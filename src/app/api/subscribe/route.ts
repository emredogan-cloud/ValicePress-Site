import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/subscribe — add a reader to the MailerLite group that receives
 * the Larkspur Lake bonus, then let the page hand them the bonus itself.
 *
 * WHY THIS IS NOT `/api/newsletter`
 * The site already subscribes readers through Resend Audiences, and that
 * route's own comments explain the choice: "reusing the same SDK + secret
 * avoids a second vendor." This endpoint is a deliberate exception, added
 * because the bonus funnel was specified against MailerLite. It is scoped to
 * that one funnel and shares no state with the Resend list. If the two lists
 * are ever meant to be one list, this is the file to delete — not the other.
 *
 * TWO OUTCOMES, DELIBERATELY SEPARATE
 *   - `ok`        — did the MailerLite subscription succeed?
 *   - `deliver`   — may the browser proceed to the bonus?
 * They are not the same question. A reader who typed a real address has
 * earned the bonus even if our mailing-list vendor is having an afternoon.
 * So a recoverable upstream failure returns `ok: false, deliver: true`: the
 * page opens the bonus, the server records the failure, and nobody is told
 * they were subscribed when they were not.
 *
 * ABUSE CONTROL
 * Per-IP burst limiting already runs at the edge — `src/proxy.ts` matches
 * `/(api|trpc)(.*)`, which includes this route — so there is no second
 * limiter here. What this adds is a honeypot and a hard payload cap.
 *
 * Responses
 *   200 { ok: true,  deliver: true,  status: "subscribed" }
 *   200 { ok: false, deliver: true,  error: "list-unavailable" }   upstream fault
 *   400 { ok: false, deliver: false, error: "invalid-email" | "invalid-request" }
 *   413 { ok: false, deliver: false, error: "payload-too-large" }
 *   503 { ok: false, deliver: false, error: "not-configured" }
 */

// RFC 5321 maximum. Matches `api/newsletter/route.ts` so the two endpoints
// cannot disagree about what counts as an address.
const MAX_EMAIL_LENGTH = 254;

// Generous ceiling for `{ email, website }` — rejects accidental or hostile
// megabyte bodies before we parse them.
const MAX_BODY_BYTES = 2_048;

// Same pragmatic check as the newsletter route. No regex is RFC-perfect; this
// rejects obvious garbage and lets MailerLite be the real authority.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAILERLITE_ENDPOINT = "https://connect.mailerlite.com/api/subscribers";

/** Upstream classification, for logs only. Never reaches the browser. */
type UpstreamOutcome =
  | "subscribed"
  | "rejected-by-provider"
  | "auth-failure"
  | "rate-limited"
  | "provider-error"
  | "network-error";

function json(
  body: Record<string, unknown>,
  status: number,
  headers?: HeadersInit,
) {
  return NextResponse.json(body, { status, headers });
}

/**
 * One sanitised line per failure. No token, no headers, no response body, and
 * no full address — a domain is enough to tell "our config is wrong" from
 * "this reader mistyped", which is the only question logs need to answer.
 */
function logFailure(outcome: UpstreamOutcome, email: string, detail?: string) {
  const domain = email.slice(email.lastIndexOf("@") + 1) || "unknown";
  console.error(
    `[subscribe] ${outcome} domain=${domain}${detail ? ` detail=${detail}` : ""}`,
  );
}

export async function POST(req: NextRequest) {
  // ---- payload cap ---------------------------------------------------
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return json({ ok: false, deliver: false, error: "payload-too-large" }, 413);
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, deliver: false, error: "payload-too-large" }, 413);
  }

  // ---- parse ---------------------------------------------------------
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ ok: false, deliver: false, error: "invalid-request" }, 400);
  }
  if (typeof parsed !== "object" || parsed === null) {
    return json({ ok: false, deliver: false, error: "invalid-request" }, 400);
  }
  const body = parsed as Record<string, unknown>;

  // ---- honeypot ------------------------------------------------------
  // A field no sighted or assistive user ever reaches. Anything in it is a
  // bot. Answer 200 so the crawler learns nothing, and go no further.
  const honeypot = body.website;
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return json({ ok: true, deliver: false, status: "subscribed" }, 200);
  }

  // ---- email ---------------------------------------------------------
  const rawEmail = body.email;
  if (typeof rawEmail !== "string") {
    return json({ ok: false, deliver: false, error: "invalid-email" }, 400);
  }
  // Trim only. Lowercasing the local part would be wrong (it is technically
  // case-sensitive) and stripping dots or +tags would mutate a valid address
  // into somebody else's.
  const email = rawEmail.trim();
  if (
    email.length === 0 ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_RE.test(email)
  ) {
    return json({ ok: false, deliver: false, error: "invalid-email" }, 400);
  }

  // ---- configuration -------------------------------------------------
  const token = process.env.MAILERLITE_API_TOKEN;
  const groupId = process.env.MAILERLITE_GROUP_ID;
  if (!token || !groupId) {
    // A misconfigured server is our fault, not the reader's — but we must not
    // pretend to subscribe, and we must not name the missing variable to the
    // browser. 503 tells the page to show a real error.
    logFailure("auth-failure", email, "missing-configuration");
    return json({ ok: false, deliver: false, error: "not-configured" }, 503);
  }

  // ---- upstream ------------------------------------------------------
  let res: Response;
  try {
    res = await fetch(MAILERLITE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      // MailerLite's subscribers endpoint creates or updates on the same call,
      // and takes groups as an array of ids.
      body: JSON.stringify({ email, groups: [groupId] }),
      cache: "no-store",
    });
  } catch {
    // Network fault. The reader did nothing wrong — hand over the bonus.
    logFailure("network-error", email);
    return json({ ok: false, deliver: true, error: "list-unavailable" }, 200);
  }

  if (res.ok) {
    return json({ ok: true, deliver: true, status: "subscribed" }, 200);
  }

  // 422 is MailerLite's "this address is not acceptable" — the one upstream
  // failure that is genuinely about the input, so the reader is told.
  if (res.status === 400 || res.status === 422) {
    logFailure("rejected-by-provider", email, String(res.status));
    return json({ ok: false, deliver: false, error: "invalid-email" }, 400);
  }

  if (res.status === 401 || res.status === 403) {
    logFailure("auth-failure", email, String(res.status));
    return json({ ok: false, deliver: false, error: "not-configured" }, 503);
  }

  if (res.status === 429) {
    // Our bucket is full, not the reader's problem. Pass Retry-After through
    // for anything upstream of us that respects it, and still deliver.
    const retryAfter = res.headers.get("retry-after");
    logFailure("rate-limited", email, retryAfter ?? undefined);
    return json(
      { ok: false, deliver: true, error: "list-unavailable" },
      200,
      retryAfter ? { "Retry-After": retryAfter } : undefined,
    );
  }

  logFailure("provider-error", email, String(res.status));
  return json({ ok: false, deliver: true, error: "list-unavailable" }, 200);
}
