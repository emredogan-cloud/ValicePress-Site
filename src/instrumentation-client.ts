/**
 * Sentry — browser runtime init.
 *
 * ⚠ WHY THIS FILE EXISTS AND `sentry.client.config.ts` NO LONGER RUNS.
 * Up to @sentry/nextjs v8, the build plugin auto-loaded `sentry.client.config
 * .ts` into the client bundle, and that file's own header still says so. From
 * v9 the browser half moved to `instrumentation-client.ts`, which Next.js
 * loads itself — beside `app/`, which in this project means `src/`. This
 * repository is on @sentry/nextjs 10.55.0 and Next 16.2.6, so
 * `sentry.client.config.ts` has not been executing.
 *
 * It was invisible because the old file no-ops without a DSN, and there was no
 * DSN until 2026-09-19. When one was set, a search of every JavaScript chunk
 * the home page loads found no reference to the ingest host at all — which is
 * what sent us looking here.
 *
 * The server half had the mirror-image fault: `instrumentation.ts` sat at the
 * repository root rather than in `src/`, so `register()` never ran either.
 * Both halves were wired, neither was loaded, and nothing said so.
 *
 * Graceful degradation is kept exactly as it was: no `NEXT_PUBLIC_SENTRY_DSN`,
 * no `init`, and every SDK call becomes a silent no-op. A local checkout with
 * no DSN behaves as it always did.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Sample 10% of transactions; raise temporarily when chasing a specific
    // regression. Free-tier-friendly, and the same figure the server uses.
    tracesSampleRate: 0.1,
    // Never ship form values or other personal data by default — the same PII
    // discipline as everywhere else in this codebase.
    sendDefaultPii: false,
    environment: process.env.NODE_ENV,
  });
}

/**
 * Router transition instrumentation. Without this, a client-side navigation is
 * invisible to Sentry's performance data and an error after a soft navigation
 * is attributed to the page the visitor first landed on.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
