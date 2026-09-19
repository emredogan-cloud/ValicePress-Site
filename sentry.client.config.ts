/**
 * ⚠ SUPERSEDED 2026-09-19 — THIS FILE IS NO LONGER EXECUTED.
 *
 * @sentry/nextjs auto-loaded this file into the client bundle up to v8. From
 * v9 the browser init moved to `instrumentation-client.ts`, which Next.js
 * loads itself. This repository is on v10.55.0, so nothing here has been
 * running — the real client init is `src/instrumentation-client.ts`.
 *
 * Kept, not deleted, because its comments explain choices the new file
 * inherits. Do not add configuration here: it will not take effect.
 */

/**
 * Sentry — client runtime init (SUB-PR 4.5).
 *
 * Auto-loaded by `@sentry/nextjs`'s webpack/turbopack plugin during the
 * build. The plugin emits a bundle entry that imports this file before
 * any application code runs in the browser.
 *
 * Graceful degradation: if `NEXT_PUBLIC_SENTRY_DSN` isn't set,
 * `Sentry.init()` is skipped entirely. The SDK functions exported from
 * `@sentry/nextjs` then become no-ops at runtime — `captureException`,
 * `captureMessage`, etc. all silently succeed without sending. The
 * site does not 500, log noisy warnings, or burn HTTP requests on a
 * dead DSN.
 *
 * `NEXT_PUBLIC_SENTRY_DSN` is the public DSN — safe to ship in the
 * client bundle. `SENTRY_DSN` (server-side) is intentionally separate
 * so the two surfaces can target different projects if needed.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Sample 10% of transactions in production; raise temporarily when
    // debugging a specific regression. Free-tier-friendly default.
    tracesSampleRate: 0.1,
    // Don't ship sensitive form values to Sentry by default — match the
    // PII discipline used everywhere else (Roadmap §11).
    sendDefaultPii: false,
    // Drop noisy localhost / dev events from production project — set
    // explicitly so debug builds against the real DSN don't pollute.
    environment: process.env.NODE_ENV,
  });
}
