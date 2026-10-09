#!/usr/bin/env node
/**
 * axe-core (WCAG 2.2 AA + best practice — the same rules as e2e/quality.pw.ts) over the live site's landing pages,
 * at a desktop and a phone width. Read-only; the contexts carry the internal-traffic markers.
 *
 *   node scripts/release/axe.mjs [base=https://valicepress.com] [out.json]
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const BASE = (process.argv[2] ?? "https://valicepress.com").replace(/\/$/, "");
const OUT = process.argv[3] ?? null;
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// A live site rate-limits per IP (100 requests / 10 s): pace the pages. A local server needs no pause.
const PAUSE_MS = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(BASE) ? 0 : 6_000;
const require = createRequire(`${REPO}/package.json`);
const { chromium } = require("@playwright/test");
const AXE = fs.readFileSync(`${REPO}/node_modules/axe-core/axe.min.js`, "utf8");

const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
const all = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const first = (re) => all.find((p) => re.test(p));
const pages = [
  "/", "/books", "/ebooks", "/authors", "/categories", "/about", "/cart", "/search?q=moon", "/blog", "/terms", "/privacy",
  "/bonus", "/weather-permitting-bonus", "/long-way-back-bonus",
  "/books/weather-permitting", "/books/the-great-book-of-world-games", "/books/meditations",
  first(/^\/authors\/[^/]+$/), first(/^\/categories\/[^/]+$/), first(/^\/companion\/[^/]+$/), first(/^\/blog\/[^/]+$/),
].filter(Boolean);

const sizes = [
  ["desktop 1440", { viewport: { width: 1440, height: 900 } }],
  ["phone 393", { viewport: { width: 393, height: 851 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
];
const browser = await chromium.launch();
const results = [];
let violationsTotal = 0;
for (const [label, opts] of sizes) {
  const ctx = await browser.newContext({ locale: "en-US", ...opts });
  await ctx.addCookies([{ name: "vp_internal", value: "1", url: BASE }]);
  await ctx.addInitScript(() => {
    try {
      if (location.hostname.endsWith("valicepress.com")) localStorage.setItem("va-disable", "1");
    } catch {
      /* storage blocked */
    }
  });
  for (const p of pages) {
    const page = await ctx.newPage();
    try {
      // The live proxy rate-limits per IP (100 requests / 10 s): never run flat out, and retry once on a 429.
      let resp = await page.goto(BASE + p, { waitUntil: "load", timeout: 45_000 });
      if (resp && resp.status() === 429) {
        await page.waitForTimeout(15_000);
        resp = await page.goto(BASE + p, { waitUntil: "load", timeout: 45_000 });
      }
      if (!resp || resp.status() !== 200) throw new Error(`HTTP ${resp ? resp.status() : "none"}`);
      await page.waitForTimeout(900);
      await page.evaluate(AXE);
      const v = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } });
        return r.violations.map((x) => ({ id: x.id, impact: x.impact, help: x.help, nodes: x.nodes.slice(0, 3).map((n) => `${n.target.join(" ")}  ${n.html.slice(0, 100)}`) }));
      });
      violationsTotal += v.length;
      results.push({ size: label, path: p, violations: v });
      console.log(`${v.length === 0 ? "PASS" : "FAIL"}  ${label.padEnd(13)} ${p}${v.length ? "  " + v.map((x) => `[${x.impact}] ${x.id}`).join(", ") : ""}`);
    } catch (e) {
      results.push({ size: label, path: p, error: String(e) });
      violationsTotal += 1;
      console.log(`FAIL  ${label.padEnd(13)} ${p}  ${String(e).slice(0, 120)}`);
    } finally {
      await page.close();
      if (PAUSE_MS > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${pages.length} pages × ${sizes.length} sizes · ${violationsTotal} violations`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), violationsTotal, results }, null, 2));
process.exit(violationsTotal ? 1 : 0);
