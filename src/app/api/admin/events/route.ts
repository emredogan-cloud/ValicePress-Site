import { NextResponse } from "next/server";
import { desc, gte, sql } from "drizzle-orm";

import { adminRouteDenial } from "@/lib/admin/api-auth";
import { db } from "@/lib/db";
import { analyticsEvents } from "@/lib/db/schema";

/**
 * GET /api/admin/events?days=30 — the smallest read of the first-party
 * funnel that answers "is anything happening": counts per event per day
 * for the window, plus the last 50 raw rows (which carry no PII by
 * construction — see the table comment in the schema).
 *
 * Admin only (`requireAdmin`, same gate as /admin).
 */
export async function GET(req: Request) {
  const denied = await adminRouteDenial(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? "30") || 30));
  const since = new Date(Date.now() - days * 86_400_000);

  const perDay = await db
    .select({
      day: sql<string>`to_char(${analyticsEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
      event: analyticsEvents.event,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(sql`1`, analyticsEvents.event)
    .orderBy(sql`1 desc`, analyticsEvents.event);

  const totals = await db
    .select({ event: analyticsEvents.event, count: sql<number>`count(*)::int` })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(analyticsEvents.event)
    .orderBy(analyticsEvents.event);

  const recent = await db
    .select({
      createdAt: analyticsEvents.createdAt,
      event: analyticsEvents.event,
      bookSlug: analyticsEvents.bookSlug,
      path: analyticsEvents.path,
      referrerHost: analyticsEvents.referrerHost,
      source: analyticsEvents.source,
      props: analyticsEvents.props,
    })
    .from(analyticsEvents)
    .orderBy(desc(analyticsEvents.createdAt))
    .limit(50);

  return NextResponse.json({ ok: true, days, since: since.toISOString(), totals, perDay, recent });
}
