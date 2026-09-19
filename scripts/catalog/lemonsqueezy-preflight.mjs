/**
 * Lemon Squeezy pre-flight — everything that can be proved WITHOUT the
 * provider.
 *
 * Provisioning has been blocked twice on the same two Founder actions, and
 * each time the interesting question ("is the rest of the chain actually
 * ready, or is the store just the first of several blockers?") went
 * unanswered because the first failure stopped the run. This script answers
 * it. It touches Lemon Squeezy only to report whether it is reachable, and
 * never requires an API key.
 *
 * It checks, for the exact set of books the storefront is cleared to sell:
 *   1. the catalogue is internally consistent (price, delivery, exclusions);
 *   2. every master file the checkout promises EXISTS IN R2, at the byte
 *      level — a HEAD, not a manifest read, because this project has called
 *      eight built editions missing off a manifest that had drifted;
 *   3. the production database can receive the mapping (column, constraints);
 *   4. the production webhook endpoint is wired and fails safe.
 *
 * Read-only. Writes nothing, anywhere.
 *
 * Usage:
 *   node scripts/catalog/lemonsqueezy-preflight.mjs --env scripts/tmp/.env.production
 */
import { readFileSync } from "node:fs";

import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";

import { BOOKS } from "./valice-catalog.mjs";

const argv = process.argv.slice(2);
const envIdx = argv.indexOf("--env");
const envFile = envIdx >= 0 ? argv[envIdx + 1] : ".env.local";
const json = argv.includes("--json");

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
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    out[key] = value;
  }
  return out;
}

// R2 credentials are not in the production env dump; they live in .env /
// .env.local. Merge, preferring the explicitly chosen file, so DATABASE_URL
// points where the caller asked while R2 still resolves.
// A redaction is not a value. The production env dump stores `[SENSITIVE]`
// in place of every secret, and merging it naively puts that literal string
// over the working credential — which fails as "Invalid URL" and reads like
// 27 missing masters. Redactions are dropped, so the real value survives.
function realOnly(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "[SENSITIVE]" || v === "") continue;
    out[k] = v;
  }
  return out;
}
const env = {
  ...realOnly(loadEnv(".env")),
  ...realOnly(loadEnv(".env.local")),
  ...realOnly(loadEnv(envFile)),
};

const results = [];
function check(area, name, ok, detail) {
  results.push({ area, name, ok, detail });
  if (!json) {
    const mark = ok === true ? "PASS" : ok === null ? "SKIP" : "FAIL";
    console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// 1. The eligible set. Same predicate as provision-lemonsqueezy.mjs, kept in
//    step deliberately: if the two ever disagree, the storefront sells a book
//    the provisioner never created a product for.
// ---------------------------------------------------------------------------
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
      priceCents: ebook.priceCents,
      masterFileKey: ebook.masterFileKey,
      epubFileKey: ebook.epubFileKey ?? null,
      kdpSelect: b.kdpSelect === true,
      providerPriceId: b.providerPriceId ?? null,
      description: b.description ?? "",
    });
  }
  return rows;
}

/** Books deliberately not sold here, with the reason the catalogue gives. */
function excludedBooks() {
  const rows = [];
  for (const b of BOOKS) {
    if (b.websiteStatus !== "published") continue;
    const ebook = (b.formats ?? []).find((f) => f.format === "ebook");
    const sellable =
      b.directSale !== false &&
      ebook &&
      ebook.fulfillment === "direct" &&
      ebook.availability === "available" &&
      ebook.masterFileKey &&
      ebook.priceCents > 0;
    if (sellable) continue;
    let why = "no ebook format";
    if (ebook) {
      if (b.directSale === false) why = b.directSaleBlockedBy ?? "directSale: false";
      else if (ebook.fulfillment !== "direct") why = `fulfillment: ${ebook.fulfillment}`;
      else if (ebook.availability !== "available") why = `availability: ${ebook.availability}`;
      else if (!ebook.masterFileKey) why = "no master file";
      else if (!(ebook.priceCents > 0)) why = "priceCents: 0 (not sold here)";
    }
    rows.push({ slug: b.slug, title: b.title, why, kdpSelect: b.kdpSelect === true });
  }
  return rows;
}

const wanted = sellableBooks();
const excluded = excludedBooks();

if (!json) {
  console.log("LEMON SQUEEZY PRE-FLIGHT");
  console.log(`env file : ${envFile}`);
  console.log(`eligible : ${wanted.length} books\n`);
  console.log("1. CATALOGUE CONSISTENCY");
}

// Every eligible book has a positive USD price.
const badPrice = wanted.filter((b) => !Number.isInteger(b.priceCents) || b.priceCents <= 0);
check("catalogue", "every eligible book has a positive integer price",
  badPrice.length === 0, badPrice.map((b) => b.slug).join(", ") || `${wanted.length} books`);

// KDP Select exclusivity: a Select-enrolled book must never be in the set.
const selectLeak = wanted.filter((b) => b.kdpSelect);
check("catalogue", "no KDP Select book is offered for direct sale",
  selectLeak.length === 0,
  selectLeak.length ? `LEAK: ${selectLeak.map((b) => b.slug).join(", ")}` : "exclusivity respected");

// Slugs unique — a duplicate would map two books to one product name.
const slugCounts = new Map();
for (const b of wanted) slugCounts.set(b.slug, (slugCounts.get(b.slug) ?? 0) + 1);
const dupSlugs = [...slugCounts].filter(([, n]) => n > 1).map(([s]) => s);
check("catalogue", "slugs are unique across the eligible set",
  dupSlugs.length === 0, dupSlugs.join(", ") || `${slugCounts.size} distinct`);

// Product names unique — the name IS the idempotency key the provisioner
// matches on, so two books sharing one would silently collide into one
// product and the second book would be sold the first book's file.
const nameCounts = new Map();
for (const b of wanted) {
  const n = `Valice Press — ${b.title}`;
  nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
}
const dupNames = [...nameCounts].filter(([, n]) => n > 1).map(([s]) => s);
check("catalogue", "product names are unique (the idempotency key)",
  dupNames.length === 0, dupNames.join(", ") || `${nameCounts.size} distinct`);

// A description exists to build the checkout copy from.
const noDesc = wanted.filter((b) => !b.description || b.description.length < 40);
check("catalogue", "every eligible book has a description for the checkout",
  noDesc.length === 0, noDesc.map((b) => b.slug).join(", ") || "all present");

// ---------------------------------------------------------------------------
// 2. Assets. HEAD every file the checkout promises to deliver.
// ---------------------------------------------------------------------------
if (!json) console.log("\n2. DELIVERABLE FILES IN R2 (HEAD, not a manifest read)");

let s3 = null;
if (env.R2_ENDPOINT && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY) {
  s3 = new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

const assetRows = [];
if (!s3) {
  check("assets", "R2 credentials present", null, "no R2 credentials in env — skipped");
} else {
  const bucket = env.R2_BUCKET_MASTERS;
  let pdfOk = 0, pdfBad = [], epubOk = 0, epubBad = [], epubCount = 0;
  for (const b of wanted) {
    let pdf = null, epub = null;
    try {
      const h = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: b.masterFileKey }));
      pdf = h.ContentLength ?? 0;
      if (pdf > 0) pdfOk += 1; else pdfBad.push(`${b.slug} (0 bytes)`);
    } catch (e) {
      pdfBad.push(`${b.slug} (${e.name})`);
    }
    if (b.epubFileKey) {
      epubCount += 1;
      try {
        const h = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: b.epubFileKey }));
        epub = h.ContentLength ?? 0;
        if (epub > 0) epubOk += 1; else epubBad.push(`${b.slug} (0 bytes)`);
      } catch (e) {
        epubBad.push(`${b.slug} (${e.name})`);
      }
    }
    assetRows.push({ slug: b.slug, pdfBytes: pdf, epubBytes: epub, hasEpub: Boolean(b.epubFileKey) });
  }
  check("assets", `every eligible book's PDF master exists and is non-empty`,
    pdfBad.length === 0, pdfBad.join(", ") || `${pdfOk}/${wanted.length} present`);
  check("assets", `every promised EPUB exists and is non-empty`,
    epubBad.length === 0, epubBad.join(", ") || `${epubOk}/${epubCount} present`);
}

// ---------------------------------------------------------------------------
// 3. The database can receive the mapping.
// ---------------------------------------------------------------------------
if (!json) console.log("\n3. DATABASE READINESS");

let dbRows = [];
if (!env.DATABASE_URL) {
  check("db", "DATABASE_URL present", null, `not in ${envFile} — skipped`);
} else {
  const sql = neon(env.DATABASE_URL);
  const dbName = (await sql`select current_database() d`)[0].d;
  check("db", "connected", true, dbName);

  const cols = await sql`
    select column_name from information_schema.columns
    where table_schema='public' and table_name='books'`;
  const colNames = cols.map((c) => c.column_name);
  check("db", "books.provider_price_id exists (the provider migration ran)",
    colNames.includes("provider_price_id"),
    colNames.includes("provider_price_id") ? "column present" : "MISSING — run apply-provider-migration.mjs");

  const tables = (await sql`
    select table_name from information_schema.tables where table_schema='public'`)
    .map((t) => t.table_name);
  for (const t of ["orders", "order_items", "entitlements", "watermark_jobs", "commerce_events"]) {
    check("db", `table ${t} exists`, tables.includes(t), tables.includes(t) ? "" : "MISSING");
  }

  // mor_order_ref UNIQUE is the idempotency guarantee a re-delivered webhook
  // relies on. A missing constraint would double-fulfil silently.
  // Uniqueness can be enforced by a UNIQUE INDEX with no matching row in
  // pg_constraint — this schema does exactly that (orders_mor_order_ref_uk).
  // Asking pg_constraint alone reports a missing guarantee that is in fact
  // present, so ask pg_indexes, which sees both.
  const idx = await sql`
    select indexname, indexdef from pg_indexes where tablename = 'orders'`;
  const morUnique = idx.find(
    (i) => /UNIQUE/i.test(i.indexdef) && /\(mor_order_ref\)/.test(i.indexdef),
  );
  check("db", "orders.mor_order_ref is UNIQUE (webhook idempotency)",
    Boolean(morUnique), morUnique ? morUnique.indexname : "NO UNIQUE INDEX OR CONSTRAINT");

  dbRows = await sql`select slug, price_cents, provider_price_id, status from books`;
  const bySlug = new Map(dbRows.map((r) => [r.slug, r]));

  // Every eligible book has a row to write the variant id into.
  const missingRows = wanted.filter((b) => !bySlug.has(b.slug));
  check("db", "every eligible book has a row in books",
    missingRows.length === 0, missingRows.map((b) => b.slug).join(", ") || `${wanted.length} matched`);

  // Price agreement between catalogue and database.
  const priceDrift = wanted
    .filter((b) => bySlug.has(b.slug) && bySlug.get(b.slug).price_cents !== b.priceCents)
    .map((b) => `${b.slug}: catalogue ${b.priceCents}¢ vs db ${bySlug.get(b.slug).price_cents}¢`);
  check("db", "catalogue price == database price for every eligible book",
    priceDrift.length === 0, priceDrift.join("; ") || "no drift");

  // Nothing ineligible already carries a provider id.
  const eligibleSlugs = new Set(wanted.map((b) => b.slug));
  const wrongfullyWired = dbRows
    .filter((r) => r.provider_price_id && !eligibleSlugs.has(r.slug))
    .map((r) => r.slug);
  check("db", "no ineligible book carries a provider_price_id",
    wrongfullyWired.length === 0, wrongfullyWired.join(", ") || "clean");

  // No two books share one variant id.
  const wiredIds = dbRows.filter((r) => r.provider_price_id).map((r) => r.provider_price_id);
  const dupIds = wiredIds.filter((id, i) => wiredIds.indexOf(id) !== i);
  check("db", "no duplicate book→variant mapping",
    dupIds.length === 0, dupIds.join(", ") || `${wiredIds.length} mapped`);

  const mapped = dbRows.filter((r) => r.provider_price_id && eligibleSlugs.has(r.slug)).length;
  check("db", `eligible catalogue mapped to a variant`,
    mapped === wanted.length,
    `${mapped}/${wanted.length}${mapped === wanted.length ? "" : " — provisioning has not run"}`);
}

// ---------------------------------------------------------------------------
// 4. The provider and the live endpoint.
// ---------------------------------------------------------------------------
if (!json) console.log("\n4. PROVIDER AND LIVE ENDPOINT");

let storeState = "unknown";
try {
  const res = await fetch(`https://valicepress.lemonsqueezy.com/`, {
    redirect: "manual",
    headers: { "Cache-Control": "no-cache" },
  });
  const text = await res.text();
  if (/has not been activated/i.test(text)) storeState = "NOT ACTIVATED";
  else if (res.status === 200) storeState = "activated";
  else storeState = `HTTP ${res.status}`;
} catch (e) {
  storeState = `unreachable (${e.message})`;
}
check("provider", "Lemon Squeezy store is activated",
  storeState === "activated", `storefront reports: ${storeState}`);

check("provider", "LEMONSQUEEZY_API_KEY is available to this process",
  Boolean(env.LEMONSQUEEZY_API_KEY), env.LEMONSQUEEZY_API_KEY ? "present" : "absent");

const appUrl = (env.NEXT_PUBLIC_APP_URL || "https://valicepress.com").replace(/\/+$/, "");
try {
  const res = await fetch(`${appUrl}/api/webhooks/lemonsqueezy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meta: { event_name: "order_created" }, data: { id: "preflight-probe" } }),
  });
  const body = (await res.text()).slice(0, 120);
  // 401 = secret configured, signature rejected (correct).
  // 503 = secret absent, refusing to process (fail-safe, but not configured).
  check("provider", "production webhook rejects an unsigned payload",
    res.status === 401 || res.status === 503, `HTTP ${res.status}: ${body}`);
  check("provider", "LEMONSQUEEZY_WEBHOOK_SECRET is configured in production",
    res.status === 401, res.status === 503 ? "endpoint says it is not configured" : `HTTP ${res.status}`);
} catch (e) {
  check("provider", "production webhook reachable", false, e.message);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const pass = results.filter((r) => r.ok === true).length;
const fail = results.filter((r) => r.ok === false).length;
const skip = results.filter((r) => r.ok === null).length;

if (json) {
  console.log(JSON.stringify({ wanted, excluded, assetRows, results, storeState }, null, 2));
} else {
  console.log("\n" + "=".repeat(70));
  console.log(`PASS ${pass} · FAIL ${fail} · SKIP ${skip}`);
  console.log("=".repeat(70));
  if (fail) {
    console.log("\nFAILING:");
    for (const r of results.filter((r) => r.ok === false)) {
      console.log(`  - [${r.area}] ${r.name} — ${r.detail}`);
    }
  }
  console.log(`\nEligible for sale here (${wanted.length}):`);
  for (const b of wanted) {
    console.log(`  ${b.slug.padEnd(38)} $${(b.priceCents / 100).toFixed(2).padStart(6)}  ${b.epubFileKey ? "PDF + EPUB" : "PDF"}`);
  }
  console.log(`\nDeliberately not sold here (${excluded.length}):`);
  for (const b of excluded) console.log(`  ${b.slug.padEnd(38)} ${b.why}`);
}

process.exit(fail > 0 ? 1 : 0);
