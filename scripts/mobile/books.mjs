#!/usr/bin/env node
/**
 * EVERY published book, on the physical phone: its card's popup and its own page.
 *
 *   adb reverse tcp:3210 tcp:3210 && adb forward tcp:9222 localabstract:chrome_devtools_remote
 *   MOBILE_BASE_URL=http://localhost:3210 npm run mobile:books -- --out docs/execution/mobile/phase-15/books-phone.json
 *   npm run mobile:books -- --only weather-permitting,codex-bestiarium     # a few
 *
 * The other phone scripts walk one or two books each. The brief's last gate says no book may ever show another
 * book's cover, preview, author or Amazon link, and that every high-priority book passes on the phone — so this
 * walks all of them, with a real finger, and records one row per book for `AUDIT/FINAL-BOOK-MATRIX.md`.
 *
 * POPUP (from /books?page=N, the card a finger would tap): it opens; its heading is that book's title; it offers
 * the book's own panels (every picture's path is under THIS book's slug, every alt names THIS title); the
 * "Next view" arrow steps; every Amazon link in it is one the catalogue gives THIS book; Close closes it and the
 * page behind is unlocked afterwards.
 *
 * PAGE (/books/<slug>): the heading is the title; no sideways scroll; the cover decoded and is this book's file;
 * the way to buy is inside the first screen; every Amazon link is one of this book's editions; every Look Inside
 * picture is this book's, and a row that scrolls shows a piece of its next tile; the author is the catalogue's;
 * no console error and no uncaught exception.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { AUTHORS, BOOKS } from "../catalog/valice-catalog.mjs";
import { connectDevice, DEVICE_CDP, navigateAndSettle, sleep } from "./device.mjs";

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const BASE = arg("url", process.env.MOBILE_BASE_URL ?? "http://localhost:3210").replace(/\/$/, "");
const OUT = arg("out", null);
const ONLY = arg("only", null)?.split(",") ?? null;
const SKIP_POPUPS = argv.includes("--no-popups");
const SKIP_PAGES = argv.includes("--no-pages");

const published = BOOKS.filter((b) => b.websiteStatus === "published" && (!ONLY || ONLY.includes(b.slug)));
const bySlug = new Map(published.map((b) => [b.slug, b]));
const authorName = new Map(AUTHORS.map((a) => [a.slug, a.name]));
const amazonUrls = (b) => new Set((b.formats ?? []).map((f) => f.amazonUrl).filter(Boolean));

/* ------------------------------------------------------------------ fingers */
const cdp = await connectDevice();
const touch = (x, y) => [{ x: Math.round(x), y: Math.round(y), radiusX: 12, radiusY: 12, force: 1 }];
async function tapAt(x, y, wait = 700) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touch(x, y) });
  await sleep(60);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(wait);
}
/**
 * Where a finger must go to land on the first visible element matching `selector` (and `re` on its label/text),
 * scrolled to the middle. A rect is in LAYOUT-viewport coordinates and a finger in VISUAL-viewport ones: they
 * differ once the browser's toolbar has collapsed, so the visual viewport's offset is taken off.
 */
const locate = (selector, re = null, scope = "document") =>
  cdp.eval(`(() => {
    const t = (e) => (e.getAttribute("aria-label") || e.textContent || "").replace(/\\s+/g, " ").trim();
    const re = ${re ? re.toString() : "null"};
    const el = Array.from((${scope}).querySelectorAll(${JSON.stringify(selector)})).filter((e) => e.getClientRects().length > 0 && (!re || re.test(t(e))))[0];
    if (!el) return null;
    el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    const r = el.getBoundingClientRect(), v = window.visualViewport;
    const dx = v ? v.offsetLeft : 0, dy = v ? v.offsetTop : 0;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x: x - dx, y: y - dy, w: Math.round(r.width), h: Math.round(r.height), reachable: !!top && (top === el || el.contains(top) || top.contains(el)), href: el.getAttribute("href") };
  })()`).catch(() => null);
/** Scroll it into view, let the toolbar settle, measure again where it ended up, then tap. */
async function tap(selector, re = null, wait = 700, scope = "document") {
  const first = await locate(selector, re, scope);
  if (!first) return null;
  await sleep(450);
  const at = await locate(selector, re, scope);
  if (!at) return null;
  await sleep(120);
  await tapAt(at.x, at.y, wait);
  return at;
}
async function waitFor(expr, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cdp.eval(expr).catch(() => false)) return true;
    await sleep(200);
  }
  return false;
}

/* ------------------------------------------------------------------ popups */
const DIALOG_FACTS = `(() => {
  const d = document.querySelector('[role="dialog"]');
  if (!d) return null;
  const path = (u) => { try { return decodeURIComponent(String(u).replace(/^.*[?&]url=/, "").replace(/&.*$/, "")); } catch (e) { return String(u); } };
  const thumbs = Array.from(d.querySelectorAll('[role="group"][aria-label="Views of the book"] button img')).map((i) => path(i.getAttribute("src")));
  const main = d.querySelector('section[aria-label="Preview"] img[alt]');
  const counter = (d.textContent.match(/(\\d+) \\/ (\\d+)/) || [])[0] || null;
  return {
    title: ((d.querySelector("h2") || {}).textContent || "").trim(),
    thumbs,
    mainAlt: main ? main.getAttribute("alt") : null,
    mainDecoded: !!main && main.complete && main.naturalWidth > 0,
    counter,
    amazon: Array.from(new Set(Array.from(d.querySelectorAll('a[href*="amazon.com"]')).map((a) => a.getAttribute("href")))),
    locked: getComputedStyle(document.documentElement).overflow === "hidden" || getComputedStyle(document.body).overflow === "hidden",
  };
})()`;

async function popupSweep() {
  const rows = [];
  for (const page of [1, 2, 3]) {
    await navigateAndSettle(cdp, `${BASE}/books?page=${page}`, { hard: true, settleMs: 2500 });
    const hrefs = await cdp.eval(`Array.from(document.querySelectorAll('ul a[href^="/books/"]')).map((a) => a.getAttribute("href"))`);
    for (const href of hrefs) {
      const slug = href.replace("/books/", "");
      const book = bySlug.get(slug);
      if (!book) continue;
      const row = { slug, page, opened: false, heading: null, panels: 0, panelsOwn: false, altsOwn: false, stepped: false, amazonOk: null, amazon: [], closed: false, unlocked: false, onList: false, problems: [] };
      rows.push(row);
      try {
        const card = await tap(`ul a[href="${href}"]`, null, 1000);
        if (!card) { row.problems.push("card not found"); continue; }
        row.opened = await waitFor(`!!document.querySelector('[role="dialog"]')`, 6000);
        if (!row.opened) { row.problems.push("popup did not open"); continue; }
        await sleep(500);
        const f = await cdp.eval(DIALOG_FACTS);
        row.heading = f.title;
        row.panels = f.thumbs.length;
        const slugPath = new RegExp(`/${slug.replace(/[-]/g, "\\-")}(\\.webp|/)`);
        row.panelsOwn = f.thumbs.length > 0 && f.thumbs.every((s) => slugPath.test(s));
        row.altsOwn = !!f.mainAlt && f.mainAlt.includes(book.title);
        row.amazon = f.amazon;
        const allowed = amazonUrls(book);
        row.amazonOk = f.amazon.every((u) => allowed.has(u));
        if (!f.mainDecoded) row.problems.push("main panel did not decode");
        if (f.title !== book.title) row.problems.push(`heading "${f.title}" is not "${book.title}"`);
        if (!row.panelsOwn) row.problems.push("a panel is not this book's file");
        if (!row.altsOwn) row.problems.push("the main picture's alt does not name this title");
        if (!row.amazonOk) row.problems.push("an Amazon link is not one of this book's editions");
        if (f.thumbs.length > 1) {
          const next = await tap('[role="dialog"] button[aria-label="Next view"]', null, 500);
          const after = next ? await cdp.eval(`((document.querySelector('[role="dialog"]') || {}).textContent || "").match(/(\\d+) \\/ (\\d+)/)?.[0] || null`) : null;
          row.stepped = !!after && after.startsWith("2 /");
          if (!row.stepped) row.problems.push(`Next view did not step (${after})`);
        } else row.stepped = true;
        await tap('[role="dialog"] [aria-label="Close quick view"]', null, 700);
        row.closed = await waitFor(`!document.querySelector('[role="dialog"]')`, 4000);
        const after = await cdp.eval(`({ path: location.pathname, html: getComputedStyle(document.documentElement).overflow, body: getComputedStyle(document.body).overflow })`);
        row.unlocked = after.html !== "hidden" && after.body !== "hidden";
        row.onList = after.path === "/books";
        if (!row.closed) row.problems.push("Close did not close it");
        if (!row.unlocked) row.problems.push("the page is still locked");
        if (!row.onList) row.problems.push(`left the list for ${after.path}`);
      } catch (e) {
        row.problems.push(`threw: ${String(e.message).slice(0, 120)}`);
      }
      process.stdout.write(`  popup ${row.problems.length ? "✗" : "✓"} ${slug}${row.problems.length ? "  " + row.problems.join("; ") : `  (${row.panels} panels)`}\n`);
      // a popup that failed to close must not poison the next card
      if (await cdp.eval(`!!document.querySelector('[role="dialog"]')`).catch(() => false)) {
        await navigateAndSettle(cdp, `${BASE}/books?page=${page}`, { hard: true, settleMs: 2000 });
      }
    }
  }
  return rows;
}

/* ------------------------------------------------------------------- pages */
const PAGE_FACTS = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const path = (u) => { try { return decodeURIComponent(String(u).replace(/^.*[?&]url=/, "").replace(/&.*$/, "")); } catch (e) { return String(u); } };
  const cover = document.querySelector('#overview img[alt^="Cover of "]');
  const way = Array.from(document.querySelectorAll("#overview a, #overview button")).filter((e) => e.getClientRects().length > 0).find((e) => /buy on amazon|add digital|add to cart|see the editions/i.test((e.textContent || "").trim()));
  const wr = way ? way.getBoundingClientRect() : null;
  const strip = document.querySelector('ul[aria-label^="Pictures from"]');
  let row = null;
  if (strip) {
    const rr = strip.getBoundingClientRect();
    const tiles = Array.from(strip.querySelectorAll(":scope > li > button")).map((b) => b.getBoundingClientRect());
    row = {
      tiles: tiles.length,
      srcs: Array.from(strip.querySelectorAll("img")).map((i) => path(i.getAttribute("src"))),
      scrolls: strip.scrollWidth > strip.clientWidth + 4,
      firstWhole: tiles.length > 0 && tiles[0].right <= rr.right + 1,
      secondShows: tiles[1] ? Math.round(rr.right - tiles[1].left) : 0,
    };
  }
  return {
    vw, vh,
    h1: ((document.querySelector("h1") || {}).textContent || "").trim(),
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    cover: cover ? { decoded: cover.complete && cover.naturalWidth > 0, natural: [cover.naturalWidth, cover.naturalHeight], path: path(cover.currentSrc || cover.src) } : null,
    way: wr ? { text: (way.textContent || "").trim().slice(0, 30), bottom: Math.round(wr.bottom), h: Math.round(wr.height) } : null,
    amazon: Array.from(new Set(Array.from(document.querySelectorAll('main a[href*="amazon.com"]')).map((a) => a.getAttribute("href")))),
    row,
    authors: Array.from(new Set(Array.from(document.querySelectorAll('#overview a[href^="/authors/"]')).map((a) => a.textContent.trim()))),
  };
})()`;

async function pageSweep() {
  const rows = [];
  for (const book of published) {
    const row = { slug: book.slug, h1: false, overflow: null, coverOk: false, wayOnFirstScreen: null, amazonOk: null, amazon: [], rowOk: null, authorOk: false, errors: [], problems: [] };
    rows.push(row);
    try {
      cdp.clearDiagnostics();
      await navigateAndSettle(cdp, `${BASE}/books/${book.slug}`, { hard: true, settleMs: 2200 });
      await cdp.eval(`window.scrollTo(0, 0)`);
      await sleep(400);
      const f = await cdp.eval(PAGE_FACTS);
      row.h1 = f.h1 === book.title;
      row.overflow = f.overflow;
      row.coverOk = !!f.cover && f.cover.decoded && f.cover.path === `/images/books/${book.slug}.webp` && Math.abs(f.cover.natural[0] / f.cover.natural[1] - 2 / 3) < 0.12;
      row.wayOnFirstScreen = f.way ? f.way.bottom <= f.vh && f.way.h >= 44 : null;
      row.amazon = f.amazon;
      const allowed = amazonUrls(book);
      row.amazonOk = f.amazon.length === allowed.size && f.amazon.every((u) => allowed.has(u));
      if (f.row) {
        const slugPath = new RegExp(`/(lookinside|previews)/${book.slug.replace(/[-]/g, "\\-")}/|/books/back/${book.slug.replace(/[-]/g, "\\-")}\\.webp`);
        row.rowOk = f.row.srcs.every((s) => slugPath.test(s)) && f.row.firstWhole && (!f.row.scrolls || f.row.secondShows >= 24);
        if (!row.rowOk) row.problems.push(`Look Inside row: ${JSON.stringify({ own: f.row.srcs.every((s) => slugPath.test(s)), firstWhole: f.row.firstWhole, secondShows: f.row.secondShows, scrolls: f.row.scrolls })}`);
      }
      const names = (book.authors ?? []).map((s) => authorName.get(s)).filter(Boolean);
      row.authorOk = names.length > 0 && names.every((n) => f.authors.includes(n));
      // A console line about a failed resource carries no address, but the log entry does: judge by that. What a build served
      // from localhost cannot have is not the page's fault — Vercel's beacons exist only on Vercel, and Clerk's production keys
      // refuse to run off valicepress.com — so those are set aside, as the desktop sweep sets them aside.
      const own = cdp.events
        .filter((m) => m.method === "Log.entryAdded" && m.params.entry.level === "error")
        .map((m) => `${m.params.entry.text} ${m.params.entry.url ?? ""}`)
        .filter((e) => !/_vercel\/|clerk|accounts\.|Production Keys|sentry|_next\/webpack-hmr|__nextjs|Back-Forward Cache/i.test(e));
      row.errors = [...own, ...cdp.pageErrors].map((e) => e.slice(0, 200));
      if (!row.h1) row.problems.push(`h1 "${f.h1}" is not "${book.title}"`);
      if (row.overflow !== 0) row.problems.push(`sideways scroll ${row.overflow}px`);
      if (!row.coverOk) row.problems.push(`cover ${JSON.stringify(f.cover)}`);
      if (row.wayOnFirstScreen === false) row.problems.push(`the way to buy ends at ${f.way.bottom}px of ${f.vh}`);
      if (!row.amazonOk) row.problems.push(`Amazon links ${JSON.stringify(f.amazon)} vs ${JSON.stringify([...allowed])}`);
      if (!row.authorOk) row.problems.push(`authors ${JSON.stringify(f.authors)} vs ${JSON.stringify(names)}`);
      if (row.errors.length) row.problems.push(`console: ${row.errors[0].slice(0, 100)}`);
    } catch (e) {
      row.problems.push(`threw: ${String(e.message).slice(0, 120)}`);
    }
    process.stdout.write(`  page  ${row.problems.length ? "✗" : "✓"} ${book.slug}${row.problems.length ? "  " + row.problems.join("; ") : ""}\n`);
  }
  return rows;
}

/* -------------------------------------------------------------------- main */
const ver = await (await fetch(`${DEVICE_CDP}/json/version`)).json();
console.log(`\nEvery published book on the phone — ${BASE}   (${published.length} books, ${ver.Browser})\n`);
const visible = await cdp.eval(`({ v: document.visibilityState, w: innerWidth })`);
if (visible.v !== "visible" || !visible.w) {
  console.error("the attached tab is not visible: bring Chrome to the front and run again");
  process.exit(2);
}
const popups = SKIP_POPUPS ? [] : await popupSweep();
const pages = SKIP_PAGES ? [] : await pageSweep();
const bad = [...popups.filter((r) => r.problems.length), ...pages.filter((r) => r.problems.length)];
console.log(`\n${bad.length ? `${bad.length} ROWS WITH PROBLEMS` : "ALL PASS"} — popups ${popups.filter((r) => !r.problems.length).length}/${popups.length}, pages ${pages.filter((r) => !r.problems.length).length}/${pages.length}\n`);
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), browser: ver.Browser, popups, pages }, null, 1));
  console.log(`wrote ${OUT}`);
}
process.exit(bad.length ? 1 : 0);
