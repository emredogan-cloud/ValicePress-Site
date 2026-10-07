#!/usr/bin/env node
/**
 * The quick-view lock, reproduced and verified on the PHYSICAL phone.
 *
 *   # original bug, on the live site:
 *   npm run mobile:quickview -- --url https://valicepress.com
 *   # the fix, on a local production build served to the phone:
 *   adb reverse tcp:3210 tcp:3210
 *   npm run mobile:quickview -- --url http://localhost:3210
 *
 * Needs the phone attached with Chrome in the foreground and
 *   adb forward tcp:9222 localabstract:chrome_devtools_remote
 * (see README.md). Uses real touch events, a real hit test and the real Android
 * Back key (`adb shell input keyevent KEYCODE_BACK`), because every earlier
 * mobile bug in this project was invisible to an emulator:
 *   - a coordinate that looks right in a screenshot can sit under another
 *     element, so "is the button on screen" is not "can a finger reach it" —
 *     this asks `document.elementFromPoint` at the button's centre;
 *   - `window.scrollBy` works on a locked page (programmatic scroll ignores
 *     `overflow: hidden`), so "does the page scroll" is tested with a touch drag.
 *
 * Writes a JSON report next to the console summary. Exits 1 when any check fails.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { connectDevice, DEVICE_CDP, navigateAndSettle, sleep } from "./device.mjs";

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const BASE = (arg("url", process.env.MOBILE_BASE_URL ?? "https://valicepress.com")).replace(/\/$/, "");
const OUT = arg("out", null);
const ADB = process.env.ADB_BIN ?? "/home/emre/Android/Sdk/platform-tools/adb";

const results = [];
const check = (name, pass, detail = {}) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "  ✓" : "  ✗"} ${name}${pass ? "" : `   ${JSON.stringify(detail)}`}`);
};

async function tapAt(cdp, x, y) {
  const pt = [{ x: Math.round(x), y: Math.round(y), radiusX: 12, radiusY: 12, force: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt });
  await sleep(60);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(500);
}

/** A finger drag from (x, y) by dy pixels, in small steps like real input. */
async function dragBy(cdp, x, y, dy, steps = 12) {
  const at = (yy) => [{ x: Math.round(x), y: Math.round(yy), radiusX: 12, radiusY: 12, force: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(y) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(y + (dy * i) / steps) });
    await sleep(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(450);
}

const adbBack = () => execFileSync(ADB, ["shell", "input", "keyevent", "KEYCODE_BACK"], { stdio: "ignore", timeout: 8000 });

const SNAPSHOT = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const dlg = document.querySelector('[role="dialog"]');
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const inView = (r) => !!r && r.x >= -1 && r.y >= -1 && r.x + r.w <= vw + 1 && r.y + r.h <= vh + 1;
  const reachable = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2; if (cx < 0 || cy < 0 || cx > vw || cy > vh) return false; const top = document.elementFromPoint(cx, cy); return !!top && (top === el || el.contains(top)); };
  const find = (re) => dlg ? [...dlg.querySelectorAll('a,button')].find((e) => re.test((e.getAttribute('aria-label') || e.textContent || '').trim())) : null;
  const close = dlg ? dlg.querySelector('[aria-label="Close quick view"], [aria-label="Close"]') : null;
  const primary = find(/buy|full details/i);
  const scrollers = dlg ? [...dlg.querySelectorAll('*')].filter((e) => { const o = getComputedStyle(e).overflowY; return /(auto|scroll)/.test(o) && e.scrollHeight > e.clientHeight + 1; }) : [];
  return {
    vw, vh, dpr: devicePixelRatio, visibility: document.visibilityState,
    dialog: rect(dlg), closeRect: rect(close), closeInView: inView(rect(close)), closeReachable: reachable(close),
    primaryRect: rect(primary), primaryInView: inView(rect(primary)), primaryReachable: reachable(primary),
    closeSizeOk: !!close && close.getBoundingClientRect().width >= 43.5 && close.getBoundingClientRect().height >= 43.5,
    htmlOverflow: document.documentElement.style.overflow || getComputedStyle(document.documentElement).overflow,
    bodyOverflow: document.body.style.overflow || getComputedStyle(document.body).overflow,
    scrollY: Math.round(scrollY), docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    scrollers: scrollers.map((e) => ({ cls: String(e.className).slice(0, 40), top: Math.round(e.scrollTop), max: e.scrollHeight - e.clientHeight })),
    url: location.pathname,
  };
})()`;

/**
 * Bring the tab the harness will attach to to the FRONT. `connectDevice()` takes
 * the first page target, which is not necessarily the one on screen; a background
 * tab reports `visibilityState: "hidden"` and `innerWidth: 0` and measures
 * nothing true (the same trap as a hidden desktop tab). Activating it first, and
 * refusing to continue if it is still hidden, keeps this from "passing" or
 * "failing" on a page nobody can see.
 */
async function activateFirstPage() {
  const list = await (await fetch(`${DEVICE_CDP}/json/list`, { signal: AbortSignal.timeout(8000) })).json();
  const first = list.find((t) => t.type === "page");
  if (first) await fetch(`${DEVICE_CDP}/json/activate/${first.id}`, { signal: AbortSignal.timeout(8000) }).catch(() => {});
  await sleep(900);
}

async function main() {
  console.log(`\nQuick view on the phone — ${BASE}\n`);
  await activateFirstPage();
  const cdp = await connectDevice();
  await navigateAndSettle(cdp, `${BASE}/books`, { hard: true, settleMs: 2500 });

  // The first card, scrolled into view, as a finger would find it.
  const card = await cdp.eval(`(() => {
    const a = document.querySelector('ul a[href^="/books/"]');
    if (!a) return null;
    a.scrollIntoView({ block: 'center' });
    const r = a.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, href: a.getAttribute('href') };
  })()`);
  if (!card) {
    check("a book card exists on /books", false);
    return finish();
  }
  await sleep(500);
  const card2 = await cdp.eval(`(() => { const r = document.querySelector('ul a[href^="/books/"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  const before = await cdp.eval(SNAPSHOT);
  check("the page is visible and focused (a hidden tab measures nothing)", before.visibility === "visible" && before.vw > 0, { visibility: before.visibility, innerWidth: before.vw });
  if (before.visibility !== "visible" || before.vw === 0) {
    console.log("\n  The attached tab is not the visible one — every number below would be meaningless. Stopping.\n  Put the page you want on screen on the phone (Chrome in the foreground, one tab visible) and rerun.\n");
    return finish();
  }
  check("no horizontal overflow on /books", before.docOverflowX <= 0, { overflowPx: before.docOverflowX, viewport: before.vw });

  await tapAt(cdp, card2.x, card2.y);
  await sleep(700);
  const open = await cdp.eval(SNAPSHOT);
  console.log(`\n  viewport ${open.vw}×${open.vh} @${open.dpr}x   dialog ${JSON.stringify(open.dialog)}\n`);

  check("tapping a card opens a dialog", !!open.dialog, { url: open.url });
  if (!open.dialog) return finish();
  check("dialog fits inside the visible viewport", open.dialog.y >= -1 && open.dialog.y + open.dialog.h <= open.vh + 1 && open.dialog.x + open.dialog.w <= open.vw + 1, open.dialog);
  check("Close is fully on screen", open.closeInView, open.closeRect);
  check("Close is a finger-sized target (≥44px)", open.closeSizeOk, open.closeRect);
  check("Close is REACHABLE — nothing covers it at its centre", open.closeReachable, open.closeRect);
  check("the primary action (Buy / Full details) is on screen without scrolling", open.primaryInView, open.primaryRect);
  check("the primary action is REACHABLE by touch", open.primaryReachable, open.primaryRect);
  check("the page behind is locked (html and body)", open.htmlOverflow === "hidden" && open.bodyOverflow === "hidden", { html: open.htmlOverflow, body: open.bodyOverflow });

  // ---- scroll INSIDE the dialog with a finger -------------------------------
  const scrollerBefore = open.scrollers[0]?.top ?? null;
  const midY = open.dialog.y + open.dialog.h * 0.55;
  await dragBy(cdp, open.vw / 2, midY, -260);
  const afterDrag = await cdp.eval(SNAPSHOT);
  if (open.scrollers.length) {
    check("a finger drag scrolls the dialog's own content", (afterDrag.scrollers[0]?.top ?? 0) > (scrollerBefore ?? 0), { before: scrollerBefore, after: afterDrag.scrollers[0]?.top });
  } else {
    check("content fits without scrolling (nothing to scroll)", true);
  }
  check("…and the page behind did not move", afterDrag.scrollY === open.scrollY, { before: open.scrollY, after: afterDrag.scrollY });
  check("Close is still reachable after scrolling", afterDrag.closeReachable, afterDrag.closeRect);

  // ---- the real Android Back key --------------------------------------------
  adbBack();
  await sleep(900);
  const afterBack = await cdp.eval(SNAPSHOT).catch(() => null);
  check("Android Back closes the dialog and the reader stays on /books", !!afterBack && !afterBack.dialog && afterBack.url === "/books", { dialog: afterBack?.dialog, url: afterBack?.url });

  // ---- reopen, and leave with a real tap on Close ----------------------------
  // If Back took the reader OFF /books (the original behaviour) we are on another
  // page now; return to /books so the remaining checks measure the dialog, not
  // whatever page Back landed on.
  if (!afterBack || afterBack.url !== "/books") {
    await navigateAndSettle(cdp, `${BASE}/books`, { hard: true, settleMs: 2500 });
  }
  await cdp.eval(`document.querySelector('ul a[href^="/books/"]').scrollIntoView({ block: 'center' })`);
  await sleep(400);
  const c = await cdp.eval(`(() => { const r = document.querySelector('ul a[href^="/books/"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await tapAt(cdp, c.x, c.y);
  await sleep(700);
  const reopened = await cdp.eval(SNAPSHOT);
  check("it can be opened again", !!reopened.dialog);
  if (reopened.dialog && reopened.closeRect) {
    await tapAt(cdp, reopened.closeRect.x + reopened.closeRect.w / 2, reopened.closeRect.y + reopened.closeRect.h / 2);
    await sleep(500);
  }

  const closed = await cdp.eval(SNAPSHOT).catch(() => null);
  check("tapping Close closes it", !!closed && !closed.dialog, { dialog: closed?.dialog });
  check("the page is UNLOCKED afterwards (html and body)", !!closed && closed.htmlOverflow !== "hidden" && closed.bodyOverflow !== "hidden", { html: closed?.htmlOverflow, body: closed?.bodyOverflow });

  // The decisive one: can a finger scroll the page again?
  const y0 = closed?.scrollY ?? 0;
  await dragBy(cdp, (closed?.vw ?? 360) / 2, (closed?.vh ?? 700) * 0.7, -320);
  const y1 = (await cdp.eval(SNAPSHOT).catch(() => null))?.scrollY ?? y0;
  check("a finger scrolls the PAGE again (the original freeze is gone)", y1 > y0 + 20, { before: y0, after: y1 });

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${failed.length === 0 ? "ALL PASS" : `${failed.length} FAILED`} — ${results.length - failed.length}/${results.length} checks   (${BASE})\n`);
  if (OUT) {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify({ url: BASE, at: new Date().toISOString(), results }, null, 2));
    console.log(`wrote ${OUT}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
