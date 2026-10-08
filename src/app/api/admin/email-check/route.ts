import { NextResponse } from "next/server";

import { adminRouteDenial, opsTokenConfigured } from "@/lib/admin/api-auth";
import { listRequestsForDiagnostics } from "@/lib/db/queries/free-books";
import { deliverFreeBookRequest } from "@/lib/free-book-delivery";

/**
 * GET  /api/admin/email-check — is transactional email actually able to send?
 * POST /api/admin/email-check — deliver one queued request, and say what the
 *                               provider said about it.
 *
 * WHY THIS EXISTS
 * The queue said `fulfilled` and a mailbox stayed empty. "The provider
 * accepted it" and "the reader got it" are different claims, and nothing in
 * the product could tell them apart: the admin button reports its own opinion
 * of the send and the provider's verdict was never written down anywhere.
 *
 * So this asks the provider directly — is the sending domain verified, are
 * SPF and DKIM green, what did it do with message X — and reports the answer
 * without ever putting a key in a response. It is the same shape as
 * `storage-check` and `fulfillment-check`, for the same reason: a diagnostic
 * that runs where the credentials are is worth more than one that runs where
 * the engineer is.
 *
 * AUTH — two ways in, because the two callers are different:
 *   - a signed-in admin (`requireAdmin`, the same gate as /admin);
 *   - `Authorization: Bearer $OPS_DIAG_TOKEN`, for a shell or CI where there
 *     is no browser session to carry a Clerk cookie.
 * The token gate is off unless the token is at least 32 characters — an absent
 * or short token must never become an open door. POST additionally refuses a
 * token shorter than that even for an admin session, because a send is not a
 * read.
 *
 * WHAT IT NEVER RETURNS: the API key, the key's prefix, the bearer token, a
 * signed URL, an R2 key, or any request row's message text. Sender addresses
 * and recipient addresses appear because an operator debugging delivery has to
 * see who it was sent to.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The sender's domain, never the whole address. `hello@x.com` → `x.com`. */
function senderDomain(): string | null {
  const from = process.env.EMAIL_FROM;
  if (!from) return null;
  return from.match(/@([^>\s]+)/)?.[1] ?? null;
}

interface ResendDomain {
  name: string;
  status: string;
  region?: string;
  records?: Array<{ record: string; name: string; status: string }>;
}

/**
 * Ask Resend about the account's domains.
 *
 * Returns a shape that is safe to print: names and statuses only. A failure
 * here is reported, not thrown — the point of a diagnostic is to say what is
 * wrong, and "the diagnostic itself 500ed" says nothing.
 */
async function resendDomains(): Promise<
  { ok: true; domains: ResendDomain[] } | { ok: false; error: string; status?: number }
> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set in this environment" };
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `provider returned ${res.status}`, status: res.status };
    }
    const body = (await res.json()) as { data?: unknown };
    const rows = Array.isArray(body.data) ? body.data : [];
    return {
      ok: true,
      domains: rows.map((d) => {
        const dom = d as Record<string, unknown>;
        const records = Array.isArray(dom.records) ? dom.records : [];
        return {
          name: String(dom.name ?? "?"),
          status: String(dom.status ?? "?"),
          region: dom.region ? String(dom.region) : undefined,
          records: records.map((r) => {
            const rec = r as Record<string, unknown>;
            return {
              record: String(rec.record ?? "?"),
              name: String(rec.name ?? "?"),
              status: String(rec.status ?? "?"),
            };
          }),
        };
      }),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  }
}

/** What the provider did with one message, after it accepted it. */
async function resendMessage(id: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false as const, error: "RESEND_API_KEY is not set" };
  try {
    const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) return { ok: false as const, error: `provider returned ${res.status}`, body };
    return {
      ok: true as const,
      id: String(body?.id ?? id),
      // `last_event` is the provider's own verdict: delivered, bounced,
      // complained, delivery_delayed. This is the field the whole route
      // exists to surface.
      lastEvent: body?.last_event ? String(body.last_event) : null,
      to: body?.to ?? null,
      from: body?.from ? String(body.from) : null,
      subject: body?.subject ? String(body.subject) : null,
      createdAt: body?.created_at ? String(body.created_at) : null,
    };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "unknown error" };
  }
}

export async function GET(req: Request) {
  // Reads only (it asks the provider about its own domains and one message).
  const denied = await adminRouteDenial(req, { allowToken: true });
  if (denied) return denied;

  const url = new URL(req.url);
  const messageId = url.searchParams.get("messageId");

  return NextResponse.json({
    ok: true,
    config: {
      resendKeySet: Boolean(process.env.RESEND_API_KEY),
      emailFromSet: Boolean(process.env.EMAIL_FROM),
      senderDomain: senderDomain(),
      adminAllowlistSet: Boolean(process.env.ADMIN_EMAILS),
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    },
    domains: await resendDomains(),
    message: messageId ? await resendMessage(messageId) : null,
    queue: await listRequestsForDiagnostics(12),
  });
}

/**
 * Deliver one request.
 *
 * The same call the admin button makes, behind a bearer token instead of a
 * Clerk cookie. It is deliberately not a "send to any address" endpoint: the
 * only input is the id of a row someone already asked for, so this can never
 * mail a private master anywhere the queue does not already point.
 */
export async function POST(req: Request) {
  // A send changes the world, so a cross-site request is refused even with a
  // valid admin cookie (`sideEffects`).
  const denied = await adminRouteDenial(req, { allowToken: true, sideEffects: true });
  if (denied) return denied;

  // A send is not a read. Even an admin session cannot trigger one here
  // unless a real ops token is configured, so this route can never become a
  // second, less-guarded copy of the admin button.
  if (!opsTokenConfigured()) {
    return NextResponse.json(
      { ok: false, error: "sending is disabled unless OPS_DIAG_TOKEN is configured" },
      { status: 409 },
    );
  }

  let body: { requestId?: unknown };
  try {
    body = (await req.json()) as { requestId?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
    return NextResponse.json({ ok: false, error: "invalid-request-id" }, { status: 400 });
  }

  const result = await deliverFreeBookRequest(requestId);
  const provider = result.providerId ? await resendMessage(result.providerId) : null;

  return NextResponse.json({ ok: result.ok, result, provider });
}
