#!/usr/bin/env node
/**
 * The spiral library's frames on a desktop GPU: a reader's wheel down every shelf and back, timed by the scene itself.
 *
 *   node scripts/perf/library-frames.mjs                                  # the sandbox server, 1440 × 900 and 1920 × 1080
 *   node scripts/perf/library-frames.mjs --base https://valicepress.com --json /tmp/frames.json
 *
 * WHY THE FLAGS. Headless Chromium draws WebGL with SwiftShader — on the CPU — unless it is told to use the GPU, and a
 * software renderer's frame times say nothing about anyone's browser. `--enable-gpu --use-angle=vulkan` puts it on the
 * machine's own GPU; the renderer string is printed, so a run that fell back to software is visible as one.
 *
 * WHAT IS MEASURED. `/books?library-stats` makes the scene keep the interval between consecutive frames
 * (`scene/frame-monitor.tsx`); a frame after a rest is not counted. The scroll is real wheel input (`mouse.wheel`), in
 * steps a mouse would take. Reported per viewport: median, p95, p99, max, the share over 16.7 / 33.3 ms, the pixel ratio and
 * any step down the scene took, and the frames drawn in two still seconds (must be 0). Lab numbers on one machine.
 */
import fs from "node:fs";

import { chromium } from "@playwright/test";

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const BASE = arg("base", "http://localhost:3210").replace(/\/$/, "");
const JSON_OUT = arg("json", "");
const SIZES = arg("sizes", "1440x900,1920x1080").split(",").map((s) => s.split("x").map(Number));

const pct = (xs, p) => {
  const v = [...xs].sort((a, b) => a - b);
  return v.length ? v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))] : null;
};

const browser = await chromium.launch({ args: ["--enable-gpu", "--use-angle=vulkan", "--enable-features=Vulkan"] });
const results = [];
for (const [width, height] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/books?library-stats`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelector("section[data-library]")?.getAttribute("data-library") === "ready" &&
      (window.__libraryStats?.coversLoaded ?? 0) === document.querySelectorAll(".library-index a").length,
    null,
    { timeout: 60_000 },
  );
  const geo = await page.evaluate(() => {
    const track = document.querySelector("section[data-library] > div.relative");
    const stage = track.firstElementChild;
    const n = document.querySelectorAll(".library-index h2").length;
    window.__libraryStats.frames.length = 0;
    const r = stage.getBoundingClientRect();
    return { segment: (track.offsetHeight - stage.offsetHeight) / (n - 1), shelves: n, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(geo.x, geo.y);
  // Down every shelf in mouse-wheel notches, pausing at each as a reader would; then back up quickly.
  for (let i = 1; i < geo.shelves; i++) {
    for (let moved = 0; moved < geo.segment; moved += 100) {
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(700);
  }
  for (let moved = 0; moved < geo.segment * (geo.shelves - 1); moved += 300) {
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(16);
  }
  // The camera eases home after the last wheel notch (a few shelves at ≤ 3.2 a second): wait until frames stop.
  const settleStart = Date.now();
  let last = -1;
  for (;;) {
    const n = await page.evaluate(() => window.__libraryStats.frames.length);
    if (n === last || Date.now() - settleStart > 15_000) break;
    last = n;
    await page.waitForTimeout(500);
  }
  const settledMs = Date.now() - settleStart - 500;
  const s = await page.evaluate(() => ({ ...window.__libraryStats, frames: window.__libraryStats.frames.slice() }));
  const still = s.frames.length;
  await page.waitForTimeout(2000);
  const stillAfter = await page.evaluate(() => window.__libraryStats.frames.length);
  const f = s.frames;
  const row = {
    viewport: `${width}×${height}`,
    renderer: s.renderer,
    frames: f.length,
    medianMs: pct(f, 0.5),
    p95Ms: pct(f, 0.95),
    p99Ms: pct(f, 0.99),
    maxMs: f.length ? Math.max(...f) : null,
    over16_7: f.length ? +(f.filter((x) => x > 17.5).length / f.length).toFixed(3) : null,
    over33: f.length ? +(f.filter((x) => x > 33.4).length / f.length).toFixed(3) : null,
    dpr: s.dpr,
    dprSteps: s.dprSteps,
    drawCalls: s.drawCalls,
    triangles: s.triangles,
    textures: s.textures,
    programs: s.programs,
    coverMB: +(s.coverBytes / 1048576).toFixed(1),
    settledAfterMs: settledMs,
    drawnWhileStill: stillAfter - still,
  };
  results.push(row);
  console.log(
    `${row.viewport.padEnd(10)} ${row.frames} frames · median ${row.medianMs} ms · p95 ${row.p95Ms} · p99 ${row.p99Ms} · max ${row.maxMs} · >16.7 ms ${(row.over16_7 * 100).toFixed(1)}% · >33 ms ${(row.over33 * 100).toFixed(1)}% · DPR ${row.dpr} ${JSON.stringify(row.dprSteps)} · ${row.drawCalls} calls · ${row.coverMB} MB covers · settled ${row.settledAfterMs} ms after the last notch · then still: ${row.drawnWhileStill} frames\n           ${row.renderer}`,
  );
  await ctx.close();
}
await browser.close();
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ base: BASE, when: new Date().toISOString(), results }, null, 2));
process.exit(results.every((r) => r.drawnWhileStill === 0 && r.frames > 30) ? 0 : 1);
