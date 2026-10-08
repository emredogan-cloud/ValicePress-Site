import { NextResponse } from "next/server";
import { eq, isNotNull } from "drizzle-orm";

import { adminRouteDenial } from "@/lib/admin/api-auth";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import {
  buildWatermarkText,
  stampPdfWithWatermark,
} from "@/inngest/functions/watermark";
import { watermarkEpub } from "@/lib/epub-watermark";
import {
  ARTIFACTS_BUCKET,
  MASTERS_BUCKET,
  deleteObject,
  generateSignedDownloadUrl,
  getObject,
  putObject,
} from "@/lib/storage";

/**
 * GET /api/admin/fulfillment-check?slug=<book> — run the delivery half of a
 * purchase, on the real master, in the real production runtime, without
 * inventing a sale.
 *
 * WHAT IT PROVES
 *   master in R2 → pdf-lib stamps every page → artifact written to R2 →
 *   signed URL issued → the bytes come back through that URL and are a PDF.
 *
 * That is the whole of what a buyer receives, and every step of it runs here
 * exactly as the Inngest worker runs it — same functions, same buckets, same
 * memory ceiling, same 8 MB masters. Before this route the path had never
 * been executed in production, because it had never had a customer.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * No order row, no entitlement, no `commerce_events`, no Paddle transaction,
 * no email. A test that writes a fake order into the production ledger buys
 * a little more coverage at the price of a revenue number nobody can trust
 * afterwards. The two links this route does not exercise — the Paddle webhook
 * signature and the Inngest trigger — are covered by
 * `scripts/tmp/e2e-fulfillment.mjs`, which needs `PADDLE_WEBHOOK_SECRET` and
 * therefore an operator.
 *
 * The probe artifact is written under `diagnostics/` and deleted before the
 * response is sent, whether or not the read-back succeeded.
 *
 * Auth: signed-in admin, or `Authorization: Bearer $OPS_DIAG_TOKEN`.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  // It writes and deletes probe artifacts, so a cross-site request is refused
  // even with a valid admin cookie (`sideEffects`); the bearer token is exempt.
  const denied = await adminRouteDenial(req, { allowToken: true, sideEffects: true });
  if (denied) return denied;

  const slug = new URL(req.url).searchParams.get("slug");
  const rows = slug
    ? await db
        .select({
          slug: books.slug,
          title: books.title,
          key: books.masterFileKey,
          epubKey: books.epubFileKey,
        })
        .from(books)
        .where(eq(books.slug, slug))
    : await db
        .select({
          slug: books.slug,
          title: books.title,
          key: books.masterFileKey,
          epubKey: books.epubFileKey,
        })
        .from(books)
        .where(isNotNull(books.masterFileKey))
        .limit(1);

  const book = rows[0];
  if (!book?.key) {
    return NextResponse.json(
      { ok: false, error: slug ? `no master_file_key for ${slug}` : "no book has a master" },
      { status: 404 },
    );
  }

  const started = Date.now();
  const steps: Record<string, unknown> & { probeDeleteErrors?: string[] } = {
    slug: book.slug,
    masterKey: book.key,
    epubMasterKey: book.epubKey,
  };
  const stamp = Date.now();
  const probeKey = `diagnostics/fulfillment-check-${stamp}.pdf`;
  const epubProbeKey = `diagnostics/fulfillment-check-${stamp}.epub`;

  try {
    const master = await getObject({ bucket: MASTERS_BUCKET, key: book.key });
    steps.masterBytes = master.body.byteLength;
    steps.masterContentType = master.contentType ?? null;

    const t0 = Date.now();
    const stamped = await stampPdfWithWatermark(
      master.body,
      buildWatermarkText({ buyerName: "storage diagnostic", orderId: "diagnostic-probe" }),
      { bookId: book.slug, orderId: "diagnostic-probe" },
    );
    steps.watermarkMs = Date.now() - t0;
    steps.watermarkedBytes = stamped.byteLength;

    await putObject({
      bucket: ARTIFACTS_BUCKET,
      key: probeKey,
      body: Buffer.from(stamped),
      contentType: "application/pdf",
      cacheControl: "private, max-age=0, no-store",
    });
    steps.artifactWritten = true;

    // The customer never touches the bucket; they get a short-lived signed
    // URL. Fetching it here is the only way to know that URL actually works
    // from outside the function.
    const url = await generateSignedDownloadUrl({
      bucket: ARTIFACTS_BUCKET,
      key: probeKey,
      ttlSeconds: 120,
    });
    const res = await fetch(url);
    const bytes = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    steps.signedUrlStatus = res.status;
    steps.signedUrlContentType = res.headers.get("content-type");
    steps.downloadedBytes = bytes?.byteLength ?? 0;
    steps.isPdf = bytes ? bytes.subarray(0, 5).toString("latin1") === "%PDF-" : false;
    steps.bytesMatch = bytes ? bytes.byteLength === stamped.byteLength : false;
    // The second artifact, when the edition has one. Same shape: read the
    // master, stamp it, write it, fetch it back through a signed URL — and
    // confirm the bytes are still a zip whose first entry is `mimetype`,
    // because a re-zip that loses that ordering produces a file every reading
    // system rejects and no unit test on our own fixture would catch.
    if (book.epubKey) {
      const epubMaster = await getObject({ bucket: MASTERS_BUCKET, key: book.epubKey });
      steps.epubMasterBytes = epubMaster.body.byteLength;
      const t1 = Date.now();
      const stampedEpub = watermarkEpub(epubMaster.body, {
        buyerName: "storage diagnostic",
        orderId: "diagnostic-probe",
        bookId: book.slug,
        bookTitle: book.title,
      });
      steps.epubWatermarkMs = Date.now() - t1;
      steps.epubWatermarkedBytes = stampedEpub.byteLength;

      await putObject({
        bucket: ARTIFACTS_BUCKET,
        key: epubProbeKey,
        body: Buffer.from(stampedEpub),
        contentType: "application/epub+zip",
        cacheControl: "private, max-age=0, no-store",
      });
      const epubUrl = await generateSignedDownloadUrl({
        bucket: ARTIFACTS_BUCKET,
        key: epubProbeKey,
        ttlSeconds: 120,
      });
      const epubRes = await fetch(epubUrl);
      const epubBytes = epubRes.ok ? Buffer.from(await epubRes.arrayBuffer()) : null;
      steps.epubSignedUrlStatus = epubRes.status;
      steps.epubDownloadedBytes = epubBytes?.byteLength ?? 0;
      steps.epubIsZip = epubBytes
        ? epubBytes.subarray(0, 2).toString("latin1") === "PK"
        : false;
      steps.epubMimetypeFirst = epubBytes
        ? epubBytes.subarray(30, 38).toString("latin1") === "mimetype"
        : false;
      steps.epubBytesMatch = epubBytes
        ? epubBytes.byteLength === stampedEpub.byteLength
        : false;
    } else {
      steps.epub = "this edition has no EPUB master";
    }
  } catch (err) {
    steps.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  } finally {
    for (const key of [probeKey, epubProbeKey]) {
      try {
        await deleteObject({ bucket: ARTIFACTS_BUCKET, key });
      } catch {
        // A probe left behind under diagnostics/ is untidy, not dangerous.
        (steps.probeDeleteErrors ??= []).push(key);
      }
    }
    steps.probesDeleted = !steps.probeDeleteErrors;
  }

  return NextResponse.json({
    ok: Boolean(
      steps.isPdf &&
        steps.bytesMatch &&
        !steps.error &&
        (!book.epubKey || (steps.epubIsZip && steps.epubMimetypeFirst && steps.epubBytesMatch)),
    ),
    checkedAt: new Date().toISOString(),
    totalMs: Date.now() - started,
    note: "Delivery path only. No order, entitlement or transaction was created.",
    ...steps,
  });
}
