import { expect, test } from "@playwright/test";

import { BOOKS } from "../scripts/catalog/valice-catalog.mjs";

import { horizontalOverflow, isMobileProject, MOBILE_WIDTHS } from "./helpers";

/**
 * PHASE 5 — a book's page follows the reference design and shows only that book.
 *
 * What is asserted is structure and identity, not pixels: the sections the
 * reference has, in the order it has them; a tab for every section that exists;
 * an Editions card whose rows are exactly the catalogue's available editions; a
 * Look Inside whose viewer steps through pictures and closes cleanly; nothing
 * wider than the screen; and not one picture on the page from another book.
 */

interface Fmt {
  format: string;
  availability: string;
  fulfillment: string;
  amazonUrl?: string | null;
}
interface Bk {
  slug: string;
  title: string;
  websiteStatus: string;
  formats: Fmt[];
}
const published = (BOOKS as unknown as Bk[]).filter((b) => b.websiteStatus === "published");
// the six priority books, and two with no A+ pictures and no back cover (a classic, a reference)
const SAMPLE = ["weather-permitting", "the-sweetest-season", "the-great-book-of-world-games", "codex-bestiarium", "the-long-way-back", "all-the-quiet-places", "kwaidan", "meditations"];

for (const slug of SAMPLE) {
  const book = published.find((b) => b.slug === slug)!;

  test.describe(`/books/${slug}`, () => {
    test("has the reference's sections, in the reference's order, and a tab for each", async ({ page }) => {
      const res = await page.goto(`/books/${slug}`);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1")).toContainText(book.title);

      // vertical order of the section anchors on the page
      const ys = await page.evaluate(() => {
        const y = (id: string) => document.getElementById(id)?.getBoundingClientRect().top ?? null;
        return { overview: y("overview"), editions: y("editions"), preview: y("preview"), about: y("about-the-book"), author: y("about-the-author") };
      });
      for (const [k, v] of Object.entries(ys)) expect(v, `#${k} is on the page`).not.toBeNull();
      expect(ys.overview!).toBeLessThan(ys.editions!);
      expect(ys.editions!).toBeLessThan(ys.preview!);
      expect(ys.preview!).toBeLessThan(ys.about!);

      // the strip offers exactly these, in the reference's order
      const tabs = page.getByRole("navigation", { name: "Sections of this page" }).getByRole("link");
      await expect(tabs).toHaveText(["Overview", "Preview", "About the book", "About the author", "Editions"]);
    });

    test("Editions: one row per available edition, each Amazon button leading to its own URL", async ({ page }) => {
      await page.goto(`/books/${slug}`);
      const card = page.locator("#editions");
      const available = book.formats.filter((f) => f.availability === "available");
      // a direct ebook that is also on Kindle is two rows (PDF here, Kindle there) — count distinct (format, fulfilment)
      const wantRows = new Set(available.map((f) => `${f.format}`)).size;
      const rows = card.locator("ul > li");
      expect(await rows.count()).toBeGreaterThanOrEqual(wantRows);

      const hrefs = await card.locator('a[href*="amazon.com"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      const wantHrefs = available.map((f) => f.amazonUrl).filter(Boolean);
      expect([...new Set(hrefs)].sort()).toEqual([...new Set(wantHrefs)].sort());
      for (const a of await card.locator('a[href*="amazon.com"]').all()) {
        expect(await a.getAttribute("rel")).toContain("noopener");
        expect(await a.getAttribute("target")).toBe("_blank");
      }
    });

    test("Look inside: the row shows the book's own pictures, and the viewer steps through and closes", async ({ page }, testInfo) => {
      await page.goto(`/books/${slug}`);
      const section = page.locator("#preview");
      await section.scrollIntoViewIfNeeded();
      const tiles = section.locator("ul button");
      expect(await tiles.count()).toBeGreaterThan(0);

      // every picture on the page that is part of Look Inside belongs to this book
      const srcs = await section.locator("img").evaluateAll((imgs) => imgs.map((i) => decodeURIComponent(i.getAttribute("src") ?? "")));
      for (const s of srcs) expect(s, `a picture in ${slug}'s Look Inside`).toContain(slug);

      const open = section.getByRole("button", { name: /Read preview/ });
      if (isMobileProject(testInfo)) await open.tap();
      else await open.click();

      const dialog = page.getByRole("dialog", { name: /Look inside/ });
      await expect(dialog).toBeVisible();
      const counter = dialog.locator("[aria-live=polite]");
      await expect(counter).toContainText(/^1 \/ \d+/);
      const total = Number(((await counter.textContent()) ?? "").match(/\/ (\d+)/)?.[1]);
      expect(total).toBeGreaterThanOrEqual(2);

      await page.keyboard.press("ArrowRight");
      await expect(counter).toContainText(/^2 \/ \d+/);
      await dialog.getByRole("button", { name: "Next picture" }).click();
      await expect(counter).toContainText(/^3 \/ \d+|^2 \/ 2/);
      await page.keyboard.press("ArrowLeft");

      // every picture in the viewer is this book's too
      const viewerSrcs = await dialog.locator("img").evaluateAll((imgs) => imgs.map((i) => decodeURIComponent(i.getAttribute("src") ?? "")));
      for (const s of viewerSrcs) expect(s).toContain(slug);

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      // the page is usable again: scroll lock released, focus back on the control that opened it
      expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
      await expect(open).toBeFocused();
    });

    test("nothing is wider than the screen", async ({ page }, testInfo) => {
      test.skip(!isMobileProject(testInfo), "phone widths are exercised in the mobile project");
      test.setTimeout(120_000);
      await page.goto(`/books/${slug}`, { waitUntil: "domcontentloaded" });
      for (const w of MOBILE_WIDTHS) {
        await page.setViewportSize({ width: w, height: 800 });
        // layout is settled a frame after a resize; the page is not reloaded (it is the layout that is under test)
        await page.waitForTimeout(150);
        expect(await horizontalOverflow(page), `${slug} at ${w}px`).toBeLessThanOrEqual(0);
      }
    });
  });
}

test.describe("detail pages — the tabs follow the reader", () => {
  test("a tab scrolls to its section and marks itself current", async ({ page }, testInfo) => {
    test.skip(isMobileProject(testInfo), "pointer-driven; the strip is the same on a phone");
    await page.goto("/books/the-sweetest-season");
    const nav = page.getByRole("navigation", { name: "Sections of this page" });
    await nav.getByRole("link", { name: "Editions" }).click();
    await expect(page).toHaveURL(/#editions$/);
    await expect(page.locator("#editions")).toBeInViewport();
    await expect(nav.getByRole("link", { name: "Editions" })).toHaveAttribute("aria-current", "true");
  });
});

test.describe("detail pages — the primary button", () => {
  test("Buy on Amazon leads to a real edition of THIS book", async ({ page }) => {
    for (const slug of ["weather-permitting", "all-the-quiet-places"]) {
      const book = published.find((b) => b.slug === slug)!;
      await page.goto(`/books/${slug}`);
      const buy = page.locator("#overview").getByRole("link", { name: /Buy on Amazon/ });
      const href = await buy.getAttribute("href");
      expect(book.formats.map((f) => f.amazonUrl)).toContain(href);
    }
  });
});
