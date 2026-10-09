#!/usr/bin/env node
/**
 * Desktop QA sweep: every public page, in Chromium AND Firefox, at three desktop widths.
 *
 *   node scripts/qa/desktop-sweep.mjs                              # the sandbox server, both engines, 1280/1440/1920
 *   node scripts/qa/desktop-sweep.mjs --base https://valicepress.com --strict
 *   node scripts/qa/desktop-sweep.mjs --engines firefox --widths 1366 --json /tmp/sweep.json
 *   node scripts/qa/desktop-sweep.mjs --base https://valicepress.com --strict --widths 1440 --pause 8000 --pages /,/books,/about
 *
 * For each page it loads it, scrolls to the bottom as a reader would (so lazy images load), waits, and
 * records what a person watching the console and the network panel would see:
 *
 *   page errors and uncaught exceptions · console errors and warnings · hydration / React warnings ·
 *   same-origin requests that answered 4xx/5xx or failed · images that decoded to nothing ·
 *   horizontal overflow · layout shift (CLS) · the page's own links that 404 are the SEO audit's job.
 *
 * Third-party noise is separated from the page's own: a build served from localhost loads Clerk with its
 * PRODUCTION keys (which refuse to run off valicepress.com and say so) and the Vercel analytics beacons
 * (which do not exist off Vercel). Those are listed as "environment" and do not fail the sweep unless
 * `--strict` — which is what to use against production, where none of it should happen.
 *
 * Exit status 1 when anything the page itself is responsible for is found.
 */
import fs from "node:fs";

import { chromium, firefox } from "@playwright/test";

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const BASE = arg("base", "http://localhost:3210").replace(/\/$/, "");
const STRICT = argv.includes("--strict");
const ENGINES = arg("engines", "chromium,firefox").split(",");
const WIDTHS = arg("widths", "1280,1440,1920").split(",").map(Number);
const JSON_OUT = arg("json", "");
/* Milliseconds to wait after every page. A live site rate-limits per IP (the proxy allows 100 requests per 10 s, and a
 * page that prefetches its links spends a good part of that on one load), so a sweep of production must not run flat
 * out: pass --pause 8000 and --pages for a representative list. The default, 0, is for the local server. */
const PAUSE = Number(arg("pause", "0"));
const EXTRA = ["/terms", "/privacy", "/refund", "/kvkk", "/search?q=moon", "/cart", "/weather-permitting-bonus", "/long-way-back-bonus"];

const ENVIRONMENT = /clerk|_vercel|va\.vercel|vercel-scripts|cloudflareinsights|sentry|ingest\.|MIME type|Production Keys|Loading failed for the <script>|Failed to load script from/i;
const REACT = /hydrat|server rendered|did not match|Minified React error|Cannot update a component|unique "key"|Invalid DOM property|validateDOMNesting|cannot be a descendant|cannot contain a nested/i;

const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
const pages = [...new Set([...[...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname), ...EXTRA])];
const only = arg("pages", "");
const PAGES = only ? only.split(",") : pages;

const results = [];
for (const engineName of ENGINES) {
  const engine = engineName === "firefox" ? firefox : chromium;
  const browser = await engine.launch();
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    // Pointed at a real site, this script must stay out of its commercial signal (src/lib/internal-traffic.ts): the
    // first-party cookie that the analytics gate and /api/events read, and the key Vercel's documented opt-out reads.
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
    for (const path of PAGES) {
      const page = await ctx.newPage();
      const own = [];
      const env = [];
      const sameOrigin = (u) => new URL(u).origin === new URL(BASE).origin;
      const note = (bucket, kind, text) => bucket.push({ kind, text: String(text).replace(/\s+/g, " ").slice(0, 220) });
      page.on("pageerror", (e) => note(ENVIRONMENT.test(e.message) ? env : own, "pageerror", e.message));
      page.on("console", (m) => {
        if (m.type() !== "error" && m.type() !== "warning") return;
        const t = m.text();
        if (/unsupported entryTypes/.test(t)) return; // Firefox saying it has no layout-shift entries: our own observer's remark
        // Chromium prints "Failed to load resource: … 404" with no URL in the text; the message's LOCATION is the resource.
        const loc = m.location().url ?? "";
        // `accounts.valicepress.com` is Clerk's hosted sign-in on OUR domain: a request the page makes there (a
        // prefetch of a sign-in-protected route that the proxy redirects across origins) is the page's own fault.
        const thirdParty = loc !== "" && ((!sameOrigin(loc) && !/^https:\/\/accounts\.valicepress\.com\//.test(loc)) || /\/_vercel\//.test(loc));
        note(!REACT.test(t) && (ENVIRONMENT.test(t) || thirdParty) ? env : own, REACT.test(t) ? "react" : `console.${m.type()}`, `${t}${thirdParty ? "" : loc ? `  [${loc.replace(BASE, "")}]` : ""}`);
      });
      page.on("response", (r) => {
        const u = r.url();
        if (r.status() < 400) return;
        if (!sameOrigin(u) && !/^https:\/\/accounts\.valicepress\.com\//.test(u)) return note(env, "http", `${r.status()} ${u}`);
        if (/\/_vercel\//.test(u)) return note(env, "http", `${r.status()} ${u}`);
        // the 404 page and a 404 for a deliberately-missing route are the page's answer, not a fault
        if (r.request().resourceType() === "document" && u === `${BASE}${path}` && /^\/this-page/.test(path)) return;
        // a protected route's redirect to sign-in is an answer
        note(own, "http", `${r.status()} ${u.replace(BASE, "")}`);
      });
      page.on("requestfailed", (r) => {
        const u = r.url();
        const why = r.failure()?.errorText ?? "";
        // a request cancelled because we left the page (or a prefetch that lost a race) is not a failure
        if (/ABORTED|NS_BINDING_ABORTED|cancel/i.test(why)) return;
        note(sameOrigin(u) && !/\/_vercel\//.test(u) ? own : env, "requestfailed", `${why} ${u.replace(BASE, "")}`);
      });
      await page.addInitScript(() => {
        window.__cls = 0;
        try {
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
          }).observe({ type: "layout-shift", buffered: true });
        } catch {
          /* Firefox has no layout-shift entries */
        }
      });
      let status = 0;
      try {
        const res = await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 45000 });
        status = res?.status() ?? 0;
        await page.evaluate(async () => {
          const h = document.documentElement.scrollHeight;
          for (let y = 0; y < h; y += 700) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 70));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(700);
      } catch (e) {
        note(own, "navigation", String(e).split("\n")[0]);
      }
      const facts = await page
        .evaluate(() => ({
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          broken: [...document.images].filter((i) => i.getAttribute("src") && i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0).map((i) => (i.currentSrc || i.src).slice(-80)),
          cls: Math.round((window.__cls ?? 0) * 1000) / 1000,
        }))
        .catch(() => ({ overflow: 0, broken: [], cls: 0 }));
      if (facts.overflow > 0) note(own, "overflow", `${facts.overflow}px wider than the window`);
      for (const b of facts.broken) note(own, "broken-image", b);
      if (facts.cls > 0.1) note(own, "cls", `layout shift ${facts.cls}`);
      results.push({ engine: engineName, width, path, status, cls: facts.cls, own, env });
      await page.close();
      if (PAUSE > 0) await new Promise((r) => setTimeout(r, PAUSE));
    }
    await ctx.close();
  }
  await browser.close();
}

const fails = results.filter((r) => r.own.length || (STRICT && r.env.length));
console.log(`\nDesktop sweep — ${BASE}   ${PAGES.length} pages × ${WIDTHS.join("/")}px × ${ENGINES.join(" + ")}  = ${results.length} loads${STRICT ? "  (strict)" : ""}`);
const byEngine = {};
for (const r of results) {
  byEngine[r.engine] ??= { loads: 0, own: 0, env: 0, worstCls: 0 };
  byEngine[r.engine].loads++;
  byEngine[r.engine].own += r.own.length;
  byEngine[r.engine].env += r.env.length;
  byEngine[r.engine].worstCls = Math.max(byEngine[r.engine].worstCls, r.cls);
}
for (const [e, s] of Object.entries(byEngine)) console.log(`  ${e.padEnd(9)} ${s.loads} loads · ${s.own} page problems · ${s.env} third-party/environment messages · worst CLS ${s.worstCls}`);
const grouped = new Map();
for (const r of results) for (const x of r.own) {
  const k = `${x.kind}: ${x.text}`;
  (grouped.get(k) ?? grouped.set(k, new Set()).get(k)).add(`${r.engine}@${r.width} ${r.path}`);
}
for (const [k, where] of grouped) console.log(`\n  ✘ ${k}\n      ${[...where].slice(0, 4).join("\n      ")}${where.size > 4 ? `\n      … ${where.size - 4} more` : ""}`);
const envKinds = new Map();
for (const r of results) for (const x of r.env) envKinds.set(x.text.slice(0, 90), (envKinds.get(x.text.slice(0, 90)) ?? 0) + 1);
if (envKinds.size && !STRICT) {
  console.log("\n  environment (not the page's):");
  for (const [k, n] of [...envKinds].sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`      ×${n}  ${k}`);
}
console.log(`\n${fails.length ? `${fails.length} of ${results.length} loads have problems` : "no page problems"}`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 1));
process.exit(fails.length ? 1 : 0);
