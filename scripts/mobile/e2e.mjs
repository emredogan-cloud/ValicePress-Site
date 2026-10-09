#!/usr/bin/env node
/**
 * The five end-to-end user journeys, walked on the physical Redmi.
 *
 *   npm run mobile:e2e
 *   npm run mobile:e2e -- --only A,E --out <path>.json
 *
 * HOW THIS DIFFERS FROM `mobile:journeys`
 * `journeys.mjs` asserts a contract per surface: this control is 44px, that
 * panel traps focus, this input is not collapsed. It is a grid of independent
 * checks. This file walks the roadmap's Journeys A–E as *sequences* — open the
 * site, find the way in, follow it, and only then judge what you arrived at.
 * A journey fails where a real reader would get stuck, and every step after
 * that is recorded as `blocked`, not as a pass and not as a separate failure.
 *
 * WHAT IS DELIBERATELY NOT DONE
 * Journey B stops at the checkout control. Tapping it hands off to Paddle, and
 * the brief is explicit that a financial transaction must not be faked. The
 * Paddle overlay, the return leg and /order/[id] are recorded as NOT EXERCISED
 * with the reason, never as passes. Journey D's sign-in is likewise recorded
 * as unavailable: Clerk is not provisioned in this environment, so there is no
 * honest way to be signed in here.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  BASE_URL, assertServerHealthy, connectDevice, navigateAndSettle,
  assertRendered, clearViewport, resetCart, sleep,
} from "./device.mjs";
import { PROBE_SOURCE } from "./probe.mjs";
import { byName, ROUTES } from "./routes.mjs";

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ONLY = arg("only", null) ? arg("only").split(",").map((s) => s.trim().toUpperCase()) : null;
const OUT = arg("out", "docs/execution/mobile/baseline/phase-9/e2e.json");

const MENU = 'button[aria-controls="mobile-nav-panel"]';
const PANEL = "#mobile-nav-panel";

/* ───────────────────────────── primitives ───────────────────────────── */

async function tapAt(cdp, x, y) {
  const pt = [{ x: Math.round(x), y: Math.round(y), radiusX: 12, radiusY: 12, force: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt });
  await sleep(60);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(500);
}

/**
 * Scroll an element into view, then tap its centre. Returns its box, or null.
 *
 * Takes the first VISIBLE match, not the first match, and resolves it INSIDE
 * the tap — never through an id planted by an earlier probe. `BookAddToCart`
 * fetches `/api/entitlement` on mount and re-renders when it resolves, which
 * dropped the planted id; the tap then hit nothing and the journey reported a
 * working button as broken. `textRe` narrows by visible text or aria-label.
 *
 * The root layout used to mount a legacy `<SiteHeader>` on every page, hidden
 * by CSS, so `header a[href="/cart"]` and `input[type=search]` each resolved to
 * a display:none element FIRST, and querying without the visibility filter made a
 * reachable 44x44 cart button report "control not found". The legacy header is gone
 * (Phase 12); the filter stays so a hidden twin can never trip it again.
 */
async function tap(cdp, selector, textRe = null) {
  const box = await cdp.eval(`(() => {
    const t = (e) => (e.textContent || e.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    const re = ${textRe ? textRe.toString() : "null"};
    const el = Array.from(document.querySelectorAll(${JSON.stringify(selector)}))
      .filter((e) => e.getClientRects().length > 0)
      .filter((e) => !re || re.test(t(e)))[0];
    if (!el) return null;
    el.scrollIntoView({ block: "center", behavior: "instant" });
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2,
             w: Math.round(r.width), h: Math.round(r.height) };
  })()`).catch(() => null);
  if (!box) return null;
  await sleep(250);
  await tapAt(cdp, box.x, box.y);
  return box;
}

/**
 * Tap until the page agrees something happened.
 *
 * A tap that lands before the island has hydrated does nothing at all, and the
 * button is left reading "Add to cart" as if no finger had touched it — seen
 * intermittently on `next dev`, where a route compiles on first visit. A reader
 * would tap again; so does this. Three dead taps is still a failure.
 */
async function tapUntil(cdp, selector, textRe, conditionExpr, { attempts = 3, polls = 12 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const box = await tap(cdp, selector, textRe);
    if (!box) { await sleep(600); continue; }
    for (let p = 0; p < polls; p++) {
      if (await cdp.eval(conditionExpr).catch(() => false)) return { ok: true, attempts: i + 1 };
      await sleep(400);
    }
  }
  return { ok: false, attempts };
}

/** Wait until the address bar reads `path`. Returns the landing state, or null. */
async function waitForPath(cdp, path, { timeoutMs = 20000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const st = await cdp.eval(`({ p: location.pathname, rs: document.readyState,
      stuck: !!document.getElementById("S:0"), nodes: document.querySelectorAll('*').length })`)
      .catch(() => null);
    if (st && st.p === path && st.rs === "complete" && !st.stuck && st.nodes > 80) {
      // A soft transition streams the tree in; wait for the node count to rest.
      let last = -1, quiet = 0;
      while (quiet < 2 && Date.now() < deadline) {
        await sleep(350);
        const n = await cdp.eval(`document.querySelectorAll('*').length`).catch(() => last);
        if (n === last) quiet++; else { quiet = 0; last = n; }
      }
      return st;
    }
    await sleep(300);
  }
  return null;
}

/** Tap, then wait for the URL to change. Retries: a pre-hydration tap is inert. */
async function tapToPath(cdp, selector, path, { attempts = 3 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const box = await tap(cdp, selector);
    if (!box) return { ok: false, reason: "control not found", attempts: i + 1 };
    const landed = await waitForPath(cdp, path);
    if (landed) return { ok: true, box, landed, attempts: i + 1 };
    await sleep(600);
  }
  return { ok: false, reason: `never reached ${path}`, attempts };
}

async function pressKey(cdp, key, code, keyCode) {
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code, windowsVirtualKeyCode: keyCode });
  await cdp.send("Input.dispatchKeyEvent", { type: "char", text: key === "Enter" ? "\r" : key });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode });
  await sleep(400);
}

/** Horizontal overflow in CSS px. The one thing that must be zero everywhere. */
const overflow = (cdp) => cdp.eval(
  `Math.max(0, Math.round(document.documentElement.scrollWidth - innerWidth))`);

async function open(cdp, routeName) {
  const route = byName(routeName);
  await assertServerHealthy(BASE_URL, { path: route.path });
  await navigateAndSettle(cdp, new URL(route.path, BASE_URL).href);
  await assertRendered(cdp, route, route.path);
  await cdp.eval(`(() => {
    const b = document.querySelector(${JSON.stringify(MENU)});
    if (b && b.getAttribute("aria-expanded") === "true") b.click();
    window.scrollTo(0, 0); return true;
  })()`).catch(() => {});
  await sleep(350);
  return route;
}

/* ────────────────────────────── the walker ──────────────────────────── */

/** A journey is a list of steps; the first hard failure blocks the rest. */
function Walk(id, title, failureMode) {
  const steps = [];
  let dead = null;
  return {
    id, title, failureMode, steps,
    /** Record a step. `fatal` means a reader could not continue past it. */
    step(name, pass, detail, { fatal = false } = {}) {
      if (dead) { steps.push({ name, blocked: true, detail: `blocked by: ${dead}` }); return false; }
      steps.push({ name, pass: !!pass, detail });
      if (!pass && fatal) dead = name;
      return !!pass;
    },
    /** Record something we chose not to exercise, with the reason. Never a pass. */
    notExercised(name, reason) { steps.push({ name, notExercised: true, detail: reason }); },
    get blocked() { return dead; },
    get failed() { return steps.some((s) => s.pass === false); },
  };
}

/**
 * Is this element's text actually being cut off?
 *
 * NOT `scrollHeight > clientHeight`. A gradient display heading
 * (`background-clip: text`) reports 4-5px of extra scrollHeight from its line
 * box while `overflow: visible` paints every pixel of it — the /categories h1
 * measured 105 against 101 and lost nothing. Text is only unreadable if
 * something CLIPS it: an ellipsis, a line clamp, or an overflow that hides.
 *
 * `var`, not `const`: every Runtime.evaluate shares one global scope, so a
 * second `const clipsText` in the same page throws "already been declared" and
 * takes the whole journey down with it.
 */
const CLIPS_TEXT = `
  var clipsText = (el) => {
    const cs = getComputedStyle(el);
    const clampN = parseInt(cs.webkitLineClamp || cs.lineClamp, 10);
    if (clampN > 0) {
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      return el.scrollHeight > Math.ceil(lh * clampN) + 2;
    }
    if (cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1) return true;
    const hides = (s) => s === "hidden" || s === "clip" || s === "auto" || s === "scroll";
    if (hides(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) return true;
    if (hides(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) return true;
    return false;
  };
`;

/**
 * How many lines are in the cart, as the reader sees it.
 *
 * One remove control per line. NOT `a[href^="/books/"]` — /cart also carries a
 * recommendation shelf, and counting those reported "10 lines" for an empty
 * cart. NOT `/api/cart/count` either: under `next dev` that endpoint returned 0
 * while this page rendered the line and its remove button in the same session.
 */
const LINE_COUNT = `Array.from(document.querySelectorAll("button"))
  .filter((e) => e.getClientRects().length > 0)
  .filter((e) => /remove/i.test(e.textContent || e.getAttribute("aria-label") || "")).length`;

/* ───────────────────── A — Discovery ───────────────────── */

async function journeyA(cdp) {
  const w = Walk("A", "Discovery — home → menu → categories → a category → a book",
    "menu unreachable; category title unreadable; cover missing; any horizontal scroll");

  await open(cdp, "home");
  w.step("1. / renders with no horizontal scroll", (await overflow(cdp)) === 0, `${await overflow(cdp)}px`, { fatal: true });

  const trigger = await cdp.eval(`(() => {
    const b = document.querySelector(${JSON.stringify(MENU)});
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
  })()`);
  w.step("2. menu trigger is on screen and >= 44x44",
    !!trigger && trigger.w >= 44 && trigger.h >= 44 && trigger.top < 200,
    trigger, { fatal: true });

  const opened = await (async () => {
    for (let i = 0; i < 3; i++) {
      await tap(cdp, MENU);
      for (let p = 0; p < 8; p++) {
        const n = await cdp.eval(`(() => { const el = document.querySelector(${JSON.stringify(PANEL)});
          if (!el) return null; const links = el.querySelectorAll("a[href]");
          const r = el.getBoundingClientRect();
          return { links: links.length, w: Math.round(r.width), h: Math.round(r.height) }; })()`).catch(() => null);
        if (n && n.links > 0) return n;
        await sleep(250);
      }
    }
    return null;
  })();
  w.step("3. the drawer opens and offers browse destinations",
    !!opened && opened.links >= 4, opened, { fatal: true });

  const catLink = `${PANEL} a[href="/categories"]`;
  const toCats = await tapToPath(cdp, catLink, "/categories");
  w.step("4. tapping Categories navigates there", toCats.ok, toCats.landed ?? toCats.reason, { fatal: true });

  const cats = await cdp.eval(`${CLIPS_TEXT}(() => {
    const vis = (e) => e.getClientRects().length > 0;
    const cards = Array.from(document.querySelectorAll('a[href^="/categories/"]')).filter(vis);
    const first = cards[0];
    const rows = cards.slice(0, 8).map((a) => {
      const h = a.querySelector("h2,h3,h4,p,span");
      const cs = h ? getComputedStyle(h) : null;
      return { href: new URL(a.href, location.href).pathname,
               title: h ? (h.textContent || "").trim().slice(0, 40) : null,
               size: cs ? Math.round(parseFloat(cs.fontSize) * 10) / 10 : null,
               clipped: h ? clipsText(h) : null };
    });
    return { count: cards.length, first: first ? new URL(first.href, location.href).pathname : null, rows };
  })()`);
  w.step("5. /categories: no horizontal scroll", (await overflow(cdp)) === 0, `${await overflow(cdp)}px`);
  w.step("6. category titles are >= 12px and none is clipped",
    cats.rows.length > 0 && cats.rows.every((r) => (r.size ?? 0) >= 12 && r.clipped === false),
    cats.rows.filter((r) => (r.size ?? 0) < 12 || r.clipped).slice(0, 4));

  const toCat = await tapToPath(cdp, `a[href="${cats.first}"]`, cats.first);
  w.step(`7. tapping a category opens ${cats.first}`, toCat.ok, toCat.landed ?? toCat.reason, { fatal: true });

  const detail = await cdp.eval(`${CLIPS_TEXT}(() => {
    const h1 = document.querySelector("h1");
    const cs = h1 ? getComputedStyle(h1) : null;
    const book = Array.from(document.querySelectorAll('a[href^="/books/"]'))
      .filter((e) => e.getClientRects().length > 0)[0];
    return { h1: h1 ? (h1.textContent || "").trim().slice(0, 50) : null,
             size: cs ? Math.round(parseFloat(cs.fontSize)) : null,
             clipped: h1 ? clipsText(h1) : null,
             book: book ? new URL(book.href, location.href).pathname : null };
  })()`);
  w.step("8. the category title is present, sized and not clipped",
    !!detail.h1 && detail.size >= 18 && detail.clipped === false, detail);
  w.step("9. /categories/*: no horizontal scroll", (await overflow(cdp)) === 0, `${await overflow(cdp)}px`);

  const toBook = await tapToPath(cdp, `a[href="${detail.book}"]`, detail.book);
  w.step(`10. tapping a book opens ${detail.book}`, toBook.ok, toBook.landed ?? toBook.reason, { fatal: true });

  /* The cover, specifically. "The largest image on the page" picks the
     interior-preview carousel instead — 289x433 against the cover's 258x388 —
     and those are `loading="lazy"` and 2 629px down, so they are legitimately
     undecoded at the top of the page. Judging the cover by them reported a
     missing cover on a page whose cover was on screen and painted. */
  const cover = await cdp.eval(`(() => {
    const imgs = Array.from(document.querySelectorAll("main img, img"))
      .filter((i) => i.getClientRects().length > 0);
    const el = imgs.filter((i) => /^cover of /i.test(i.alt || ""))[0] || imgs[0];
    const r = el ? el.getBoundingClientRect() : null;
    const h1 = document.querySelector("h1");
    return { imgs: imgs.length,
             cover: el ? { w: Math.round(r.width), h: Math.round(r.height),
                           natural: el.naturalWidth, complete: el.complete,
                           alt: (el.alt || "").slice(0, 40) } : null,
             title: h1 ? (h1.textContent || "").trim().slice(0, 50) : null };
  })()`);
  w.step("11. the cover actually decoded",
    !!cover.cover && cover.cover.complete && cover.cover.natural > 0 && cover.cover.w > 80, cover.cover);
  w.step("12. the book title is present", !!cover.title, cover.title);
  w.step("13. book detail: no horizontal scroll", (await overflow(cdp)) === 0, `${await overflow(cdp)}px`);
  return w;
}

/* ───────────────────── B — Purchase ───────────────────── */

async function journeyB(cdp) {
  const w = Walk("B", "Purchase — ebooks → a direct-sale book → cart → quantity → checkout",
    "price or CTA below the fold; quantity control untappable; return lands on an error");

  /* Start from an empty cart. `/api/cart/count` returns LINE count, so adding a
     book that is already in the cart raises its quantity and leaves the count
     at 1 — the check read "1 → 1" and called a working button broken. */
  const cartState = await resetCart(cdp);
  /* Empty the cart the way a reader would, then check.
   *
   * `resetCart` clears cookies, but `next dev` keeps serving a cached /cart
   * render regardless — it says so itself — so "the cookie is gone" is not
   * "the cart is empty". A unique query string forces a fresh render, and
   * anything still in there gets removed through the UI. If a line will not
   * remove, that is a real failure and the journey should stop. */
  await assertServerHealthy(BASE_URL, { path: "/cart" });
  await navigateAndSettle(cdp, new URL(`/cart?e2e=${Date.now()}`, BASE_URL).href, { hard: true });
  await sleep(600);
  let startLines = await cdp.eval(LINE_COUNT);
  for (let i = 0; i < 12 && startLines > 0; i++) {
    await tapUntil(cdp, "button", /remove/i, `(${LINE_COUNT}) < ${startLines}`, { attempts: 2 });
    startLines = await cdp.eval(LINE_COUNT);
  }
  w.step("0. the cart starts empty", startLines === 0,
    `${startLines} line(s) after clearing; resetCart: ${cartState}`, { fatal: true });

  await open(cdp, "ebooks");
  w.step("1. /ebooks renders with no horizontal scroll", (await overflow(cdp)) === 0, `${await overflow(cdp)}px`, { fatal: true });

  /* A book that is SOLD HERE: its card says so with a PDF chip. /ebooks also lists Kindle-only
     titles (since 2026-10-07), whose page rightly has no Add to cart — picking the first card
     would make a correct page look like a missing button. */
  const pick = await cdp.eval(`(() => {
    const arts = Array.from(document.querySelectorAll("main article")).filter((a) =>
      a.getClientRects().length > 0 && /\\bPDF\\b/.test(a.querySelector(".catalog-card__chips")?.textContent ?? ""));
    const a = arts.map((x) => x.querySelector('a[href^="/books/"]')).filter(Boolean)[0];
    return a ? new URL(a.href, location.href).pathname : null;
  })()`);
  /* A tap on a catalogue card opens QUICK VIEW (the popup — brief section 8), not the page: a plain
     left click is intercepted there on purpose. The way on to the book is the popup's "Full details". */
  const card = await tap(cdp, `a[href="${pick}"]`);
  await sleep(900);
  const popup = card ? await cdp.eval(`!!document.querySelector('[role="dialog"]')`).catch(() => false) : false;
  w.step("2a. tapping a card opens the popup", popup, card ? "no dialog appeared" : "card not found", { fatal: true });
  const toBook = await tapToPath(cdp, `[role="dialog"] a[href="${pick}"]`, pick);
  w.step(`2. the popup's Full details opens ${pick}`, toBook.ok, toBook.landed ?? toBook.reason, { fatal: true });

  const buy = await cdp.eval(`(() => {
    const vis = (e) => e.getClientRects().length > 0;
    const t = (e) => (e.textContent || "").replace(/\\s+/g, " ").trim();
    const price = Array.from(document.querySelectorAll("span,p,strong")).filter(vis)
      .filter((e) => /^(\\$|£|€)\\d/.test(t(e)) && t(e).length < 14 && e.children.length === 0)[0];
    const cta = Array.from(document.querySelectorAll("button")).filter(vis)
      .filter((e) => /add digital edition|add to cart/i.test(t(e)))[0];
    const pr = price ? price.getBoundingClientRect() : null;
    const cr = cta ? cta.getBoundingClientRect() : null;
    return { vh: innerHeight,
             price: price ? t(price) : null, priceTop: pr ? Math.round(pr.top + scrollY) : null,
             ctaTop: cr ? Math.round(cr.top + scrollY) : null,
             ctaH: cr ? Math.round(cr.height) : null };
  })()`);
  w.step("3. the price is readable without scrolling",
    buy.priceTop !== null && buy.priceTop < buy.vh, `${buy.price} at ${buy.priceTop}px of ${buy.vh}`);
  w.step("4. the Add button is above the fold and >= 44px tall",
    buy.ctaTop !== null && buy.ctaTop < buy.vh && buy.ctaH >= 44,
    { top: buy.ctaTop, h: buy.ctaH, vh: buy.vh }, { fatal: buy.ctaTop === null });

  /* Since Phase 9 the button BECOMES a link — "In your cart — view cart" — and stays that way; an error
     leaves a button that says "Try again". Either is the page answering the tap. */
  const responded = await tapUntil(cdp, "button", /add digital edition|add to cart/i,
    `(() => Array.from(document.querySelectorAll("button,a[href]"))
       .filter((e) => e.getClientRects().length > 0)
       .some((e) => /in your cart|try again/i.test((e.textContent||"").trim())))()`);
  const claim = await cdp.eval(`(() => {
    const vis = (e) => e.getClientRects().length > 0;
    const t = (e) => (e.textContent || "").replace(/\s+/g, " ").trim();
    const b = Array.from(document.querySelectorAll("button,a[href]")).filter(vis)
      .filter((e) => /in your cart|add digital edition|add to cart|adding|try again/i.test(t(e)))[0];
    return { label: b ? t(b).slice(0, 24) : null,
             alert: !!document.querySelector('[role="alert"]') };
  })()`);
  const claimsSuccess = /in your cart/i.test(claim.label ?? "");
  w.step("5. the Add control responds to a tap",
    responded.ok, { ...claim, taps: responded.attempts }, { fatal: true });

  const toCart = await tapToPath(cdp, 'a[href="/cart"]', "/cart");
  w.step("6. the header cart control opens /cart", toCart.ok, toCart.landed ?? toCart.reason, { fatal: true });

  const cart = await cdp.eval(`(() => {
    const vis = (e) => e.getClientRects().length > 0;
    const t = (e) => (e.textContent || e.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
    const controls = Array.from(document.querySelectorAll("button")).filter(vis);
    const box = (e) => { const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) }; };
    const remove = controls.filter((e) => /remove/i.test(t(e)))[0];
    const checkout = Array.from(document.querySelectorAll("button,a[href]")).filter(vis)
      .filter((e) => /^buy\\b|checkout|proceed|pay/i.test(t(e)))[0];
    /* Cart LINES, not every book link on the page: /cart also carries a
       recommendation shelf, and counting those reported "10 line(s)" for an
       empty cart. One remove control exists per line, so count those. */
    return { lines: controls.filter((e) => /remove/i.test(t(e))).length,
             remove: remove ? { ...box(remove), label: t(remove).slice(0, 34) } : null,
             checkout: checkout ? { ...box(checkout), label: t(checkout).slice(0, 24) } : null };
  })()`);
  /* THE ARBITER IS THE CART PAGE, not /api/cart/count.
     Under `next dev` that endpoint was measured returning 0 while /cart
     rendered the line and its remove control in the same session — a dev-server
     caching artifact, not a product fault, but it makes the API useless as a
     source of truth here. The reader's truth is the page. */
  w.step("7. the cart shows the line just added", cart.lines === 1, `${cart.lines} line(s)`, { fatal: true });

  /* The regression test for the defect this phase found: the button used to say
     "Added to cart" whatever the server did. The control and the cart must
     agree — a store may decline to sell a book, it may not say it sold one. */
  w.step("8. the button's claim matches the cart",
    claimsSuccess === (cart.lines > 0), { claim: claim.label, lines: cart.lines });
  /* The roadmap's Journey B says "adjust quantity". This store has no quantity
     control, and that is a decision, not a gap: `src/lib/cart.ts` stores
     `Array<{bookId, addedAt}>` rather than a quantity map because "you can't
     buy two copies of the same title", and `addToCart` is idempotent to match.
     So the line's real control is REMOVE, and that is what gets tested. */
  w.notExercised("9. adjust the quantity",
    "not applicable: a digital line has an implicit quantity of 1 by design " +
    "(src/lib/cart.ts), so no quantity control exists to test.");
  w.step("10. the remove control is labelled and clears 44px",
    !!cart.remove && Math.min(cart.remove.w, cart.remove.h) >= 44 && /remove/i.test(cart.remove.label),
    cart.remove);

  const removeBefore = await cdp.eval(`(${LINE_COUNT})`).catch(() => cart.lines);
  const removed = await tapUntil(cdp, "button", /remove/i, `(${LINE_COUNT}) < ${removeBefore}`);
  const removeAfter = await cdp.eval(`(${LINE_COUNT})`).catch(() => removeBefore);
  w.step("11. tapping remove actually removes the line",
    removed.ok && removeAfter < removeBefore, `${removeBefore} → ${removeAfter} line(s)`);

  // Put it back so the checkout control below has something to act on.
  await open(cdp, "book-detail");
  await tap(cdp, "button", /add digital edition|add to cart/i);
  await sleep(1500);
  await open(cdp, "cart");
  const again = await cdp.eval(`(() => {
    const vis = (e) => e.getClientRects().length > 0;
    const t = (e) => (e.textContent || e.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    const c = Array.from(document.querySelectorAll("button,a[href]")).filter(vis)
      .filter((e) => /^buy\\b|checkout|proceed|pay/i.test(t(e)))[0];
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), label: t(c).slice(0, 24) };
  })()`);
  cart.checkout = again ?? cart.checkout;

  /* Since Phase 9 each line buys itself (Lemon Squeezy binds a checkout to one variant), so the control
     is the line's "Buy" button; there is no cart-wide checkout button, on purpose. */
  w.step("12. the line's Buy control is present and >= 44px tall",
    !!cart.checkout && cart.checkout.h >= 44, cart.checkout);
  w.notExercised("13. Paddle overlay → return → /order/[id] → /account/library",
    "stops here deliberately: completing checkout means a real payment-provider " +
    "transaction, and the brief forbids faking one. Paddle is also not keyed in " +
    "this environment, so a tap would only surface a configuration error, not the " +
    "reader's experience.");
  w.step("14. /cart: no horizontal scroll", (await overflow(cdp)) === 0, `${await overflow(cdp)}px`);

  /* Leave the cart as we found it. `resetCart` clears cookies but cannot beat
     `next dev`'s cached /cart render, so a line left behind here fails the NEXT
     run's step 0 — which is exactly what happened once. */
  const left = await cdp.eval(`(${LINE_COUNT})`).catch(() => 0);
  if (left > 0) {
    await tapUntil(cdp, "button", /remove/i, `(${LINE_COUNT}) < ${left}`);
  }
  return w;
}

/* ───────────────────── C — Amazon + companion ───────────────────── */

async function journeyC(cdp) {
  const w = Walk("C", "Amazon + companion — an Amazon-listed book → its companion → a sheet → signup",
    "a buy CTA appears for a book not sold here; sheet fails; signup input collapsed");

  /* The roadmap's subject is a book listed ON Amazon but NOT sold here. No such
     book is published in this environment — all 12 published books carry a real
     price — so the premise is checked as an INVARIANT across every published
     book instead of on one specimen, which is the same failure it guards. */
  const books = await (await fetch(new URL("/books", BASE_URL).href)).text();
  const slugs = [...new Set([...books.matchAll(/href="(\/books\/[a-z0-9-]+)"/g)].map((m) => m[1]))];
  const offenders = [];
  let amazonOnly = null;
  for (const slug of slugs) {
    const html = await (await fetch(new URL(slug, BASE_URL).href)).text();
    const hasCart = /add digital edition|add to cart/i.test(html);
    const hasAmazon = /buy on amazon/i.test(html);
    const priced = /[$£€]\d/.test(html);
    if (hasCart && !priced) offenders.push({ slug, reason: "cart CTA with no price" });
    if (hasAmazon && !hasCart) amazonOnly = slug;
  }
  w.step("1. no published book offers a buy CTA without a price",
    offenders.length === 0, offenders.length ? offenders : `${slugs.length} books checked`);
  if (amazonOnly) {
    // Since the 2026-10 catalogue, several titles are sold only on Amazon: their page must offer Amazon and no direct Add.
    const html = await (await fetch(new URL(amazonOnly, BASE_URL).href)).text();
    w.step(`2. an Amazon-only book (${amazonOnly}) hides the direct-buy CTA`,
      !/add digital edition|add to cart/i.test(html) && /buy on amazon/i.test(html), "its page offers Amazon and no direct Add");
  } else {
    w.notExercised("2. an Amazon-ONLY book hides the direct-buy CTA",
      `no Amazon-only book is published here: every one of the ${slugs.length} published books is also sold here. ` +
      "The rule stays enforced by valice-catalog.test.ts.");
  }

  const subject = "book-detail-2";  // world games: Amazon CTAs + a companion
  await open(cdp, subject);
  const links = await cdp.eval(`(() => {
    const vis = (e) => e.getClientRects().length > 0;
    const t = (e) => (e.textContent || "").replace(/\\s+/g, " ").trim();
    const amazon = Array.from(document.querySelectorAll("a[href]")).filter(vis)
      .filter((e) => /buy on amazon/i.test(t(e)))
      .map((e) => { const r = e.getBoundingClientRect();
        return { h: Math.round(r.height), rel: e.rel, target: e.target }; });
    const comp = Array.from(document.querySelectorAll('a[href^="/companion/"]')).filter(vis)[0];
    return { amazon, companion: comp ? new URL(comp.href, location.href).pathname : null };
  })()`);
  w.step("3. the Amazon CTAs are >= 44px tall",
    links.amazon.length > 0 && links.amazon.every((a) => a.h >= 44), links.amazon);

  const toComp = await tapToPath(cdp, `a[href="${links.companion}"]`, links.companion);
  w.step(`4. the companion link reaches ${links.companion}`, toComp.ok, toComp.landed ?? toComp.reason, { fatal: true });

  const sheets = await cdp.eval(`(() => {
    const vis = (e) => e.getClientRects().length > 0;
    const dl = Array.from(document.querySelectorAll("a[href]")).filter(vis)
      /* href and text tested SEPARATELY: an end-anchored .pdf pattern never
         matches once the two are concatenated, which is how this reported
         "no sheets" on a page offering four of them.
         NO BACKTICKS IN THIS BLOCK - it lives inside a template literal. */
      .filter((e) => /\\.pdf(\\?|$)/i.test(e.getAttribute("href") || "") ||
                     /download/i.test(e.textContent || ""))
      .map((e) => { const r = e.getBoundingClientRect();
        return { href: e.getAttribute("href"), h: Math.round(r.height),
                 label: (e.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 30) }; });
    const input = Array.from(document.querySelectorAll('input[type="email"], input[name*="mail" i]')).filter(vis)[0];
    const ir = input ? input.getBoundingClientRect() : null;
    return { downloads: dl,
             signup: ir ? { w: Math.round(ir.width), h: Math.round(ir.height) } : null };
  })()`);
  w.step("5. the companion offers at least one sheet",
    sheets.downloads.length > 0, sheets.downloads.slice(0, 4), { fatal: true });
  w.step("6. every download control is >= 44px tall",
    sheets.downloads.every((d) => d.h >= 44), sheets.downloads.filter((d) => d.h < 44));

  /* Follow the first sheet for real: a 200 with a PDF body, not just a link. */
  const first = sheets.downloads[0];
  let fetched = null;
  try {
    const r = await fetch(new URL(first.href, BASE_URL).href, { redirect: "follow", signal: AbortSignal.timeout(30000) });
    const buf = new Uint8Array(await r.arrayBuffer());
    fetched = { status: r.status, type: r.headers.get("content-type"), bytes: buf.length,
                magic: String.fromCharCode(...buf.slice(0, 5)) };
  } catch (e) { fetched = { error: String(e.message).slice(0, 90) }; }
  w.step("7. the sheet downloads and is a real PDF",
    fetched.status === 200 && fetched.magic === "%PDF-" && fetched.bytes > 1000, fetched);

  w.step("8. the signup input is not collapsed (>= 200px wide, >= 44px tall)",
    !!sheets.signup && sheets.signup.w >= 200 && sheets.signup.h >= 44, sheets.signup);
  w.step("9. the companion page: no horizontal scroll", (await overflow(cdp)) === 0, `${await overflow(cdp)}px`);
  return w;
}

/* ───────────────────── D — Retention ───────────────────── */

async function journeyD(cdp) {
  const w = Walk("D", "Retention — sign in → library → open a book → download and read",
    "sign-in modal clipped; library cards need hover; /read/[bookId] unusable");

  await open(cdp, "library");
  const state = await cdp.eval(`(() => {
    const vis = (e) => e.getClientRects().length > 0;
    const t = (e) => (e.textContent || "").replace(/\\s+/g, " ").trim();
    const body = t(document.body);
    const signIn = Array.from(document.querySelectorAll("a[href],button")).filter(vis)
      .filter((e) => /sign in|log in|sign up/i.test(t(e)))
      .map((e) => { const r = e.getBoundingClientRect();
        return { label: t(e).slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; });
    return { unprovisioned: /not configured|unavailable|unprovisioned|coming soon/i.test(body),
             signIn, h1: (document.querySelector("h1") || {}).textContent || null,
             cards: document.querySelectorAll('a[href^="/read/"], a[href^="/books/"]').length };
  })()`);
  w.step("1. /account/library renders on the device", !!state.h1, state.h1);
  w.step("2. /account/library: no horizontal scroll", (await overflow(cdp)) === 0, `${await overflow(cdp)}px`);
  if (state.signIn.length) {
    w.step("3. every sign-in control clears 44px",
      state.signIn.every((s) => s.h >= 44), state.signIn);
  }
  w.notExercised("4. sign in, open an owned book, download and read it",
    "Clerk is not provisioned in this environment (no publishable key in any " +
    "`vercel env` scope), so there is no honest way to be a signed-in reader " +
    "here. The library shell, its cards and /read/[bookId] are measured below; " +
    "the entitled path is not, and is not claimed.");

  /* /read/[bookId] had never been opened on a device before this phase. */
  const reader = byName("reader");
  await assertServerHealthy(BASE_URL, { path: reader.path });
  await navigateAndSettle(cdp, new URL(reader.path, BASE_URL).href, { hard: true });
  /* Tap targets come from the audit probe, not a hand-rolled "< 24px" scan.
     SC 2.5.8 has normative exceptions — spacing, inline, equivalent — and the
     footer's link list satisfies the spacing one. A naive scan reported four
     footer links as failures on a route the audit itself scores clean, which
     would have been a false accusation in a sign-off report. */
  const probe = await cdp.eval(PROBE_SOURCE);
  const r = await cdp.eval(`(() => ({
    nodes: document.querySelectorAll('*').length,
    text: (document.body.innerText || "").trim().length,
    overflow: Math.max(0, Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth)),
  }))()`);
  w.step("5. /read/[bookId] renders on the device (a first)", r.nodes > 80 && r.text > 40,
    { nodes: r.nodes, textLen: r.text });
  w.step("6. /read/[bookId]: no horizontal scroll", r.overflow === 0, `${r.overflow}px`);
  w.step("7. /read/[bookId]: no WCAG 2.5.8 tap failure",
    probe.tapFailsWcag === 0, probe.tapFailsWcagList?.slice(0, 4) ?? []);
  w.step("8. /read/[bookId]: no text under 12px", probe.textBelow12 === 0, probe.textBelow12);
  return w;
}

/* ───────────────────── E — Search ───────────────────── */

async function journeyE(cdp) {
  const w = Walk("E", "Search — tap search → type \"games\" → results visible → tap one",
    "keyboard covers the results; results below the fold; result tap does nothing");

  await open(cdp, "home");
  const toSearch = await tapToPath(cdp, 'a[href="/search"]', "/search");
  w.step("1. the header search control opens /search", toSearch.ok, toSearch.landed ?? toSearch.reason, { fatal: true });

  /* Poll: /search streams its input in, and a single probe taken the moment the
     URL changed found nothing and aborted the whole journey. The FIRST
     `input[type=search]` in the document is the hidden legacy header's, so the
     visibility filter is load-bearing here too. */
  let input = null;
  for (let i = 0; i < 12 && !input; i++) {
    input = await cdp.eval(`(() => {
      const vis = (e) => e.getClientRects().length > 0;
      const el = Array.from(document.querySelectorAll('input[type="search"], input[type="text"], input:not([type])')).filter(vis)[0];
      if (!el) return null;
      if (!el.id) el.id = "e2e-search-input";
      const r = el.getBoundingClientRect();
      return { id: el.id, w: Math.round(r.width), h: Math.round(r.height),
               top: Math.round(r.top), vw: innerWidth, vh: innerHeight,
               fontSize: Math.round(parseFloat(getComputedStyle(el).fontSize)) };
    })()`).catch(() => null);
    if (!input) await sleep(500);
  }
  const haveInput = w.step("2. the search input is present and not collapsed",
    !!input && input.w >= 200 && input.h >= 44, input, { fatal: true });
  if (!haveInput) return w;   // never dereference a control we failed to find

  /* The project's rule is a 12px floor (Phase 3), and this is 15px. The 16px
     iOS zoom-on-focus threshold is NOT asserted: no roadmap or audit item sets
     it, and there is no iOS device in the matrix to verify it on. Recorded so
     the number is on the table when an iOS device exists. */
  w.step("3. the search input clears the 12px floor",
    input.fontSize >= 12, `${input.fontSize}px (iOS would zoom below 16px — untested, no iOS device)`);

  await tap(cdp, `#${input.id}`);
  await sleep(400);
  await cdp.send("Input.insertText", { text: "games" });
  await sleep(600);

  /* Submit. This form is `onSubmit -> router.push("/search?q=…")`; there is no
     as-you-type search. Without pressing Enter the page never changes, and the
     step only "found results" because it was matching footer links. */
  await pressKey(cdp, "Enter", "Enter", 13);
  const landed = await waitForPath(cdp, "/search");
  w.step("4. pressing Enter runs the search",
    !!landed && /[?&]q=games/.test(await cdp.eval(`location.search`)),
    await cdp.eval(`location.pathname + location.search`), { fatal: true });
  await sleep(800);

  /* The keyboard is a real overlay: emulate the space it takes by measuring
     against the visual viewport the phone reports while focused. */
  const results = await cdp.eval(`(() => {
    const vis = (e) => e.getClientRects().length > 0;
    /* Results only. Unscoped, the first match was the footer's "Discover"
       column and the journey happily "tapped a result" that was a category
       link 2 076px down the page. */
    const root = document.querySelector("main") || document.body;
    const links = Array.from(root.querySelectorAll('a[href^="/books/"], a[href^="/blog/"]'))
      .filter(vis).filter((a) => !a.closest("footer") && !a.closest("header"));
    const first = links[0];
    if (first && !first.id) first.id = "e2e-first-result";
    const fr = first ? first.getBoundingClientRect() : null;
    const el = document.querySelector("#" + ${JSON.stringify(input.id)});
    return { count: links.length,
             firstId: first ? first.id : null,
             firstHref: first ? new URL(first.href, location.href).pathname : null,
             firstTop: fr ? Math.round(fr.top) : null,
             firstBottom: fr ? Math.round(fr.bottom) : null,
             visualH: visualViewport ? Math.round(visualViewport.height) : innerHeight,
             focused: document.activeElement === el,
             value: el ? el.value : null };
  })()`);
  w.step("5. the search returns results", results.count > 0,
    `${results.count} result(s) for "${results.value}"`, { fatal: true });
  /* Two different questions, and only one of them is assertable here.
     Submitting dismisses the Android IME, so the state a reader actually lands
     in has the full viewport — that is what gets asserted. The "would a raised
     keyboard cover it" number is RECORDED, not asserted: CDP taps do not raise
     the real IME, so the harness can only model it, and the honest home for
     that check is the manual list in MOBILE_REGRESSION_SUITE.md. */
  const keyboardUp = results.visualH < (await cdp.eval(`innerHeight`)) - 80;
  w.step("6. the first result is on screen when the results land",
    results.firstTop !== null && results.firstTop < results.visualH,
    `first result at ${results.firstTop}px of ${results.visualH}px` +
    (keyboardUp ? " (keyboard raised)" : " (keyboard dismissed by submit, as Android does)"));
  w.notExercised("7. the first result with the soft keyboard still raised",
    `modelled only: a 45%-height IME would start at ${Math.round(results.visualH * 0.55)}px and the ` +
    `first result is at ${results.firstTop}px. CDP cannot raise the real IME, so this is checked by ` +
    `hand — see MOBILE_REGRESSION_SUITE.md section 3.`);

  const toResult = await tapToPath(cdp, `#${results.firstId}`, results.firstHref);
  w.step(`8. tapping the first result opens ${results.firstHref}`,
    toResult.ok, toResult.landed ?? toResult.reason);
  w.step("9. the result page: no horizontal scroll", (await overflow(cdp)) === 0, `${await overflow(cdp)}px`);
  return w;
}

/* ────────────────────────────── runner ──────────────────────────────── */

const JOURNEYS = { A: journeyA, B: journeyB, C: journeyC, D: journeyD, E: journeyE };

async function main() {
  const ids = ONLY ?? Object.keys(JOURNEYS);

  // `next dev` compiles on first hit; a tap during that window hits dead HTML.
  for (const r of ROUTES.filter((x) => x.device)) {
    try { await fetch(new URL(r.path, BASE_URL).href, { signal: AbortSignal.timeout(60000) }); } catch {}
  }

  const cdp = await connectDevice();
  await clearViewport(cdp);
  console.log(`\n▸ End-to-end journeys on ${cdp.meta.browser}\n`);

  const walks = [];
  for (const id of ids) {
    if (!JOURNEYS[id]) { console.error(`unknown journey ${id}`); process.exit(2); }
    let walk;
    try {
      walk = await JOURNEYS[id](cdp);
    } catch (err) {
      walk = { id, title: `journey ${id}`, steps: [{ name: "journey aborted", pass: false, detail: String(err.message).slice(0, 200) }],
               failed: true, blocked: "aborted" };
    }
    console.log(`  ── Journey ${walk.id}: ${walk.title} ──`);
    for (const s of walk.steps) {
      const mark = s.blocked ? "·" : s.notExercised ? "–" : s.pass ? "✓" : "╳";
      const note = s.pass === true && !s.detail ? "" : `  ${JSON.stringify(s.detail)}`;
      console.log(`  ${mark} ${s.name}${s.pass === true ? "" : note}`);
    }
    walks.push({ id: walk.id, title: walk.title, failureMode: walk.failureMode,
                 steps: walk.steps, blocked: walk.blocked ?? null });
    console.log("");
  }
  cdp.close();

  const all = walks.flatMap((w) => w.steps);
  const passed = all.filter((s) => s.pass === true).length;
  const failed = all.filter((s) => s.pass === false).length;
  const blocked = all.filter((s) => s.blocked).length;
  const notEx = all.filter((s) => s.notExercised).length;
  console.log(`▸ ${passed}/${passed + failed} steps passed` +
              (blocked ? `, ${blocked} blocked` : "") +
              (notEx ? `, ${notEx} deliberately not exercised` : ""));

  const p = resolve(process.cwd(), OUT);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: BASE_URL,
    device: cdp.meta, summary: { passed, failed, blocked, notExercised: notEx }, journeys: walks }, null, 2));
  console.log(`  → ${OUT}`);
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(`\n╳ e2e aborted: ${e.message}`); process.exit(1); });
