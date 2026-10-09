#!/usr/bin/env node
/**
 * Every layout shift on a page, with WHAT moved, WHEN, and how far — on the physical phone.
 *
 *   node scripts/mobile/shifts.mjs <url> [--wait 7000] [--scroll] [--taps] [--throttle]
 *
 * Installs a layout-shift observer before any document script, loads the URL (hard navigation, cache off), waits,
 * optionally scrolls down and back like a reader, and prints each entry: start time, value, whether a recent input
 * excuses it, and for every source node its tag/class/id and its previous and current rectangle.
 */
import { connectDevice, navigateAndSettle, setCacheDisabled, sleep, throttle, unthrottle } from "./device.mjs";

const argv = process.argv.slice(2);
const url = argv.find((a) => /^https?:\/\//.test(a));
const wait = Number(argv[argv.indexOf("--wait") + 1] || 7000);
const doScroll = argv.includes("--scroll");
const doTaps = argv.includes("--taps");
const doThrottle = argv.includes("--throttle");
if (!url) {
  console.error("usage: node scripts/mobile/shifts.mjs <url> [--wait ms] [--scroll] [--taps] [--throttle]");
  process.exit(2);
}

const OBS = `(() => {
  window.__shifts = [];
  window.__fonts = [];
  try {
    document.fonts.addEventListener("loadingdone", (e) => window.__fonts.push({ t: Math.round(performance.now()), faces: (e.fontfaces || []).map((f) => f.family + " " + f.weight + " " + f.style + " [" + f.status + "]") }));
    document.fonts.addEventListener("loading", () => window.__fonts.push({ t: Math.round(performance.now()), loading: true }));
  } catch (e) {}
  const desc = (n) => n ? (n.tagName + (n.id ? "#" + n.id : "") + (n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\\s+/).slice(0, 6).join(".") : "")) : null;
  const r = (x) => x ? [Math.round(x.x), Math.round(x.y), Math.round(x.width), Math.round(x.height)] : null;
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), input: e.hadRecentInput,
          src: (e.sources || []).map((s) => ({ node: desc(s.node), prev: r(s.previousRect), cur: r(s.currentRect) })) });
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch (e) { window.__shifts.push({ error: String(e) }); }
})()`;

const cdp = await connectDevice();
try {
  await setCacheDisabled(cdp, true);
  if (doThrottle) await throttle(cdp);
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: OBS });
  await navigateAndSettle(cdp, url, { hard: true, settleMs: 800 });
  await sleep(wait);
  if (doTaps) {
    // the same tap pass as scripts/mobile/cwv.mjs: up to 8 on-screen controls, clicks suppressed, 560 ms apart
    await cdp.eval(`(() => { window.__inpBlock = (e) => { e.preventDefault(); e.stopPropagation(); }; document.addEventListener("click", window.__inpBlock, true); window.__tapLog = []; return true; })()`);
    const spots = await cdp.eval(`(() => {
      const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden" && parseFloat(getComputedStyle(e).opacity) !== 0;
      const els = Array.prototype.slice.call(document.querySelectorAll("button,[role=button],select,input,a[href],summary")).filter(vis)
        .map((e) => { const r = e.getBoundingClientRect(); return { e, r }; })
        .filter((o) => o.r.width > 8 && o.r.height > 8 && o.r.top >= 0 && o.r.bottom <= innerHeight);
      return els.slice(0, 8).map((o) => ({ x: Math.round(o.r.left + o.r.width / 2), y: Math.round(o.r.top + o.r.height / 2),
        label: (o.e.getAttribute("aria-label") || o.e.textContent || o.e.tagName).trim().slice(0, 30), tag: o.e.tagName }));
    })()`);
    for (const sp of spots) {
      const t0 = await cdp.eval(`Math.round(performance.now())`);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sp.x, y: sp.y, radiusX: 12, radiusY: 12, force: 1 }] });
      await sleep(60);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(500);
      console.log(`   tap @${t0}ms  ${sp.tag} "${sp.label}"  (${sp.x},${sp.y})`);
    }
    await sleep(800);
    await cdp.eval(`(() => { document.removeEventListener("click", window.__inpBlock, true); return true; })()`);
  }
  if (doScroll) {
    await cdp.eval(`(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 250)); } window.scrollTo(0, 0); })()`, { awaitPromise: true });
    await sleep(2000);
  }
  const out = JSON.parse(await cdp.eval(`JSON.stringify(window.__shifts)`));
  const total = out.filter((s) => !s.input).reduce((a, s) => a + (s.v || 0), 0);
  const ctx = JSON.parse(await cdp.eval(`JSON.stringify({ w: innerWidth, h: innerHeight, vv: visualViewport && [Math.round(visualViewport.width), Math.round(visualViewport.height)], reduced: matchMedia("(prefers-reduced-motion: reduce)").matches, dpr: devicePixelRatio, docH: document.documentElement.scrollHeight })`));
  console.log(`${url}  viewport ${JSON.stringify(ctx)}  shifts ${out.length}  CLS(no input) ${total.toFixed(4)}`);
  const byNode = new Map();
  for (const s of out) {
    for (const x of s.src ?? []) {
      const k = x.node;
      byNode.set(k, (byNode.get(k) ?? 0) + s.v / (s.src.length || 1));
    }
  }
  console.log("by source node (share of CLS):");
  for (const [k, v] of [...byNode].sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`   ${v.toFixed(4)}  ${k}`);
  const fonts = JSON.parse(await cdp.eval(`JSON.stringify(window.__fonts)`));
  console.log("font loading events:", JSON.stringify(fonts).slice(0, 700));
  const fp = JSON.parse(await cdp.eval(`JSON.stringify({ resources: performance.getEntriesByType("resource").filter((r) => /\\.woff2?/.test(r.name)).map((r) => ({ f: r.name.split("/").pop().slice(0, 30), start: Math.round(r.startTime), end: Math.round(r.responseEnd) })), fcp: Math.round((performance.getEntriesByName("first-contentful-paint")[0] || {}).startTime || 0) })`));
  console.log("font files:", JSON.stringify(fp));
  console.log("first entries:");
  for (const s of out.slice(0, 14)) console.log(`   t=${String(s.t).padStart(5)}ms  v=${s.v}  input=${s.input}  ` + (s.src ?? []).slice(0, 2).map((x) => `${x.node} ${JSON.stringify(x.prev)}→${JSON.stringify(x.cur)}`).join(" | "));
} finally {
  if (doThrottle) await unthrottle(cdp).catch(() => {});
  await setCacheDisabled(cdp, false).catch(() => {});
  cdp.close();
}
process.exit(0);
