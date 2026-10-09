import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { expect, test, type Page } from "@playwright/test";

import { isMobileProject } from "./helpers";

const run = promisify(execFile);

/**
 * PHASE 12 — what a search engine, a screen reader, a keyboard and a phone on a bad connection each
 * make of the site.
 *
 *   - SEO: the crawl-based audit (`scripts/seo/audit.mjs`) is run against this server and must find no
 *     error: unique titles and descriptions, canonicals, Open Graph, structured data, a sitemap that
 *     lists what is indexable, internal links that answer, one ASIN per book.
 *   - Accessibility: axe-core (WCAG 2.2 AA + best practice) over the pages a visitor lands on, at the
 *     desktop and the phone size, with no violation allowed; every control the Tab key reaches shows
 *     that it has focus.
 *   - Images: the pictures the audit found being delivered at three times the pixels they were drawn
 *     at (a phone fetching 1080px files for 140px slots) stay fixed.
 */

const AXE = fs.readFileSync(path.join(process.cwd(), "node_modules/axe-core/axe.min.js"), "utf8");

/** Pages a visitor lands on, one of each kind. Dynamic ones are read from the sitemap, not named here. */
const STATIC_PAGES = ["/", "/books", "/ebooks", "/authors", "/categories", "/about", "/cart", "/search?q=moon", "/blog", "/terms", "/weather-permitting-bonus"];

async function sitemapPaths(page: Page): Promise<string[]> {
  const res = await page.request.get("/sitemap.xml");
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
}

async function axeViolations(page: Page) {
  await page.evaluate(AXE);
  return page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run: (c: Document, o: unknown) => Promise<{ violations: Array<{ id: string; impact: string; help: string; nodes: Array<{ target: string[]; html: string }> }> }> } }).axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
    });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")}  ${n.html.slice(0, 100)}`) }));
  });
}

test.describe("SEO — the crawl audit finds no error", () => {
  test("titles, descriptions, canonicals, Open Graph, JSON-LD, sitemap, links and ASINs", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "a crawl of the whole site, run once");
    test.setTimeout(180_000);
    const base = testInfo.project.use.baseURL ?? "http://localhost:3210";
    const out = path.join(testInfo.outputDir, "seo-audit.json");
    fs.mkdirSync(testInfo.outputDir, { recursive: true });
    let code = 0;
    let log = "";
    try {
      const r = await run(process.execPath, ["scripts/seo/audit.mjs", "--base", base, "--json", out], { timeout: 150_000, maxBuffer: 8 * 1024 * 1024 });
      log = r.stdout;
    } catch (e) {
      const err = e as { code?: number; stdout?: string; stderr?: string };
      code = err.code ?? 1;
      log = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    }
    const report = fs.existsSync(out) ? (JSON.parse(fs.readFileSync(out, "utf8")) as { findings: Array<{ level: string; url: string; check: string; detail: string }> }) : { findings: [] };
    const errors = report.findings.filter((f) => f.level === "ERROR").map((f) => `${f.url}  ${f.check}: ${f.detail}`);
    expect(errors, log.split("\n").slice(-12).join("\n")).toEqual([]);
    expect(code, "the audit exits 0").toBe(0);
  });
});

test.describe("accessibility — axe-core, WCAG 2.2 AA and best practice", () => {
  test("no violation on the pages a visitor lands on", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop-firefox", "axe runs in Chromium at both sizes; Firefox adds nothing here");
    test.setTimeout(240_000);
    const paths = await sitemapPaths(page);
    const pick = (re: RegExp, n: number) => paths.filter((p) => re.test(p)).slice(0, n);
    const pages = [...STATIC_PAGES, ...pick(/^\/books\/[^/]+$/, 4), ...pick(/^\/authors\/[^/]+$/, 2), ...pick(/^\/categories\/[^/]+$/, 2), ...pick(/^\/blog\/[^/]+$/, 2), ...pick(/^\/companion\/[^/]+$/, 1)];
    const failures: string[] = [];
    for (const p of pages) {
      await page.goto(p);
      await page.waitForLoadState("load");
      await page.waitForTimeout(300);
      for (const v of await axeViolations(page)) failures.push(`${p}  [${v.impact}] ${v.id} — ${v.help}\n      ${v.nodes.join("\n      ")}`);
    }
    expect(failures, `${pages.length} pages at ${isMobileProject(testInfo) ? "phone" : "desktop"} size`).toEqual([]);
  });

  test("the book's page, with its Look Inside viewer open, has no violation", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop-firefox", "axe runs in Chromium");
    await page.goto("/books/weather-permitting");
    await page.getByRole("button", { name: /read preview/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const v = await axeViolations(page);
    expect(v.map((x) => `${x.id}: ${x.nodes.join(" | ")}`)).toEqual([]);
  });
});

test.describe("keyboard — the Tab key reaches things, and each shows it has focus", () => {
  for (const route of ["/", "/books", "/books/weather-permitting", "/about"]) {
    test(`${route}: the first thirty stops all show a focus indicator`, async ({ page }, testInfo) => {
      test.skip(isMobileProject(testInfo), "a hardware keyboard; the phone project has no Tab key");
      await page.goto(route);
      await page.waitForLoadState("load");
      const failures: string[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press("Tab");
        const f = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
          const shadow = cs.boxShadow !== "none" && cs.boxShadow !== "";
          // A control that draws its focus on a wrapper (`group-focus-visible`, `focus-within`) counts: look one level up.
          const parent = el.parentElement ? getComputedStyle(el.parentElement) : null;
          const wrapped = !!parent && ((parent.outlineStyle !== "none" && parseFloat(parent.outlineWidth) > 0) || (parent.boxShadow !== "none" && parent.boxShadow !== ""));
          const r = el.getBoundingClientRect();
          return {
            id: `${el.tagName.toLowerCase()}${el.getAttribute("href") ? `[href=${el.getAttribute("href")?.slice(0, 40)}]` : ""}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")?.slice(0, 30)}]` : ""}`,
            visible: r.width > 0 && r.height > 0,
            indicated: outline || shadow || wrapped,
            skipLink: /skip/i.test(el.textContent ?? ""),
          };
        });
        if (!f) continue;
        if (seen.has(f.id)) continue;
        seen.add(f.id);
        if (f.visible && !f.indicated) failures.push(f.id);
      }
      expect(failures, `${seen.size} distinct stops`).toEqual([]);
    });
  }
});

test.describe("images — the pictures that were delivered at three times their size stay fixed", () => {
  /** Delivered width of each next/image in `selector`, over the width the device needs for it. */
  async function oversize(page: Page, selector: string): Promise<{ n: number; worst: number; detail: string }> {
    return page.evaluate((sel) => {
      const dpr = window.devicePixelRatio;
      let worst = 0;
      let detail = "";
      let n = 0;
      for (const img of document.querySelectorAll<HTMLImageElement>(sel)) {
        const r = img.getBoundingClientRect();
        const m = img.currentSrc.match(/[?&]w=(\d+)/);
        if (!r.width || !m) continue;
        n++;
        const ratio = Number(m[1]) / (r.width * dpr);
        if (ratio > worst) {
          worst = ratio;
          detail = `${img.currentSrc.slice(-60)} drawn ${Math.round(r.width)}px @${dpr}x, w=${m[1]}`;
        }
      }
      return { n, worst, detail };
    }, selector);
  }
  async function scrollThrough(page: Page) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 70));
      }
    });
    await page.waitForTimeout(700);
  }
  // The optimiser offers a fixed ladder of widths (…, 384, 640, 750, 828, 1080, …), so a file one rung up from
  // what is needed is as close as it gets: 2.3 is "one rung of slack", 2.6 was the bug.
  const LIMIT = 2.3;

  test("the category stacks on /about ask for a cover's width, not the card's", async ({ page }) => {
    await page.goto("/about");
    await scrollThrough(page);
    const r = await oversize(page, "[data-category-stack] img");
    expect(r.n, "covers in the stacks").toBeGreaterThan(0);
    expect(r.worst, r.detail).toBeLessThanOrEqual(LIMIT);
  });

  test("the Look Inside strip on a book's page asks for a tile's width, not the screen's", async ({ page }) => {
    await page.goto("/books/weather-permitting");
    await scrollThrough(page);
    const r = await oversize(page, 'ul[aria-label^="Pictures from"] img');
    expect(r.n, "pictures in the strip").toBeGreaterThan(0);
    expect(r.worst, r.detail).toBeLessThanOrEqual(LIMIT);
  });

  test("the catalogue's covers are delivered at about the size they are drawn", async ({ page }) => {
    await page.goto("/books");
    await scrollThrough(page);
    const r = await oversize(page, "main article img");
    expect(r.n, "covers on the page").toBeGreaterThan(0);
    expect(r.worst, r.detail).toBeLessThanOrEqual(LIMIT);
  });
});

test.describe("caching — the press's own pictures are not re-fetched on every page", () => {
  test("/images/** answers with a cache lifetime, and the optimiser's output with one too", async ({ request }) => {
    const own = await request.get("/images/books/weather-permitting.webp");
    expect(own.status()).toBe(200);
    expect(own.headers()["cache-control"] ?? "", "a file under /public/images").toMatch(/max-age=(\d{5,})/);
    const opt = await request.get("/_next/image?url=%2Fimages%2Fbooks%2Fweather-permitting.webp&w=640&q=75");
    expect(opt.status()).toBe(200);
    expect(opt.headers()["cache-control"] ?? "", "the optimiser's output").toMatch(/max-age=(\d{4,})/);
  });
});
