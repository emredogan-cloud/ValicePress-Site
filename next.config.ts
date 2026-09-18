import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/*
 * Security headers — Roadmap §11 "Production hardening: strict security
 * headers/CSP, HTTPS-only" and §11 "Security-by-design principles".
 *
 * Implemented natively in Next.js (App Router) via `headers()` rather than
 * in `vercel.json` so the policy lives next to the app and travels with it.
 *
 * Future hardening (later SUB-PR): switch CSP to nonce-based via Routing
 * Middleware once we have dynamic surfaces (auth/account) — this gets rid of
 * `'unsafe-inline'`. For now we ship a strict-but-pragmatic CSP that does not
 * break Next.js' static rendering or Turbopack dev.
 */

const isDev = process.env.NODE_ENV !== "production";

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "manifest-src 'self'",
  "media-src 'self'",
  "worker-src 'self' blob:",
  // 'unsafe-eval' is dev-only (Turbopack HMR uses eval). Production CSP drops it.
  // `va.vercel-scripts.com` is the host for Vercel Analytics + Speed Insights
  // (SUB-PR 4.3). `clerk.valicepress.com` is Clerk's frontend-api, added
  // 2026-09-18: the CNAME for it existed nowhere until that date (Clerk's
  // custom-domain DNS records were never created), so this gap was invisible
  // until DNS was fixed and the very next blocker was this CSP entry — the
  // script tag was always going to be refused, DNS or not. Same discipline as
  // above: explicitly allowlisted, not wildcarded.
  `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://clerk.valicepress.com${isDev ? " 'unsafe-eval'" : ""}`,
  // Tailwind/Next inject runtime style tags; tighten later via nonces.
  "style-src 'self' 'unsafe-inline'",
  // `https:` is allowed in both dev and prod so client code can fetch from
  // R2 (PDF reader, future cover images) and other HTTPS integrations.
  // Dev additionally needs `ws:`/`wss:` for the Turbopack HMR socket.
  `connect-src 'self' https:${isDev ? " ws: wss:" : ""}`,
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  // X-Frame-Options is a legacy mirror of `frame-ancestors 'none'` for older agents.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()",
  },
  // HSTS is HTTPS-only and would lock localhost out of plain HTTP if cached,
  // so only emit it in production deployments (Vercel terminates TLS for us).
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

/**
 * Allow Next/Image to fetch covers from R2. Two pattern families:
 *  - **Default Cloudflare R2 hostnames** — direct R2 (`*.r2.cloudflarestorage.com`)
 *    and the per-bucket public dev URLs (`*.r2.dev`). Always allowed.
 *  - **Custom CDN domain from `R2_PUBLIC_BASE_URL`** — captured at build
 *    time. If the env var holds a valid HTTPS URL its hostname is added
 *    to the allowlist; otherwise no extra pattern is emitted.
 *
 * Keeping the allowlist build-time-derived (rather than wildcarding all
 * HTTPS) means an exfiltration of the image proxy can only target hosts
 * we've explicitly named at deploy time.
 */
function buildCustomR2RemotePattern():
  | { protocol: "https"; hostname: string }[]
  | [] {
  const url = process.env.R2_PUBLIC_BASE_URL;
  if (!url) return [];
  try {
    return [{ protocol: "https", hostname: new URL(url).hostname }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "**.r2.dev" },
      ...buildCustomR2RemotePattern(),
    ],
  },
  /**
   * Force-include the blog content directory in the serverless trace
   * (SUB-PR 4.2). Background:
   *   - SUB-PR 3.2's blog detail routes (/blog/[slug]) were pure static —
   *     markdown read at build only, no ISR.
   *   - SUB-PR 4.2 wraps `getFeaturedBooks` in `unstable_cache(..., {
   *     revalidate: 3600 })`. Next.js propagates the revalidate hint UP
   *     to the consuming route, so blog detail now ISR-regenerates hourly.
   *   - At ISR regen time, the markdown loader (`src/lib/blog.ts`) reads
   *     `src/content/blog/*.md`. NFT (next-file-trace) doesn't always
   *     auto-capture `fs.readdir(staticPath)` patterns, so we explicitly
   *     include the content directory in the trace for any /blog/** route.
   * Without this, ISR regen on /blog/[slug] would degrade to the loader's
   * `[blog] content directory missing` fallback and serve empty posts.
   */
  outputFileTracingIncludes: {
    "/blog/**": ["./src/content/**/*"],
  },
  async headers() {
    return [
      {
        // Apply to every route, including the root path.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        // `/genres` was a discovery page built on eight hard-coded genres
        // with invented book counts (~44,000 titles against a catalog of
        // eight). It has been removed rather than rebuilt, because
        // `/categories` already lists the real, database-backed shelves and
        // two browse-by-subject pages was one too many. Permanent, so the
        // link equity and any existing bookmark land on the real page.
        source: "/genres",
        destination: "/categories",
        permanent: true,
      },
    ];
  },
};

/**
 * Sentry build-time wrapper (SUB-PR 4.5).
 *
 * Wraps the Next.js config to:
 *   - Auto-load `sentry.client.config.ts` into the client bundle
 *   - Auto-tunnel SDK calls (when `tunnelRoute` is set — not used here)
 *   - Optionally upload source maps to Sentry for symbolicated stack traces
 *
 * Graceful degradation:
 *   - `silent: !process.env.CI` — quiet build logs locally; surface them in CI
 *   - `sourcemaps.disable: !SENTRY_AUTH_TOKEN` — when no auth token is set,
 *     skip the upload step entirely (the build still produces source maps,
 *     they just stay local). Without this guard, every local `npm run build`
 *     would try to upload and either fail noisily or hang on auth prompts.
 *   - When `SENTRY_DSN` is missing at runtime, the actual SDK init in
 *     `sentry.{client,server,edge}.config.ts` no-ops — `withSentryConfig`
 *     itself doesn't require the DSN at build time.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  // Don't widen the deployment surface; just wire up source-map upload
  // when configured. `tunnelRoute` (ad-blocker bypass) and ReactComponent
  // Annotation are off by default — opt in later if needed.
});
