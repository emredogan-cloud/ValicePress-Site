/**
 * The sitemap's policy, run against the real `sitemap()` with only the two data sources faked (the catalogue's
 * queries and the blog loader), so the test needs no database and no content directory.
 *
 * What it guards:
 *
 *  1. THE BONUS-SCENE PAGES ARE LISTED. Their addresses are printed inside the books and linked from the footer and
 *     /about, they are public, and none of them carries a robots meta — so they are indexable, and a page that is
 *     indexable but absent from the sitemap is only found by following a link. Two of the three were absent until
 *     2026-10-09.
 *  2. NOTHING THE ROBOTS FILE FORBIDS IS LISTED. Offering a crawler a URL the same site tells it not to fetch is a
 *     contradiction Search Console reports as "blocked by robots.txt" against every such entry.
 *  3. NO UTILITY SURFACE IS LISTED (cart, search results, checkout confirmation, the reader, the admin).
 *  4. NO DUPLICATES, every URL on the one canonical origin, and every `lastmod` a real date that is not in the future
 *     — the one thing a sitemap's freshness signal is trusted for is being verifiably accurate.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/queries/catalog", () => ({
  getBookSitemapEntries: async () => [
    { slug: "a-book", lastModified: new Date("2026-10-01T00:00:00.000Z") },
    { slug: "another-book", lastModified: new Date("2026-09-20T00:00:00.000Z") },
  ],
  listAuthorSlugs: async () => [],
  listCategorySlugs: async () => [{ slug: "a-shelf" }],
}));
vi.mock("@/lib/blog", () => ({
  getAllPosts: async () => [],
  getAllCategories: async () => [],
}));

import robots from "./robots";
import sitemap from "./sitemap";

const BONUS = ["/bonus", "/long-way-back-bonus", "/weather-permitting-bonus"];

async function entries() {
  const list = await sitemap();
  const origin = new URL(list[0].url).origin;
  return { list, origin, paths: list.map((e) => new URL(e.url).pathname) };
}

describe("sitemap.xml", () => {
  it("lists the three bonus-scene landing pages", async () => {
    const { paths } = await entries();
    for (const p of BONUS) expect(paths, p).toContain(p);
  });

  it("gives each bonus page a real, past lastmod of its own (not the static-pages revision)", async () => {
    const { list } = await entries();
    const about = list.find((e) => new URL(e.url).pathname === "/about")!;
    for (const p of BONUS) {
      const e = list.find((x) => new URL(x.url).pathname === p)!;
      const d = e.lastModified instanceof Date ? e.lastModified : new Date(String(e.lastModified));
      expect(Number.isNaN(d.getTime()), `${p} lastmod`).toBe(false);
      expect(d.getTime(), `${p} lastmod is in the future`).toBeLessThanOrEqual(Date.now());
      // Each of these pages was created after the 2026-09-02 revision of /about; a lastmod from before the page
      // existed would be a claim nothing supports.
      expect(d.getTime(), `${p} lastmod predates the page`).toBeGreaterThan(new Date(String(about.lastModified)).getTime());
    }
  });

  it("lists nothing the robots file disallows", async () => {
    const { paths } = await entries();
    const rules = robots().rules;
    const disallow = (Array.isArray(rules) ? rules : [rules]).flatMap((r) => (r.disallow === undefined ? [] : [r.disallow].flat()));
    expect(disallow.length).toBeGreaterThan(0);
    for (const p of paths) {
      for (const d of disallow) expect(p.startsWith(d), `${p} is listed but robots.txt disallows ${d}`).toBe(false);
    }
  });

  it("lists no utility or private surface", async () => {
    const { paths } = await entries();
    for (const p of paths) {
      expect(p, p).not.toMatch(/^\/(cart|search|order|read|admin|account|api|download|codex-enigmatica)(\/|$)/);
    }
  });

  it("has no duplicate URLs and keeps every URL on one origin", async () => {
    const { list, origin } = await entries();
    const urls = list.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const u of urls) expect(new URL(u).origin, u).toBe(origin);
  });

  it("every lastmod is a valid date that is not in the future", async () => {
    const { list } = await entries();
    for (const e of list) {
      const d = e.lastModified instanceof Date ? e.lastModified : new Date(String(e.lastModified));
      expect(Number.isNaN(d.getTime()), e.url).toBe(false);
      expect(d.getTime(), `${e.url} lastmod is in the future`).toBeLessThanOrEqual(Date.now());
    }
  });
});
