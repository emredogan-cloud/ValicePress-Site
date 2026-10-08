#!/usr/bin/env node
/**
 * What a page WAITS FOR on the physical phone, on a slow link: its paint timings, every LCP candidate, and the
 * resource timeline — what was requested when, what finished when, how big.
 *
 *   MOBILE_BASE_URL=http://localhost:3210 npm run mobile:trace -- /
 *   MOBILE_BASE_URL=http://localhost:3210 npm run mobile:trace -- / --block "*\/images/books/thumb/*,*\/video/*"
 *
 * `mobile:cwv` says THAT the home page's largest paint arrives at 4.9 s; this says why (the photograph shared a 1.6 Mbps
 * link with ~580 kB of scripts), and `--block` takes a group of URLs off the network to see how much of the delay they
 * were responsible for. Same conditions as `mobile:cwv`: cache off, 1.6 Mbps down, 70 ms round trip. Lab, one device.
 */
import { connectDevice, navigateAndSettle, setCacheDisabled, throttle, unthrottle } from "./device.mjs";

const argv = process.argv.slice(2);
const path = argv.find((a) => a.startsWith("/")) ?? "/";
const blockAt = argv.indexOf("--block");
const block = blockAt >= 0 ? argv[blockAt + 1].split(",") : [];
const base = (process.env.MOBILE_BASE_URL ?? "http://localhost:3210").replace(/\/$/, "");

const cdp = await connectDevice();
await setCacheDisabled(cdp, true);
await throttle(cdp);
if (block.length) await cdp.send("Network.setBlockedURLs", { urls: block });
try {
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__lcp = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp.push({ t: Math.round(e.startTime), el: e.element ? e.element.tagName + (e.url ? " " + e.url.slice(-60) : "") : null, size: e.size }); }).observe({ type: "largest-contentful-paint", buffered: true });`,
  });
  await navigateAndSettle(cdp, base + path, { hard: true, settleMs: 9000 });
  const out = await cdp.eval(`(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paint = Object.fromEntries(performance.getEntriesByType("paint").map((p) => [p.name, Math.round(p.startTime)]));
    const res = performance.getEntriesByType("resource").map((r) => ({ n: r.name.replace(location.origin, "").slice(0, 70), t: Math.round(r.startTime), end: Math.round(r.responseEnd), kb: Math.round((r.transferSize || 0) / 1024), type: r.initiatorType, prio: r.renderBlockingStatus })).sort((a, b) => a.t - b.t);
    return { nav: { ttfb: Math.round(nav.responseStart), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) }, paint, lcp: window.__lcp, res: res.slice(0, 60) };
  })()`);
  console.log(JSON.stringify({ path, blocked: block, nav: out.nav, paint: out.paint, lcp: out.lcp }));
  for (const r of out.res) console.log(String(r.t).padStart(5), "→", String(r.end).padStart(5), `${r.kb}kB`.padStart(6), r.type.padEnd(8), r.prio ?? "", r.n);
} finally {
  await cdp.send("Network.setBlockedURLs", { urls: [] }).catch(() => {});
  await unthrottle(cdp);
  await setCacheDisabled(cdp, false);
}
process.exit(0);
