#!/usr/bin/env node
/**
 * Production cart isolation, the way a stranger would hit it: three brand-new browsers.
 *
 *   node scripts/release/cart-isolation.mjs [base=https://valicepress.com]
 *
 *   A adds a book from a product page  -> A's cart holds it
 *   B (a different, cookie-less browser) -> has an EMPTY cart (the shared-EMPTY_CART defect would show A's book here)
 *   B adds the same book -> it is ADDED to B's cart (not answered "already in your cart" from a shared object)
 *   C (a third browser) -> still empty
 *
 * Only cookies in the three throw-away contexts are written; no checkout is started, nothing is bought. The
 * contexts carry the internal-traffic markers (src/lib/internal-traffic.ts) so analytics ignores them.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const BASE = (process.argv[2] ?? "https://valicepress.com").replace(/\/$/, "");
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(`${REPO}/package.json`);
const { chromium } = require("@playwright/test");
const catalogue = await import(pathToFileURL(`${REPO}/scripts/catalog/valice-catalog.mjs`).href);

// A book this site sells directly: an available direct-fulfilment ebook with a price.
const book = catalogue.BOOKS.find(
  (b) => b.websiteStatus === "published" && b.directSale !== false && !b.kdpSelect && b.formats.some((f) => f.format === "ebook" && f.fulfillment === "direct" && f.availability === "available" && f.priceCents > 0),
);
if (!book) {
  console.error("no directly sold book in the catalogue file");
  process.exit(2);
}
const slug = book.slug;
console.log(`base ${BASE} · book ${slug}`);

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await chromium.launch();
async function visitor() {
  const ctx = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: "vp_internal", value: "1", url: BASE }]);
  await ctx.addInitScript(() => {
    try {
      if (location.hostname.endsWith("valicepress.com")) localStorage.setItem("va-disable", "1");
    } catch {
      /* storage blocked */
    }
  });
  const page = await ctx.newPage();
  return { ctx, page };
}
const count = async (page) => {
  const res = await page.request.get(`${BASE}/api/cart/count`, { headers: { "x-valice-internal": "1" } });
  return { status: res.status(), body: res.ok() ? await res.json() : null };
};
async function addFromProductPage(page) {
  await page.goto(`${BASE}/books/${slug}`, { waitUntil: "load" });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const add = page.getByRole("button", { name: /^Add digital edition$|^Try again$/ }).first();
    if (await add.isVisible().catch(() => false)) await add.click().catch(() => {});
    if (await page.getByRole("link", { name: /^In your cart — view cart/ }).first().isVisible().catch(() => false)) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

try {
  const A = await visitor();
  const added = await addFromProductPage(A.page);
  check("A: pressing \"Add digital edition\" puts the book in A's cart", added);
  const ca = await count(A.page);
  check("A: the server's cart holds exactly that one book", ca.status === 200 && ca.body?.count === 1, JSON.stringify(ca));

  const B = await visitor();
  const cb0 = await count(B.page);
  check("B (a different browser): an EMPTY cart", cb0.status === 200 && cb0.body?.count === 0 && cb0.body?.ids?.length === 0, JSON.stringify(cb0));
  await B.page.goto(`${BASE}/cart`, { waitUntil: "load" });
  const heading = (await B.page.getByRole("heading", { level: 1 }).first().innerText().catch(() => "")).trim();
  check("B: /cart says the cart is empty and lists no line", heading === "Your cart is empty" && (await B.page.locator("[data-cart-line]").count()) === 0, heading);

  const addedB = await addFromProductPage(B.page);
  const bCookie = (await B.ctx.cookies()).find((c) => c.name === "dbs_cart");
  const cb1 = await count(B.page);
  check("B presses Add on the same book: it is ADDED (B's own cookie written)", addedB && !!bCookie && cb1.body?.count === 1, JSON.stringify(cb1));

  const C = await visitor();
  const cc = await count(C.page);
  check("C (a third browser): still an EMPTY cart", cc.status === 200 && cc.body?.count === 0, JSON.stringify(cc));

  // leave nothing behind (the contexts are discarded, but say so): remove from A and B through the cart page's control
  for (const v of [A, B, C]) await v.ctx.close();
} catch (e) {
  failed++;
  console.log("FAIL  script error: " + String(e));
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
