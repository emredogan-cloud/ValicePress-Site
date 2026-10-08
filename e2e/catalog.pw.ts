import { expect, test, type Page } from "@playwright/test";

import { BOOKS } from "../scripts/catalog/valice-catalog.mjs";

import { firstBookCard, isMobileProject, press } from "./helpers";

/**
 * PHASE 2–3 — the catalogue as the browser sees it: the priority books lead
 * /books and /ebooks in a fixed order, each book's quick view and detail page
 * offer exactly its own Amazon formats, and no page carries another book's data.
 *
 * Expected values come from the catalogue file — the single source of truth — not
 * from literals typed here, so a catalogue edit that changes a link is tested
 * against itself, and a page that disagrees with the catalogue fails.
 */

interface Fmt {
  format: string;
  availability: string;
  fulfillment: string;
  amazonAsin?: string | null;
  amazonUrl?: string | null;
}
interface Bk {
  slug: string;
  title: string;
  websiteStatus: string;
  authors: string[];
  formats: Fmt[];
}
const books = BOOKS as unknown as Bk[];
const bySlug = (slug: string) => books.find((b) => b.slug === slug)!;

/** Pinned books that are published, in pin order (Ridge Runner is a staged draft). */
const PINNED_LIVE = [
  "weather-permitting",
  "the-sweetest-season",
  "the-great-book-of-world-games",
  "codex-bestiarium",
  "the-long-way-back",
  "all-the-quiet-places",
];
/** Amazon URLs the catalogue says this book has, whatever their fulfilment. */
const amazonUrlsOf = (b: Bk) =>
  b.formats.filter((f) => f.availability === "available" && f.amazonUrl).map((f) => f.amazonUrl as string);

const FORMAT_LABEL: Record<string, RegExp> = {
  paperback: /Paperback/i,
  hardcover: /Hardcover/i,
  large_print: /Large Print/i,
};

async function slugsInOrder(page: Page): Promise<string[]> {
  await firstBookCardWait(page);
  return page.$$eval('ul a[href^="/books/"]', (as) => {
    const seen: string[] = [];
    for (const a of as) {
      const slug = (a.getAttribute("href") ?? "").replace("/books/", "");
      if (slug && !seen.includes(slug)) seen.push(slug);
    }
    return seen;
  });
}
async function firstBookCardWait(page: Page) {
  await firstBookCard(page).waitFor();
}

test.describe("priority order — /books and /ebooks", () => {
  for (const route of ["/books", "/ebooks"]) {
    test(`${route} opens with the priority books, in order`, async ({ page }) => {
      await page.goto(route);
      const slugs = await slugsInOrder(page);
      expect(slugs.slice(0, PINNED_LIVE.length), `${route}: ${slugs.slice(0, 9).join(", ")}`).toEqual(PINNED_LIVE);
    });

    test(`${route} does not list the staged draft`, async ({ page }) => {
      await page.goto(route);
      expect(await slugsInOrder(page)).not.toContain("ridge-runner");
    });
  }

  test("the rest of the catalogue is still there, in a stable order", async ({ page }) => {
    await page.goto("/books");
    const first = await slugsInOrder(page);
    await page.reload();
    const second = await slugsInOrder(page);
    expect(second).toEqual(first);
    // 12 per page; the page says how many books there are in all.
    await expect(page.getByText(/of \d+ books/)).toContainText(String(books.filter((b) => b.websiteStatus === "published").length));
  });
});

test.describe("detail pages — each book shows only itself", () => {
  for (const slug of PINNED_LIVE) {
    test(`/books/${slug}: title, cover, author and exactly its own Amazon links`, async ({ page }) => {
      const b = bySlug(slug);
      const res = await page.goto(`/books/${slug}`);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1").first()).toContainText(b.title);

      // The cover is this book's file (next/image rewrites the src, so read the original out of it).
      const cover = page.locator(`img[src*="${slug}"]`).first();
      await expect(cover, "cover image").toBeVisible();
      const src = decodeURIComponent((await cover.getAttribute("src")) ?? "");
      expect(src).toContain(`/images/books/${slug}`);

      // Exactly the catalogue's Amazon URLs for this book, no more, no fewer.
      const hrefs = await page.$$eval('a[href*="amazon.com"]', (as) => [...new Set(as.map((a) => a.getAttribute("href") as string))]);
      const asinOf = (u: string) => new URL(u).pathname.replace("/dp/", "");
      expect(hrefs.map(asinOf).sort(), `${slug}: Amazon links on the page`).toEqual(amazonUrlsOf(b).map(asinOf).sort());

      // …and no ASIN that belongs to any OTHER book.
      const others = new Set(books.filter((x) => x.slug !== slug).flatMap((x) => x.formats.map((f) => f.amazonAsin).filter(Boolean) as string[]));
      for (const h of hrefs) expect(others.has(asinOf(h)), `${slug} links ${h}, which belongs to another book`).toBe(false);

      // No other book's cover is anywhere on the page's own hero.
      const html = await page.content();
      for (const slugOther of PINNED_LIVE.filter((s) => s !== slug)) {
        expect(html.includes(`/images/books/back/${slugOther}`), `${slug} carries ${slugOther}'s back cover`).toBe(false);
      }
    });
  }

  test("the staged draft has no public page", async ({ page }) => {
    const res = await page.goto("/books/ridge-runner");
    expect(res?.status()).toBe(404);
  });
});

test.describe("quick view — the formats of THAT book", () => {
  for (const slug of PINNED_LIVE) {
    test(`${slug}: one chip per real edition, each leading to its own Amazon page`, async ({ page }, testInfo) => {
      const b = bySlug(slug);
      await page.goto("/books");
      const card = page.locator(`ul a[href="/books/${slug}"]`).first();
      await card.scrollIntoViewIfNeeded();
      await press(card, testInfo);
      const dialog = page.getByRole("dialog", { name: b.title });
      await expect(dialog).toBeVisible();

      const available = b.formats.filter((f) => f.availability === "available");
      const group = dialog.getByRole("group", { name: "Editions" });
      const chips = group.getByRole("button");
      // A Kindle chip is shown when the ebook is Amazon's or the direct row carries a Kindle ASIN;
      // the number of chips is the number of distinct editions a reader can obtain.
      const wantChips = new Set<string>();
      for (const f of available) {
        if (f.format === "ebook") {
          if (f.fulfillment === "direct") wantChips.add("pdf");
          if (f.amazonUrl) wantChips.add("kindle");
        } else wantChips.add(f.format);
      }
      await expect(chips).toHaveCount(wantChips.size);

      // Every chip that goes to Amazon must go to the URL the catalogue holds for that format.
      // An ebook row that is sold HERE and also carries a Kindle ASIN is shown as TWO
      // chips — "PDF" (bought here) and "Kindle" (on Amazon) — and only the Kindle one
      // leads to Amazon.
      const amazonRows = available.filter((f) => f.amazonUrl);
      for (const f of amazonRows) {
        const label = f.format === "ebook" ? /^Kindle/i : FORMAT_LABEL[f.format];
        const chip = chips.filter({ hasText: label }).first();
        await chip.click();
        const buy = dialog.getByRole("link", { name: /Buy on Amazon/ });
        await expect(buy, `${slug}/${f.format}`).toHaveAttribute("href", f.amazonUrl as string);
      }
    });
  }
});

test.describe("mobile — the same books, a finger's reach", () => {
  test("the priority books lead /books on a phone too", async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo), "mobile project only");
    await page.goto("/books");
    const slugs = await slugsInOrder(page);
    expect(slugs.slice(0, PINNED_LIVE.length)).toEqual(PINNED_LIVE);
  });
});

/**
 * The catalogue keeps its filters in the address bar, and it used to write the
 * address ~300 ms after mounting even when nothing had changed: a `router.replace`
 * to the page it was already on. That is a server round trip for nothing, and
 * when the visitor left while it was in flight Next fell back to a browser
 * navigation to /books — in Firefox, a hard navigation to /cart ended on /books.
 *
 * The router is made cold and slow here (prefetches fail, every other RSC
 * response is held), because on a warm router the replace is answered from
 * cache and nothing shows; that is the difference between a fast laptop and a
 * phone on a bad connection.
 */
test.describe("the catalogue leaves the address alone until the visitor changes something", () => {
  async function coldSlowRouter(page: Page, holdMs: number) {
    await page.route(/[?&]_rsc=/, (route) => {
      if (route.request().headers()["next-router-prefetch"]) return route.abort().catch(() => {});
      setTimeout(() => route.continue().catch(() => {}), holdMs);
    });
  }

  for (const route of ["/books", "/ebooks"]) {
    test(`${route}: a plain visit asks the server for nothing of its own`, async ({ page }) => {
      await coldSlowRouter(page, 1500);
      const own: string[] = [];
      page.on("request", (r) => {
        const u = new URL(r.url());
        if (u.searchParams.has("_rsc") && u.pathname === route && !r.headers()["next-router-prefetch"]) own.push(r.url());
      });
      await page.goto(route);
      await firstBookCard(page).waitFor();
      await page.waitForTimeout(1200); // past the 300 ms debounce, with room for a slow hydration
      expect(own, "the page re-requested itself").toEqual([]);
    });
  }

  test("leaving /books straight after it loads goes where the visitor asked, and stays there", async ({ page }) => {
    await coldSlowRouter(page, 1500);
    await page.goto("/books");
    await firstBookCard(page).waitFor();
    await page.waitForTimeout(800);
    await page.goto("/cart"); // before the fix this rejected with NS_BINDING_ABORTED in Firefox
    await expect(page).toHaveURL(/\/cart$/);
    await page.waitForTimeout(1600); // long enough for a late fallback navigation to land
    expect(new URL(page.url()).pathname).toBe("/cart");
  });

  test("a filter still reaches the address, once", async ({ page }) => {
    await page.goto("/books");
    await firstBookCard(page).waitFor();
    const sort = page.locator("#catalog-sort");
    await sort.selectOption("price-low");
    await expect(page).toHaveURL(/[?&]sort=price-low(&|$)/);
    await sort.selectOption("newest");
    await expect.poll(() => new URL(page.url()).search).toBe("");
  });
});
