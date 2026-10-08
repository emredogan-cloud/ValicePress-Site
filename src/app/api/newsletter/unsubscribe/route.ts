import { NextResponse } from "next/server";
import { Resend } from "resend";

import { recordUnsubscribe } from "@/lib/db/contacts";
import { normalizeEmail, verifyUnsubscribeToken } from "@/lib/unsubscribe";

/**
 * Unsubscribe from the Valice Press audience.
 *
 * POST is the one-click endpoint named by `List-Unsubscribe-Post`
 * (RFC 8058): Gmail and Yahoo POST here directly from their own UI, with no
 * browser session and no confirmation page. It must therefore work on a bare
 * POST carrying only the signed link's query parameters, and must be safe to
 * call twice — mail clients retry.
 *
 * GET is not offered: a link prefetcher that followed a GET would silently
 * unsubscribe the reader. The human path is the /unsubscribe page, which
 * shows a button and posts here.
 */

export const dynamic = "force-dynamic";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  let email = url.searchParams.get("e") ?? "";
  let token = url.searchParams.get("t") ?? "";

  // Mail clients POST with an empty body and the parameters in the URL;
  // our own page posts JSON. Accept both.
  if (!email || !token) {
    const body = await req.json().catch(() => null);
    if (body && typeof body === "object") {
      email = String((body as Record<string, unknown>).email ?? email);
      token = String((body as Record<string, unknown>).token ?? token);
    }
  }

  email = normalizeEmail(email);
  if (!email || !verifyUnsubscribeToken(email, token)) {
    return NextResponse.json({ ok: false, error: "invalid-link" }, { status: 400 });
  }

  // Record the suppression in the press's own contact book FIRST, whatever the
  // provider says next. This route used to talk only to Resend, so the admin's
  // "suppressed" and "mailable" figures never moved when somebody unsubscribed.
  // A failure here is logged and does not change the answer: the provider is
  // what actually stops a broadcast, and the person is told what the provider did.
  try {
    await recordUnsubscribe(email);
  } catch (err) {
    console.error("[api/newsletter/unsubscribe] could not record the suppression locally:", err instanceof Error ? err.message : err);
  }

  const audienceId = process.env.RESEND_AUDIENCE_ID;
  const resend = getResend();
  if (!resend || !audienceId) {
    // Never tell someone "you are unsubscribed" when nothing was written.
    return NextResponse.json(
      { ok: false, error: "provider-unavailable" },
      { status: 503 },
    );
  }

  try {
    const result = await resend.contacts.update({
      audienceId,
      email,
      unsubscribed: true,
    });
    if (result.error) {
      // A contact that is not in the audience is already "unsubscribed" as
      // far as the person is concerned; saying so is honest and stops a
      // retry loop in the mail client.
      const message = String(result.error.message ?? "");
      if (/not found/i.test(message)) {
        return NextResponse.json({ ok: true, status: "not-subscribed" });
      }
      console.error("[api/newsletter/unsubscribe] Resend refused:", message);
      return NextResponse.json({ ok: false, error: "provider-error" }, { status: 502 });
    }
  } catch (err) {
    console.error("[api/newsletter/unsubscribe] threw:", err);
    return NextResponse.json({ ok: false, error: "internal-error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "unsubscribed" });
}
