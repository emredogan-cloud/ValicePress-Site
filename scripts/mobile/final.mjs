#!/usr/bin/env node
/**
 * The final physical checklist, walked on the phone with a real finger.
 *
 *   adb reverse tcp:3210 tcp:3210
 *   adb forward tcp:9222 localabstract:chrome_devtools_remote
 *   npm run mobile:final -- --url http://localhost:3210
 *
 * `mobile:quickview` proves the popup half of the original bug (OPEN POPUP → SCROLL POPUP → CLOSE → SCROLL PAGE).
 * This is the other half and everything else the brief names that no other script touches:
 *
 *   OPEN BOOK → VIEW PREVIEW → CLOSE / BACK, without freezing — on a romance, a reference book, and from a tile
 *   swiping the preview gallery
 *   a card → its popup → "Full details" → the Android Back key → still scrolls
 *   the Amazon button (does a tap open amazon.com, in a new tab, leaving this one alone?)
 *   the four social links in the menu (each opens its own network in a new tab)
 *   an author card → the author's page → Back
 *   the cart's "+" and the recommendation shelf
 *   the three bonus pages: no overflow, a form a finger can hit, nothing locked on arrival
 *   /admin signed out: the hosted sign-in page and nothing of the admin area
 *
 * Real touch events (`Input.dispatchTouchEvent`), the real Android Back key, and `elementFromPoint` for "can a finger
 * reach it": every earlier mobile bug in this project was invisible to an emulator. It only touches the site it is
 * pointed at, and it closes every extra tab it opens. It leaves the cart empty.
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
const BASE = arg("url", process.env.MOBILE_BASE_URL ?? "http://localhost:3210").replace(/\/$/, "");
const OUT = arg("out", null);
const ADB = process.env.ADB_BIN ?? "/home/emre/Android/Sdk/platform-tools/adb";

const results = [];
let group = "";
const section = (name) => {
  group = name;
  console.log(`\n  ── ${name} ──`);
};
const check = (name, pass, detail = {}) => {
  results.push({ group, name, pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} ${name}${pass ? "" : `   ${JSON.stringify(detail).slice(0, 220)}`}`);
  return pass;
};

/* ------------------------------------------------------------------ fingers */
let cdp;
const touch = (x, y) => [{ x: Math.round(x), y: Math.round(y), radiusX: 12, radiusY: 12, force: 1 }];
async function tapAt(x, y, wait = 600) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touch(x, y) });
  await sleep(60);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(wait);
}
/** A finger drag in small steps, like real input. */
async function drag(x1, y1, x2, y2, steps = 12) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touch(x1, y1) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touch(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps) });
    await sleep(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(450);
}
const adbBack = () => execFileSync(ADB, ["shell", "input", "keyevent", "KEYCODE_BACK"], { stdio: "ignore", timeout: 8000 });
/** The package whose window has the phone's focus right now (an app other than Chrome means a link was handed over). */
const foreground = () => {
  const out = execFileSync(ADB, ["shell", "dumpsys", "window"], { encoding: "utf8", timeout: 12000 });
  return out.match(/mCurrentFocus=Window\{[^}]*?\s([\w.]+)\/[\w.$]+\}/)?.[1] ?? "";
};

/**
 * The centre of the first VISIBLE element matching `selector` (and `re` on its text / aria-label), scrolled into the
 * middle of the screen — and whether a finger placed there would actually land on it.
 */
async function locate(selector, re = null, root = "document") {
  return cdp.eval(`(() => {
    const t = (e) => (e.getAttribute("aria-label") || e.textContent || "").replace(/\\s+/g, " ").trim();
    const re = ${re ? re.toString() : "null"};
    const el = Array.from((${root}).querySelectorAll(${JSON.stringify(selector)}))
      .filter((e) => e.getClientRects().length > 0 && (!re || re.test(t(e))))[0];
    if (!el) return null;
    // inline: "center" too: an element inside a sideways shelf may have been swiped half out of the screen.
    el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    const r = el.getBoundingClientRect();
    // a rect is in layout-viewport coordinates, a finger in visual-viewport ones (they differ once the toolbar has collapsed)
    const v = window.visualViewport;
    const dx = v ? v.offsetLeft : 0, dy = v ? v.offsetTop : 0;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x: x - dx, y: y - dy, w: Math.round(r.width), h: Math.round(r.height), reachable: !!top && (top === el || el.contains(top) || top.contains(el)),
             href: el.getAttribute("href"), target: el.getAttribute("target"), rel: el.getAttribute("rel"), text: t(el).slice(0, 60) };
  })()`).catch(() => null);
}
async function tap(selector, re = null, wait = 700) {
  const box = await locate(selector, re);
  if (!box) return null;
  await sleep(250);
  await tapAt(box.x, box.y, wait);
  return box;
}
const scrollY = () => cdp.eval(`Math.round(scrollY)`);
const path = () => cdp.eval(`location.pathname`);
const hasDialog = () => cdp.eval(`!!document.querySelector('[role="dialog"]')`);
async function waitFor(expr, ms = 8000, awaitPromise = false) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cdp.eval(expr, { awaitPromise }).catch(() => false)) return true;
    await sleep(250);
  }
  return false;
}
/** A finger drag must scroll the PAGE: the thing the original bug took away. */
async function pageScrolls() {
  await cdp.eval(`window.scrollTo(0, 0)`);
  await sleep(250);
  const before = await scrollY();
  await drag(200, 520, 200, 220);
  return (await scrollY()) - before > 40;
}
const locked = () => cdp.eval(`(() => ({ html: getComputedStyle(document.documentElement).overflow, body: getComputedStyle(document.body).overflow }))()`);
const unlocked = async () => {
  const l = await locked();
  return l.html !== "hidden" && l.body !== "hidden";
};
const overflowPx = () => cdp.eval(`Math.max(0, document.documentElement.scrollWidth - innerWidth)`);

/* --------------------------------------------------------------------- tabs */
const targets = async () => (await (await fetch(`${DEVICE_CDP}/json/list`, { signal: AbortSignal.timeout(8000) })).json()).filter((t) => t.type === "page");
async function newTabsSince(before, match, ms = 9000) {
  const known = new Set(before.map((t) => t.id));
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const now = await targets();
    const fresh = now.filter((t) => !known.has(t.id));
    const hit = fresh.find((t) => match.test(t.url));
    if (hit) return { hit, fresh };
    await sleep(400);
  }
  return { hit: null, fresh: (await targets()).filter((t) => !known.has(t.id)) };
}
async function closeFresh(before) {
  const known = new Set(before.map((t) => t.id));
  for (const t of (await targets()).filter((x) => !known.has(x.id))) await fetch(`${DEVICE_CDP}/json/close/${t.id}`, { signal: AbortSignal.timeout(8000) }).catch(() => {});
  await sleep(500);
}
async function activateOurs(ourId) {
  await fetch(`${DEVICE_CDP}/json/activate/${ourId}`, { signal: AbortSignal.timeout(8000) }).catch(() => {});
  await sleep(900);
}
async function go(p) {
  await navigateAndSettle(cdp, `${BASE}${p}`, { hard: true, settleMs: 2200 });
  await cdp.eval(`window.scrollTo(0, 0)`).catch(() => {});
  await sleep(300);
}

/* ------------------------------------------------------------------- checks */
async function openBookPreview(slug, label) {
  section(`${label}: OPEN BOOK → VIEW PREVIEW → CLOSE / BACK  (/books/${slug})`);
  await go(`/books/${slug}`);
  check("the book page renders without sideways scroll", (await overflowPx()) === 0, { overflow: await overflowPx() });
  check("a finger scrolls the page", await pageScrolls());

  // the secondary button scrolls to the preview; the section's own button opens the viewer
  const link = await tap('a[href="#preview"]', /preview/i);
  check("'Read a preview' is a finger-sized control", !!link && link.h >= 44, link ?? "not found");
  await sleep(700);
  const open = await tap("button", /^read preview/i);
  check("the Look inside button is on the page and reachable", !!open && open.reachable, open ?? "not found");
  const opened = await waitFor(`!!document.querySelector('[role="dialog"]')`);
  check("the preview viewer opens", opened);
  if (!opened) return;

  const v = await cdp.eval(`(() => {
    const d = document.querySelector('[role="dialog"]');
    const r = d.getBoundingClientRect();
    const close = d.querySelector('[aria-label="Close preview"]');
    const cr = close ? close.getBoundingClientRect() : null;
    const top = cr ? document.elementFromPoint(cr.x + cr.width / 2, cr.y + cr.height / 2) : null;
    const counter = d.querySelector('[aria-live="polite"]');
    return { vw: innerWidth, vh: innerHeight, fits: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
             closeW: cr ? Math.round(cr.width) : null, closeH: cr ? Math.round(cr.height) : null,
             closeReachable: !!close && !!top && (top === close || close.contains(top)),
             counter: counter ? counter.textContent.trim() : null };
  })()`);
  check("the viewer fits the screen", v.fits, v);
  check("Close is a finger-sized target and nothing covers it", (v.closeW ?? 0) >= 44 && (v.closeH ?? 0) >= 44 && v.closeReachable, v);
  const l = await locked();
  check("the page behind is locked while it is open", l.html === "hidden" && l.body === "hidden", l);

  // swipe the gallery: a deliberate sideways drag over the picture
  const n = Number((v.counter ?? "").match(/\/\s*(\d+)/)?.[1] ?? 1);
  const pic = await cdp.eval(`(() => { const i = document.querySelector('[role="dialog"] img'); if (!i) return null; const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; })()`);
  if (n > 1 && pic) {
    await drag(pic.x + pic.w * 0.35, pic.y, pic.x - pic.w * 0.35, pic.y, 10);
    const after = await cdp.eval(`document.querySelector('[role="dialog"] [aria-live="polite"]')?.textContent.trim() ?? ""`);
    check("a swipe to the left shows the next picture", /^2\s*\//.test(after), { counter: after });
    await drag(pic.x - pic.w * 0.35, pic.y, pic.x + pic.w * 0.35, pic.y, 10);
    const back = await cdp.eval(`document.querySelector('[role="dialog"] [aria-live="polite"]')?.textContent.trim() ?? ""`);
    check("a swipe to the right goes back", /^1\s*\//.test(back), { counter: back });
    const next = await tap('[role="dialog"] button[aria-label="Next picture"]');
    check("the Next arrow is a finger-sized control that works", !!next && next.h >= 44 && /^2\s*\//.test(await cdp.eval(`document.querySelector('[role="dialog"] [aria-live="polite"]')?.textContent.trim() ?? ""`)), next ?? "not found");
  } else {
    check("(single picture — nothing to swipe)", true);
  }

  // CLOSE with the button
  await tap('[role="dialog"] [aria-label="Close preview"]');
  await sleep(500);
  check("Close closes it", !(await hasDialog()));
  check("the page is unlocked afterwards", await unlocked(), await locked());
  check("a finger scrolls the page again — nothing froze", await pageScrolls());

  // reopen and leave by the Android Back key
  await cdp.eval(`window.scrollTo(0, 0)`);
  await tap("button", /^read preview/i);
  const again = await waitFor(`!!document.querySelector('[role="dialog"]')`);
  check("it opens again", again);
  const here = await path();
  adbBack();
  await sleep(900);
  check("the Android Back key closes the viewer and stays on the book", !(await hasDialog()) && (await path()) === here, { dialog: await hasDialog(), path: await path(), wanted: here });
  check("the page is unlocked and scrolls after Back", (await unlocked()) && (await pageScrolls()), await locked());

  // and from a tile in the strip
  const tile = await tap('ul[aria-label^="Pictures from"] button');
  if (tile) {
    check("a tile in the strip opens the viewer", await waitFor(`!!document.querySelector('[role="dialog"]')`));
    adbBack();
    await sleep(900);
    check("Back closes it; the page still scrolls", !(await hasDialog()) && (await unlocked()) && (await pageScrolls()));
  }
}

async function popupToDetailAndBack() {
  section("a card → its popup → Full details → Back  (/books)");
  await go("/books");
  const card = await tap('main ul > li > article a[href^="/books/"]');
  check("a card is reachable by a finger", !!card && card.reachable, card ?? "not found");
  const dlg = await waitFor(`!!document.querySelector('[role="dialog"]')`);
  check("tapping it opens the popup", dlg);
  if (!dlg) return;
  const slug = card.href;
  const full = await tap('[role="dialog"] a[href^="/books/"]', /full details/i, 1500);
  check("'Full details' is a finger-sized control", !!full && full.h >= 44, full ?? "not found");
  check("it opens the book's page", await waitFor(`location.pathname === ${JSON.stringify(slug)}`, 12000), { path: await path(), wanted: slug });
  check("the book page scrolls", await pageScrolls());
  adbBack();
  await sleep(1500);
  check("Back returns to the catalogue", (await path()) === "/books", { path: await path() });
  check("nothing is locked, and the catalogue scrolls", (await unlocked()) && (await pageScrolls()), await locked());
  check("no popup is left open", !(await hasDialog()));
}

async function amazonButton(ourId) {
  section("the Amazon button  (/books/weather-permitting)");
  await go("/books/weather-permitting");
  const before = await targets();
  const box = await locate('a[href*="amazon.com"]', /amazon/i);
  check("an Amazon button is on the page and a finger can reach it", !!box && box.reachable && box.h >= 44, box ?? "not found");
  if (!box) return;
  check("it opens in a new tab, without handing the opener over", box.target === "_blank" && /noopener/.test(box.rel ?? ""), { target: box.target, rel: box.rel });
  check("it goes to the edition's own page", /^https:\/\/www\.amazon\.com\/dp\/[A-Z0-9]{10}/.test(box.href ?? ""), { href: box.href });
  await tapAt(box.x, box.y, 300);
  const { hit, fresh } = await newTabsSince(before, /amazon\./);
  check("a tap opens amazon.com in a NEW tab", !!hit, { fresh: fresh.map((t) => t.url.slice(0, 60)) });
  await closeFresh(before);
  await activateOurs(ourId);
  check("this site's tab is still where it was", (await path()) === "/books/weather-permitting", { path: await path() });
}

async function socialLinks(ourId) {
  section("the four social links in the menu");
  await go("/");
  await tap('button[aria-controls="mobile-nav-panel"]');
  check("the menu opens", await waitFor(`!!document.querySelector("#mobile-nav-panel")`));
  const links = await cdp.eval(`Array.from(document.querySelectorAll('#mobile-nav-panel a[aria-label^="Valice Press on"]')).map((a) => ({ label: a.getAttribute("aria-label"), href: a.getAttribute("href") }))`);
  check("all four networks are offered", links.length === 4, links);
  const hosts = [/x\.com|twitter\.com/, /instagram\.com/, /facebook\.com/, /tiktok\.com/];
  for (let i = 0; i < links.length; i++) {
    const before = await targets();
    const box = await locate("#mobile-nav-panel a[aria-label^=\"Valice Press on\"]", new RegExp(links[i].label.replace(/[()]/g, ".")));
    if (!box) {
      check(`${links[i].label}: reachable`, false, "not found");
      continue;
    }
    check(`${links[i].label}: a 48px target a finger reaches`, box.reachable && box.w >= 48 && box.h >= 48, box);
    await tapAt(box.x, box.y, 300);
    const { hit } = await newTabsSince(before, hosts[i] ?? /./, 6000);
    // An installed app can claim the link (Android App Links): the tap then opens the APP, not a Chrome tab.
    const fg = foreground();
    // …or Android puts its own "open with" chooser (package "android") on top because an installed app claims the host.
    const handedOver = !hit && fg !== "" && fg !== "com.android.chrome" && (fg === "android" || new RegExp(fg.split(".").slice(-2)[0], "i").test(links[i].href ?? ""));
    check(`${links[i].label}: a tap opens it (a new tab, or the installed app)`, !!hit || handedOver, { href: links[i].href, foreground: fg });
    if (handedOver) {
      adbBack();
      await sleep(1500);
      check(`${links[i].label}: Back from the app / the chooser returns to this site`, foreground() === "com.android.chrome", { foreground: foreground() });
    }
    await closeFresh(before);
    await activateOurs(ourId);
    if (!(await cdp.eval(`!!document.querySelector("#mobile-nav-panel")`))) {
      await tap('button[aria-controls="mobile-nav-panel"]');
      await waitFor(`!!document.querySelector("#mobile-nav-panel")`);
    }
  }
  adbBack();
  await sleep(700);
}

async function authorCard() {
  section("an author card  (/authors)");
  await go("/authors");
  const card = await tap('section[aria-label="Authors"] > ul > li a[href^="/authors/"]');
  check("an author card is reachable by a finger", !!card && card.reachable, card ?? "not found");
  if (!card) return;
  check("it opens that author's page", await waitFor(`location.pathname === ${JSON.stringify(card.href)}`, 12000), { path: await path(), wanted: card.href });
  check("the author page has no sideways scroll and scrolls", (await overflowPx()) === 0 && (await pageScrolls()));
  adbBack();
  await sleep(1500);
  check("Back returns to the list", (await path()) === "/authors", { path: await path() });
}

async function cartShelf() {
  section("the cart's recommendation shelf  (/cart)");
  await go("/cart");
  const shelf = await cdp.eval(`(() => {
    const track = Array.from(document.querySelectorAll('ul,div')).find((e) => /cart-shelf-track/.test(e.className) && e.getClientRects().length > 0);
    if (!track) return null;
    const r = track.getBoundingClientRect();
    return { x: r.left + r.width * 0.7, y: r.top + r.height / 2, left: Math.round(track.scrollLeft), max: track.scrollWidth - track.clientWidth };
  })()`);
  check("the shelf is there and scrolls sideways", !!shelf && shelf.max > 0, shelf ?? "not found");
  if (shelf) {
    await cdp.eval(`(() => { const t = Array.from(document.querySelectorAll('ul,div')).find((e) => /cart-shelf-track/.test(e.className)); t.scrollIntoView({ block: "center", behavior: "instant" }); })()`);
    await sleep(300);
    const s2 = await cdp.eval(`(() => { const t = Array.from(document.querySelectorAll('ul,div')).find((e) => /cart-shelf-track/.test(e.className)); const r = t.getBoundingClientRect(); return { x: r.left + r.width * 0.8, y: r.top + r.height / 2, left: t.scrollLeft }; })()`);
    await drag(s2.x, s2.y, s2.x - 220, s2.y, 10);
    const moved = await cdp.eval(`(() => { const t = Array.from(document.querySelectorAll('ul,div')).find((e) => /cart-shelf-track/.test(e.className)); return Math.round(t.scrollLeft); })()`);
    check("a finger swipe moves the shelf", moved > s2.left + 20, { before: s2.left, after: moved });
  }
  const plus = await tap('button[aria-label^="Add "]', /add .* to (your )?cart|add digital edition/i, 1200);
  check("a '+' on the shelf is a finger-sized control a finger reaches", !!plus && plus.h >= 40 && plus.w >= 40 && plus.reachable, plus ?? "not found");
  if (plus) {
    // the add is a server action and a re-read of the count: give it the time a phone on a USB tunnel needs
    const added = await waitFor(`fetch("/api/cart/count", { cache: "no-store" }).then((r) => r.json()).then((j) => j.count === 1)`, 8000, true);
    check("tapping it adds the book (the server's cart says so)", added, { count: await cdp.eval(`fetch("/api/cart/count", { cache: "no-store" }).then((r) => r.json()).then((j) => j.count)`, { awaitPromise: true }) });
    // leave the cart as it was found
    await go("/cart");
    await tap("button", /remove/i, 1200);
    const after = await cdp.eval(`fetch("/api/cart/count", { cache: "no-store" }).then((r) => r.json()).then((j) => j.count)`, { awaitPromise: true });
    check("Remove empties it again", after === 0, { count: after });
  }
}

/**
 * What the GLASS showed that no earlier check had asked: the shapes things are drawn in, and what a page says in its
 * first screen. Each of these was found by looking at this phone, and each is the same measurement `e2e/shapes.pw.ts`
 * makes in a browser, made here on the real one.
 */
async function glass() {
  section("what the glass showed  (shapes and first looks)");

  await go("/about");
  const stacks = await cdp.eval(`(() => {
    const out = [];
    for (const stack of document.querySelectorAll("[data-category-stack]")) {
      const f = stack.getBoundingClientRect();
      for (const img of stack.querySelectorAll("img")) {
        const box = img.parentElement, r = box.getBoundingClientRect();
        out.push({ w: box.offsetWidth, h: box.offsetHeight, spill: Math.max(f.left - r.left, r.right - f.right, f.top - r.top, r.bottom - f.bottom) });
      }
    }
    return out;
  })()`);
  const squares = stacks.filter((c) => Math.abs(c.w / c.h - 2 / 3) > 0.03);
  check("/about: every cover on a shelf card is a cover's 2:3 — none cut to a square", stacks.length > 0 && squares.length === 0, { covers: stacks.length, wrong: squares.slice(0, 3) });
  const spilling = stacks.filter((c) => c.spill > 1);
  check("/about: the fan stays inside its frame", stacks.length > 0 && spilling.length === 0, { spilling: spilling.slice(0, 3) });

  await go("/authors");
  const arrows = await cdp.eval(`(() => Array.from(document.querySelectorAll("article span[aria-hidden]"))
    .filter((s) => s.querySelector(":scope > svg"))
    .map((s) => { const r = s.getBoundingClientRect(); return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; }))()`);
  const ovals = arrows.filter((a) => Math.abs(a.w - a.h) > 1);
  check("/authors: the arrow on every card is a circle, however its label wraps", arrows.length >= 25 && ovals.length === 0, { arrows: arrows.length, ovals: ovals.slice(0, 3) });

  for (const slug of ["emre-dogan", "hans-christian-andersen"]) {
    await go(`/authors/${slug}`);
    const h = await cdp.eval(`(() => { const e = document.querySelector("h1"); const r = e.getBoundingClientRect(); return { endsAt: Math.round(r.top + (parseFloat(getComputedStyle(e).lineHeight) || 40)), screen: innerHeight }; })()`);
    check(`/authors/${slug}: the name is on the first screen`, h.endsAt <= h.screen, h);
  }

  await go("/books/weather-permitting");
  const strip = await cdp.eval(`(() => {
    const ul = document.querySelector('ul[aria-label^="Pictures from"]');
    if (!ul) return null;
    ul.scrollIntoView({ block: "center", behavior: "instant" });
    const row = ul.getBoundingClientRect();
    const tiles = Array.from(ul.querySelectorAll(":scope > li > button")).map((b) => b.getBoundingClientRect());
    return { right: Math.round(row.right), firstRight: Math.round(tiles[0].right), secondShows: tiles[1] ? Math.round(row.right - tiles[1].left) : 0, scrolls: ul.scrollWidth > ul.clientWidth + 4 };
  })()`);
  check("a book's Look Inside row: the first picture is whole and a piece of the next shows, so it says it goes on", !!strip && strip.scrolls && strip.firstRight <= strip.right + 1 && strip.secondShows >= 24, strip ?? "no row");

  await go("/books/weather-permitting");
  const hero = await cdp.eval(`(() => {
    const cta = Array.from(document.querySelectorAll("#overview a")).find((a) => /buy on amazon/i.test(a.textContent || ""));
    const prev = Array.from(document.querySelectorAll("#overview a")).find((a) => /read a preview/i.test(a.textContent || ""));
    if (!cta || !prev) return null;
    const c = cta.getBoundingClientRect(), p = prev.getBoundingClientRect();
    return { ctaBottom: Math.round(c.bottom), screen: innerHeight, ctaW: Math.round(c.width), prevW: Math.round(p.width), column: innerWidth - 32 };
  })()`);
  check("a book's page: the way to buy is on the first screen, and both buttons are the full width of the column", !!hero && hero.ctaBottom < hero.screen && Math.abs(hero.ctaW - hero.column) <= 2 && Math.abs(hero.prevW - hero.column) <= 2, hero ?? "buttons not found");
}

async function bonusPages() {
  section("the bonus pages");
  for (const p of ["/bonus", "/weather-permitting-bonus", "/long-way-back-bonus"]) {
    await go(p);
    const o = await overflowPx();
    const facts = await cdp.eval(`(() => {
      const i = Array.from(document.querySelectorAll('input[type="email"], input[name="email"]')).find((e) => e.getClientRects().length > 0);
      const r = i ? i.getBoundingClientRect() : null;
      return { h1: (document.querySelector("h1") || {}).textContent?.trim().slice(0, 50) ?? null, input: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null, dialogs: document.querySelectorAll('[role="dialog"]').length };
    })()`);
    check(`${p}: renders, no sideways scroll`, !!facts.h1 && o === 0, { facts, overflow: o });
    check(`${p}: nothing is locked on arrival, and a finger scrolls`, (await unlocked()) && (await pageScrolls()), await locked());
    if (facts.input) check(`${p}: the email field is a finger-sized control`, facts.input.h >= 44 && facts.input.w >= 200, facts.input);
  }
}

async function adminSignedOut() {
  section("/admin, signed out");
  await navigateAndSettle(cdp, `${BASE}/admin`, { hard: true, settleMs: 2500 }).catch(() => {});
  await sleep(1500);
  const a = await cdp.eval(`({ h1: ((document.querySelector("h1") || {}).textContent || "").trim().slice(0, 60), url: location.href.slice(0, 80), text: document.body.innerText.slice(0, 4000), overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth) })`);
  check("a signed-out phone is sent to sign in", /sign in/i.test(a.h1) || /sign-in|accounts\./.test(a.url), { h1: a.h1, url: a.url });
  check("nothing of the admin area is on the page", !/Overview|Reader support|Site data|Mailable|Suppressed/.test(a.text), { sample: a.text.slice(0, 120) });
  check("the sign-in page does not scroll sideways", a.overflow === 0, { overflow: a.overflow });
}

/* ---------------------------------------------------------------------- main */
async function main() {
  console.log(`\nFinal physical checklist — ${BASE}`);
  const list = await targets();
  const ours = list[0];
  if (ours) await fetch(`${DEVICE_CDP}/json/activate/${ours.id}`, { signal: AbortSignal.timeout(8000) }).catch(() => {});
  await sleep(900);
  cdp = await connectDevice();
  const ourId = ours?.id;
  const model = execFileSync(ADB, ["shell", "getprop", "ro.product.model"], { encoding: "utf8" }).trim();
  const android = execFileSync(ADB, ["shell", "getprop", "ro.build.version.release"], { encoding: "utf8" }).trim();
  const ver = await (await fetch(`${DEVICE_CDP}/json/version`)).json();
  console.log(`  device ${model} · Android ${android} · ${ver.Browser}`);

  const visible = await cdp.eval(`({ v: document.visibilityState, w: innerWidth })`);
  check("the page is visible and focused (a hidden tab measures nothing)", visible.v === "visible" && visible.w > 0, visible);

  await openBookPreview("weather-permitting", "a romance");
  await openBookPreview("the-great-book-of-world-games", "a reference book");
  await popupToDetailAndBack();
  await amazonButton(ourId);
  await socialLinks(ourId);
  await authorCard();
  await cartShelf();
  await glass();
  await bonusPages();
  await adminSignedOut();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${failed.length ? `${failed.length} FAILED — ` : "ALL PASS — "}${results.length - failed.length}/${results.length} checks   (${BASE})   ${model}, Android ${android}, ${ver.Browser}\n`);
  if (OUT) {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify({ base: BASE, device: { model, android, browser: ver.Browser }, at: new Date().toISOString(), results }, null, 1));
    console.log(`wrote ${OUT}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
