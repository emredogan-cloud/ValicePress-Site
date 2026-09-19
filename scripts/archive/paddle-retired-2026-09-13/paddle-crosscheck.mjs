// Every price id the catalogue sells with, checked against the live Paddle account.
import { readFileSync } from "node:fs";
import { BOOKS } from "../catalog/valice-catalog.mjs";
for (const line of readFileSync(process.argv[2], "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const key = process.env.PADDLE_API_KEY;
const base = key.startsWith("pdl_live") ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
const prices = [];
let url = `${base}/prices?per_page=100&status=active`;
while (url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`prices → ${r.status}`);
  const j = await r.json();
  prices.push(...j.data);
  url = j.meta?.pagination?.has_more ? j.meta.pagination.next : null;
}
const live = new Map(prices.map((p) => [p.id, p]));
console.log(`${live.size} active prices in the live Paddle account (${base.includes("sandbox") ? "SANDBOX" : "LIVE"})\n`);

let bad = 0;
for (const b of BOOKS) {
  const ebook = b.formats.find((f) => f.format === "ebook");
  const sells = ebook?.fulfillment === "direct" && ebook.availability === "available";
  if (!sells) continue;
  const p = b.paddlePriceId ? live.get(b.paddlePriceId) : null;
  const want = ebook.priceCents;
  const got = p ? Number(p.unit_price.amount) : null;
  const ok = p && got === want && p.status === "active";
  if (!ok) bad++;
  console.log(
    `  ${ok ? "OK  " : "BAD "} ${b.slug.padEnd(36)} ${b.websiteStatus.padEnd(10)} ` +
      (p ? `$${(got / 100).toFixed(2)} ${p.status}${got !== want ? ` ← catalogue says $${(want / 100).toFixed(2)}` : ""}`
         : `no live price for ${b.paddlePriceId ?? "(none recorded)"}`),
  );
}
console.log(`\n${bad === 0 ? "every direct-sold book has a live, active, price-matched Paddle price" : `${bad} book(s) would fail at the till`}`);
