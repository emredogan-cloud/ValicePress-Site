/**
 * Provision the Valice Press catalog as Lemon Squeezy products and variants.
 *
 * ONE BOOK → ONE PRODUCT → ONE VARIANT. Lemon Squeezy binds a checkout to a
 * single variant, so a second variant on a book would be a second thing the
 * checkout could offer and a second id fulfilment would have to resolve. The
 * digital edition is one purchase that delivers every file we hold for that
 * book — the watermarked PDF and, where it exists, the EPUB — so it is one
 * variant. Formats are not variants here; Amazon sells the print.
 *
 * THE API CANNOT CREATE PRODUCTS. Established empirically on 2026-09-15 with
 * a live key, not read off a doc page:
 *
 *     POST /v1/products → 405  "The POST method is not supported for route
 *                               v1/products. Supported methods: GET, HEAD."
 *     POST /v1/variants → 405  (same)
 *     POST /v1/files    → 405  (same)
 *     POST /v1/checkouts, /v1/webhooks, /v1/discounts → these DO exist.
 *
 * So products and variants are created in the dashboard, by hand, and this
 * script's job is to say exactly WHAT to create, then read the result back and
 * emit the `providerPriceId:` lines. It no longer pretends `--commit` can
 * create anything, because it never could — the create path in the version
 * before this one had simply never been run against a real key.
 *
 * `/files` not existing costs us nothing: Lemon Squeezy is the payment rail
 * only. Files are delivered from our own R2 through the watermark worker and
 * the private reader, which is the architecture the threat model assumes.
 *
 * DRY RUN BY DEFAULT, like every other script in this directory. `--commit`
 * now only writes the read-back mapping to stdout; it creates nothing.
 *
 * IDEMPOTENT. Every run lists what the store already holds and matches on the
 * product name, so a re-run after a partial failure creates only what is
 * missing. It never deletes and never silently repoints an existing product at
 * a different book.
 *
 * Usage:
 *   node scripts/catalog/provision-lemonsqueezy.mjs                    # dry run
 *   node scripts/catalog/provision-lemonsqueezy.mjs --commit
 *   node scripts/catalog/provision-lemonsqueezy.mjs --commit --i-know-this-is-live
 *   node scripts/catalog/provision-lemonsqueezy.mjs --env .env.local   # pick env file
 *   node scripts/catalog/provision-lemonsqueezy.mjs --audit            # read-only report
 */
import { readFileSync } from "node:fs";

import { BOOKS } from "./valice-catalog.mjs";

const argv = process.argv.slice(2);
const commit = argv.includes("--commit");
const liveOk = argv.includes("--i-know-this-is-live");
const auditOnly = argv.includes("--audit");
const envIdx = argv.indexOf("--env");
const envFile = envIdx >= 0 ? argv[envIdx + 1] : ".env.local";

// ---------------------------------------------------------------------------
// Environment. Read from a file rather than trusting the ambient shell: this
// project has been bitten twice by a stale exported variable shadowing the
// file, and by a malformed line hiding a working key.
// ---------------------------------------------------------------------------
function loadEnv(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const out = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // A key with whitespace in its name is a malformed line, not a variable.
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    out[key] = value;
  }
  return out;
}

const fileEnv = loadEnv(envFile);
const API_KEY = fileEnv.LEMONSQUEEZY_API_KEY || process.env.LEMONSQUEEZY_API_KEY;
const STORE_ID = fileEnv.LEMONSQUEEZY_STORE_ID || process.env.LEMONSQUEEZY_STORE_ID;

if (!API_KEY) {
  console.error(
    `No LEMONSQUEEZY_API_KEY in ${envFile} or the environment.\n` +
      "Create one at Settings » API in the Lemon Squeezy dashboard while the\n" +
      "Valice Press store is selected, and paste it into that file. Keys are\n" +
      "mode-scoped: a key made in test mode only ever returns test data.",
  );
  process.exit(1);
}
if (!STORE_ID) {
  console.error(
    `No LEMONSQUEEZY_STORE_ID in ${envFile} or the environment.\n` +
      "It is the numeric id shown at Settings » Stores (Valice Press).",
  );
  process.exit(1);
}

const API = "https://api.lemonsqueezy.com/v1";
const JSON_API = "application/vnd.api+json";

async function ls(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: JSON_API,
      "Content-Type": JSON_API,
      Authorization: `Bearer ${API_KEY}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const detail = parsed?.errors?.map((e) => e.detail ?? e.title).join("; ");
    throw new Error(`${method} ${path} → ${res.status}: ${detail ?? String(text).slice(0, 300)}`);
  }
  return parsed;
}

/** Follow JSON:API pagination to the end rather than trusting page one. */
async function lsAll(path) {
  const out = [];
  let page = 1;
  for (;;) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await ls("GET", `${path}${sep}page[number]=${page}&page[size]=100`);
    out.push(...(res.data ?? []));
    const last = res.meta?.page?.lastPage ?? 1;
    if (page >= last) break;
    page += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// What the catalog says should exist
// ---------------------------------------------------------------------------

/** The books this storefront is cleared to sell, with the price to charge. */
function sellableBooks() {
  const rows = [];
  for (const b of BOOKS) {
    if (b.websiteStatus !== "published") continue;
    if (b.directSale === false) continue;
    const ebook = (b.formats ?? []).find((f) => f.format === "ebook");
    if (!ebook) continue;
    if (ebook.fulfillment !== "direct" || ebook.availability !== "available") continue;
    if (!ebook.masterFileKey) continue;
    if (!(ebook.priceCents > 0)) continue;
    rows.push({
      slug: b.slug,
      title: b.title,
      subtitle: b.subtitle ?? null,
      priceCents: ebook.priceCents,
      pageCount: ebook.pageCount ?? b.pageCount ?? null,
      hasEpub: Boolean(ebook.epubFileKey),
      series: b.series?.name ?? null,
      description: b.description ?? "",
    });
  }
  return rows;
}

/** The name a book's product carries in Lemon Squeezy. The matching key. */
const productName = (book) => `Valice Press — ${book.title}`;

/**
 * The product description shown on the checkout.
 *
 * Says three things every time, because each has been got wrong somewhere in
 * this project's history: that it is a digital download and nothing ships;
 * exactly which files arrive; and — for a Valice Classics title — that what is
 * being sold is this press's EDITION of a public-domain text, not a claim on
 * the text itself.
 */
function productDescription(book) {
  const files = book.hasEpub
    ? "a watermarked PDF and an EPUB"
    : "a watermarked PDF";
  const pages = book.pageCount ? `${book.pageCount} pages. ` : "";
  const provenance =
    book.series === "Valice Classics"
      ? "This is the Valice Press edition of a public-domain work: the typesetting, " +
        "introduction, head-notes, glossary and index are ours; the underlying text is " +
        "in the public domain and its source and translator are named in the book. "
      : "";
  // The first sentence of the catalogue description, which is written for a
  // reader rather than for a shop.
  const firstSentence = (book.description.split(". ")[0] ?? "").trim();
  return (
    `${firstSentence}${firstSentence.endsWith(".") ? "" : "."} ` +
    `${provenance}${pages}` +
    `Digital edition — you receive ${files} by email and in your Valice Press library. ` +
    "Nothing is shipped; printed editions are sold separately on Amazon."
  );
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const wanted = sellableBooks();

console.log(`store            : ${STORE_ID}`);
console.log(`env file         : ${envFile}`);
console.log(`mode             : ${auditOnly ? "AUDIT" : commit ? "COMMIT" : "DRY RUN"}`);
console.log(`sellable books   : ${wanted.length}\n`);

const store = await ls("GET", `/stores/${STORE_ID}`);
const storeAttrs = store.data?.attributes ?? {};
console.log(`store name       : ${storeAttrs.name}`);
console.log(`store currency   : ${storeAttrs.currency}`);
console.log(`store country    : ${storeAttrs.country}`);
console.log(`store plan       : ${storeAttrs.plan}\n`);

if (storeAttrs.currency && storeAttrs.currency !== "USD") {
  console.error(
    `REFUSING: the store's currency is ${storeAttrs.currency}, but every price in\n` +
      "valice-catalog.mjs is in USD cents. Set the store currency to USD in\n" +
      "Settings » General before provisioning, or every price will be wrong.",
  );
  process.exit(1);
}

const existingProducts = await lsAll(`/products?filter[store_id]=${STORE_ID}`);
const existingVariants = await lsAll(`/variants`);
const variantsByProduct = new Map();
for (const v of existingVariants) {
  const pid = String(v.attributes?.product_id ?? "");
  if (!variantsByProduct.has(pid)) variantsByProduct.set(pid, []);
  variantsByProduct.get(pid).push(v);
}

const byName = new Map(existingProducts.map((p) => [p.attributes?.name, p]));
console.log(`products already in the store : ${existingProducts.length}\n`);

const mapping = [];
let created = 0;
let matched = 0;
const mismatches = [];

for (const book of wanted) {
  const name = productName(book);
  const existing = byName.get(name);

  if (existing) {
    matched += 1;
    const variants = (variantsByProduct.get(String(existing.id)) ?? []).filter(
      // A Lemon Squeezy product always has a hidden "default" variant when it
      // has exactly one price; that IS the variant to sell, so nothing is
      // filtered out by status here — only soft-deleted rows would be.
      (v) => v.attributes?.status !== "draft" || variantsByProduct.get(String(existing.id)).length === 1,
    );
    const variant = variants[0] ?? null;
    const livePrice = existing.attributes?.price ?? null;
    if (livePrice !== null && livePrice !== book.priceCents) {
      mismatches.push(
        `${book.slug}: catalogue says ${book.priceCents}¢, Lemon Squeezy says ${livePrice}¢`,
      );
    }
    mapping.push({
      slug: book.slug,
      title: book.title,
      productId: String(existing.id),
      variantId: variant ? String(variant.id) : null,
      priceCents: livePrice ?? book.priceCents,
      status: existing.attributes?.status ?? "unknown",
      action: "existing",
    });
    console.log(
      `EXISTS  ${book.slug.padEnd(38)} product ${String(existing.id).padEnd(9)} variant ${variant ? variant.id : "—"}`,
    );
    continue;
  }

  mapping.push({
    slug: book.slug,
    title: book.title,
    productId: null,
    variantId: null,
    priceCents: book.priceCents,
    status: "absent",
    action: "create-by-hand",
  });
  console.log(
    `MISSING ${book.slug.padEnd(38)} $${(book.priceCents / 100).toFixed(2).padStart(6)}  ${name}`,
  );
}

// The dashboard worksheet. Everything needed to create the missing products by
// hand, in the order the form asks for it, so nobody has to go and find it.
const toCreate = mapping.filter((m) => m.action === "create-by-hand");
if (toCreate.length) {
  console.log(
    `\n${"=".repeat(72)}\n` +
      `${toCreate.length} PRODUCT(S) MUST BE CREATED IN THE DASHBOARD.\n` +
      `${"=".repeat(72)}\n` +
      "The Lemon Squeezy API has no POST /products and no POST /variants — it\n" +
      "answers 405. There is no scripted path; this is dashboard work. For each\n" +
      "row below: Products » New product, paste Name, Description and Price,\n" +
      "set it to a single-payment digital product, and publish.\n",
  );
  for (const m of toCreate) {
    const book = wanted.find((b) => b.slug === m.slug);
    console.log(`--- ${m.slug} ---`);
    console.log(`  Name        : ${productName(book)}`);
    console.log(`  Price       : $${(book.priceCents / 100).toFixed(2)} USD, one-time`);
    console.log(`  Description : ${productDescription(book)}`);
    console.log("");
  }
}

console.log(
  `\nmatched ${matched} · created ${created} · unmapped ${mapping.filter((m) => !m.variantId).length}`,
);

if (mismatches.length) {
  console.log("\nPRICE MISMATCHES — the storefront and the till disagree:");
  for (const m of mismatches) console.log(`  - ${m}`);
  console.log(
    "\nFix the price in Lemon Squeezy or in valice-catalog.mjs, whichever is\n" +
      "wrong, and re-run. A storefront quoting a price the checkout will not\n" +
      "charge is worse than quoting none.",
  );
}

// The paste-back block: the exact edits `valice-catalog.mjs` needs so that
// nothing has to be transcribed by hand.
const wired = mapping.filter((m) => m.variantId);
if (wired.length) {
  console.log("\n--- providerPriceId values for valice-catalog.mjs ---");
  for (const m of wired) {
    console.log(`  ${m.slug.padEnd(38)} providerPriceId: "${m.variantId}",`);
  }
}

if (mapping.some((m) => m.variantId) && !liveOk) {
  console.log(
    "\nNOTE: this key reads whatever mode it belongs to. A key created while the\n" +
      "store was in test mode sees only test-mode products, and a test variant id\n" +
      "must never reach production — scripts/catalog/wire-rehearsal-variants.mjs\n" +
      "refuses to write one into neondb.",
  );
}
