import { NextResponse, type NextRequest } from "next/server";

import { getUserId } from "@/lib/auth";
import {
  hasSeenPopup,
  recordPopupShown,
  resolvePopup,
} from "@/lib/db/contacts";
import {
  POPUP_SEEN_COOKIE,
  VISITOR_COOKIE,
  VISITOR_COOKIE_OPTIONS,
  isValidVisitorId,
  mintVisitorId,
} from "@/lib/visitor";

/**
 * /api/popup — the newsletter popup's eligibility question and its memory.
 *
 * WHY THIS IS AN ENDPOINT AND NOT A SERVER COMPONENT. Every page that can
 * show the popup is static or ISR: the homepage renders at build and
 * revalidates hourly, and every companion page is `force-static` because a
 * printed QR code has to resolve whether or not a database is reachable.
 * Reading a cookie in any of those render paths would opt the whole page out
 * of static rendering — trading the site's speed for a popup. So the page
 * ships static and asks this route, once, on the client.
 *
 * THE DECISION IS GLOBAL, NOT PER PAGE. `hasSeenPopup` looks the visitor up
 * by three identities (browser cookie, signed-in user, known contact), so
 * homepage → ten companion pages is one impression, which is the whole
 * requirement. The cookie is only a cache in front of that answer: a visitor
 * who clears it is recognised again by the table.
 *
 * GET  → { eligible: boolean, visitorId }   and sets the visitor cookie
 * POST → { action: "shown" | "dismissed" | "submitted", path? }
 *
 * The route is never cached: `force-dynamic` plus explicit no-store, because
 * an eligibility answer cached at the edge would show one visitor's decision
 * to everybody behind the same CDN node.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const POPUP = "newsletter";
const NO_STORE = { "cache-control": "no-store, private" } as const;

/** Pathname only, capped. Never a query string — this is not a URL log. */
function cleanPath(input: unknown): string | null {
  if (typeof input !== "string" || !input.startsWith("/")) return null;
  return input.split("?")[0].split("#")[0].slice(0, 200);
}

export async function GET(req: NextRequest) {
  const existing = req.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId = isValidVisitorId(existing) ? existing : mintVisitorId();

  // The client's own fast path already short-circuits on this cookie; the
  // check is repeated here so a forged "eligible" request still gets the
  // right answer.
  const seenCookie = req.cookies.get(POPUP_SEEN_COOKIE)?.value === "1";

  let seen = seenCookie;
  if (!seen) {
    try {
      const userId = await getUserId();
      seen = await hasSeenPopup({ popup: POPUP, visitorId, userId });
    } catch {
      // A database that cannot be reached must not produce a popup storm.
      // Failing to "already seen" is the safe direction: the cost of being
      // wrong is one missed signup, not a visitor shown the same modal on
      // every page of the site.
      seen = true;
    }
  }

  const res = NextResponse.json(
    { eligible: !seen, visitorId },
    { headers: NO_STORE },
  );
  if (existing !== visitorId) {
    res.cookies.set(VISITOR_COOKIE, visitorId, VISITOR_COOKIE_OPTIONS);
  }
  return res;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: NO_STORE });
  }

  const action =
    typeof body === "object" && body !== null && "action" in body
      ? String((body as { action: unknown }).action)
      : "";
  if (!["shown", "dismissed", "submitted"].includes(action)) {
    return NextResponse.json({ ok: false }, { status: 400, headers: NO_STORE });
  }

  const existing = req.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId = isValidVisitorId(existing) ? existing : mintVisitorId();
  const path = cleanPath(
    typeof body === "object" && body !== null && "path" in body
      ? (body as { path: unknown }).path
      : null,
  );

  try {
    if (action === "shown") {
      const userId = await getUserId();
      await recordPopupShown({ popup: POPUP, visitorId, userId, sourcePath: path });
    } else {
      await resolvePopup({
        popup: POPUP,
        visitorId,
        outcome: action as "dismissed" | "submitted",
      });
    }
  } catch (err) {
    // Best-effort, like the analytics sink: the visitor's experience must not
    // depend on this write succeeding. The cookie below still closes the
    // popup for this browser even when the table is unreachable.
    console.error("[api/popup] write failed:", err instanceof Error ? err.message : err);
  }

  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  if (existing !== visitorId) {
    res.cookies.set(VISITOR_COOKIE, visitorId, VISITOR_COOKIE_OPTIONS);
  }
  // Written on EVERY outcome, including a bare "shown". Someone who saw it
  // and walked away has met it; showing it to them again on the next page is
  // exactly what the once-per-person rule forbids.
  res.cookies.set(POPUP_SEEN_COOKIE, "1", VISITOR_COOKIE_OPTIONS);
  return res;
}
