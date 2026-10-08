import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { analyticsEvents } from "@/lib/db/schema";
import { validateEventPayload } from "@/lib/event-payload";
import { isInternalRequest } from "@/lib/internal-traffic";

/**
 * POST /api/events — first-party funnel event sink.
 *
 * Why it exists: Vercel Web Analytics custom events are dropped on the Hobby
 * plan, so `trackEvent` also beacons here. This route is the only place the
 * events are actually recorded.
 *
 * Contract, enforced not advised:
 *   - `event` must be one of ANALYTICS_EVENTS; anything else is dropped.
 *   - `props` is an object of at most 12 keys, each a string (≤ 120 chars),
 *     number, boolean or null; keys that look like PII (`email`, `name`,
 *     `address`, `phone`, `query`, `q`, `search`) are refused outright.
 *   - `path` is a pathname (no query string, ≤ 200 chars) or nothing.
 *   - The referrer HOST is taken from the Referer header; never the URL.
 *   - Body over 2 KB → 413. Bad body → 204 anyway: a beacon is fire-and-
 *     forget and the page must never see an error from analytics.
 *
 * The response is always 204 unless the payload is oversize; a database
 * failure is logged and swallowed for the same reason.
 */

const MAX_BODY_BYTES = 2048;
function referrerHost(req: NextRequest): string | null {
  const ref = req.headers.get("referer");
  if (!ref) return null;
  try {
    return new URL(ref).host.slice(0, 120);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // Internal traffic is acknowledged and discarded. The Founder checking the
  // storefront is not a customer, and neither is a verification script.
  if (isInternalRequest(req.headers)) return new NextResponse(null, { status: 204 });
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const v = validateEventPayload(raw);
  if (!v.ok) return new NextResponse(null, { status: 204 });

  try {
    await db.insert(analyticsEvents).values({
      event: v.event,
      props: v.props,
      path: v.path,
      referrerHost: referrerHost(req),
      bookSlug: v.bookSlug,
      source: "client",
    });
  } catch (err) {
    console.error(
      "[api/events] insert failed:",
      err instanceof Error ? err.message : err,
    );
  }
  return new NextResponse(null, { status: 204 });
}
