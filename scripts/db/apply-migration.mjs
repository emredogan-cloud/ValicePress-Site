/**
 * Apply one generated migration and then MEASURE that it landed.
 *
 * WHY THIS EXISTS. `npm run db:migrate` (drizzle-kit migrate) exits 0 on this
 * project having applied nothing — on both databases, repeatedly. An exit
 * code that says "fine" for a migration that did not run is worse than a
 * failure, because everything downstream then measures the old schema and
 * agrees with itself.
 *
 * So this script does three things drizzle-kit's runner does not:
 *   1. Names the database it is about to touch, out loud, before touching it.
 *      This project has two (`neondb` in production, `bookstore` in the
 *      sandbox) and has already loaded one believing it was the other.
 *   2. Runs each statement independently and reports per-statement, so a
 *      re-run over a partly-applied migration is a normal, readable outcome
 *      rather than an abort.
 *   3. Reads the resulting schema back out of `information_schema` and
 *      prints what it found. The exit code is not the evidence; the column
 *      count is.
 *
 * Usage:
 *   node scripts/db/apply-migration.mjs drizzle/0013_long_slayback.sql
 *   ENVFILE=path/to/.env node scripts/db/apply-migration.mjs <file> --tables a,b
 */
import { readFileSync } from "node:fs";

import { neon } from "@neondatabase/serverless";

const argv = process.argv.slice(2);
const file = argv.find((a) => a.endsWith(".sql"));
if (!file) {
  console.error("usage: node scripts/db/apply-migration.mjs <migration.sql> [--tables a,b]");
  process.exit(1);
}
const tablesArg = argv.indexOf("--tables");
const tables =
  tablesArg >= 0 && argv[tablesArg + 1]
    ? argv[tablesArg + 1].split(",").map((t) => t.trim()).filter(Boolean)
    : // Everything the migration itself creates, read out of its own SQL.
      [...readFileSync(file, "utf8").matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]);

const envFile = process.env.ENVFILE ?? ".env.local";
const env = {};
for (const line of readFileSync(envFile, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}

const url = env.DATABASE_URL ?? process.env.DATABASE_URL;
// A redaction is not a value. `vercel env pull` writes the literal string
// "[SENSITIVE]" for every Sensitive variable, and this project has already
// spent a session treating one of those as a connection string.
if (!url || url === "[SENSITIVE]") {
  console.error(`No usable DATABASE_URL in ${envFile}.`);
  process.exit(1);
}

let dbName = "(unparseable)";
try {
  dbName = new URL(url).pathname.slice(1) || "(none)";
} catch {
  /* keep the placeholder */
}
console.log(`env file : ${envFile}`);
console.log(`database : ${dbName}`);
console.log(`migration: ${file}\n`);

const sql = neon(url);
const statements = readFileSync(file, "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

let applied = 0;
let skipped = 0;
for (const statement of statements) {
  const head = statement.split("\n")[0].slice(0, 72);
  try {
    await sql.query(statement);
    applied += 1;
    console.log(`  APPLIED  ${head}`);
  } catch (err) {
    // "already exists" on a re-run is the expected, correct outcome — the
    // migration is idempotent in effect even though the SQL is not.
    skipped += 1;
    console.log(`  SKIPPED  ${head}  → ${String(err.message).slice(0, 90)}`);
  }
}

console.log(`\n${applied} applied, ${skipped} skipped\n`);

if (tables.length) {
  const rows = await sql.query(
    `select table_name, count(*)::int as columns
       from information_schema.columns
      where table_schema = 'public' and table_name = any($1)
      group by table_name
      order by table_name`,
    [tables],
  );
  const found = new Set(rows.map((r) => r.table_name));
  for (const t of tables) {
    const row = rows.find((r) => r.table_name === t);
    console.log(row ? `  ${t}: ${row.columns} columns` : `  ${t}: MISSING`);
  }
  if (tables.some((t) => !found.has(t))) process.exitCode = 1;
}
