import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { BOOKS, CATEGORIES } from "../scripts/catalog/valice-catalog.mjs";

import { UNLOCKED, horizontalOverflow, isMobileProject, lockState, press } from "./helpers";

/**
 * The spiral library on /books, as a browser gets it.
 *
 * Expectations come from the catalogue file, never from literals: which books
 * stand on which shelf (each on the first of its collections in shelf order),
 * which Amazon link each opens on, and which books have none. A page that
 * disagrees with the catalogue fails.
 *
 * The suite runs as the config runs every context — `reducedMotion: "reduce"`:
 * the camera cuts from shelf to shelf, which makes positions exact. The block
 * at the end runs with full motion.
 */

interface Fmt {
  format: "ebook" | "paperback" | "hardcover" | "large_print";
  availability: "available" | "coming_soon" | "unavailable";
  fulfillment: "direct" | "amazon";
  amazonUrl?: string | null;
}
interface Bk {
  slug: string;
  title: string;
  websiteStatus: string;
  categories: string[];
  formats: Fmt[];
}
const published = (BOOKS as unknown as Bk[]).filter((b) => b.websiteStatus === "published");
const collectionName = new Map((CATEGORIES as unknown as Array<{ slug: string; name: string }>).map((c) => [c.slug, c.name]));

/** The shelves top to bottom, as the page must build them: `SHELF_ORDER` in `library-shelves.ts`. */
const SHELF_ORDER = ["romance", "myth-and-folklore", "games-and-play", "puzzle-and-challenge", "language-and-learning", "young-explorers", "classics-and-philosophy"];
const shelfOf = (b: Bk) => [...b.categories].sort((x, y) => SHELF_ORDER.indexOf(x) - SHELF_ORDER.indexOf(y))[0];
const SHELVES = SHELF_ORDER.filter((slug) => published.some((b) => shelfOf(b) === slug));

/**
 * The Amazon link Quick View must open on from the library: the book's first
 * Amazon edition in Quick View's order (Kindle, paperback, hardcover, large
 * print), where a direct ebook's ASIN is its Kindle twin (`withKindleEditions`).
 * Null for a book Amazon does not sell.
 */
const RANK = { ebook: 0, paperback: 1, hardcover: 2, large_print: 3 } as const;
function firstAmazonUrl(b: Bk): string | null {
  const offered = b.formats
    .flatMap((f) =>
      f.format === "ebook" && f.fulfillment === "direct" && f.amazonUrl
        ? [{ ...f, fulfillment: "amazon" as const, availability: "available" as const }]
        : [f],
    )
    .filter((f) => f.fulfillment === "amazon" && f.availability === "available" && f.amazonUrl)
    .sort((a, z) => RANK[a.format] - RANK[z.format]);
  return offered[0]?.amazonUrl ?? null;
}

const AXE = fs.readFileSync(path.join(process.cwd(), "node_modules/axe-core/axe.min.js"), "utf8");

const section = (page: Page) => page.locator("section[data-library]");

async function openLibrary(page: Page, path = "/books"): Promise<"ready" | "list"> {
  // Not the load event: under a full parallel run, software WebGL in four browsers can hold it back for half a minute.
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(section(page)).toHaveAttribute("data-library", /^(ready|list)$/, { timeout: 45_000 });
  return (await section(page).getAttribute("data-library")) as "ready" | "list";
}

/** Scroll the page itself to shelf `i`'s stop, as a reader's scroll would. */
async function scrollToShelf(page: Page, i: number) {
  await page.evaluate((index) => {
    const track = document.querySelector<HTMLElement>("section[data-library] > div.relative")!;
    const stage = track.firstElementChild as HTMLElement;
    const shelves = document.querySelectorAll("section[data-library] .library-index h2").length;
    const segment = (track.offsetHeight - stage.offsetHeight) / Math.max(1, shelves - 1);
    const top = track.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(stage).top);
    window.scrollTo({ top: top + index * segment, behavior: "instant" });
  }, i);
}

const railCurrent = (page: Page) =>
  page.locator('nav[aria-label="Shelves"]:visible a[aria-current="location"]').first();

test.describe("the spiral library on /books", () => {
  test("stands every published book on its shelf, in shelf order, each linked once", async ({ page }) => {
    await openLibrary(page);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("All books");

    const headings = await page.locator("section[data-library] .library-index h2").allTextContents();
    expect(headings.map((h) => h.split(",")[0])).toEqual(SHELVES.map((s) => collectionName.get(s)));

    for (const [i, shelf] of SHELVES.entries()) {
      const expected = published.filter((b) => shelfOf(b) === shelf).map((b) => b.slug).sort();
      const onShelf = await page
        .locator("section[data-library] .library-index > div")
        .nth(i)
        .locator('a[href^="/books/"]')
        .evaluateAll((as) => as.map((a) => a.getAttribute("href")!.replace("/books/", "")));
      expect([...onShelf].sort(), shelf).toEqual(expected);
    }
    const all = await page.locator('section[data-library] a[href^="/books/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(new Set(all).size).toBe(published.length);
    expect(all).toHaveLength(published.length);
    expect(all).not.toContain("/books/ridge-runner"); // the staged draft
  });

  test("opens every book's Quick View on its first Amazon edition — or, with none, on its own way to buy", async ({ page }) => {
    test.setTimeout(180_000);
    await openLibrary(page);
    for (const b of published) {
      await page.locator(`#library-book-${b.slug}`).focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog, b.slug).toBeVisible();
      await expect(dialog.getByRole("heading", { level: 2 }).first(), b.slug).toHaveText(b.title);
      const amazon = dialog.getByRole("link", { name: /Buy on Amazon/ });
      const expected = firstAmazonUrl(b);
      if (expected) {
        await expect(amazon, b.slug).toHaveCount(1);
        await expect(amazon, b.slug).toHaveAttribute("href", expected);
        await expect(amazon).toHaveAttribute("target", "_blank");
        await expect(amazon).toHaveAttribute("rel", /noopener/);
      } else {
        await expect(dialog.getByRole("link", { name: /Amazon/ }), b.slug).toHaveCount(0);
        await expect(dialog.getByText(/Not sold on Amazon/), b.slug).toBeVisible();
        await expect(dialog.getByRole("link", { name: /Buy the digital edition/ }), b.slug).toBeVisible();
      }
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(page.locator(`#library-book-${b.slug}`), "focus returns to the book's link").toBeFocused();
    }
    expect(await lockState(page)).toEqual(UNLOCKED);
  });

  test("a press on a cover opens that book, and Back or Escape gives the page back unlocked", async ({ page }, testInfo) => {
    const mode = await openLibrary(page);
    test.skip(mode !== "ready", "no WebGL in this browser: the list is the library (tested below)");
    const box = (await page.locator("section[data-library] canvas").boundingBox())!;
    const romance = published.filter((b) => shelfOf(b) === "romance").map((b) => b.title);
    // The shelf in front stands 40–46 % down the stage; the stage's centre column is its front books.
    await page.waitForTimeout(500);
    const x = box.x + box.width / 2 + box.width * 0.03;
    const y = box.y + box.height * (isMobileProject(testInfo) ? 0.46 : 0.4);
    if (isMobileProject(testInfo)) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(romance).toContain(await dialog.getByRole("heading", { level: 2 }).first().textContent());
    expect(await lockState(page)).toMatchObject({ html: "hidden", inert: true });
    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/books$/);
    expect(await lockState(page)).toEqual(UNLOCKED);
  });

  test("the page's own scroll walks the shelves, then goes on into the full catalogue", async ({ page }) => {
    const mode = await openLibrary(page);
    test.skip(mode !== "ready", "the list scrolls like any page");
    for (const [i, shelf] of SHELVES.entries()) {
      await scrollToShelf(page, i);
      await expect(railCurrent(page), shelf).toContainText(collectionName.get(shelf)!);
    }
    // A wheel over the scene scrolls the page: nothing cancels it.
    await scrollToShelf(page, 0);
    const before = await page.evaluate(() => window.scrollY);
    const box = (await page.locator("section[data-library] canvas").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 300);
    // One screen past the last shelf, the full catalogue follows.
    await scrollToShelf(page, SHELVES.length - 1);
    await page.evaluate(() => window.scrollBy({ top: window.innerHeight, behavior: "instant" }));
    await expect(page.locator("#all-books-title")).toBeInViewport();
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test("a shelf is one press away on the rail, and the address can name it", async ({ page }, testInfo) => {
    const mode = await openLibrary(page);
    test.skip(mode !== "ready", "the list's rail is plain page anchors");
    const rail = page.locator('nav[aria-label="Shelves"]:visible');
    await press(rail.getByRole("link", { name: /Games & Play/ }), testInfo);
    await expect(railCurrent(page)).toContainText("Games & Play");
    await expect(page, "the shelf is in the address, to share").toHaveURL(/#shelf-games-and-play$/);

    // A shelf named in the address while the page is open…
    await page.evaluate(() => (window.location.hash = "#shelf-puzzle-and-challenge"));
    await expect(railCurrent(page)).toContainText("Puzzle & Challenge");

    // …and on arrival, in a fresh tab. Read by polling the page rather than with a locator: Playwright's Firefox can
    // sit "waiting for navigation to finish" on a URL with a fragment long after the page has arrived (2026-10-22,
    // under four parallel workers — the failure screenshot showed the right shelf in front).
    const arriving = await page.context().newPage();
    await arriving.goto("/books#shelf-classics-and-philosophy", { waitUntil: "commit" });
    await expect
      .poll(
        () =>
          arriving
            .evaluate(() => document.querySelector('nav[aria-label="Shelves"] a[aria-current="location"]')?.textContent ?? "")
            .catch(() => ""),
        { timeout: 45_000 },
      )
      .toContain("Classics & Philosophy");
    await arriving.close();
  });

  test("a long shelf turns a frontful at a time, to both ends, and says which books are in front", async ({ page }, testInfo) => {
    const mode = await openLibrary(page);
    test.skip(mode !== "ready", "nothing turns in the list");
    const myth = SHELVES.indexOf("myth-and-folklore");
    const count = published.filter((b) => shelfOf(b) === "myth-and-folklore").length;
    await scrollToShelf(page, myth);
    const later = page.getByRole("button", { name: /Turn Myth & Folklore to later books/ });
    const earlier = page.getByRole("button", { name: /Turn Myth & Folklore to earlier books/ });
    const range = page.locator("section[data-library] p[aria-live]").filter({ hasText: / of \d+$/ });
    const read = async () => (await range.textContent())!.match(/(\d+)–(\d+) of (\d+)/)!.slice(1).map(Number);

    const [first, last, total] = await read();
    expect(total).toBe(count);
    const front = last - first + 1; // 5 on a wide screen, 3 on a phone
    expect(front % 2).toBe(1);
    while (!(await later.isDisabled())) await press(later, testInfo);
    expect(await read()).toEqual([count - front + 1, count, count]);
    while (!(await earlier.isDisabled())) await press(earlier, testInfo);
    expect(await read()).toEqual([1, front, count]);
  });

  test("draws every cover from the catalogue's own file: one request each, every one an image", async ({ page }) => {
    // A 256 px copy of the cover from the image optimiser, or — on a high-density desktop — the 432 px thumb.
    const pattern = /(?:\/_next\/image\?url=%2Fimages%2Fbooks%2F([a-z0-9-]+)\.webp&w=256&q=75|\/images\/books\/thumb\/([a-z0-9-]+)\.webp)$/;
    const covers = new Map<string, { status: number; type: string; count: number }>();
    page.on("response", (r) => {
      const m = r.url().match(pattern);
      if (!m || r.request().resourceType() === "image") return;
      const slug = m[1] ?? m[2];
      const seen = covers.get(slug);
      covers.set(slug, { status: r.status(), type: r.headers()["content-type"] ?? "", count: (seen?.count ?? 0) + 1 });
    });
    const mode = await openLibrary(page);
    test.skip(mode !== "ready", "the list draws covers with <img>");
    await expect.poll(() => covers.size, { timeout: 45_000 }).toBe(published.length);
    expect([...covers.keys()].sort()).toEqual(published.map((b) => b.slug).sort());
    for (const [slug, r] of covers) {
      expect(r.status, slug).toBe(200);
      expect(r.type, slug).toBe("image/webp");
      expect(r.count, `${slug} fetched more than once`).toBe(1);
    }
  });
});

test.describe("without WebGL", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === "webgl2" || type === "webgl") return null;
        return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof original;
    });
  });

  test("the same shelves are a list, with the same links and Quick View, and no 3D code is fetched", async ({ page }) => {
    const scripts: string[] = [];
    page.on("response", async (r) => {
      if (r.request().resourceType() === "script") scripts.push((await r.text().catch(() => "")).includes("WebGLRenderer") ? r.url() : "");
    });
    expect(await openLibrary(page)).toBe("list");
    await expect(page.locator("section[data-library] canvas")).toHaveCount(0);
    for (const shelf of SHELVES) {
      await expect(page.locator(`#shelf-${shelf} h2`)).toBeVisible();
    }
    await expect(page.locator('section[data-library] a[href^="/books/"]:visible')).toHaveCount(published.length);
    await expect(page.getByRole("button", { name: "Library", exact: true }), "no Library to switch to without WebGL").toBeDisabled();

    const kwaidan = published.find((b) => b.slug === "kwaidan")!;
    await page.locator('#shelf-myth-and-folklore a[href="/books/kwaidan"]').click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { level: 2 }).first()).toHaveText(kwaidan.title);
    await expect(dialog.getByRole("link", { name: /Amazon/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.waitForLoadState("networkidle");
    expect(scripts.filter(Boolean), "the 3D chunk was downloaded").toEqual([]);
  });

  test("the list has no accessibility violation", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop-firefox", "axe runs in Chromium, as in quality.pw.ts");
    await openLibrary(page);
    await page.evaluate(AXE);
    const result = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: Array<{ id: string; nodes: unknown[] }> }> } }).axe;
      return axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } });
    });
    expect(result.violations.map((v) => `${v.id} ×${v.nodes.length}`)).toEqual([]);
  });
});

test.describe("choosing the view", () => {
  test("the List view can be chosen, is remembered, and the Library comes back", async ({ page }, testInfo) => {
    const mode = await openLibrary(page);
    test.skip(mode !== "ready", "this browser only has the list");
    await press(page.getByRole("button", { name: "List", exact: true }), testInfo);
    await expect(section(page)).toHaveAttribute("data-library", "list");
    await page.reload();
    await expect(section(page)).toHaveAttribute("data-library", "list");
    await press(page.getByRole("button", { name: "Library", exact: true }), testInfo);
    await expect(section(page)).toHaveAttribute("data-library", /^(loading|ready)$/);
  });
});

test.describe("the newsletter popup and the library", () => {
  test("waits while the library is on screen, and may appear once the reader has gone on past it", async ({ page }) => {
    await page.clock.install();
    await openLibrary(page);
    await page.clock.fastForward(40_000);
    await expect(page.getByRole("dialog"), "the popup opened over the library").toHaveCount(0);
    expect(await lockState(page)).toEqual(UNLOCKED);

    await page.evaluate(() => document.getElementById("all-books")!.scrollIntoView({ block: "start", behavior: "instant" }));
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.clock.fastForward(4_000);
    const popup = page.getByRole("dialog", { name: /Newsletter/ });
    test.skip((await popup.count()) === 0, "popup not eligible in this environment (/api/popup said no) — the hold itself is asserted above");
    await expect(popup).toBeVisible();
  });
});

test.describe("with full motion", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("the camera follows the scroll and comes to rest; nothing is drawn while the reader is still", async ({ page }) => {
    const mode = await openLibrary(page, "/books?library-stats");
    test.skip(mode !== "ready", "no WebGL in this browser");
    const frames = () => page.evaluate(() => window.__libraryStats!.frames.length);
    const drawn = await frames();
    await scrollToShelf(page, 3);
    await expect(railCurrent(page)).toContainText(collectionName.get(SHELVES[3])!);
    // It travels — several frames, not one cut…
    await expect.poll(frames).toBeGreaterThan(drawn + 5);
    // …and comes to rest: once the count stops rising, a still second draws nothing.
    let last = -1;
    await expect.poll(async () => {
      const n = await frames();
      const settled = n === last;
      last = n;
      return settled;
    }, { intervals: [600], timeout: 15_000 }).toBe(true);
    const before = await frames();
    await page.waitForTimeout(1000);
    expect((await frames()) - before, "frames drawn while nothing moved").toBe(0);
  });
});
