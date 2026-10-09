import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { BOOKS, CATEGORIES } from "../scripts/catalog/valice-catalog.mjs";
import { PINNED_BOOK_SLUGS } from "../src/lib/pinned-books";
import { SOCIAL_URLS } from "../src/lib/social";

import { clippedContent, horizontalOverflow, isMobileProject, MOBILE_WIDTHS } from "./helpers";

/**
 * PHASE 8 — the About page says what the press is, and every link on it goes somewhere real.
 *
 * The page used to describe a digital-only bookshop and had never heard of the romance list, the folklore
 * editions or the games books. What is asserted: the old story is gone; each shelf's count is the
 * catalogue's; the featured books are the catalogue's pinned ones; the direct-download sentence appears only
 * if some titles can be bought here; and — the audit the brief asks for — EVERY link on the page (header,
 * body, footer) is internal and answers, a mailto to the press's own address, or one of the four social
 * profiles, opened safely.
 */

const PUBLIC_EMAIL = "hello@valicepress.com";
interface Book {
  slug: string;
  websiteStatus: string;
  categories: string[];
  providerPriceId?: string | null;
}
const books = BOOKS as Book[];
const published = books.filter((b) => b.websiteStatus === "published");
const publishedSlugs = new Set(published.map((b) => b.slug));
const categorySlugs = new Set((CATEGORIES as Array<{ slug: string }>).map((c) => c.slug));
const authorSlugs = new Set(readdirSync(path.resolve(__dirname, "../src/content/authors")).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")));
for (const s of ["emre-dogan", "harper-hayes", "quinn-gallagher"]) authorSlugs.add(s);
const local = !process.env.E2E_BASE_URL;
void readFileSync;

test.describe("/about — what the press is", () => {
  test("opens with the brand's own line and the logo, and is the page about the press as it is now", async ({ page }) => {
    const res = await page.goto("/about");
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("Independent ideas. A longer tomorrow.");
    const logo = page.locator("main img[alt^='Valice Press — Independent ideas']");
    await expect(logo).toBeVisible();
    const m = await logo.evaluate((i: HTMLImageElement) => ({ ok: i.complete && i.naturalWidth > 0, w: i.getBoundingClientRect().width, h: i.getBoundingClientRect().height }));
    expect(m.ok).toBe(true);
    expect(Math.abs(m.w - m.h), "the lockup is square, never stretched").toBeLessThan(1);

    const text = await page.locator("main").innerText();
    for (const stale of [
      "A bookstore that doesn't lock you out",
      "first-party bookshop",
      "Buy once. Yours to keep. Never locked.",
      "Watermark-free",
      "emre30283",
      "every other reading platform",
    ]) {
      expect(text, `stale claim: ${stale}`).not.toContain(stale);
    }
    for (const h of ["What we publish", "Books that show their evidence", "Start here", "How to read them", "What we believe", "Who built it", "Where to go next"]) {
      await expect(page.getByRole("heading", { name: h, level: 2 }), h).toBeVisible();
    }
  });

  test("each shelf's title count is the catalogue's, and each shelf links to its own page", async ({ page }) => {
    test.skip(!local, "counts are compared with the catalogue file, which the local database mirrors");
    await page.goto("/about");
    const cards = page.locator("#shelves-heading").locator("xpath=ancestor::section").locator("ul > li");
    const live = [...categorySlugs].filter((c) => published.some((b) => b.categories.includes(c)));
    expect(await cards.count()).toBe(live.length);
    for (const slug of live) {
      const card = cards.locator(`a[href="/categories/${slug}"]`);
      await expect(card, slug).toHaveCount(1);
      const n = published.filter((b) => b.categories.includes(slug)).length;
      await expect(card, slug).toContainText(`${n} ${n === 1 ? "title" : "titles"}`);
    }
    await expect(page.locator("#shelves-heading").locator("xpath=following-sibling::p")).toContainText(`${published.length} titles on ${live.length} shelves`);
  });

  test("the featured books are the catalogue's pinned books, in the pins' order", async ({ page }) => {
    await page.goto("/about");
    const hrefs = await page.locator("#featured-heading").locator("xpath=ancestor::section").locator("a[href^='/books/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!.split("/").pop()!));
    expect(hrefs.length).toBe(4);
    const pins = PINNED_BOOK_SLUGS.filter((s) => publishedSlugs.has(s));
    expect(hrefs.slice(0, Math.min(3, pins.length))).toEqual(pins.slice(0, Math.min(3, pins.length)));
    for (const h of hrefs) expect(publishedSlugs.has(h), h).toBe(true);
  });

  test("says downloads are sold here only if some can be bought, and says how many", async ({ page }) => {
    test.skip(!local, "compared with the catalogue file");
    await page.goto("/about");
    const card = page.locator("#readers-heading").locator("xpath=ancestor::section").locator("li", { hasText: "Direct download" });
    const n = published.filter((b) => b.providerPriceId).length;
    if (n > 0) await expect(card).toContainText(`${n} titles are also sold here as DRM-free PDFs`);
    else await expect(card).toContainText("not on sale at the moment");
  });

  test("the founder's biography is the catalogue's text and the contact address is the press's own", async ({ page }) => {
    await page.goto("/about");
    const section = page.locator("#who-built-it-heading").locator("xpath=ancestor::section");
    await expect(section).toContainText("Emre Doğan writes about the stories that cultures tell themselves");
    await expect(section).toContainText("CODEX MYTHOLOGICA, his first book");
    await expect(section.locator(`a[href="mailto:${PUBLIC_EMAIL}"]`)).toHaveCount(1);
    expect(await page.locator("a[href^='mailto:']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))])).toEqual([`mailto:${PUBLIC_EMAIL}`]);
  });

  test("is not wider than the screen", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const widths = isMobileProject(testInfo) ? MOBILE_WIDTHS : ([1024, 1440] as const);
    await page.goto("/about", { waitUntil: "domcontentloaded" });
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(150);
      expect(await horizontalOverflow(page), `/about at ${w}px`).toBeLessThanOrEqual(0);
      expect(await clippedContent(page), `/about at ${w}px: content cut off by the screen's edge`).toEqual([]);
    }
  });
});

test.describe("/about — link audit", () => {
  test("every link on the page is real: routes answer, books exist, the only addresses are the press's own", async ({ page, request }) => {
    await page.goto("/about");
    const links = await page.locator("a[href]").evaluateAll((as) =>
      as.map((a) => ({ href: a.getAttribute("href")!, text: (a.textContent || a.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 50), target: a.getAttribute("target"), rel: a.getAttribute("rel") ?? "" })),
    );
    expect(links.length).toBeGreaterThan(40);

    const internal = new Set<string>();
    const external = new Map<string, { target: string | null; rel: string }>();
    const mailto = new Set<string>();
    for (const l of links) {
      if (l.href.startsWith("#")) {
        expect(await page.locator(l.href).count(), `fragment ${l.href} (${l.text}) has no target`).toBeGreaterThan(0);
      } else if (l.href.startsWith("mailto:")) mailto.add(l.href);
      else if (/^https?:\/\//.test(l.href)) external.set(l.href, { target: l.target, rel: l.rel });
      else internal.add(l.href.split("#")[0]);
    }

    // mail: one address, the press's own
    expect([...mailto]).toEqual([`mailto:${PUBLIC_EMAIL}`]);

    // outbound: exactly the four profiles, each opened in a new tab without leaking the opener
    expect([...external.keys()].sort()).toEqual([...SOCIAL_URLS].sort());
    for (const [href, a] of external) {
      expect(a.target, href).toBe("_blank");
      expect(a.rel, href).toContain("noopener");
    }

    // inside the site: each path answers; the shapes of the dynamic ones are checked against the catalogue
    const protectedPrefix = /^\/account(\/|$)/; // behind sign-in: a redirect is the correct answer
    for (const href of internal) {
      const p = href.replace(/\?.*$/, "");
      if (p.startsWith("/books/")) expect(publishedSlugs.has(p.split("/")[2]), `${href}: not a published book`).toBe(true);
      if (p.startsWith("/categories/")) expect(categorySlugs.has(p.split("/")[2]), `${href}: not a category`).toBe(true);
      if (p.startsWith("/authors/")) expect(authorSlugs.has(p.split("/")[2]), `${href}: not an author`).toBe(true);
      const res = await request.get(href, { maxRedirects: 0 });
      if (protectedPrefix.test(p)) expect([200, 302, 303, 307, 308], `${href} (protected)`).toContain(res.status());
      else expect(res.status(), href).toBe(200);
    }

    // the routes the brief names are all linked from this page
    for (const must of ["/books", "/authors", "/bonus", "/ebooks", "/terms", "/privacy", "/refund", "/kvkk", "/categories"]) {
      expect(internal.has(must), `/about does not link to ${must}`).toBe(true);
    }
    // Amazon: none on this page, but if one is ever added it must be a catalogue URL
    for (const href of external.keys()) expect(href).not.toMatch(/amazon\./);
  });

  test("the bonus scenes the page names are real pages", async ({ request }) => {
    for (const [p, title] of [["/bonus", "The First Frost"], ["/weather-permitting-bonus", "The Second Chair"], ["/long-way-back-bonus", "The Ocean"]] as const) {
      const res = await request.get(p);
      expect(res.status(), p).toBe(200);
      expect(await res.text(), p).toContain(title);
    }
  });
});
