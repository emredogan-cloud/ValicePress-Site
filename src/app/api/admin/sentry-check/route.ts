import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";

import { AdminAccessError, requireAdmin } from "@/lib/auth";

/**
 * GET /api/admin/sentry-check — is this deployment actually reporting to Sentry?
 *
 * WHY THIS ROUTE EXISTS
 * `@sentry/nextjs` has been a dependency, and `sentry.{client,server,edge}
 * .config.ts` have been wired, since long before any DSN existed. All three
 * configs degrade gracefully: no DSN, no init, no error, no log. That is the
 * right behaviour for a local checkout and exactly the wrong one for
 * production, because the failure is silent in both directions — nothing tells
 * you errors are not being collected, and nothing tells you when they start.
 * The 2026-09-18 audit found the code wired, the DSN absent, and nobody aware
 * of either (VP-022).
 *
 * A DSN was set on 2026-09-19. This route is how that is checked, then and at
 * every future launch: it reads back what the runtime resolved, and — only when
 * asked — sends one deliberate, clearly-labelled event so the operator can
 * watch it arrive.
 *
 * WHAT IT DOES
 *   - always: reports whether the SDK is initialised in THIS runtime and
 *     whether a DSN is present, without ever printing the DSN;
 *   - with `?emit=1`: captures one exception labelled as a deliberate probe
 *     and returns its Sentry event id, so the operator can find that exact
 *     event rather than hunting for "an error, around then".
 *
 * It CAPTURES rather than THROWS. A route that throws to prove error reporting
 * works also puts a 500 in the access log, in the uptime monitor and in every
 * alert built on either; the event that reaches Sentry is identical, so the
 * 500 buys nothing and costs a false alarm.
 *
 * AUTH — the same two ways in as the other diagnostics routes:
 *   - a signed-in admin (`requireAdmin`);
 *   - `Authorization: Bearer $OPS_DIAG_TOKEN`, for a shell with no session.
 * The token gate stays shut unless `OPS_DIAG_TOKEN` is at least 32 characters;
 * an absent or short token must never become an open door.
 */

export const dynamic = "force-dynamic";

function tokenAccepted(req: Request): boolean {
  const expected = process.env.OPS_DIAG_TOKEN;
  if (!expected || expected.length < 32) return false;
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

/** The DSN's shape, never the DSN. Enough to tell "set" from "set to junk". */
function dsnShape(raw: string | undefined) {
  if (!raw) return { present: false as const };
  const m = /^https:\/\/([0-9a-f]+)@([A-Za-z0-9.-]+)\/(\d+)$/.exec(raw.trim());
  return m
    ? { present: true as const, wellFormed: true as const, host: m[2], projectId: m[3] }
    : { present: true as const, wellFormed: false as const };
}

export async function GET(req: Request) {
  if (!tokenAccepted(req)) {
    try {
      await requireAdmin();
    } catch (err) {
      if (err instanceof AdminAccessError) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      throw err;
    }
  }

  const client = Sentry.getClient();
  const body: Record<string, unknown> = {
    ok: true,
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    environment: process.env.VERCEL_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    sdkInitialised: Boolean(client),
    serverDsn: dsnShape(process.env.SENTRY_DSN),
    publicDsn: dsnShape(process.env.NEXT_PUBLIC_SENTRY_DSN),
  };

  if (new URL(req.url).searchParams.get("emit") === "1") {
    if (!client) {
      body.emitted = false;
      body.why = "no Sentry client in this runtime — a DSN is missing or unparseable";
    } else {
      const eventId = Sentry.captureException(
        new Error("sentry-check: deliberate probe, not a real fault"),
        { level: "info", tags: { probe: "sentry-check" } },
      );
      await Sentry.flush(4000);
      body.emitted = true;
      body.eventId = eventId;
    }
  }

  return NextResponse.json(body);
}
