import type { MetadataRoute } from "next";

import { getAllCategories, getAllPosts } from "@/lib/blog";
import { listCompanions } from "@/lib/companions";
import {
  getBookSitemapEntries,
  listAuthorSlugs,
  listCategorySlugs,
} from "@/lib/db/queries/catalog";
import { allAuthorSlugs } from "@/lib/reference-authors";
import { getBaseUrl } from "@/lib/seo";

/**
 * Dynamic XML sitemap (Roadmap §13 — "dynamic XML sitemaps").
 *
 * Next.js App Router serves this at `/sitemap.xml`. The function runs at
 * SSG time and re-runs at the configured ISR cadence; DB reads go through
 * the `safeQuery`-wrapped catalog helpers, and blog reads go through the
 * filesystem-backed loader — so a missing `DATABASE_URL` degrades to "site
 * + blog URLs only", and a missing `src/content/blog/` degrades to "site
 * + catalog URLs only".
 *
 * Priority + `changeFrequency` are *hints* to crawlers, not contracts;
 * the values below reflect the SEO weight of each surface (catalog browse
 * is daily; per-book pages weekly; hub pages weekly; blog posts monthly
 * since editorial content drifts slower than catalog metadata).
 */
export const revalidate = 3600;

/**
 * Revision date of the hand-authored pages (/about, companions, legal). Bump
 * this when their copy changes; it is intentionally not the build time.
 */
const STATIC_PAGES_REVISION = new Date("2026-09-02T00:00:00.000Z");

/**
 * The bonus-scene landing pages, each with the date its page last changed (the
 * date of the last commit that touched its route). They post-date
 * `STATIC_PAGES_REVISION`, so borrowing it would give a `lastmod` from before
 * the page existed. Bump a date here when the page's copy changes.
 */
const BONUS_PAGES: ReadonlyArray<{ path: string; lastModified: Date }> = [
  { path: "/bonus", lastModified: new Date("2026-10-08T00:00:00.000Z") },
  { path: "/long-way-back-bonus", lastModified: new Date("2026-09-27T00:00:00.000Z") },
  { path: "/weather-permitting-bonus", lastModified: new Date("2026-10-01T00:00:00.000Z") },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const [books, categories, authors, blogPosts, blogCategories] =
    await Promise.all([
      getBookSitemapEntries(),
      listCategorySlugs(),
      listAuthorSlugs(),
      getAllPosts(),
      getAllCategories(),
    ]);

  // Deterministic freshness (Phase 0, 2026-09-02). `new Date()` here made
  // every ISR regeneration claim that every hub had just changed, which is
  // the one thing Google says it ignores `lastmod` for ("if it's
  // consistently and verifiably accurate"). Hubs are digests of the
  // catalogue, so they change when the newest book row changed; pages whose
  // copy is hand-authored carry a revision date that is bumped by hand.
  const newestBookDate = books.reduce<Date | null>((max, b) => {
    const d = b.lastModified instanceof Date ? b.lastModified : new Date(b.lastModified);
    return !max || d > max ? d : max;
  }, null);
  const catalogLastMod = newestBookDate ?? STATIC_PAGES_REVISION;

  // Blog-index + blog-category lastModified track the most recent post —
  // those surfaces are effectively the digest of all posts beneath them,
  // so crawlers should re-fetch them when new content lands.
  const newestPostDate =
    blogPosts.length > 0 ? new Date(blogPosts[0].date) : STATIC_PAGES_REVISION;

  const blogCategoryLastMod = new Map<string, Date>();
  for (const p of blogPosts) {
    const existing = blogCategoryLastMod.get(p.categorySlug);
    const d = new Date(p.date);
    if (!existing || d > existing) blogCategoryLastMod.set(p.categorySlug, d);
  }

  return [
    {
      url: `${baseUrl}/`,
      lastModified: catalogLastMod,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/books`,
      lastModified: catalogLastMod,
      changeFrequency: "daily",
      priority: 0.9,
    },
    // The only shelf a reader can buy from — it was missing from the sitemap
    // entirely until 2026-09-02.
    {
      url: `${baseUrl}/ebooks`,
      lastModified: catalogLastMod,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: catalogLastMod,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/authors`,
      lastModified: catalogLastMod,
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: STATIC_PAGES_REVISION,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    // The bonus-scene landing pages. Their addresses are printed inside the
    // books and linked from the footer and /about, they are public (the scenes
    // themselves go out by e-mail, not from the page), and none carries a
    // robots meta — so they are indexable already and belong here. Listed on
    // 2026-10-09; before that two of the three were reachable but unlisted.
    ...BONUS_PAGES.map(({ path, lastModified }) => ({
      url: `${baseUrl}${path}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    // Free companions to printed books. Indexable on purpose: each is a real
    // long-tail surface ("hangul practice sheet pdf"), rendered from a
    // constant, and the printed QR code inside the book points here.
    ...listCompanions().map((c) => ({
      url: `${baseUrl}/companion/${c.slug}`,
      lastModified: STATIC_PAGES_REVISION,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...books.map((b) => ({
      url: `${baseUrl}/books/${b.slug}`,
      lastModified: b.lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...categories.map(({ slug }) => ({
      url: `${baseUrl}/categories/${slug}`,
      lastModified: catalogLastMod,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    // Every researched author has a page whether or not the database answered, so they are listed regardless.
    ...allAuthorSlugs(authors.map((a) => a.slug)).map((slug) => ({
      url: `${baseUrl}/authors/${slug}`,
      lastModified: catalogLastMod,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    // Blog index
    {
      url: `${baseUrl}/blog`,
      lastModified: newestPostDate,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    // Blog posts (canonical content URLs)
    ...blogPosts.map((p) => ({
      url: `${baseUrl}/blog/${p.slug}`,
      lastModified: new Date(p.date),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // Blog category hubs
    ...blogCategories.map((c) => ({
      url: `${baseUrl}/blog/category/${c.slug}`,
      lastModified: blogCategoryLastMod.get(c.slug) ?? STATIC_PAGES_REVISION,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
