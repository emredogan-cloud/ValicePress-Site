#!/usr/bin/env node
/**
 * Visual-regression capture for the Valice Press site.
 *
 *   node QA/visual-regression/capture.mjs --base https://valicepress.com --label before
 *   node QA/visual-regression/capture.mjs --base http://localhost:3210  --label after
 *
 * Writes QA/visual-regression/<label>/<viewport>/<page>.png plus a manifest.json
 * recording, per page, the HTTP status, final URL, console errors, failed
 * requests and any horizontal overflow. The manifest is what lets "before" and
 * "after" be compared on facts, not just on pixels.
 *
 * Headless Chromium reports visibilityState "visible", so lazy images load and
 * rAF runs — unlike a background automation tab (see memory: hidden-tab-suspends-raf).
 * Read-only against the target: it only issues GETs and clicks.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"]);
    return acc;
  }, []),
);

const BASE = (args.base ?? "https://valicepress.com").replace(/\/$/, "");
const LABEL = args.label ?? "before";
const ONLY = args.only ? String(args.only).split(",") : null;
const DELAY_MS = Number(args.delay ?? 1200); // be polite to production

/** Representative pages named in the master prompt (§53). */
export const PAGES = [
  { name: "home", path: "/" },
  { name: "books", path: "/books" },
  { name: "ebooks", path: "/ebooks" },
  { name: "detail-romance", path: "/books/the-sweetest-season" },
  { name: "detail-reference", path: "/books/the-great-book-of-world-games" },
  { name: "authors", path: "/authors" },
  { name: "about", path: "/about" },
  { name: "cart", path: "/cart" },
  { name: "bonus", path: "/bonus" },
];

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900, mobile: false, dsf: 1 },
  { name: "mobile-390", width: 390, height: 844, mobile: true, dsf: 2 },
];

async function settle(page) {
  // Trigger lazy images by walking the page, then return to the top.
  await page.evaluate(async () => {
    const step = Math.max(300, Math.floor(window.innerHeight * 0.8));
    const max = Math.min(document.documentElement.scrollHeight, 30000);
    for (let y = 0; y < max; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(600);
}

async function main() {
  const outRoot = path.join(HERE, LABEL);
  const manifest = { base: BASE, label: LABEL, capturedAt: new Date().toISOString(), pages: [] };
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dsf,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      reducedMotion: "reduce",
      locale: "en-US",
    });
    await mkdir(path.join(outRoot, vp.name), { recursive: true });

    for (const pg of PAGES) {
      if (ONLY && !ONLY.includes(pg.name)) continue;
      const page = await ctx.newPage();
      const consoleErrors = [];
      const failedRequests = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
      });
      page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));
      page.on("requestfailed", (r) => failedRequests.push(`${r.url().slice(0, 200)} :: ${r.failure()?.errorText}`));
      page.on("response", (r) => {
        if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url().slice(0, 200)}`);
      });

      const rec = { viewport: vp.name, name: pg.name, path: pg.path };
      const t0 = Date.now();
      try {
        const resp = await page.goto(BASE + pg.path, { waitUntil: "domcontentloaded", timeout: 45000 });
        rec.status = resp?.status() ?? null;
        await settle(page);
        rec.finalUrl = page.url();
        rec.title = await page.title();
        rec.overflowX = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        rec.brokenImages = await page.evaluate(
          () => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc.slice(0, 160)),
        );
        const file = path.join(outRoot, vp.name, `${pg.name}.png`);
        await page.screenshot({ path: file, fullPage: true, animations: "disabled", timeout: 60000 });
        rec.file = path.relative(HERE, file);
      } catch (err) {
        rec.error = String(err).slice(0, 300);
      }
      rec.ms = Date.now() - t0;
      rec.consoleErrors = consoleErrors;
      rec.failedRequests = failedRequests.slice(0, 20);
      manifest.pages.push(rec);
      console.log(
        `${vp.name.padEnd(13)} ${pg.name.padEnd(17)} status=${rec.status ?? "-"} overflowX=${rec.overflowX ?? "-"} ` +
          `consoleErr=${consoleErrors.length} failedReq=${failedRequests.length} broken=${rec.brokenImages?.length ?? "-"}${rec.error ? " ERROR " + rec.error : ""}`,
      );
      await page.close();
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    await ctx.close();
  }

  await browser.close();
  await writeFile(path.join(outRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${path.join(outRoot, "manifest.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
