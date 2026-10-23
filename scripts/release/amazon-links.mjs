#!/usr/bin/env node
/**
 * The Amazon links a visitor of valicepress.com is given, against the catalogue file — one book page at a time.
 *
 *   node scripts/release/amazon-links.mjs [base=https://valicepress.com] [out.json]
 *
 * For every published book: fetch /books/<slug> (plain GET, one per second — the live proxy rate-limits per IP), take every
 * https://www.amazon.com/dp/<ASIN> link in the server HTML, and compare that set with the ASINs the catalogue
 * gives THIS book's formats. Also: no ASIN is shown on two books, every link is the /dp/<ASIN> form, none carries a
 * tracking tag, and the draft book has no page. (Whether Amazon's own page for each ASIN matches the registry was read
 * on 2026-10-07/08 by verify-amazon-asins.mjs and is not repeated here.)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BASE = (process.argv[2] ?? "https://valicepress.com").replace(/\/$/, "");
const OUT = process.argv[3] ?? null;
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { BOOKS } = await import(pathToFileURL(`${REPO}/scripts/catalog/valice-catalog.mjs`).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rows = [];
let bad = 0;
const owner = new Map();
for (const b of BOOKS.filter((x) => x.websiteStatus === "published")) {
  const want = new Set(b.formats.filter((f) => f.amazonAsin && f.availability === "available").map((f) => f.amazonAsin));
  const res = await fetch(`${BASE}/books/${b.slug}`, { headers: { "user-agent": "Mozilla/5.0 valice-release-verify (read-only)", accept: "text/html" } });
  const html = await res.text();
  const links = [...html.matchAll(/https:\/\/www\.amazon\.com\/[^"'<>\s\\]+/g)].map((m) => m[0].replace(/&amp;/g, "&"));
  const asins = new Set();
  const odd = [];
  for (const l of links) {
    const m = l.match(/^https:\/\/www\.amazon\.com\/dp\/([A-Z0-9]{10})$/);
    if (m) asins.add(m[1]);
    else odd.push(l);
  }
  for (const a of asins) owner.set(a, [...(owner.get(a) ?? []), b.slug]);
  const missing = [...want].filter((a) => !asins.has(a));
  const extra = [...asins].filter((a) => !want.has(a));
  const ok = res.status === 200 && missing.length === 0 && extra.length === 0 && odd.length === 0;
  if (!ok) bad++;
  rows.push({ slug: b.slug, status: res.status, want: [...want], shown: [...asins], missing, extra, odd });
  console.log(`${ok ? "PASS" : "FAIL"}  ${b.slug.padEnd(42)} ${res.status}  catalogue ${want.size} · page ${asins.size}${missing.length ? " · MISSING " + missing.join(",") : ""}${extra.length ? " · EXTRA " + extra.join(",") : ""}${odd.length ? " · ODD " + odd.slice(0, 2).join(" ") : ""}`);
  await sleep(1000);
}
const shared = [...owner].filter(([, slugs]) => slugs.length > 1);
console.log(shared.length ? `FAIL  ASINs shown on more than one book: ${shared.map(([a, s]) => a + " → " + s.join("+")).join("; ")}` : "PASS  no ASIN is shown on two books");
if (shared.length) bad++;
const draft = BOOKS.filter((x) => x.websiteStatus !== "published");
for (const d of draft) {
  const r = await fetch(`${BASE}/books/${d.slug}`);
  console.log(`${r.status === 404 ? "PASS" : "FAIL"}  draft ${d.slug} has no page (${r.status})`);
  if (r.status !== 404) bad++;
}
const total = rows.reduce((n, r) => n + r.shown.length, 0);
console.log(`\n${rows.length} book pages · ${total} Amazon links shown · ${bad} problems`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), problems: bad, rows }, null, 2));
process.exit(bad ? 1 : 0);
