#!/usr/bin/env node
/**
 * The spiral library on the PHYSICAL phone: what it costs to open, how its frames come, and whether a finger can use it.
 *
 *   adb reverse tcp:3210 tcp:3210 && adb forward tcp:9222 localabstract:chrome_devtools_remote
 *   MOBILE_BASE_URL=http://localhost:3210 npm run mobile:library -- --out docs/…/library-phone.json
 *
 * Three measurements, each with its conditions in the output:
 *
 *  1. ARRIVAL — cache off, 1.6 Mbps down / 70 ms (the roadmap's reference link), median of --repeat: when the scene's first
 *     frame is drawn (`data-library="ready"`) and when the last cover is on its shelf, beside FCP and LCP. LCP alone would
 *     flatter the page: a canvas is not an LCP candidate, so the covers the reader is waiting for are timed directly.
 *  2. FRAMES — real touch scrolls (`Input.synthesizeScrollGesture`, a finger's gesture) down every shelf and back up, while the
 *     scene records the interval between consecutive frames (`?library-stats`). Reported: median, p95, p99, the share over 33.3 ms
 *     and 50 ms, and any pixel-ratio step the scene took. Then two still seconds, in which it must draw nothing.
 *  3. A FINGER — a tap on the front cover opens Quick View (tap → dialog, timed in the page), the Back key closes it, and the
 *     page is unlocked afterwards.
 *
 * Lab numbers on one device: what this phone did, not a percentile of anyone's. Exits 1 when a functional check fails.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

import { connectDevice, navigateAndSettle, setCacheDisabled, sleep, throttle, unthrottle } from "./device.mjs";

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const BASE = arg("url", process.env.MOBILE_BASE_URL ?? "http://localhost:3210").replace(/\/$/, "");
const OUT = arg("out", null);
const REPEAT = Number(arg("repeat", 3));
const ADB = process.env.ADB_BIN ?? "adb";
const URL_ = `${BASE}/books?library-stats`;

const checks = [];
const check = (name, pass, detail = {}) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "  ✓" : "  ✗"} ${name}${pass ? "" : `   ${JSON.stringify(detail)}`}`);
};
const pct = (xs, p) => {
  const v = [...xs].sort((a, b) => a - b);
  return v.length ? v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))] : null;
};
const median = (xs) => pct(xs, 0.5);

/** Installed before any page script: when the scene says it is ready, the paint timings, and a pointerdown → dialog clock. */
const WATCH = `(() => {
  window.__lib = { ready: null, allCovers: null, lcp: null, tap: null, dialog: null };
  try { new PerformanceObserver((l) => { const e = l.getEntries(); const x = e[e.length - 1]; if (x) window.__lib.lcp = { t: Math.round(x.startTime), el: x.element ? x.element.tagName : null }; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch (e) {}
  const tick = () => {
    const s = document.querySelector("section[data-library]");
    if (s && s.dataset.library === "ready" && window.__lib.ready === null) window.__lib.ready = Math.round(performance.now());
    const st = window.__libraryStats;
    if (st && st.coversLoaded > 0 && st.coversLoaded === document.querySelectorAll(".library-index a").length && window.__lib.allCovers === null) window.__lib.allCovers = Math.round(performance.now());
    if (window.__lib.allCovers === null || window.__lib.ready === null) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  addEventListener("pointerdown", () => { window.__lib.tap = performance.now(); window.__lib.dialog = null; }, true);
  // The document, not its <html>: this runs before the parser has made one.
  new MutationObserver(() => { if (window.__lib.tap !== null && window.__lib.dialog === null && document.querySelector("[role=dialog]")) window.__lib.dialog = performance.now(); })
    .observe(document, { childList: true, subtree: true });
})()`;

async function waitFor(cdp, expr, timeoutMs, what) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await cdp.eval(expr).catch(() => false)) return true;
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${what}`);
}

const cdp = await connectDevice();
console.log(`\n▸ Spiral library on the phone — ${URL_}\n  device: ${cdp.meta.browser}\n`);
await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: WATCH });

/* ------------------------------------------------------------------ 1. arrival */
const arrivals = [];
for (let i = 0; i < REPEAT; i++) {
  await setCacheDisabled(cdp, true);
  await throttle(cdp);
  await navigateAndSettle(cdp, URL_, { timeoutMs: 90000, settleMs: 500, hard: true });
  await waitFor(cdp, `window.__lib && window.__lib.allCovers !== null`, 120000, "every cover on its shelf");
  const a = await cdp.eval(`(() => {
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    const res = performance.getEntriesByType("resource");
    const kb = (f) => Math.round(res.filter(f).reduce((s, r) => s + (r.transferSize || 0), 0) / 1024);
    return { fcpMs: fcp ? Math.round(fcp.startTime) : null, lcp: window.__lib.lcp, readyMs: window.__lib.ready, allCoversMs: window.__lib.allCovers,
      jsKB: kb((r) => /\\.js(\\?|$)/.test(r.name)), coversKB: kb((r) => r.initiatorType === "fetch" && /images(\\/|%2F)books/.test(r.name)), totalKB: kb(() => true) };
  })()`);
  arrivals.push(a);
  console.log(`  arrival ${i + 1}: FCP ${a.fcpMs} ms · LCP ${a.lcp?.t} ms (${a.lcp?.el}) · first frame ${a.readyMs} ms · all covers ${a.allCoversMs} ms · JS ${a.jsKB} kB · covers ${a.coversKB} kB`);
  await unthrottle(cdp);
  await setCacheDisabled(cdp, false);
}

/* ------------------------------------------------------------------- 2. frames */
await navigateAndSettle(cdp, URL_, { timeoutMs: 60000, settleMs: 500, hard: true });
await waitFor(cdp, `window.__lib && window.__lib.allCovers !== null`, 60000, "every cover on its shelf");
const geo = await cdp.eval(`(() => {
  const track = document.querySelector("section[data-library] > div.relative");
  const stage = track.firstElementChild;
  const n = document.querySelectorAll(".library-index h2").length;
  const r = stage.getBoundingClientRect();
  window.__libraryStats.frames.length = 0;
  return { segment: (track.offsetHeight - stage.offsetHeight) / (n - 1), shelves: n, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height * 0.7), stageTop: Math.round(r.top), stageH: Math.round(r.height), dpr: devicePixelRatio, w: innerWidth, h: innerHeight };
})()`);
for (let i = 1; i < geo.shelves; i++) {
  await cdp.send("Input.synthesizeScrollGesture", { x: geo.x, y: geo.y, yDistance: -Math.round(geo.segment), speed: 1100, gestureSourceType: "touch" });
  await sleep(900);
}
await cdp.send("Input.synthesizeScrollGesture", { x: geo.x, y: Math.round(geo.stageTop + geo.stageH * 0.2), yDistance: Math.round(geo.segment * (geo.shelves - 1)), speed: 2400, gestureSourceType: "touch" });
await sleep(2000);
const frames = await cdp.eval(`(() => { const s = window.__libraryStats; return { frames: s.frames.slice(), dpr: s.dpr, dprSteps: s.dprSteps, drawCalls: s.drawCalls, triangles: s.triangles, textures: s.textures, programs: s.programs, coverMB: +(s.coverBytes / 1048576).toFixed(1), renderer: s.renderer }; })()`);
const f = frames.frames;
const frameReport = {
  count: f.length,
  medianMs: median(f),
  p95Ms: pct(f, 0.95),
  p99Ms: pct(f, 0.99),
  maxMs: f.length ? Math.max(...f) : null,
  over33: f.length ? +(f.filter((x) => x > 33.4).length / f.length).toFixed(3) : null,
  over50: f.length ? +(f.filter((x) => x > 50).length / f.length).toFixed(3) : null,
  dpr: frames.dpr,
  dprSteps: frames.dprSteps,
  drawCalls: frames.drawCalls,
  triangles: frames.triangles,
  textures: frames.textures,
  programs: frames.programs,
  coverMB: frames.coverMB,
  renderer: frames.renderer,
};
console.log(`\n  frames over ${f.length} intervals: median ${frameReport.medianMs} ms · p95 ${frameReport.p95Ms} · p99 ${frameReport.p99Ms} · max ${frameReport.maxMs} · >33 ms ${(frameReport.over33 * 100).toFixed(1)}% · >50 ms ${(frameReport.over50 * 100).toFixed(1)}% · DPR ${frameReport.dpr} (steps ${JSON.stringify(frameReport.dprSteps)})`);
console.log(`  scene: ${frameReport.drawCalls} draw calls · ${frameReport.triangles} triangles · ${frameReport.textures} textures · ${frameReport.programs} programs · covers ${frameReport.coverMB} MB · ${frameReport.renderer}\n`);
check("frames came in during the descent", f.length > 30, { count: f.length });
const stillBefore = await cdp.eval(`window.__libraryStats.frames.length`);
await sleep(2000);
const stillAfter = await cdp.eval(`window.__libraryStats.frames.length`);
check("nothing is drawn while the reader is still", stillAfter === stillBefore, { drawn: stillAfter - stillBefore });

/* ------------------------------------------------------------------ 3. a finger */
await cdp.eval(`window.scrollTo({ top: 0, behavior: "instant" })`);
await sleep(1500);
const spot = await cdp.eval(`(() => { const r = document.querySelector("section[data-library] canvas").getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height * 0.46) }; })()`);
const pt = [{ x: spot.x, y: spot.y, radiusX: 10, radiusY: 10, force: 1 }];
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt });
await sleep(70);
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await waitFor(cdp, `!!document.querySelector("[role=dialog]")`, 10000, "Quick View");
await sleep(400);
const opened = await cdp.eval(`(() => ({ title: document.querySelector("[role=dialog] h2")?.textContent ?? null, ms: window.__lib.dialog && window.__lib.tap ? Math.round(window.__lib.dialog - window.__lib.tap) : null, amazon: document.querySelector('[role=dialog] a[href*="amazon.com"]')?.getAttribute("href") ?? null, locked: document.documentElement.style.overflow }))()`);
check("a tap on the front cover opens that book's Quick View", Boolean(opened.title), opened);
check("Quick View opens on an Amazon edition", Boolean(opened.amazon && /^https:\/\/www\.amazon\.com\/dp\/B0/.test(opened.amazon)), opened);
console.log(`  tap → dialog: ${opened.ms} ms (${opened.title})`);
execFileSync(ADB, ["shell", "input", "keyevent", "KEYCODE_BACK"]);
await sleep(1200);
const after = await cdp.eval(`(() => ({ dialog: !!document.querySelector("[role=dialog]"), html: document.documentElement.style.overflow, body: document.body.style.overflow, inert: document.getElementById("app-root")?.hasAttribute("inert") ?? null, path: location.pathname }))()`);
check("Android Back closes it, stays on /books, and leaves the page unlocked", !after.dialog && after.html === "" && after.body === "" && after.inert === false && after.path === "/books", after);

const report = {
  when: new Date().toISOString(),
  device: cdp.meta.browser,
  url: URL_,
  viewport: { width: geo.w, height: geo.h, dpr: geo.dpr },
  arrival: {
    conditions: "cache off · 1.6 Mbps down · 70 ms RTT · physical phone",
    runs: arrivals,
    median: {
      fcpMs: median(arrivals.map((a) => a.fcpMs)),
      lcpMs: median(arrivals.map((a) => a.lcp?.t)),
      firstFrameMs: median(arrivals.map((a) => a.readyMs)),
      allCoversMs: median(arrivals.map((a) => a.allCoversMs)),
    },
  },
  frames: { conditions: "cache warm · real network to localhost · touch scroll gestures down every shelf and back", ...frameReport, samples: f },
  tap: opened,
  checks,
};
console.log(`\n  arrival (median of ${REPEAT}): FCP ${report.arrival.median.fcpMs} ms · LCP ${report.arrival.median.lcpMs} ms · first frame ${report.arrival.median.firstFrameMs} ms · all covers ${report.arrival.median.allCoversMs} ms`);
if (OUT) {
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`  → ${OUT}`);
}
process.exit(checks.every((c) => c.pass) ? 0 : 1);
