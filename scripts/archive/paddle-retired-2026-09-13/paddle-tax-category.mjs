/**
 * Try to move every Valice product onto Paddle's `ebooks` tax category.
 *
 * `standard` over-collects VAT on ebook sales in the many jurisdictions that
 * tax a book at a reduced rate or not at all — Paddle is the merchant of
 * record, so the category decides what the buyer is charged. `ebooks` is
 * gated behind a per-seller approval; the API answers
 * `product_tax_category_not_approved` until it is granted.
 *
 * A PATCH that is refused changes nothing, so this is the cheapest way to
 * find out whether the approval exists, and it applies the fix when it does.
 *   node scripts/tmp/paddle-tax.mjs --env <file> [--commit]
 */
import { readFileSync } from "node:fs";
const flag = process.argv.indexOf("--env");
const envFile = flag !== -1 ? process.argv[flag + 1] : ".env";
const commit = process.argv.includes("--commit");
for (const line of readFileSync(envFile, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const apiKey = process.env.PADDLE_API_KEY;
const BASE = apiKey.startsWith("pdl_live_") ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
const res = await fetch(`${BASE}/products?status=active&per_page=100`, { headers: { Authorization: `Bearer ${apiKey}` } });
const { data } = await res.json();
const mine = data.filter((p) => p.custom_data?.valice_slug);
console.log(`${mine.length} Valice products, current categories: ${[...new Set(mine.map((p) => p.tax_category))].join(", ")}\n`);
if (!commit) { console.log("dry run — re-run with --commit to attempt the PATCH"); process.exit(0); }
for (const p of mine) {
  if (p.tax_category === "ebooks") { console.log(`  ${p.custom_data.valice_slug}: already ebooks`); continue; }
  const r = await fetch(`${BASE}/products/${p.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ tax_category: "ebooks" }),
  });
  const j = await r.json().catch(() => null);
  if (r.ok) console.log(`  ${p.custom_data.valice_slug}: standard → ${j.data.tax_category}`);
  else console.log(`  ${p.custom_data.valice_slug}: REFUSED ${r.status} ${JSON.stringify(j?.error?.code ?? j?.error ?? j)}`);
}
