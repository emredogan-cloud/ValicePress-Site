/**
 * Next.js instrumentation hook (SUB-PR 4.5).
 *
 * ⚠ THIS FILE LIVED AT THE REPOSITORY ROOT UNTIL 2026-09-19, AND WAS DEAD.
 * Next.js looks for `instrumentation.ts` beside `app/` — which in this project
 * means `src/`, because the app router lives at `src/app/`. At the root it is
 * not an error and not a warning; it is simply never loaded. `register()` had
 * therefore never run, which meant `sentry.server.config.ts` had never been
 * imported and `Sentry.init()` had never been called on the server.
 *
 * That was invisible for as long as there was no DSN, because the config file
 * no-ops without one. A DSN was set on 2026-09-19 and
 * `/api/admin/sentry-check` answered `sdkInitialised: false` with both DSNs
 * present and well-formed — which is how the file's location was found. Had
 * nobody measured it, the DSN would have been "configured" and still nothing
 * would have been reported.
 *
 * Next.js calls `register()` once per runtime cold start. We use it to
 * dispatch to the right Sentry config file based on `NEXT_RUNTIME`:
 *   - "nodejs" → `sentry.server.config.ts`
 *   - "edge"   → `sentry.edge.config.ts`
 *
 * The client config (`sentry.client.config.ts`) is auto-loaded by the
 * Sentry webpack/turbopack plugin during build; nothing to do here for
 * the browser surface.
 *
 * `onRequestError` is the Next.js 15+ hook for capturing server-side
 * render errors. We forward to `Sentry.captureRequestError` which is a
 * no-op when Sentry isn't initialized (DSN missing).
 */

import * as Sentry from "@sentry/nextjs";

import { assertSiteUrlConfigured } from "@/lib/site-url";

export async function register(): Promise<void> {
  // Fail loudly on a real production misconfiguration of the canonical origin
  // (WS-A): a silent empty/invalid NEXT_PUBLIC_APP_URL would corrupt every
  // canonical / OG / JSON-LD / sitemap URL. No-op off Vercel production.
  assertSiteUrlConfigured();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
