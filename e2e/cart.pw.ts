import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { clippedContent, expectTouchTarget, horizontalOverflow, isMobileProject, MOBILE_WIDTHS, press } from "./helpers";

/**
 * PHASE 9 — the cart.
 *
 * Browser tests against a production build on the SANDBOX database. The cart is
 * one httpOnly cookie, so everything here writes only to the browser's own
 * cookie jar — except the "Buy" test, which would open a real checkout on a
 * server that has a payment key, and therefore runs only against localhost,
 * where `scripts/e2e/serve.mjs` has blanked the key.
 *
 * What is held to account:
 *   - no state crosses from one visitor to the next (the bug that put a
 *     stranger's book in every cookie-less cart on the server);
 *   - ADD → ADD AGAIN → REMOVE → RE-ADD → REFRESH → VERIFY, for EVERY book this
 *     store sells, not a sample;
 *   - the "+" on a recommended book adds that book, shows what the server says,
 *     and never reshuffles the shelf under the reader;
 *   - the carousel's arrows: LEFT → RIGHT → LEFT → RIGHT, stop at the ends, do
 *     not exist when there is nothing to scroll, and swiping works on a phone;
 *   - the header badge, the list and the total always agree;
 *   - a damaged cookie cannot empty or break the cart;
 *   - nothing is wider than the screen, and the controls are touchable.
 *
 * A note on speed: `/cart` is rendered per request against a remote database,
 * which locally takes several seconds. Assertions that wait for the PAGE (not for
 * the badge or a button, which answer from a cookie read) use a long timeout.
 */

const SLOW = { timeout: 45_000 };

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Every book whose page offers "Add digital edition" — i.e. every book this store sells. */
let purchasableCache: Promise<string[]> | null = null;
function purchasable(request: APIRequestContext): Promise<string[]> {
  purchasableCache ??= (async () => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const slugs = [...xml.matchAll(/<loc>[^<]*\/books\/([^</]+)<\/loc>/g)].map((m) => m[1]);
    const found: string[] = [];
    for (const slug of [...new Set(slugs)]) {
      const html = await (await request.get(`/books/${slug}`)).text();
      if (html.includes("Add digital edition")) found.push(slug);
    }
    return found;
  })();
  return purchasableCache;
}

const cents = (text: string) => Math.round(parseFloat(text.replace(/[^0-9.]/g, "")) * 100);

interface CartApi {
  count: number;
  ids: string[];
}
async function cartApi(page: Page): Promise<CartApi> {
  const res = await page.request.get("/api/cart/count");
  expect(res.status()).toBe(200);
  return (await res.json()) as CartApi;
}

/** The "In your cart — view cart" control a product page turns into once the server has the book. */
const inCartLink = (page: Page) => page.getByRole("link", { name: /^In your cart — view cart/ }).first();

/**
 * Press "Add digital edition" on a product page and wait until the SERVER's cart holds the book.
 *
 * The button is in the page before React has hydrated it, so a click that lands
 * too early does nothing — retried until the state changes, which is safe: a
 * press on a button that is already adding is ignored.
 */
async function addFromProductPage(page: Page, slug: string): Promise<void> {
  await page.goto(`/books/${slug}`);
  await expect(async () => {
    const add = page.getByRole("button", { name: /^Add digital edition$|^Try again$/ }).first();
    if (await add.isVisible()) await add.click();
    await expect(inCartLink(page)).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 45_000 });
}

/** Wait for a scroller to stop moving (smooth scrolling and snapping take a moment). */
async function settled(track: Locator): Promise<number> {
  let last = -1;
  let stable = 0;
  for (let i = 0; i < 60 && stable < 3; i++) {
    const now = await track.evaluate((el) => Math.round(el.scrollLeft));
    stable = now === last ? stable + 1 : 0;
    last = now;
    await track.page().waitForTimeout(80);
  }
  return last;
}

/** Titles of the cards that are wholly inside the visible part of the track. */
function fullyVisibleTitles(track: Locator): Promise<string[]> {
  return track.evaluate((el) => {
    const view = el.getBoundingClientRect();
    return Array.from(el.children)
      .filter((card) => {
        const r = card.getBoundingClientRect();
        return r.left >= view.left - 1 && r.right <= view.right + 1;
      })
      .map((card) => card.querySelector("h3")?.textContent?.trim() ?? "");
  });
}

const badge = (page: Page) => page.locator("header [data-cart-badge]");
const cartLines = (page: Page) => page.locator("[data-cart-line]");
const orderSummary = (page: Page) => page.locator("[data-order-summary]");
const shelf = (page: Page) => page.getByRole("region", { name: "Books you might like" });

const isLocal = (baseURL: string | undefined) => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseURL ?? "");

// ---------------------------------------------------------------------------
// 1. nothing crosses from one visitor to the next
// ---------------------------------------------------------------------------

test("a visitor with no cart cookie never sees another visitor's book", async ({ browser, baseURL, request }) => {
  const [slug] = await purchasable(request);
  expect(slug, "the sandbox sells at least one book").toBeTruthy();

  // Visitor A adds a book from a browser with no cart cookie — the move that used
  // to write that book into a process-wide "empty" cart.
  const a = await browser.newContext({ baseURL, locale: "en-US" });
  const pageA = await a.newPage();
  await addFromProductPage(pageA, slug);
  expect((await cartApi(pageA)).count).toBe(1);

  // Visitor B is a brand-new browser.
  const b = await browser.newContext({ baseURL, locale: "en-US" });
  const pageB = await b.newPage();
  expect(await cartApi(pageB)).toEqual({ count: 0, ids: [] });
  await pageB.goto("/cart");
  await expect(pageB.getByRole("heading", { level: 1 })).toHaveText("Your cart is empty", SLOW);
  await expect(cartLines(pageB)).toHaveCount(0);
  await expect(badge(pageB)).toHaveCount(0);

  // B presses "Add" on A's very book. It must be ADDED — and B's cookie written —
  // not answered "already in your cart" from a shared object.
  await addFromProductPage(pageB, slug);
  expect((await b.cookies()).find((c) => c.name === "dbs_cart"), "B's cart cookie was written").toBeDefined();
  expect((await cartApi(pageB)).ids).toHaveLength(1);

  // And a third visitor still sees nothing.
  const c = await browser.newContext({ baseURL, locale: "en-US" });
  const pageC = await c.newPage();
  expect(await cartApi(pageC)).toEqual({ count: 0, ids: [] });

  await Promise.all([a.close(), b.close(), c.close()]);
});

// ---------------------------------------------------------------------------
// 2. the product page's button
// ---------------------------------------------------------------------------

test("product page: add → in your cart (and it stays) → refresh → still in your cart", async ({ page, request }) => {
  const [slug] = await purchasable(request);
  await addFromProductPage(page, slug);

  // The control is now the way to the cart, and there is no second "Add".
  await expect(page.getByRole("button", { name: "Add digital edition" })).toHaveCount(0);
  await expect(badge(page)).toHaveText("1");
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();

  // It does not slide back to "Add" after a few seconds, which used to invite a second press.
  await page.waitForTimeout(4_500);
  await expect(inCartLink(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add digital edition" })).toHaveCount(0);

  // REFRESH → VERIFY: the cookie, not the page, remembers.
  await page.reload();
  await expect(inCartLink(page)).toBeVisible(SLOW);
  await expect(badge(page)).toHaveText("1");
  expect((await cartApi(page)).count).toBe(1);
});

test("product page: a refused or failed add says so, and the button stays usable", async ({ page, request }) => {
  const [slug] = await purchasable(request);
  await page.goto(`/books/${slug}`);

  // The request itself fails (offline, a deploy in flight): every Server Action POST gets a 500.
  await page.route(`**/books/${slug}`, (route) => (route.request().method() === "POST" ? route.fulfill({ status: 500, body: "boom" }) : route.continue()));
  const add = page.getByRole("button", { name: "Add digital edition" }).first();
  await expect(async () => {
    await add.click();
    await expect(page.getByRole("alert").filter({ hasText: /couldn't add this book/i })).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 30_000 });

  // Told in words, nothing was added, and the page did not blank into an error boundary.
  await expect(page.getByRole("alert").filter({ hasText: /nothing was charged/i }).first()).toBeVisible();
  expect((await cartApi(page)).count).toBe(0);
  await expect(page.locator("h1")).toBeVisible();
  const retry = page.getByRole("button", { name: "Try again" }).first();
  await expect(retry).toBeEnabled();

  // The connection comes back: the same button now works.
  await page.unroute(`**/books/${slug}`);
  await retry.click();
  await expect(inCartLink(page)).toBeVisible(SLOW);
  expect((await cartApi(page)).count).toBe(1);
});

// ---------------------------------------------------------------------------
// 3. the cart page
// ---------------------------------------------------------------------------

test("empty cart: says so, offers the way back, and shows books that CAN be added", async ({ page }) => {
  await page.goto("/cart");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your cart is empty", SLOW);
  await expect(page.getByRole("link", { name: /Browse the catalog/ })).toHaveAttribute("href", "/books");
  await expect(badge(page)).toHaveCount(0);
  expect(await cartApi(page)).toEqual({ count: 0, ids: [] });

  // The shelf is not five-eighths books with no "+": every card on it can be added.
  const cards = shelf(page).locator("[data-recommendation]");
  expect(await cards.count()).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < (await cards.count()); i++) {
    await expect(cards.nth(i).getByRole("button", { name: /^Add .+ to cart$/ }), `card ${i}`).toBeVisible();
    await expect(cards.nth(i)).not.toContainText("Not sold here");
  }
});

test("cart with several books: lines in the order added, totals add up, remove and clear work, a reload agrees", async ({ page, request }) => {
  const slugs = (await purchasable(request)).slice(0, 3);
  expect(slugs.length).toBe(3);
  for (const slug of slugs) await addFromProductPage(page, slug);
  await expect(badge(page)).toHaveText("3");

  await page.goto("/cart");
  await expect(cartLines(page)).toHaveCount(3, SLOW);
  await expect(page.getByRole("heading", { level: 1, name: "3 books in your cart" })).toBeVisible();
  // lines in the order they were added
  const order = await cartLines(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-cart-line")));
  expect(order).toEqual(slugs);

  // the total is the sum of the lines it lists — no stray, owned or unsellable line in it
  const prices = await cartLines(page).locator("p.tabular-nums").allInnerTexts();
  expect(prices).toHaveLength(3);
  const summary = orderSummary(page);
  await expect(summary.locator("[data-summary-count]")).toHaveText("3 books");
  const total = cents((await summary.locator("span.font-serif").innerText()) as string);
  expect(total).toBe(prices.reduce((sum, p) => sum + cents(p), 0));
  await expect(summary).toContainText("bought one at a time");

  // every line is buyable and removable by name
  for (const slug of slugs) {
    const line = page.locator(`[data-cart-line="${slug}"]`);
    await expect(line.getByRole("button", { name: /^Buy \$/ })).toBeEnabled();
    await expect(line.getByRole("button", { name: /^Remove .+ from cart$/ })).toBeVisible();
  }

  // REMOVE the middle one. The line steps aside at once (before the page re-renders) and the order of the rest holds.
  await page.locator(`[data-cart-line="${slugs[1]}"]`).getByRole("button", { name: /^Remove / }).click();
  await expect(page.locator(`[data-cart-line="${slugs[1]}"]`)).toHaveCount(0, SLOW);
  await expect(badge(page)).toHaveText("2");
  expect((await cartApi(page)).count).toBe(2);
  await expect(page.getByRole("heading", { level: 1, name: "2 books in your cart" })).toBeVisible(SLOW);
  await expect(summary.locator("[data-summary-count]")).toHaveText("2 books", SLOW);
  expect(await cartLines(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-cart-line")))).toEqual([slugs[0], slugs[2]]);

  // REFRESH → VERIFY
  await page.reload();
  await expect(cartLines(page)).toHaveCount(2, SLOW);
  expect(await cartLines(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-cart-line")))).toEqual([slugs[0], slugs[2]]);
  await expect(badge(page)).toHaveText("2");

  // RE-ADD the removed one from the shelf below the list: it goes to the END of the cart
  // (the last book added), and nothing is duplicated.
  await addFromProductPage(page, slugs[1]);
  await page.goto("/cart");
  await expect(cartLines(page)).toHaveCount(3, SLOW);
  expect(await cartLines(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-cart-line")))).toEqual([slugs[0], slugs[2], slugs[1]]);

  // CLEAR
  await page.getByRole("button", { name: "Clear cart" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your cart is empty", SLOW);
  await expect(badge(page)).toHaveCount(0);
  expect(await cartApi(page)).toEqual({ count: 0, ids: [] });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your cart is empty", SLOW);
});

// ---------------------------------------------------------------------------
// 4. the "+" on the recommendation shelf
// ---------------------------------------------------------------------------

test("shelf: the plus adds THAT book, shows what the server says, and the shelf stays put", async ({ page }, testInfo) => {
  await page.goto("/cart");
  const region = shelf(page);
  const cards = region.locator("[data-recommendation]");
  await expect(cards.first()).toBeVisible(SLOW);
  const titles = await region.getByRole("heading", { level: 3 }).allInnerTexts();
  expect(new Set(titles).size, "no book is listed twice").toBe(titles.length);
  expect(titles.length).toBeGreaterThanOrEqual(3);

  const press1 = async (index: number) => {
    const card = cards.nth(index);
    const title = titles[index];
    const plus = card.getByRole("button", { name: `Add ${title} to cart` });
    await expect(async () => {
      if (await plus.isVisible()) await press(plus, testInfo);
      await expect(card.getByRole("button", { name: `${title} is in your cart` })).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 45_000 });
  };

  // Press the FIRST card's plus.
  await press1(0);
  await expect(badge(page)).toHaveText("1");
  let api = await cartApi(page);
  expect(api.count).toBe(1);

  // The page body catches up: one line, and it is the book that was pressed — not its neighbour.
  await expect(cartLines(page)).toHaveCount(1, SLOW);
  await expect(cartLines(page).first().getByRole("link", { name: titles[0], exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "1 book in your cart" })).toBeVisible(SLOW);

  // The shelf did not reshuffle: same books in the same order, the pressed one still there, still ticked.
  expect(await region.getByRole("heading", { level: 3 }).allInnerTexts()).toEqual(titles);
  await expect(cards.nth(0).getByRole("button", { name: `${titles[0]} is in your cart` })).toBeVisible();
  // ...and its neighbours were not touched.
  await expect(cards.nth(1).getByRole("button", { name: `Add ${titles[1]} to cart` })).toBeVisible();

  // Press the SECOND card's plus.
  await press1(1);
  await expect(badge(page)).toHaveText("2");
  await expect(cartLines(page)).toHaveCount(2, SLOW);
  api = await cartApi(page);
  expect(api.count).toBe(2);
  expect(await cartLines(page).locator("a.font-serif").allInnerTexts()).toEqual([titles[0], titles[1]]);

  // A tick is not a button: pressing it again does not add anything.
  await cards.nth(0).getByRole("button", { name: `${titles[0]} is in your cart` }).click({ force: true });
  await page.waitForTimeout(800);
  expect((await cartApi(page)).count).toBe(2);

  // Remove the first line: its card goes back to "+".
  await page.locator("[data-cart-line]").first().getByRole("button", { name: /^Remove / }).click();
  await expect(cards.nth(0).getByRole("button", { name: `Add ${titles[0]} to cart` })).toBeVisible(SLOW);
  await expect(badge(page)).toHaveText("1");
  await expect(cartLines(page)).toHaveCount(1, SLOW);
});

test("the shelf offers what goes with the cart: the same author's other volume comes first, and nothing already in the cart is offered back", async ({ page, request }) => {
  const slugs = await purchasable(request);
  test.skip(!slugs.includes("fairy-mythology-vol-1") || !slugs.includes("fairy-mythology-vol-2"), "both volumes of Keightley are not sold in this database");
  await addFromProductPage(page, "fairy-mythology-vol-1");
  await page.goto("/cart");
  await expect(cartLines(page)).toHaveCount(1, SLOW);
  const cards = shelf(page).locator("[data-recommendation]");
  await expect(cards.first()).toHaveAttribute("data-recommendation", "fairy-mythology-vol-2");
  await expect(shelf(page).locator('[data-recommendation="fairy-mythology-vol-1"]')).toHaveCount(0);
});

test("a change made in another tab shows up when you come back to this one", async ({ page, context, request, browserName }) => {
  // Playwright's Firefox driver holds every click in a SECOND tab behind a navigation that never finishes
  // (the tab's document comes back 304), so the second tab cannot be driven there. The store's re-read on
  // `visibilitychange` is browser-independent and is unit-tested (cart-store.test.ts); this is the integration.
  test.skip(browserName === "firefox", "a second tab cannot be driven in Playwright's Firefox");
  const [slug] = await purchasable(request);
  await page.goto(`/books/${slug}`);
  await expect(page.getByRole("button", { name: "Add digital edition" }).first()).toBeVisible();
  expect((await cartApi(page)).count).toBe(0);

  // another tab, same browser, adds the book
  const other = await context.newPage();
  await addFromProductPage(other, slug);
  await other.close();

  // this tab has not heard about it; coming back to it makes it ask
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(inCartLink(page)).toBeVisible(SLOW);
  await expect(badge(page)).toHaveText("1");
});

test("shelf card: the whole card opens the book, the plus is NOT part of that link, and the keyboard reaches both", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "keyboard path; the touch path is covered above");
  await page.goto("/cart");
  const cards = shelf(page).locator("[data-recommendation]");
  const first = cards.first();
  await expect(first).toBeVisible(SLOW);
  const slug = (await first.getAttribute("data-recommendation"))!;
  const title = (await first.getByRole("heading", { level: 3 }).innerText()).trim();

  // The plus is a sibling of the link, not inside it: no control nested in another.
  expect(await first.locator("a button, a a, button a, button button").count()).toBe(0);
  expect(await first.getByRole("link").count()).toBe(1);

  // Keyboard: the title link, then — one Tab later — the plus of the SAME card.
  await first.getByRole("link").focus();
  await page.keyboard.press("Tab");
  const plus = first.getByRole("button", { name: `Add ${title} to cart` });
  await expect(plus).toBeFocused();

  // Enter on the plus adds the book, and does NOT follow the card's link.
  await expect(async () => {
    await plus.focus();
    await page.keyboard.press("Enter");
    await expect(first.getByRole("button", { name: `${title} is in your cart` })).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/cart$/);
  // focus did not fall to the page: it is still on the same (now ticked) control
  await expect(first.getByRole("button", { name: `${title} is in your cart` })).toBeFocused();

  // Pressing the cover — anywhere on the card but the plus — opens that book's page. The cover is not
  // itself the link (the title link is stretched over the card), so Playwright's "is this the topmost
  // element?" check would refuse; `force` skips only that check, and the mouse still lands on whatever is
  // really there — the link.
  await first.locator(".home-card-hover").first().click({ force: true });
  await expect(page).toHaveURL(new RegExp(`/books/${slug}$`));
});

// ---------------------------------------------------------------------------
// 5. the carousel
// ---------------------------------------------------------------------------

test.describe("carousel arrows", () => {
  test.skip(({ isMobile }) => isMobile, "below 640px there are no arrows — see the phone test");

  test("LEFT → RIGHT → LEFT → RIGHT lands on the same cards, never twice the same book, and walks to both ends", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/cart");
    const region = shelf(page);
    const track = region.locator("[data-carousel-track]");
    const prev = region.getByRole("button", { name: "Previous picks" });
    const next = region.getByRole("button", { name: "Next picks" });
    await expect(next).toBeVisible(SLOW);
    const pos = () => track.evaluate((el) => Math.round(el.scrollLeft));

    // at the start: nowhere to go left, somewhere to go right
    await expect(prev).toHaveAttribute("aria-disabled", "true");
    await expect(next).toHaveAttribute("aria-disabled", "false");
    expect(await pos()).toBe(0);
    const titles = await region.getByRole("heading", { level: 3 }).allInnerTexts();
    expect(new Set(titles).size).toBe(titles.length);
    const firstPage = await fullyVisibleTitles(track);
    expect(firstPage[0]).toBe(titles[0]);

    // RIGHT: a different set of books, the first of them a card boundary
    await next.click();
    const p1 = await settled(track);
    expect(p1).toBeGreaterThan(0);
    const secondPage = await fullyVisibleTitles(track);
    expect(secondPage[0], "the first card cut off by the right edge is now first").not.toBe(firstPage[0]);
    expect(titles.indexOf(secondPage[0])).toBeGreaterThan(titles.indexOf(firstPage[firstPage.length - 1]));
    await expect(prev).toHaveAttribute("aria-disabled", "false");

    // LEFT: exactly back where it started
    await prev.click();
    expect(await settled(track)).toBe(0);
    expect(await fullyVisibleTitles(track)).toEqual(firstPage);
    await expect(prev).toHaveAttribute("aria-disabled", "true");

    // RIGHT again: the same cards as the first time
    await next.click();
    expect(await settled(track)).toBe(p1);
    expect(await fullyVisibleTitles(track)).toEqual(secondPage);

    // LEFT again, then walk right to the very end, seeing every book on the way
    await prev.click();
    expect(await settled(track)).toBe(0);
    const seen = new Set(firstPage);
    for (let i = 0; i < 30; i++) {
      if ((await next.getAttribute("aria-disabled")) === "true") break;
      await next.click();
      await settled(track);
      (await fullyVisibleTitles(track)).forEach((t) => seen.add(t));
    }
    await expect(next).toHaveAttribute("aria-disabled", "true");
    await expect(prev).toHaveAttribute("aria-disabled", "false");
    expect([...seen].sort()).toEqual([...titles].sort());
    // the last card is wholly in view, and another press changes nothing
    expect((await fullyVisibleTitles(track)).at(-1)).toBe(titles.at(-1));
    const end = await pos();
    // `aria-disabled` is not `disabled`, so it can still be pressed — and must do nothing
    // (Playwright will not click it unforced, because it treats aria-disabled as not enabled).
    await next.click({ force: true });
    await page.waitForTimeout(300);
    expect(await pos()).toBe(end);

    // and all the way back
    for (let i = 0; i < 30; i++) {
      if ((await prev.getAttribute("aria-disabled")) === "true") break;
      await prev.click();
      await settled(track);
    }
    expect(await pos()).toBe(0);
  });

  test("the arrows are keyboard-operable, and keep focus when they run out of road", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/cart");
    const region = shelf(page);
    const track = region.locator("[data-carousel-track]");
    const next = region.getByRole("button", { name: "Next picks" });
    await expect(next).toBeVisible(SLOW);
    await next.focus();
    await page.keyboard.press("Enter");
    expect(await settled(track)).toBeGreaterThan(0);
    for (let i = 0; i < 30 && (await next.getAttribute("aria-disabled")) !== "true"; i++) {
      await page.keyboard.press("Enter");
      await settled(track);
    }
    await expect(next).toHaveAttribute("aria-disabled", "true");
    // not `disabled`: it still has focus, so a keyboard user is not thrown to the top of the page
    await expect(next).toBeFocused();
  });

  test("when every card already fits, there are no arrows at all", async ({ page }) => {
    await page.setViewportSize({ width: 2800, height: 1000 });
    await page.goto("/cart");
    const region = shelf(page);
    await expect(region.locator("[data-recommendation]").first()).toBeVisible(SLOW);
    await expect(region).toHaveAttribute("data-scrollable", "false");
    await expect(region.getByRole("button", { name: "Next picks" })).toBeHidden();
    await expect(region.getByRole("button", { name: "Previous picks" })).toBeHidden();
    const { scrollWidth, clientWidth } = await region.locator("[data-carousel-track]").evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test("the soft edge appears only on a side that has more", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/cart");
    const region = shelf(page);
    const track = region.locator("[data-carousel-track]");
    await expect(region.getByRole("button", { name: "Next picks" })).toBeVisible(SLOW);
    const fades = () => track.evaluate((el) => ({ l: el.style.getPropertyValue("--fade-l"), r: el.style.getPropertyValue("--fade-r") }));
    expect(await fades()).toEqual({ l: "0px", r: "32px" }); // start: the first card is not dimmed
    await region.getByRole("button", { name: "Next picks" }).click();
    await settled(track);
    expect((await fades()).l).toBe("32px");
  });

  test.describe("with smooth scrolling on", () => {
    test.use({ contextOptions: { reducedMotion: "no-preference" } });

    test("the animated scroll ends on a card boundary, same as the instant one", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/cart");
      const region = shelf(page);
      const track = region.locator("[data-carousel-track]");
      const next = region.getByRole("button", { name: "Next picks" });
      await expect(next).toBeVisible(SLOW);
      await next.click();
      await settled(track);
      const edgeGap = await track.evaluate((el) => {
        const view = el.getBoundingClientRect().left;
        return Math.min(...Array.from(el.children).map((c) => Math.abs(c.getBoundingClientRect().left - view)));
      });
      expect(edgeGap, "a card sits flush with the left edge").toBeLessThanOrEqual(1);
      await region.getByRole("button", { name: "Previous picks" }).click();
      expect(await settled(track)).toBe(0);
    });
  });
});

test("phone: no arrows, the strip is swiped, and it stops on a card", async ({ page, browserName }, testInfo) => {
  test.skip(!isMobileProject(testInfo) || browserName !== "chromium", "touch swiping is driven through the Chromium protocol");
  await page.goto("/cart");
  const region = shelf(page);
  const track = region.locator("[data-carousel-track]");
  await expect(region.locator("[data-recommendation]").first()).toBeVisible(SLOW);
  await expect(region.getByRole("button", { name: "Next picks" })).toBeHidden();
  await expect(region.getByRole("button", { name: "Previous picks" })).toBeHidden();
  await track.scrollIntoViewIfNeeded();

  // A finger: touch-down, a run of moves, touch-up. (`Input.synthesizeScrollGesture` reports success
  // and scrolls nothing under mobile emulation, so it cannot be used to prove a swipe works.)
  const client = await page.context().newCDPSession(page);
  const swipe = async (dx: number) => {
    const box = (await track.boundingBox())!;
    const y = Math.round(box.y + 80);
    const from = dx < 0 ? Math.round(box.x + box.width - 40) : Math.round(box.x + 40);
    const steps = 12;
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from, y }] });
    for (let i = 1; i <= steps; i++) {
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: Math.round(from + (dx * i) / steps), y }] });
      await page.waitForTimeout(16);
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    return settled(track);
  };

  expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);
  const moved = await swipe(-280);
  expect(moved, "a swipe left moves the strip").toBeGreaterThan(100);
  // snapped: a card sits flush with the left edge
  const gap = await track.evaluate((el) => {
    const view = el.getBoundingClientRect().left;
    return Math.min(...Array.from(el.children).map((c) => Math.abs(c.getBoundingClientRect().left - view)));
  });
  expect(gap).toBeLessThanOrEqual(1);
  let back = moved;
  for (let i = 0; i < 6 && back !== 0; i++) back = await swipe(280);
  expect(back, "and swiping right brings it home").toBe(0);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

test("product page: the related-books carousel scrolls both ways and never lists the book itself", async ({ page, request }, testInfo) => {
  test.skip(isMobileProject(testInfo), "arrows are hidden on phones");
  const [slug] = await purchasable(request);
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto(`/books/${slug}`);
  const region = page.getByRole("region", { name: "Related books" });
  const track = region.locator("[data-carousel-track]");
  const next = region.getByRole("button", { name: "More related books" });
  const prev = region.getByRole("button", { name: "Previous related books" });
  await expect(track).toBeVisible();
  await expect(next).toBeVisible();
  const hrefs = await track.locator("a[href^='/books/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs).not.toContain(`/books/${slug}`);
  expect(new Set(hrefs).size, "no book twice").toBe(hrefs.length);
  await expect(prev).toHaveAttribute("aria-disabled", "true");
  await next.click();
  const p1 = await settled(track);
  expect(p1).toBeGreaterThan(0);
  await prev.click();
  expect(await settled(track)).toBe(0);
  await next.click();
  expect(await settled(track)).toBe(p1);
});

// ---------------------------------------------------------------------------
// 6. a damaged cookie cannot break or empty the cart
// ---------------------------------------------------------------------------

test.describe("damaged cart cookie", () => {
  async function realId(page: Page, request: APIRequestContext): Promise<string> {
    const [slug] = await purchasable(request);
    await addFromProductPage(page, slug);
    const { ids } = await cartApi(page);
    expect(ids).toHaveLength(1);
    return ids[0];
  }
  test("one stray id does not empty the cart, and a ghost is not counted", async ({ page, request, baseURL }) => {
    const id = await realId(page, request);
    const ghost = "ffffffff-ffff-4fff-8fff-ffffffffffff"; // well-formed, but no such book
    await page.context().addCookies([
      {
        name: "dbs_cart",
        value: encodeURIComponent(
          JSON.stringify({
            items: [
              { bookId: "book-a", addedAt: 1 }, // not an id
              { bookId: id, addedAt: 2 },
              { bookId: id.toUpperCase(), addedAt: 3 }, // the same book, spelled differently
              { bookId: ghost, addedAt: 4 },
            ],
          }),
        ),
        url: baseURL!,
      },
    ]);
    // the badge and the list agree: one book
    expect(await cartApi(page)).toEqual({ count: 1, ids: [id] });
    await page.goto("/cart");
    await expect(cartLines(page)).toHaveCount(1, SLOW);
    await expect(page.getByRole("heading", { level: 1, name: "1 book in your cart" })).toBeVisible();
    await expect(badge(page)).toHaveText("1");
  });

  test("an unreadable cookie is an empty cart, not an error page — and adding still works", async ({ page, request, baseURL }) => {
    await page.context().addCookies([{ name: "dbs_cart", value: encodeURIComponent("{definitely not json"), url: baseURL! }]);
    const res = await page.goto("/cart");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your cart is empty", SLOW);
    expect(await cartApi(page)).toEqual({ count: 0, ids: [] });
    const [slug] = await purchasable(request);
    await addFromProductPage(page, slug);
    expect((await cartApi(page)).count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 7. checkout transitions
// ---------------------------------------------------------------------------

test("Buy: the button says it is working, then says what went wrong and can be pressed again", async ({ page, request, baseURL }) => {
  test.skip(!isLocal(baseURL), "would open a real checkout on a server that has a payment key; the local e2e server has it blanked");
  const [slug] = await purchasable(request);
  await addFromProductPage(page, slug);
  await page.goto("/cart");
  const line = page.locator(`[data-cart-line="${slug}"]`);
  const buy = line.getByRole("button", { name: /^Buy \$/ });
  await expect(buy).toBeEnabled(SLOW);
  await expect(async () => {
    await buy.click();
    await expect(line.getByRole("alert")).toContainText(/not configured/i, { timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  // not stuck on "Opening checkout…"; the same button, usable again
  await expect(buy).toBeEnabled();
  await expect(buy).toHaveText(/^Buy \$[\d.]+\s*→$/);
  // and the cart is exactly as it was
  expect((await cartApi(page)).count).toBe(1);
  await expect(page).toHaveURL(/\/cart$/);
});

// ---------------------------------------------------------------------------
// 8. phones: nothing wider than the screen, controls you can touch
// ---------------------------------------------------------------------------

test.describe("cart on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "phone layouts");

  for (const width of MOBILE_WIDTHS) {
    test(`${width}px: two books in the cart — no overflow, nothing clipped, 44px controls`, async ({ page, request }) => {
      await page.setViewportSize({ width, height: 800 });
      const slugs = (await purchasable(request)).slice(0, 2);
      for (const slug of slugs) await addFromProductPage(page, slug);
      await page.goto("/cart");
      await expect(cartLines(page)).toHaveCount(2, SLOW);
      await expect(page.getByRole("button", { name: "Clear cart" })).toBeVisible();

      expect(await horizontalOverflow(page), "page is wider than the screen").toBeLessThanOrEqual(0);
      expect(await clippedContent(page), "content cut off by an overflow:hidden ancestor").toEqual([]);

      for (const slug of slugs) {
        const line = page.locator(`[data-cart-line="${slug}"]`);
        await expectTouchTarget(line.getByRole("button", { name: /^Buy \$/ }), `Buy (${slug})`, 44);
        await expectTouchTarget(line.getByRole("button", { name: /^Remove / }), `Remove (${slug})`, 44);
        const b = (await line.boundingBox())!;
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(width + 1);
      }
      await expectTouchTarget(page.getByRole("button", { name: "Clear cart" }), "Clear cart", 44);

      // the shelf's plus and the header's cart link are touchable too
      await shelf(page).scrollIntoViewIfNeeded();
      await expect(shelf(page).locator("[data-recommendation]").first()).toBeVisible();
      await expectTouchTarget(shelf(page).getByRole("button", { name: /^Add .+ to cart$/ }).first(), "shelf plus", 44);
      await expectTouchTarget(page.getByRole("link", { name: /^Cart, 2 items$/ }), "header cart link", 44);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 9. EVERY book this store sells: ADD → ADD AGAIN → REMOVE → RE-ADD → REFRESH → VERIFY
// ---------------------------------------------------------------------------

test("every purchasable book goes through add, remove, re-add and refresh with the state right at each step", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "the full-catalogue pass runs once, on desktop Chromium");
  test.setTimeout(12 * 60_000);

  const slugs = await purchasable(request);
  expect(slugs.length, "the sandbox sells at least five books").toBeGreaterThanOrEqual(5);

  const BATCH = 20; // a cart holds at most 30
  for (let from = 0; from < slugs.length; from += BATCH) {
    const batch = slugs.slice(from, from + BATCH);

    // ADD, one book at a time, from its own page.
    for (const [i, slug] of batch.entries()) {
      await addFromProductPage(page, slug);
      // ADD AGAIN: there is no second copy to put in — the page offers no "Add" any more.
      await expect(page.getByRole("button", { name: "Add digital edition" }), `${slug}: no second add`).toHaveCount(0);
      await expect(badge(page), `${slug}: badge`).toHaveText(String(Math.min(i + 1, 9)) + (i + 1 > 9 ? "+" : ""));
      expect((await cartApi(page)).count, `${slug}: server count`).toBe(i + 1);
    }

    // The cart page lists exactly these, in this order, and the total is the sum of its lines.
    await page.goto("/cart");
    await expect(cartLines(page)).toHaveCount(batch.length, SLOW);
    expect(await cartLines(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-cart-line")))).toEqual(batch);
    const prices = await cartLines(page).locator("p.tabular-nums").allInnerTexts();
    const total = cents(await orderSummary(page).locator("span.font-serif").innerText());
    expect(total).toBe(prices.reduce((sum, p) => sum + cents(p), 0));

    // REMOVE every one of them, from the list; after each, the server agrees.
    for (const [i, slug] of batch.entries()) {
      await page.locator(`[data-cart-line="${slug}"]`).getByRole("button", { name: /^Remove / }).click();
      await expect(page.locator(`[data-cart-line="${slug}"]`), `${slug}: line steps aside`).toHaveCount(0, SLOW);
      await expect.poll(async () => (await cartApi(page)).count, { message: `${slug}: server count after remove`, timeout: 20_000 }).toBe(batch.length - i - 1);
    }
    expect(await cartApi(page)).toEqual({ count: 0, ids: [] });

    // RE-ADD, then REFRESH and VERIFY on the cart page itself.
    for (const slug of batch) await addFromProductPage(page, slug);
    await page.goto("/cart");
    await page.reload();
    await expect(cartLines(page)).toHaveCount(batch.length, SLOW);
    expect(await cartLines(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-cart-line")))).toEqual(batch);

    // And each product page agrees that its book is in the cart.
    for (const slug of batch.slice(0, 3)) {
      await page.goto(`/books/${slug}`);
      await expect(inCartLink(page), `${slug}: state after refresh`).toBeVisible(SLOW);
    }

    // Leave nothing behind for the next batch.
    await page.goto("/cart");
    await page.getByRole("button", { name: "Clear cart" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your cart is empty", SLOW);
  }
});
