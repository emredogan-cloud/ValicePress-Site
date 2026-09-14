import type { NextRequest } from "next/server";

import { recordReaderAccess } from "@/lib/db/queries/reader-audit";
import { logger } from "@/lib/logger";
import { openReaderGate } from "@/lib/reader-access";
import { denialIdentifier, registerReaderDenial } from "@/lib/reader-throttle";
import { ARTIFACTS_BUCKET, streamObject } from "@/lib/storage";

/** S3 body streaming and a Drizzle read — Node runtime, never the edge. */
export const runtime = "nodejs";
/** Per-user, per-request, and never cacheable. See the `Cache-Control` note. */
export const dynamic = "force-dynamic";
/** A 400-page master is tens of megabytes; a cold range read can be slow. */
export const maxDuration = 60;

/**
 * GET /api/read/<bookId>/content — the ONLY way a purchased book's bytes reach
 * a browser (Directive §10, §11).
 *
 * WHAT THIS REPLACED, AND WHY
 * ---------------------------
 * The reader used to mint a ten-minute presigned R2 URL server-side and hand it
 * to the client, where pdf.js fetched it directly. That is a defensible pattern
 * and the directive explicitly permits signed URLs as an internal mechanism
 * (§75) — but it put a bearer credential for the complete book into the page's
 * HTML. Anything that can read the document can read that URL: a browser
 * extension, a shared screenshot, a support session, `view-source`, the
 * clipboard. For ten minutes it granted the whole file to whoever held it,
 * with no session and no entitlement.
 *
 * Now the URL in the page is `/api/read/<bookId>/content`. It is not a
 * credential. Copy it, paste it into another browser, send it to a friend:
 * without that account's session cookie it is a 404. This is §13's sharing
 * model made literal — the access identity is the authenticated user, never
 * the URL — and it is why the reader route can be a permanent bookmark (§74)
 * without ever becoming a permanent grant.
 *
 * The signed URL still exists. It is minted between this function and R2, on
 * the server, and no longer crosses the network boundary to the client.
 *
 * WHAT IT REFUSES, AND HOW
 * ------------------------
 * Every refusal is the same bare 404 with an empty body (§37): a non-uuid, an
 * unauthenticated request, a real book this account does not own, a book it
 * owns whose watermark has not finished, and a book that does not exist are
 * all indistinguishable from outside. There is nothing here to enumerate with.
 *
 * RANGE REQUESTS ARE THE POINT
 * ----------------------------
 * pdf.js asks for the file's tail, reads the cross-reference table, and then
 * fetches only the objects for the pages actually on screen. Passing `Range`
 * through to R2 and returning its 206 verbatim is what makes a 435-page book
 * open in the time it takes to read forty kilobytes (§48, §49). Removing the
 * passthrough would not break the reader; it would silently turn every page
 * turn into a full-file download.
 */

/** The bytes are one person's watermarked copy. Nothing may hold them. */
const PRIVATE_HEADERS: Record<string, string> = {
  // `private` keeps it out of any shared CDN; `no-store` keeps it out of the
  // browser's disk cache, so §80 and §81 hold — a later visitor on the same
  // machine, or the back button after a sign-out, has nothing to restore.
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  // Belt and braces for intermediaries that still honour the HTTP/1.0 header.
  Pragma: "no-cache",
  // The response varies by session. Says so explicitly, so no proxy is tempted
  // to treat two users' requests for the same path as the same object.
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
  // The reader draws pages onto a canvas; the browser must never decide to
  // navigate to this as a document or frame it.
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

/** Identical for every refusal — see §37. Empty body, nothing to read. */
function deny(extraHeaders?: Record<string, string>): Response {
  return new Response(null, {
    status: 404,
    headers: { ...PRIVATE_HEADERS, ...extraHeaders },
  });
}

/**
 * Only a syntactically valid single or multi-range header is forwarded.
 *
 * R2 would reject a malformed one anyway, but a header we do not understand is
 * not a header we should relay to storage on a caller's behalf.
 */
const RANGE_RE = /^bytes=\d*-\d*(,\s*\d*-\d*)*$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId: bookRef } = await params;

  const gate = await openReaderGate(bookRef ?? "");

  if (!gate.ok) {
    // Count the refusal before answering. A customer waiting on a watermark
    // trips this once; an account walking the catalogue trips it ten times a
    // minute and is then told to wait — while still being told nothing about
    // which of its guesses were real books.
    const identifier = denialIdentifier(gate.userId, request.headers);
    const { throttled, retryAfterSeconds } =
      await registerReaderDenial(identifier);

    await recordReaderAccess({
      outcome: gate.outcome,
      userId: gate.userId,
      bookRef,
      detail: throttled ? "asset; throttled" : "asset",
    });

    // 429 is the one place a refusal changes shape, and it still says nothing
    // about the book: the client learns it is asking too often, not what it
    // was asking for.
    return throttled
      ? new Response(null, {
          status: 429,
          headers: {
            ...PRIVATE_HEADERS,
            "Retry-After": String(retryAfterSeconds),
          },
        })
      : deny();
  }

  const rawRange = request.headers.get("range");
  const range = rawRange && RANGE_RE.test(rawRange) ? rawRange : undefined;

  try {
    const object = await streamObject({
      bucket: ARTIFACTS_BUCKET,
      key: gate.access.artifactKey,
      range,
    });

    const headers = new Headers(PRIVATE_HEADERS);
    // Fixed, from our own knowledge of what we watermarked — never echoed from
    // the storage response, so a mistyped object's content type cannot become
    // something the browser is willing to execute.
    headers.set("Content-Type", "application/pdf");
    // `inline` and a generic filename: the reader displays this, and the name
    // must not leak the slug, the order or the storage key.
    headers.set("Content-Disposition", 'inline; filename="edition.pdf"');
    headers.set("Accept-Ranges", "bytes");
    if (object.contentLength !== undefined) {
      headers.set("Content-Length", String(object.contentLength));
    }
    if (object.contentRange) {
      headers.set("Content-Range", object.contentRange);
    }

    return new Response(object.body, {
      status: object.status,
      headers,
    });
  } catch (err) {
    // The entitlement is good but the artifact is not readable — a genuine
    // operational fault, and the one case worth a loud log. The customer still
    // learns nothing about storage.
    logger.error("[reader-asset] stream failed", err, { bookId: gate.bookId });
    await recordReaderAccess({
      outcome: "asset_unavailable",
      userId: gate.userId,
      bookRef: gate.bookId,
      detail: err instanceof Error ? err.name : "unknown",
    });
    return new Response(null, { status: 502, headers: PRIVATE_HEADERS });
  }
}
