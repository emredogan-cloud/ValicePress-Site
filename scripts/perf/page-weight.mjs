#!/usr/bin/env node
/**
 * What a page costs: every image it loads (and how well each is sized for the place it is drawn),
 * the JavaScript it ships, and whether each response can be cached — measured in a real browser on a
 * phone profile and a desktop one.
 *
 *   node scripts/perf/page-weight.mjs                          # the sandbox server, a standard set of pages
 *   node scripts/perf/page-weight.mjs --base https://valicepress.com --pages /,/books,/books/meditations
 *   node scripts/perf/page-weight.mjs --json /tmp/weight.json
 *
 * It does not shrink anything by itself and it does not fail a build: it prints what it found so a
 * person can decide. "Do NOT sacrifice visual quality merely to reduce file size" — so the image check
 * only flags a file that is MORE than twice the pixels the device can show (waste with no quality to
 * lose) or LESS than what it is drawn at (blur).
 */
import fs from "node:fs";

import { chromium, devices } from "@playwright/test";

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const BASE = arg("base", "http://localhost:3210").replace(/\/$/, "");
const PAGES = arg("pages", "/,/books,/ebooks,/books/weather-permitting,/books/codex-bestiarium,/authors,/about,/categories,/cart").split(",");
const JSON_OUT = arg("json", "");
const kb = (n) => `${(n / 1024).toFixed(n > 10240 ? 0 : 1)} kB`;

const profiles = [
  ["phone", { ...devices["Pixel 5"] }],
  ["desktop", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
];

const browser = await chromium.launch();
const report = [];
for (const [label, opts] of profiles) {
  for (const path of PAGES) {
    const ctx = await browser.newContext(opts);
    // Against a real site, stay out of its commercial signal (src/lib/internal-traffic.ts): the first-party cookie the
    // analytics gate and /api/events read, and the key Vercel's documented opt-out reads.
    if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(BASE)) {
      await ctx.addCookies([{ name: "vp_internal", value: "1", url: BASE }]);
      await ctx.addInitScript(() => {
        try {
          if (location.hostname.endsWith("valicepress.com")) localStorage.setItem("va-disable", "1");
        } catch {
          /* storage can be blocked */
        }
      });
    }
    const page = await ctx.newPage();
    const responses = [];
    page.on("response", async (r) => {
      try {
        const req = r.request();
        const body = await r.body().catch(() => null);
        const sizes = await req.sizes().catch(() => null);
        responses.push({
          url: r.url(),
          type: req.resourceType(),
          status: r.status(),
          ct: r.headers()["content-type"] ?? "",
          cc: r.headers()["cache-control"] ?? "",
          enc: r.headers()["content-encoding"] ?? "",
          bytes: body?.length ?? 0, // decoded
          wire: sizes?.responseBodySize ?? body?.length ?? 0, // what crossed the network
        });
      } catch {
        /* a response that vanished with the page */
      }
    });
    await page.goto(BASE + path, { waitUntil: "load" });
    // scroll through the page so lazy images load, as a reader would
    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(800);
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    const imgs = await page.evaluate(() =>
      [...document.querySelectorAll("img")].map((i) => {
        const r = i.getBoundingClientRect();
        return { src: i.currentSrc || i.src, alt: i.getAttribute("alt"), w: Math.round(r.width), h: Math.round(r.height), nw: i.naturalWidth, nh: i.naturalHeight, loading: i.loading, prio: i.getAttribute("fetchpriority"), sizes: i.getAttribute("sizes"), visible: r.width > 0 && r.height > 0 };
      }),
    );
    const lcp = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let last = null;
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) last = { t: Math.round(e.startTime), el: e.element?.tagName, src: e.element?.currentSrc ?? e.element?.getAttribute?.("src") ?? "", size: e.size };
          }).observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => resolve(last), 300);
        }),
    );
    const preloads = await page.evaluate(() => [...document.querySelectorAll('link[rel="preload"]')].map((l) => `${l.getAttribute("as")}:${(l.getAttribute("href") ?? l.getAttribute("imagesrcset") ?? "").slice(0, 70)}`));

    const js = responses.filter((r) => r.type === "script");
    const css = responses.filter((r) => r.type === "stylesheet");
    const font = responses.filter((r) => r.type === "font");
    const image = responses.filter((r) => r.type === "image");
    const total = responses.reduce((a, r) => a + r.wire, 0);

    // image sizing: the pixels the device can show vs the pixels delivered
    // `naturalWidth` of an <img srcset> is the file's width divided by the density the browser chose, so it
    // says nothing about the file. The delivered width is what the optimiser was asked for (`w=`), or, for a
    // plain file, its natural width.
    const delivered = (src, nw) => {
      const m = src.match(/[?&]w=(\d+)/);
      return /\/_next\/image/.test(src) && m ? Number(m[1]) : nw;
    };
    const findings = [];
    for (const i of imgs.filter((x) => x.visible && x.nw > 0)) {
      const want = i.w * dpr;
      const got = delivered(i.src, i.nw);
      const ratio = got / want;
      if (ratio > 2) findings.push(`over ×${ratio.toFixed(1)}: ${i.src.replace(BASE, "").slice(0, 90)} drawn ${i.w}px@${dpr}x = ${Math.round(want)} wanted, ${got} delivered`);
      else if (ratio < 0.95) findings.push(`soft ×${ratio.toFixed(2)}: ${i.src.replace(BASE, "").slice(0, 90)} drawn ${i.w}px@${dpr}x = ${Math.round(want)} wanted, ${got} delivered`);
    }
    const nonModern = image.filter((r) => r.status === 200 && !/webp|avif|svg|png|icon/.test(r.ct) && !/\/_next\/image/.test(r.url));
    const uncached = responses.filter((r) => r.status === 200 && /\/_next\/static\//.test(r.url) && !/immutable|max-age=31536000/.test(r.cc));
    const dupImages = (() => {
      const m = new Map();
      for (const r of image) m.set(r.url, (m.get(r.url) ?? 0) + 1);
      return [...m].filter(([, n]) => n > 1).map(([u, n]) => `${n}× ${u.replace(BASE, "").slice(0, 80)}`);
    })();
    const topJs = [...js].sort((a, b) => b.wire - a.wire).slice(0, 4).map((r) => `${kb(r.wire)} (${kb(r.bytes)} raw${r.enc ? ", " + r.enc : ", not compressed"}) ${r.url.replace(BASE, "").slice(0, 60)}`);

    report.push({ profile: label, path, total, js: js.reduce((a, r) => a + r.wire, 0), jsRaw: js.reduce((a, r) => a + r.bytes, 0), jsCount: js.length, css: css.reduce((a, r) => a + r.wire, 0), font: font.reduce((a, r) => a + r.wire, 0), image: image.reduce((a, r) => a + r.wire, 0), imageCount: image.length, imgs: imgs.length, lazy: imgs.filter((i) => i.loading === "lazy").length, lcp, preloads, findings, nonModern: nonModern.map((r) => r.url.replace(BASE, "")), uncached: uncached.length, dupImages, topJs });
    await ctx.close();
  }
}
await browser.close();

console.log(`\nPage weight — ${BASE}\n`);
for (const r of report) {
  console.log(`${r.profile.padEnd(7)} ${r.path.padEnd(28)} total ${kb(r.total).padStart(8)} on the wire · js ${kb(r.js).padStart(7)} (${kb(r.jsRaw)} raw, ${r.jsCount} files) · css ${kb(r.css).padStart(6)} · fonts ${kb(r.font).padStart(6)} · images ${kb(r.image).padStart(8)} (${r.imageCount} loaded of ${r.imgs} in page, ${r.lazy} lazy) · LCP ${r.lcp ? `${r.lcp.t}ms ${r.lcp.el} ${String(r.lcp.src).replace(BASE, "").slice(0, 44)}` : "-"}`);
}
console.log("");
for (const r of report) {
  const notes = [...r.findings.map((f) => `image ${f}`), ...r.nonModern.map((u) => `image format: ${u}`), ...(r.uncached ? [`${r.uncached} /_next/static responses not immutable`] : []), ...r.dupImages.map((d) => `image fetched twice: ${d}`)];
  if (notes.length) {
    console.log(`${r.profile} ${r.path}`);
    for (const n of notes.slice(0, 8)) console.log(`   ${n}`);
    if (notes.length > 8) console.log(`   … ${notes.length - 8} more`);
  }
}
const heavy = report.filter((r) => r.profile === "phone").sort((a, b) => b.js - a.js)[0];
if (heavy) console.log(`\nheaviest JS on the phone profile: ${heavy.path} ${kb(heavy.js)} on the wire — largest scripts:\n   ${heavy.topJs.join("\n   ")}`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 1));
