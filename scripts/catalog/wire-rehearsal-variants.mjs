/**
 * Wire Lemon Squeezy variant ids into a database WITHOUT touching
 * `valice-catalog.mjs`.
 *
 * WHY THIS EXISTS. The normal path is: provision → paste the printed
 * `providerPriceId:` lines into `valice-catalog.mjs` → `load-catalog.mjs`.
 * That is right for production ids and wrong for a rehearsal, because
 * `valice-catalog.mjs` is the source of truth for what this store sells and a
 * TEST variant id has no business being committed into it. This script writes
 * the mapping straight into the database instead, so the rehearsal leaves the
 * catalogue file untouched and there is nothing to un-commit afterwards.
 *
 * THE GUARD. Production is `neondb`; the sandbox is `bookstore`. A test-mode
 * variant written into production is exactly the `pri_test_meditations_999`
 * defect this project shipped once already, so the script asks the database
 * its own name and refuses to write test-mode variants anywhere but the
 * sandbox. The refusal is not overridable by a flag, because the one time a
 * flag like that exists is the time somebody uses it at 3am.
 *
 * Usage:
 *   node scripts/catalog/wire-rehearsal-variants.mjs --env .env.local          # dry run
 *   node scripts/catalog/wire-rehearsal-variants.mjs --env .env.local --commit
 *   node scripts/catalog/wire-rehearsal-variants.mjs --env .env.local --clear  # unwire
 */
import { readFileSync } from "node:fs";

import { neon } from "@neondatabase/serverless";

import { BOOKS } from "./valice-catalog.mjs";

const argv = process.argv.slice(2);
const commit = argv.includes("--commit");
const clear = argv.includes("--clear");
const envIdx = argv.indexOf("--env");
const envFile = envIdx >= 0 ? argv[envIdx + 1] : ".env.local";

function loadEnv(path) {
  let text;
  try { text = readFileSync(path, "utf8"); } catch { return {}; }
  const out = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("="); if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (v === "[SENSITIVE]" || v === "") continue;
    out[key] = v;
  }
  return out;
}

const env = { ...loadEnv(".env"), ...loadEnv(envFile) };
const API_KEY = env.LEMONSQUEEZY_API_KEY;
const STORE_ID = env.LEMONSQUEEZY_STORE_ID;
if (!API_KEY || !STORE_ID) {
  console.error(`LEMONSQUEEZY_API_KEY / LEMONSQUEEZY_STORE_ID missing from ${envFile}.`);
  process.exit(1);
}
if (!env.DATABASE_URL) {
  console.error(`DATABASE_URL missing from ${envFile}.`);
  process.exit(1);
}

const API = "https://api.lemonsqueezy.com/v1";
const JSON_API = "application/vnd.api+json";
async function lsAll(path) {
  const out = [];
  let page = 1;
  for (;;) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${API}${path}${sep}page[number]=${page}&page[size]=100`, {
      headers: { Accept: JSON_API, Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = await res.json();
    out.push(...(body.data ?? []));
    const last = body.meta?.page?.lastPage ?? 1;
    if (page >= last) break;
    page += 1;
  }
  return out;
}

const sql = neon(env.DATABASE_URL);
const dbName = (await sql`select current_database() d`)[0].d;
const isSandbox = dbName !== "neondb";
console.log(`database  : ${dbName} ${isSandbox ? "(sandbox)" : "(PRODUCTION)"}`);
console.log(`env file  : ${envFile}`);
console.log(`mode      : ${clear ? "CLEAR" : commit ? "COMMIT" : "DRY RUN"}\n`);

if (clear) {
  if (!isSandbox) {
    console.error("REFUSING: --clear is a rehearsal tool and will not run against production.");
    process.exit(1);
  }
  const res = await sql`update books set provider_price_id = null where provider_price_id is not null returning slug`;
  console.log(`cleared provider_price_id on ${res.length} rows in ${dbName}.`);
  process.exit(0);
}

const products = await lsAll(`/products?filter[store_id]=${STORE_ID}`);
const variants = await lsAll(`/variants`);
const variantsByProduct = new Map();
for (const v of variants) {
  const pid = String(v.attributes?.product_id ?? "");
  if (!variantsByProduct.has(pid)) variantsByProduct.set(pid, []);
  variantsByProduct.get(pid).push(v);
}

// Title → slug, built from the catalogue so the product NAME is the only
// thing that has to match. Same key the provisioner uses.
const slugByName = new Map();
for (const b of BOOKS) slugByName.set(`Valice Press — ${b.title}`, b.slug);

let testModeSeen = 0;
const rows = [];
for (const p of products) {
  const name = p.attributes?.name ?? "";
  const slug = slugByName.get(name);
  if (!slug) {
    console.log(`SKIP    (no catalogue book named) ${name}`);
    continue;
  }
  const vs = variantsByProduct.get(String(p.id)) ?? [];
  const variant = vs[0];
  if (!variant) {
    console.log(`SKIP    (no variant) ${slug}`);
    continue;
  }
  const testMode = Boolean(p.attributes?.test_mode ?? variant.attributes?.test_mode);
  if (testMode) testModeSeen += 1;
  rows.push({
    slug,
    productId: String(p.id),
    variantId: String(variant.id),
    price: p.attributes?.price ?? null,
    testMode,
  });
}

console.log(`resolved  : ${rows.length} book→variant mappings (${testModeSeen} test-mode)\n`);

// THE GUARD.
if (testModeSeen > 0 && !isSandbox) {
  console.error(
    `REFUSING: ${testModeSeen} of these variants are test-mode and the target database is\n` +
      `${dbName}, which is production. A test variant id in production is a buy button\n` +
      "that takes a real reader to a checkout that cannot charge them. Point --env at\n" +
      "the sandbox, or wait until the store is live and re-provision.",
  );
  process.exit(1);
}

for (const r of rows) {
  console.log(
    `${commit ? "WIRE  " : "WOULD "} ${r.slug.padEnd(38)} variant ${r.variantId.padEnd(9)} ` +
      `$${r.price != null ? (r.price / 100).toFixed(2) : "?"}${r.testMode ? "  [test]" : ""}`,
  );
  if (commit) {
    await sql`update books set provider_price_id = ${r.variantId}, updated_at = now() where slug = ${r.slug}`;
  }
}

if (commit) {
  const wired = await sql`select count(*)::int n from books where provider_price_id is not null`;
  console.log(`\nwired ${rows.length} · ${dbName}.books now has ${wired[0].n} rows with a provider_price_id`);
} else {
  console.log("\nDRY RUN — nothing written. Re-run with --commit.");
}
