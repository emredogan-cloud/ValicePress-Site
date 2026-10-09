import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { AdminAccessError, requireAdmin } from "@/lib/auth";

/**
 * Who may call an `/api/admin/*` route, or any admin route handler.
 *
 * `tokenAccepted` was copy-pasted into four route files, each with its own
 * `try { requireAdmin } catch { 403 }`, and they had begun to differ. One copy
 * now, tested.
 *
 * TWO WAYS IN, because the two callers are different:
 *   - a signed-in admin (`requireAdmin` — the same gate as the pages);
 *   - `Authorization: Bearer $OPS_DIAG_TOKEN`, for an operator's shell or CI,
 *     where there is no browser session to carry a cookie. Only when the route
 *     opts in (`allowToken`), and only when the token is at least 32 characters:
 *     an absent or short token must never become an open door.
 *
 * ONE MORE REFUSAL, for routes that DO something (`sideEffects`): a request the
 * browser itself marks `Sec-Fetch-Site: cross-site` is refused even with a valid
 * admin cookie. Cookies are sent on a top-level cross-site GET, so without this a
 * page on any other site could make an admin's browser fire a probe that writes
 * and deletes objects in storage, or sends a Sentry event, just by linking to it.
 * A bearer token is never sent by the browser on its own, so the token path is
 * exempt. (Same-origin and typed-in requests are `same-origin` / `none`.)
 */

const MIN_TOKEN_LENGTH = 32;

/** Is an ops token configured at all, and long enough to count? */
export function opsTokenConfigured(expected: string | undefined = process.env.OPS_DIAG_TOKEN): boolean {
  return Boolean(expected && expected.length >= MIN_TOKEN_LENGTH);
}

export function tokenAccepted(req: Request, expected: string | undefined = process.env.OPS_DIAG_TOKEN): boolean {
  if (!expected || !opsTokenConfigured(expected)) return false;
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

export function isCrossSiteRequest(req: Request): boolean {
  return req.headers.get("sec-fetch-site") === "cross-site";
}

const NO_STORE = { "Cache-Control": "no-store" };
const refuse = (status: 401 | 403 | 503, error: string) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

/**
 * `null` when the caller may proceed, otherwise the response to return as-is.
 * Never throws: an unexpected failure of the gate itself is a 503, not a 500
 * with a stack in it.
 */
export async function adminRouteDenial(
  req: Request,
  opts: { allowToken?: boolean; sideEffects?: boolean } = {},
): Promise<NextResponse | null> {
  if (opts.allowToken && tokenAccepted(req)) return null;
  if (opts.sideEffects && isCrossSiteRequest(req)) return refuse(403, "forbidden");
  try {
    await requireAdmin();
    return null;
  } catch (err) {
    if (err instanceof AdminAccessError) return refuse(err.kind === "not_signed_in" ? 401 : 403, err.kind === "not_signed_in" ? "unauthorized" : "forbidden");
    console.error("[admin] route gate failed:", err instanceof Error ? err.name : "unknown error");
    return refuse(503, "unavailable");
  }
}
