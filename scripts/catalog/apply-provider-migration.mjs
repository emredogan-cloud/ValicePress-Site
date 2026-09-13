/**
 * Apply migration 0011 (provider-neutral commerce columns) to one database.
 *
 * WHY THIS EXISTS RATHER THAN `npm run db:migrate`. Measured 2026-09-13:
 * drizzle-kit's own tracking table `drizzle.__drizzle_migrations` is EMPTY on
 * both Valice databases, while the schema plainly carries every earlier
 * migration — the schema was built with `db:push` at some point and the
 * ledger never caught up. `drizzle-kit migrate` therefore exits 0 having done
 * nothing, which is the worst possible failure: it looks like success. This
 * script asks the database what it actually has and adds only what is missing.
 *
 * Every statement is guarded, so re-running is a no-op rather than an error.
 *
 * Usage:
 *   node scripts/catalog/apply-provider-migration.mjs                       # dry run, .env.local
 *   node scripts/catalog/apply-provider-migration.mjs --commit
 *   node scripts/catalog/apply-provider-migration.mjs --env scripts/tmp/.env.production --commit --i-know-this-is-production
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const argv = process.argv.slice(2);
const commit = argv.includes("--commit");
const prodOk = argv.includes("--i-know-this-is-production");
const envIdx = argv.indexOf("--env");
const envFile = envIdx >= 0 ? argv[envIdx + 1] : ".env.local";

function loadEnv(path) {
  const out = {};
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    console.error(`Cannot read ${path}`);
    process.exit(1);
  }
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[key] = v;
  }
  return out;
}

const env = loadEnv(envFile);
const url = env.DATABASE_URL;
if (!url) {
  console.error(`No DATABASE_URL in ${envFile}`);
  process.exit(1);
}
const dbName = url.replace(/\?.*$/, "").split("/").pop();

console.log(`env file  : ${envFile}`);
console.log(`database  : ${dbName}`);
console.log(`mode      : ${commit ? "COMMIT" : "DRY RUN"}\n`);

if (dbName === "neondb" && commit && !prodOk) {
  console.error(
    "REFUSING: that is the production database.\n" +
      "Re-run with --i-know-this-is-production if this is genuinely intended.",
  );
  process.exit(1);
}

const sql = neon(url);

const STEPS = [
  {
    name: "type payment_provider",
    check: async () =>
      (await sql`select 1 from pg_type where typname = 'payment_provider'`).length > 0,
    apply: async () =>
      sql`create type "public"."payment_provider" as enum('paddle', 'lemonsqueezy')`,
  },
  {
    name: "books.provider_price_id",
    check: async () =>
      (
        await sql`select 1 from information_schema.columns
                  where table_name = 'books' and column_name = 'provider_price_id'`
      ).length > 0,
    apply: async () => sql`alter table "books" add column "provider_price_id" text`,
  },
  {
    name: "commerce_events.provider",
    check: async () =>
      (
        await sql`select 1 from information_schema.columns
                  where table_name = 'commerce_events' and column_name = 'provider'`
      ).length > 0,
    // Default 'paddle': every row already in this table was written by Paddle,
    // and backfilling them as 'lemonsqueezy' would be a false audit trail.
    apply: async () =>
      sql`alter table "commerce_events"
          add column "provider" "payment_provider" default 'paddle' not null`,
  },
  {
    name: "orders.payment_provider",
    check: async () =>
      (
        await sql`select 1 from information_schema.columns
                  where table_name = 'orders' and column_name = 'payment_provider'`
      ).length > 0,
    apply: async () =>
      sql`alter table "orders"
          add column "payment_provider" "payment_provider" default 'paddle' not null`,
  },
];

let applied = 0;
for (const step of STEPS) {
  const present = await step.check();
  if (present) {
    console.log(`present  ${step.name}`);
    continue;
  }
  if (!commit) {
    console.log(`WOULD ADD ${step.name}`);
    continue;
  }
  await step.apply();
  applied += 1;
  console.log(`ADDED    ${step.name}`);
}

console.log(`\n${commit ? `applied ${applied} change(s)` : "DRY RUN — nothing was changed"}`);

// Prove it, rather than trusting the statements above to have meant what they
// said. A migration script that reports success without re-reading the schema
// is the same instrument that made `drizzle-kit migrate` untrustworthy here.
if (commit) {
  const remaining = [];
  for (const step of STEPS) if (!(await step.check())) remaining.push(step.name);
  if (remaining.length) {
    console.error(`\nVERIFY FAILED — still missing: ${remaining.join(", ")}`);
    process.exit(1);
  }
  console.log("verified  : every column is present in the live schema");
}
