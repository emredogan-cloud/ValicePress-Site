import { NextResponse, after } from "next/server";
import { Resend } from "resend";

import { checkEmail, recordOptIn } from "@/lib/db/contacts";
import { sendWelcomeEmail } from "@/lib/email";
import type { NewsletterSource } from "@/lib/newsletter-client";

/**
 * POST /api/newsletter — subscribe an email to the Valice Press audience.
 *
 * Phase 0.C — one shared endpoint for all 3 cinematic newsletter forms:
 *   - `home/newsletter-section.tsx` (homepage)
 *   - `article/author-newsletter-strip.tsx` (blog detail)
 *   - `category/category-sidebar.tsx` (blog category sidebar)
 *
 * All three previously called `setStatus("ok")` locally and faked a
 * "Thanks — you'll hear from us soon" message with no real subscription.
 * After Phase 2.A wires the forms to this route, that lie ends.
 *
 * Architecture:
 *   - Rate limiting is applied at the edge by `src/proxy.ts` (the
 *     `/(api|trpc)(.*)` matcher), so this handler does not need to call
 *     `checkRateLimit` itself.
 *   - Provider: Resend Audiences (already in `package.json` for transactional
 *     mail; reusing the same SDK + secret avoids a second vendor). If the
 *     env keys (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`) are missing the
 *     route returns 503 so the form surfaces a real error rather than a
 *     fake success.
 *   - Idempotent: Resend's `contacts.create` returns the same contact id
 *     if the email already exists in the audience, so re-submission is a
 *     no-op from the user's perspective.
 *
 * Body shape:
 *   { "email": "you@example.com", "source"?: "home" | "article" |
 *     "category" | "codex-verify" }
 *
 * `source` is optional and advisory: an unknown value is dropped rather
 * than rejected, because a mistyped tag must never cost someone their
 * subscription.
 *
 * Responses:
 *   200 { ok: true, status: "subscribed" | "already-subscribed" }
 *   400 { ok: false, error: "invalid-email" }
 *   503 { ok: false, error: "provider-unavailable" }
 *   500 { ok: false, error: "internal-error" }
 *
 * Rate limit 429 responses are emitted by the middleware before this
 * handler runs.
 */

// Defensive cap to keep a single submission bounded — way longer than any
// real email but rejects accidental megabyte payloads early.
const MAX_EMAIL_LENGTH = 254; // RFC 5321 maximum

// Pragmatic email check — not RFC-perfect (no regex can be), but tight enough
// to reject obvious garbage at the edge. The real validation is at Resend.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Which form produced this subscription.
 *
 * ONE audience, tagged by origin — not one audience per form. Splitting
 * the list is how a person ends up on three lists, unsubscribing from
 * one, and still hearing from you: technically compliant, actually
 * ignoring them.
 *
 * The allow-list is closed on purpose. `source` arrives from the browser
 * and is therefore untrusted input; echoing an arbitrary string into a
 * stored contact property would let a caller write whatever they like
 * into the audience record. Anything not on this list is dropped —
 * silently, because a bad tag is not the subscriber's problem and must
 * not cost them their subscription.
 */
const SOURCES = new Set([
  "popup",
  "home",
  "article",
  "category",
  "codex-verify",
  "hangul-companion",
  "world-games-companion",
  "dudeney-companion",
  // Added 2026-09-04. The four below were declared in
  // CompanionNewsletterSource during Phase 4 but never added to this runtime
  // set, so a signup from those four companion pages was rejected with
  // "invalid-source" while the page showed a working form. Found while
  // registering the Epictetus companion; fixed here rather than left next to
  // a working sibling.
  "world-myths-companion",
  "codex-bestiarium-companion",
  "codex-mythologica-companion",
  "myth-hunters-companion",
  "epictetus-companion",
  "seneca-companion",
  "greek-companion",
  "china-gods-companion",
  "vedic-gods-companion",
  "the-dragon-companion",
  "games-ancient-and-oriental-companion",
  "korean-games-companion",
  "chess-and-playing-cards-companion",
  "mancala-companion",
  "traditional-games-companion",
  // The temporary free-ebook promotion (2026-09-10).
  "free-ebook-campaign",
]);

/**
 * The consent sentence, stored verbatim on every subscriber record.
 *
 * This must stay in sync with the wording shown next to the signup forms.
 * When the form copy changes, change it here too and leave the old value
 * on existing records — a consent record describes what someone agreed to
 * at the time, not what the current form says.
 */
const CONSENT_TEXT =
  "I agree to receive occasional email from Valice Press about new books and editions. I can unsubscribe at any time.";

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

function providerUnavailable() {
  return NextResponse.json(
    { ok: false, error: "provider-unavailable" },
    { status: 503 },
  );
}

export async function POST(req: Request) {
  // ---- 1. Parse + validate body ------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid-json");
  }

  const email =
    typeof body === "object" && body !== null && "email" in body
      ? String((body as { email: unknown }).email ?? "").trim().toLowerCase()
      : "";

  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
    return badRequest("invalid-email");
  }

  // A throwaway address is a different failure from a malformed one, and the
  // person deserves to be told which. `checkEmail` is the same normalizer the
  // contact book uses, so the two can never disagree about what an address is.
  const verdict = checkEmail(email);
  if (!verdict.ok) {
    return badRequest(verdict.reason === "disposable" ? "disposable-email" : "invalid-email");
  }

  const rawSource =
    typeof body === "object" && body !== null && "source" in body
      ? String((body as { source: unknown }).source ?? "")
      : "";
  const source = SOURCES.has(rawSource) ? rawSource : "";

  // ---- 2. Resolve provider ----------------------------------------------
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) {
    // Single warn per missing-env state — useful in dev logs, not spammed
    // because each invocation is a separate edge worker.
    console.warn(
      "[api/newsletter] RESEND_API_KEY or RESEND_AUDIENCE_ID not set — " +
        "responding 503 so the form surfaces a real error.",
    );
    return providerUnavailable();
  }

  // ---- 3. Subscribe via Resend ------------------------------------------
  const resend = new Resend(apiKey);
  try {
    let consentRecorded = true;
    let result = await resend.contacts.create({
      audienceId,
      email,
      unsubscribed: false,
      // Custom properties are what make ONE list segmentable. Recording
      // the origin at subscribe time is the only moment it is knowable —
      // reconstructing it later is guesswork, and guesswork about why
      // someone consented is exactly what a consent record must not be.
      //
      // Deliberately NOT recorded: IP address, user agent, country. None
      // is needed to honour this consent, and collecting personal data
      // because it happens to be in the request is how a mailing list
      // becomes a surveillance record.
      properties: {
        ...(source ? { source } : {}),
        // The consent record. `signup_purpose` is the machine-readable
        // scope; `consent_text` stores, verbatim, the sentence the person
        // actually agreed to. Storing only a code means that if the form
        // wording changes later, nobody can reconstruct what any given
        // subscriber consented to — which is exactly the question a
        // consent record exists to answer.
        signup_purpose: "product-updates",
        consent_text: CONSENT_TEXT,
        consent_at: new Date().toISOString(),
      },
    });

    // Custom properties must be DECLARED on the audience in the Resend
    // dashboard before a contact may carry them; Resend rejects the whole
    // create with `422 "One or more properties do not exist"` otherwise, and
    // there is no API to declare them. That is a configuration gap, and the
    // person who just typed their address into a form must not pay for it —
    // so retry without the metadata and keep the subscription.
    //
    // The consent record is the thing being lost, which is not nothing. It
    // is logged at error level rather than warn for exactly that reason, and
    // the fix is one visit to Audience → Properties.
    if (
      result.error &&
      result.error.name === "validation_error" &&
      /propert/i.test(result.error.message ?? "")
    ) {
      console.error(
        "[api/newsletter] Resend rejected the consent properties — subscribing " +
          "WITHOUT a consent record. Declare source, signup_purpose, " +
          "consent_text and consent_at under Audience → Properties in Resend. " +
          `Resend said: ${result.error.message}`,
      );
      consentRecorded = false;
      result = await resend.contacts.create({
        audienceId,
        email,
        unsubscribed: false,
      });
    }

    // Resend returns `{ data, error }` — `error` is set on validation /
    // auth failures. A duplicate contact is NOT an error in the v6 SDK
    // (the API is idempotent), so we treat the success path uniformly.
    if (result.error) {
      // Only tell someone their address is invalid when it actually is.
      // This used to map EVERY `validation_error` to `invalid-email`, so a
      // misconfigured audience made the form reject perfectly good addresses
      // and blame the person typing them — which is both wrong and the
      // hardest kind of bug to report, because the user assumes it is them.
      const message = result.error.message ?? "";
      if (
        result.error.name === "validation_error" &&
        /email/i.test(message) &&
        !/propert/i.test(message)
      ) {
        return badRequest("invalid-email");
      }
      console.error("[api/newsletter] resend error:", result.error);
      return NextResponse.json(
        { ok: false, error: "internal-error" },
        { status: 500 },
      );
    }

    // ---- 4. The contact book -------------------------------------------
    //
    // Resend holds the mailing list; this holds the RELATIONSHIP — including
    // the people Resend will never know about, like an outreach contact who
    // never subscribed. Writing it here, on the one path where a person
    // actually agreed to something, is what makes `opted_in` mean what it
    // says: the evidence (which form, which page, what time) is recorded in
    // the same breath as the decision.
    //
    // Off the response path on purpose, like the welcome mail: a contact-book
    // failure must not turn a real subscription into an error message.
    const consentPath =
      typeof body === "object" && body !== null && "consentPath" in body
        ? String((body as { consentPath: unknown }).consentPath ?? "")
        : "";
    const cleanConsentPath =
      consentPath.startsWith("/") ? consentPath.split("?")[0].slice(0, 120) : "";

    after(async () => {
      try {
        await recordOptIn({
          email: verdict.email,
          source: "newsletter",
          sourceDetail: source || null,
          consentSource: `${source || "form"}${cleanConsentPath ? `:${cleanConsentPath}` : ""} — "${CONSENT_TEXT}"`,
        });
      } catch (err) {
        console.error(
          "[api/newsletter] contact record failed:",
          err instanceof Error ? err.message : err,
        );
      }
    });

    // Welcome email — after the response, but NOT merely fire-and-forget.
    //
    // A bare `void promise` here does not survive: the handler returns, the
    // serverless instance is frozen, and the pending send is discarded. That
    // is exactly what was happening — signups succeeded, no welcome email was
    // ever delivered, and nothing logged a failure because the promise never
    // settled at all. `after()` registers the work with the runtime, which
    // keeps the invocation alive until it finishes.
    //
    // Still off the response path on purpose: a failed send must not turn a
    // successful subscription into an error, because the person IS on the
    // list either way and telling them otherwise would be false.
    after(async () => {
      const r = await sendWelcomeEmail({
        to: email,
        source: (source || null) as NewsletterSource | null,
      });
      if (!r.ok) console.error("[api/newsletter] welcome email failed:", r.error);
    });

    // `consentRecorded` is reported so an operator can see, from the
    // response alone, whether the consent metadata actually landed. The
    // subscriber's experience is identical either way.
    return NextResponse.json({ ok: true, status: "subscribed", consentRecorded });
  } catch (err) {
    // Network / SDK-internal throw (rare for Resend; most are returned in
    // `result.error`). Log + 500.
    console.error("[api/newsletter] unexpected throw:", err);
    return NextResponse.json(
      { ok: false, error: "internal-error" },
      { status: 500 },
    );
  }
}

// Reject GET / PUT / DELETE explicitly — keeps the surface tight and
// makes accidental browser fetches return a clear 405 rather than a
// confusing 500 from "undefined export."
export function GET() {
  return NextResponse.json(
    { ok: false, error: "method-not-allowed" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
