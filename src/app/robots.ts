import type { MetadataRoute } from "next";

import { getBaseUrl } from "@/lib/seo";

/**
 * robots.txt — App Router file convention, served at `/robots.txt`
 * (Roadmap §13). Previously absent, so `/robots.txt` 404'd: no sitemap
 * pointer for crawlers and no crawl-budget control.
 *
 * Policy mirrors the per-page `robots` metadata already in place:
 *
 *   - Public catalog, discovery, blog, legal and brand pages stay fully
 *     crawlable (`Allow: /`).
 *   - Server / auth / transactional surfaces are disallowed — they carry
 *     no organic value and most sit behind Clerk, so crawling them just
 *     burns budget:
 *       /api/     — route handlers, never a landing page
 *       /admin    — operator dashboard (auth-gated). No trailing slash: a
 *                   `Disallow: /admin/` does not cover the dashboard's own
 *                   address, `/admin`, only what is under it.
 *       /account/ — user dashboard (auth-gated)
 *       /order/   — post-purchase confirmation (auth-gated)
 *       /read/    — the reader (auth-gated, entitlement-bound)
 *       /cart     — transient, per-session
 *   - `/search` is INTENTIONALLY left crawlable. It already emits
 *     `noindex, nofollow` at the page level, which is the correct tool for
 *     a results surface we want kept OUT of the index but still reachable:
 *     Google must be able to crawl it to *see* the `noindex`, and the
 *     WebSite `SearchAction` (see `buildSiteJsonLd`) targets `/search?q=…`.
 *     Disallowing it here would risk a URL-only index entry and undercut
 *     the search-box action.
 *
 * `getBaseUrl()` is the same env-driven origin the sitemap and every
 * canonical use, so the `Sitemap:`/`host` lines never drift from them.
 * NOTE: this inherits the metadataBase dependency — if `NEXT_PUBLIC_APP_URL`
 * is unset in production, the emitted absolute URLs fall back to localhost.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/account/",
        "/order/",
        "/read/",
        "/cart",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
