import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { isMobileProject } from "./helpers";

/**
 * PHASE 11 — the catalogue's book cards are one system.
 *
 * /books and /ebooks show every book as a card (grid) or a row (list). Whatever
 * the book — a one-word title or a 67-character one, a Kindle edition or three
 * print editions, a page count or none — at a given width every card must be the
 * same size, with its title, author, page line and chips starting at the same
 * place, the cover in a 2:3 frame it fills without distortion, and nothing
 * outside the card. This measures all of that, on every page of both routes, at
 * the widths the brief names (phones from 320 up, a tablet, a laptop, a desktop,
 * a large desktop), rather than looking at one screenshot and agreeing with it.
 *
 * It measures geometry, not the catalogue: no book is named here, so a new book
 * with a longer title is tested against the same rules.
 */

const WIDTHS = [320, 360, 375, 390, 412, 768, 1024, 1280, 1366, 1440, 1920, 2560];
const ROUTES = ["/books", "/ebooks"] as const;
const TOL = 0.75; // px — sub-pixel layout, fractional card widths

interface Box {
  top: number;
  height: number;
  width: number;
  left: number;
}
interface Facts {
  slug: string;
  title: string;
  linkName: string | null;
  card: Box;
  cover: Box;
  image: { fit: string; box: Box } | null;
  titleBox: { offset: number; height: number; lines: number; allowed: number; clamped: boolean; wide: boolean };
  author: { offset: number; height: number; wraps: boolean };
  pagesOffset: number | null;
  chips: { offset: number; height: number; rows: number; tallest: number; wide: boolean; texts: string[] };
  escapes: string[];
}

/** Everything the rules need, read in one pass from the live page. */
async function measure(page: Page): Promise<{ cards: Facts[]; overflow: number; viewMode: "grid" | "list" }> {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const px = (n: number) => Math.round(n * 100) / 100;
    const box = (r: DOMRect, ref: DOMRect): { top: number; height: number; width: number; left: number } => ({
      top: px(r.top - ref.top),
      height: px(r.height),
      width: px(r.width),
      left: px(r.left - ref.left),
    });
    const articles = [...document.querySelectorAll<HTMLElement>("main ul > li > article.catalog-card, main ul > li > article.catalog-row")];
    const cards = articles.map((el) => {
      const r = el.getBoundingClientRect();
      const link = el.querySelector<HTMLAnchorElement>('a[href^="/books/"]');
      const h4 = el.querySelector<HTMLElement>("h4")!;
      const h4cs = getComputedStyle(h4);
      const lineH = parseFloat(h4cs.lineHeight);
      const allowed = Number(h4cs.getPropertyValue("--lines")) || 0;
      const author = h4.nextElementSibling as HTMLElement;
      const aCs = getComputedStyle(author);
      const cover = el.querySelector<HTMLElement>('[class*="aspect-"]')!;
      const img = el.querySelector<HTMLImageElement>("img");
      const chipsEl = el.querySelector<HTMLElement>(".catalog-card__chips")!;
      const chipItems = [...chipsEl.querySelectorAll<HTMLElement>("li")];
      const tops = new Set(chipItems.map((c) => Math.round(c.getBoundingClientRect().top)));
      const pagesEl = author.nextElementSibling?.firstElementChild as HTMLElement | null;
      // anything painted outside the card (the sr-only text is 1px and clipped — skip it)
      const escapes: string[] = [];
      for (const d of el.querySelectorAll<HTMLElement>("*")) {
        const cs = getComputedStyle(d);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        if (d.classList.contains("sr-only") || (d.closest(".sr-only") !== null)) continue;
        const b = d.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) continue;
        if (b.left < r.left - 1 || b.right > r.right + 1 || b.top < r.top - 1 || b.bottom > r.bottom + 1) {
          escapes.push(`${d.tagName.toLowerCase()}.${String(d.className).slice(0, 40)}`);
        }
      }
      return {
        slug: (link?.getAttribute("href") ?? "").replace("/books/", ""),
        title: h4.textContent ?? "",
        linkName: link?.getAttribute("aria-label") ?? null,
        card: { top: px(r.top), height: px(r.height), width: px(r.width), left: px(r.left) },
        cover: box(cover.getBoundingClientRect(), r),
        image: img ? { fit: getComputedStyle(img).objectFit, box: box(img.getBoundingClientRect(), r) } : null,
        titleBox: {
          offset: px(h4.getBoundingClientRect().top - r.top),
          height: px(h4.getBoundingClientRect().height),
          lines: Math.round(h4.getBoundingClientRect().height / lineH),
          allowed,
          clamped: h4.scrollHeight > h4.clientHeight + 1,
          wide: h4.scrollWidth > h4.clientWidth + 1,
        },
        author: {
          offset: px(author.getBoundingClientRect().top - r.top),
          height: px(author.getBoundingClientRect().height),
          wraps: author.getBoundingClientRect().height > parseFloat(aCs.lineHeight) + 1,
        },
        pagesOffset: pagesEl ? px(pagesEl.getBoundingClientRect().top - r.top) : null,
        chips: {
          offset: px(chipsEl.getBoundingClientRect().top - r.top),
          height: px(chipsEl.getBoundingClientRect().height),
          rows: tops.size,
          tallest: Math.max(0, ...chipItems.map((c) => c.getBoundingClientRect().height)),
          wide: chipItems.some((c) => c.scrollWidth > c.clientWidth + 1),
          texts: chipItems.map((c) => (c.textContent ?? "").trim()),
        },
        escapes,
      };
    });
    return {
      cards,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      viewMode: articles[0]?.classList.contains("catalog-row") ? ("list" as const) : ("grid" as const),
    };
  });
}

/** Every page of a route, in the given view. */
async function allCards(page: Page, route: string, view: "grid" | "list") {
  const out: Array<Facts & { page: number }> = [];
  let overflow = 0;
  let pages = 1;
  for (let n = 1; n <= pages; n++) {
    const q = new URLSearchParams();
    if (view === "list") q.set("view", "list");
    if (n > 1) q.set("page", String(n));
    await page.goto(`${route}${q.size ? `?${q}` : ""}`);
    await page.locator("main ul > li > article").first().waitFor();
    if (n === 1) {
      const total = Number((await page.getByText(/of \d+ books/).first().textContent())?.match(/of (\d+) books/)?.[1] ?? 0);
      pages = Math.max(1, Math.ceil(total / 12));
    }
    const m = await measure(page);
    expect(m.viewMode, `${route} page ${n} is in ${view} view`).toBe(view);
    overflow = Math.max(overflow, m.overflow);
    out.push(...m.cards.map((c) => ({ ...c, page: n })));
  }
  return { cards: out, overflow };
}

function allEqual(values: number[], what: string, tol = TOL) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  expect(max - min, `${what}: ${min} … ${max}`).toBeLessThanOrEqual(tol);
}

/** The rules every card must meet, in either view. */
function expectOneSystem(cards: Array<Facts & { page: number }>, where: string) {
  expect(cards.length, `${where}: cards found`).toBeGreaterThan(0);
  const tag = (c: Facts) => `${where} · ${c.slug}`;

  // One size, one skeleton: the same on every card on every page.
  allEqual(cards.map((c) => c.card.height), `${where}: card height`);
  allEqual(cards.map((c) => c.card.width), `${where}: card width`);
  allEqual(cards.map((c) => c.titleBox.offset), `${where}: where the title starts`);
  allEqual(cards.map((c) => c.titleBox.height), `${where}: the title's reserved height`);
  allEqual(cards.map((c) => c.author.offset), `${where}: where the author starts`);
  allEqual(cards.map((c) => c.chips.offset), `${where}: where the chips start`);
  allEqual(cards.map((c) => c.chips.height), `${where}: the chips' reserved height`);
  allEqual(cards.map((c) => c.cover.height), `${where}: cover frame height`);
  allEqual(cards.map((c) => c.cover.width), `${where}: cover frame width`);
  const pageOffsets = cards.map((c) => c.pagesOffset).filter((v): v is number => v !== null);
  if (pageOffsets.length) allEqual(pageOffsets, `${where}: where the page line starts`);

  for (const c of cards) {
    // The cover: a 2:3 frame, filled without being stretched, never cropped to nothing.
    expect(c.cover.width / c.cover.height, `${tag(c)}: cover frame is 2:3`).toBeCloseTo(2 / 3, 2);
    if (c.image) {
      expect(["cover", "contain"], `${tag(c)}: the cover is scaled, never stretched`).toContain(c.image.fit);
      expect(Math.abs(c.image.box.width - c.cover.width), `${tag(c)}: the image fills its frame (width)`).toBeLessThanOrEqual(TOL);
      expect(Math.abs(c.image.box.height - c.cover.height), `${tag(c)}: the image fills its frame (height)`).toBeLessThanOrEqual(TOL);
    }

    // The title: within the lines it was given, and whole in the link's name.
    expect(c.titleBox.lines, `${tag(c)}: title lines`).toBeLessThanOrEqual(c.titleBox.allowed);
    expect(c.titleBox.wide, `${tag(c)}: the title does not push sideways`).toBe(false);
    expect(c.linkName, `${tag(c)}: the card is named by the whole title`).toBe(`View ${c.title}`);

    // The author is one line; the chips are one line each, in at most the rows reserved.
    expect(c.author.wraps, `${tag(c)}: author on one line`).toBe(false);
    expect(c.chips.wide, `${tag(c)}: a chip never wraps or spills`).toBe(false);
    if (c.chips.texts.length) expect(Math.round(c.chips.tallest), `${tag(c)}: a chip is one line tall`).toBe(24);
    expect(c.chips.rows, `${tag(c)}: chip rows`).toBeLessThanOrEqual(2);

    // Nothing sticks out of the card.
    expect(c.escapes, `${tag(c)}: parts outside the card`).toEqual([]);
  }
}

function nativeViews(testInfo: TestInfo): Array<{ width: number; height: number }> {
  return isMobileProject(testInfo) ? [{ width: 393, height: 851 }] : [{ width: 1440, height: 900 }];
}

test.describe("book cards — one geometry, every width (Chromium, the widths the brief names)", () => {
  for (const width of WIDTHS) {
    test(`grid at ${width}px: every card on every page of /books and /ebooks is the same`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-chromium", "the width sweep runs once, in desktop Chromium");
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      for (const route of ROUTES) {
        const { cards, overflow } = await allCards(page, route, "grid");
        expect(overflow, `${route} at ${width}px scrolls sideways`).toBeLessThanOrEqual(0);
        expectOneSystem(cards, `${route} @${width}`);
      }
    });
  }

  for (const width of [320, 390, 768, 1440]) {
    test(`list at ${width}px: every row is the same`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-chromium", "the width sweep runs once, in desktop Chromium");
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      for (const route of ROUTES) {
        const { cards, overflow } = await allCards(page, route, "list");
        expect(overflow, `${route} list at ${width}px scrolls sideways`).toBeLessThanOrEqual(0);
        expectOneSystem(cards, `${route} list @${width}`);
      }
    });
  }
});

test.describe("book cards — each browser at its own size", () => {
  test("grid and list are uniform at this project's native viewport", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const [vp] = nativeViews(testInfo);
    await page.setViewportSize(vp);
    for (const view of ["grid", "list"] as const) {
      const { cards, overflow } = await allCards(page, "/books", view);
      expect(overflow, `/books ${view} scrolls sideways`).toBeLessThanOrEqual(0);
      expectOneSystem(cards, `/books ${view} @${vp.width} (${testInfo.project.name})`);
    }
  });
});

test.describe("book cards — what is NOT on them", () => {
  test("no dead wishlist heart or lock sits on top of the cover art", async ({ page }) => {
    await page.goto("/books");
    await page.locator("main ul > li > article").first().waitFor();
    await expect(page.getByRole("button", { name: /wishlist/i })).toHaveCount(0);
    await expect(page.locator('main [title*="Locked"]')).toHaveCount(0);
    // The only controls that may sit inside a card are the gift box (while a promotion runs).
    const buttons = await page.locator("main ul > li > article button").evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label") ?? b.textContent ?? ""));
    for (const name of buttons) expect(name, "a button on a card").toMatch(/free|promotion/i);
  });
});

test.describe("book cards — a running promotion does not change the cards", () => {
  for (const width of [320, 1440]) {
    test(`the gift box fits inside the same card at ${width}px`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-chromium", "geometry is engine-independent; run once");
      test.setTimeout(120_000);
      // Open the window on the server's clock, so the gift box renders on every card that can be given away.
      await page.route("**/api/campaign", (route) => {
        const now = Date.now();
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ serverNowMs: now, startsAtMs: now - 3_600_000, endsAtMs: now + 86_400_000 }),
        });
      });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/books");
      await page.locator("main ul > li > article").first().waitFor();
      const gifts = page.locator("main ul > li > article button.gift-box");
      await expect(gifts.first(), "the promotion is running in this test").toBeVisible({ timeout: 15_000 });

      const { cards } = await measure(page);
      expectOneSystem(cards.map((c) => ({ ...c, page: 1 })), `/books with a promotion @${width}`);

      // And each box sits inside its own card, clear of the page line.
      const clashes = await page.evaluate(() => {
        const bad: string[] = [];
        for (const art of document.querySelectorAll("main ul > li > article")) {
          const g = art.querySelector("button.gift-box");
          if (!g) continue;
          const a = art.getBoundingClientRect();
          const b = g.getBoundingClientRect();
          if (b.left < a.left || b.right > a.right || b.top < a.top || b.bottom > a.bottom) bad.push("outside its card");
          const chips = art.querySelector(".catalog-card__chips")!.getBoundingClientRect();
          if (b.bottom > chips.top + 0.5) bad.push("on top of the chips");
        }
        return bad;
      });
      expect(clashes).toEqual([]);
    });
  }
});

test.describe("book cards — they still do their job", () => {
  test("a plain click on a list row opens Quick View for that book; a modified click would leave", async ({ page }, testInfo) => {
    test.skip(isMobileProject(testInfo), "a mouse click; the phone's tap is covered by the overlay specs");
    await page.goto("/books?view=list");
    const row = page.locator("main ul > li > article.catalog-row").first();
    await row.waitFor();
    const title = (await row.locator("h4").textContent()) ?? "";
    const href = await row.locator('a[href^="/books/"]').getAttribute("href");
    expect(href).toMatch(/^\/books\/[a-z0-9-]+$/);
    await row.locator('a[href^="/books/"]').click({ force: true });
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(title.trim());
  });

  test("the grid and the list show the same books, in the same order", async ({ page }) => {
    const slugs = async (view: "grid" | "list") => {
      await page.goto(`/books${view === "list" ? "?view=list" : ""}`);
      await page.locator("main ul > li > article").first().waitFor();
      return page.$$eval('main ul > li > article a[href^="/books/"]', (as) => as.map((a) => a.getAttribute("href")));
    };
    expect(await slugs("list")).toEqual(await slugs("grid"));
  });

  test("a list row shows the book's real cover, not a painted stand-in", async ({ page }) => {
    await page.goto("/books?view=list");
    const rows = page.locator("main ul > li > article.catalog-row");
    await rows.first().waitFor();
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      await expect(rows.nth(i).locator("img").first(), `row ${i} has its cover`).toHaveCount(1);
    }
  });
});

test.describe("book cards — no hydration or React errors", () => {
  test("/books and /ebooks, grid and list, load without a page error or a React/hydration warning", async ({ page }) => {
    const problems: string[] = [];
    // Not "any console error": a build served from localhost loads third-party scripts (analytics, the auth
    // widget with the production keys) that refuse to run off their own domain and say so. What a CARD can
    // cause is a page error, a hydration mismatch, a React key/nesting warning — those are what is read here.
    const react = /hydrat|server rendered|did not match|Minified React error|Cannot update a component|unique "key"|Invalid DOM property|validateDOMNesting|cannot be a descendant|cannot contain a nested/i;
    page.on("console", (m) => {
      if ((m.type() === "error" || m.type() === "warning") && react.test(m.text())) problems.push(`${m.type()}: ${m.text().slice(0, 300)}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    for (const route of ROUTES) {
      for (const view of ["", "?view=list"]) {
        await page.goto(`${route}${view}`);
        await page.locator("main ul > li > article").first().waitFor();
        await page.waitForTimeout(500);
      }
    }
    expect(problems).toEqual([]);
  });
});
