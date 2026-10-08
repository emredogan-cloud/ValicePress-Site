#!/usr/bin/env node
/**
 * The admin area on the PHYSICAL phone — through the throw-away stub-auth copy, never the real gate.
 *
 *   node scripts/e2e/admin-harness.mjs --keep &        # builds the stub copy; serves 127.0.0.1:3211 (loopback, sandbox DB)
 *   adb reverse tcp:3211 tcp:3211                      # the phone's localhost:3211 → this machine's loopback, over USB only
 *   adb forward tcp:9222 localabstract:chrome_devtools_remote
 *   npm run mobile:admin
 *
 * Why a stub: a phone cannot sign in to the production Clerk from localhost, and the shipped code contains no way
 * around its own gate. The stub copy exists only in /tmp for the duration of the run (see the harness's header).
 * Nothing here talks to production; the one write it makes (add a contact, then delete it with the erase tick)
 * is to the sandbox database with an address that cannot exist (`*.invalid`), and it leaves nothing behind.
 *
 * Checks: every admin tab renders on the phone without sideways scroll; every BUTTON and every stand-alone LINK is at
 * least 44px (a link inside a sentence is exempt, as WCAG 2.5.8 exempts it); and the add / open / delete path works
 * with a real finger, including the soft keyboard (the first tap after typing only dismisses it, as on any phone —
 * the script closes the keyboard the way a person would before pressing the button).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { connectDevice, navigateAndSettle, sleep } from "./device.mjs";

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const BASE = arg("url", process.env.MOBILE_ADMIN_URL ?? "http://localhost:3211").replace(/\/$/, "");
const OUT = arg("out", null);
const SHOTS = arg("shots", null);

const results = [];
const check = (name, pass, detail = {}) => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} ${name}${pass ? "" : `   ${JSON.stringify(detail).slice(0, 220)}`}`);
  return pass;
};

const cdp = await connectDevice();
const touch = (x, y) => [{ x: Math.round(x), y: Math.round(y), radiusX: 12, radiusY: 12, force: 1 }];
const tapAt = async (x, y, wait = 700) => {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touch(x, y) });
  await sleep(60);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(wait);
};
const loc = (sel, re) =>
  cdp.eval(`(() => {
    const t = (e) => (e.getAttribute("aria-label") || e.textContent || "").replace(/\\s+/g, " ").trim();
    const re = ${re ? re.toString() : "null"};
    const el = Array.from(document.querySelectorAll(${JSON.stringify(sel)})).filter((e) => e.getClientRects().length > 0 && (!re || re.test(t(e))))[0];
    if (!el) return null;
    el.scrollIntoView({ block: "center", behavior: "instant" });
    const r = el.getBoundingClientRect();
    // A rect is in LAYOUT-viewport coordinates; a finger is in VISUAL-viewport coordinates. They are the same until the
    // browser's toolbar has collapsed and the visual viewport sits lower in the layout one (offsetTop 127 on a
    // contact's page): a tap at the rect's centre then lands 127px below the control, on empty page.
    const v = window.visualViewport;
    const dx = v ? v.offsetLeft : 0, dy = v ? v.offsetTop : 0;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x: x - dx, y: y - dy, w: Math.round(r.width), h: Math.round(r.height), reachable: !!top && (top === el || el.contains(top) || top.contains(el)) };
  })()`);
const tap = async (sel, re) => {
  const first = await loc(sel, re); // scrolls it into view
  if (!first) return null;
  // Scrolling makes Chrome collapse its toolbar, which makes the viewport taller and moves everything: the
  // coordinates measured during the scroll are stale a moment later (a button at the foot of a contact's page
  // was "found" at y=767 on a screen 718 tall, and the tap landed on empty space). Measure again where it settled.
  await sleep(500);
  const b = await loc(sel, re);
  if (b) {
    await sleep(150);
    await tapAt(b.x, b.y);
  }
  return b;
};
const shot = async (name) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const s = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${SHOTS}/admin-${name}.png`, Buffer.from(s.data, "base64"));
};
const facts = () =>
  cdp.eval(`({
    h1: (document.querySelector("h1") || {}).textContent?.trim().slice(0, 50),
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    small: Array.from(document.querySelectorAll("a[href], button, summary")).filter((e) => e.getClientRects().length > 0 && !e.closest(".sr-only")).filter((e) => {
      // a link inside a sentence is exempt (WCAG 2.5.8); so is a native radio/checkbox, whose LABEL is the target
      if (e.tagName === "A") { const p = e.closest("p"); if (p && p.textContent.trim().length > e.textContent.trim().length + 12) return false; }
      return true;
    }).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 28), h: Math.round(r.height), w: Math.round(r.width) }; }).filter((o) => Math.min(o.h, o.w) < 44).slice(0, 8),
  })`);

console.log(`\nAdmin on the phone — ${BASE}\n`);
for (const [path, label] of [["/admin", "overview"], ["/admin/books", "books"], ["/admin/email", "email"], ["/admin/free-books", "free books"], ["/admin/support", "reader support"], ["/admin/data", "site data"]]) {
  await navigateAndSettle(cdp, BASE + path, { hard: true, settleMs: 2500 });
  const f = await facts();
  check(`${label}: renders, no sideways scroll`, !!f.h1 && f.overflow === 0, f);
  check(`${label}: every button and stand-alone link is at least 44px`, f.small.length === 0, f.small);
  if (label === "overview" || label === "email") await shot(label);
}

// the write path, with a real finger and the soft keyboard
await navigateAndSettle(cdp, BASE + "/admin/email", { hard: true, settleMs: 2500 });
await tap("summary", /add/i);
await sleep(500);
const email = `qa-phone-${Date.now()}@e2e.invalid`;
const inp = await loc('input[name="email"]');
check("the Add-a-contact form opens and its email field is reachable", !!inp && inp.reachable, inp ?? "not found");
if (inp) {
  await tapAt(inp.x, inp.y);
  await cdp.send("Input.insertText", { text: email });
  await sleep(300);
  await cdp.eval(`document.activeElement && document.activeElement.blur()`); // close the keyboard, as a person does
  await sleep(700);
  const add = await tap("form button", /^add contact$/i);
  check("'Add contact' is a 44px control", !!add && add.h >= 44, add ?? "not found");
  let said = false;
  for (let i = 0; i < 20 && !said; i++) {
    said = await cdp.eval(`/Added /.test(document.body.innerText)`);
    if (!said) await sleep(400);
  }
  check("adding says it was added", said);
  await shot("added");
  await navigateAndSettle(cdp, `${BASE}/admin/email?q=${encodeURIComponent(email)}`, { hard: true, settleMs: 2500 });
  const row = await tap('a[href^="/admin/email/"]', new RegExp(email.slice(0, 16)));
  check("the new contact is in the list, and a finger opens it", !!row);
  await sleep(2000);
  const f2 = await facts();
  check("its page has no sideways scroll", f2.overflow === 0, f2);
  await shot("contact");
  // Delete is a question first ("Delete this contact…"), then a button that means it ("Delete permanently").
  const ask = await tap("button", /^delete this contact/i);
  await sleep(500);
  const erase = await loc('input[name="erase"]');
  if (erase) await tapAt(erase.x, erase.y);
  const del = await tap("button", /^delete permanently/i);
  const why = del ? null : await cdp.eval(`({ asked: ${JSON.stringify(ask)}, buttons: Array.from(document.querySelectorAll("button")).filter((b) => b.getClientRects().length).map((b) => b.textContent.trim().slice(0, 30)), inner: innerHeight, scrollY: Math.round(scrollY) })`);
  check("'Delete permanently' is a 44px control a finger reaches", !!del && del.h >= 44 && del.reachable, del ?? why);
  await sleep(2500);
  await navigateAndSettle(cdp, `${BASE}/admin/email?q=${encodeURIComponent(email)}`, { hard: true, settleMs: 2000 });
  check("deleting it, with the erase tick, leaves nothing", !(await cdp.eval(`document.body.innerText.includes(${JSON.stringify(email)})`)));
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${failed.length ? `${failed.length} FAILED — ` : "ALL PASS — "}${results.length - failed.length}/${results.length}\n`);
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 1));
}
process.exit(failed.length ? 1 : 0);
