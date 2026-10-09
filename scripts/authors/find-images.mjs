#!/usr/bin/env node
/**
 * List Wikimedia Commons image candidates for a person, with size and licence, best first.
 *
 *   node scripts/authors/find-images.mjs "Sam Loyd" ["Samuel Loyd"]
 *
 * Read-only. Nothing is downloaded here; `fetch-portraits.mjs` downloads the one that was chosen.
 */
const UA = "ValicePressSite/1.0 (https://valicepress.com; author-directory research) node-fetch";
const argv = process.argv.slice(2);
const bySlug = argv.includes("--slug") ? argv[argv.indexOf("--slug") + 1] : null;
const queries = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--slug");
const api = (params) => `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params })}`;
const json = async (u) => (await fetch(u, { headers: { "User-Agent": UA } })).json();

const seen = new Map();
if (bySlug) {
  // The precise route: this person's Wikidata item names a Commons category (P373); list its files.
  const fs = await import("node:fs");
  const author = JSON.parse(fs.readFileSync(new URL(`../../src/content/authors/${bySlug}.json`, import.meta.url), "utf8"));
  const qid = author.sources.find((x) => x.url.includes("wikidata.org")).url.split("/").pop();
  const wd = await (await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, { headers: { "User-Agent": UA } })).json();
  const cats = (wd.entities[qid].claims.P373 ?? []).map((c) => c.mainsnak.datavalue.value);
  const imgs = (wd.entities[qid].claims.P18 ?? []).map((c) => c.mainsnak.datavalue.value);
  console.log(`# ${author.name} — Wikidata ${qid}; Commons category: ${cats.join(", ") || "none"}; P18: ${imgs.join(", ") || "none"}`);
  for (const f of imgs) seen.set(`File:${f}`, { title: `File:${f}` });
  for (const c of cats) {
    const r = await json(api({ action: "query", generator: "categorymembers", gcmtitle: `Category:${c}`, gcmtype: "file", gcmlimit: "40", prop: "info" }));
    for (const pg of r.query?.pages ?? []) seen.set(pg.title, pg);
  }
}
for (const q of queries) {
  const s = await json(api({ action: "query", list: "search", srsearch: q, srnamespace: "6", srlimit: "25" }));
  for (const hit of s.query?.search ?? []) seen.set(hit.title, hit);
}
const titles = [...seen.keys()];
const rows = [];
for (let i = 0; i < titles.length; i += 20) {
  const batch = titles.slice(i, i + 20);
  const r = await json(api({ action: "query", titles: batch.join("|"), prop: "imageinfo", iiprop: "url|size|mime|extmetadata" }));
  for (const p of r.query?.pages ?? []) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/^image\/(jpeg|png|webp|tiff)/.test(ii.mime)) continue;
    const m = ii.extmetadata ?? {};
    rows.push({ title: p.title, w: ii.width, h: ii.height, lic: m.LicenseShortName?.value ?? "?", date: (m.DateTimeOriginal?.value ?? "").replace(/<[^>]+>/g, "").slice(0, 28), desc: (m.ImageDescription?.value ?? "").replace(/<[^>]+>/g, "").slice(0, 70) });
  }
}
rows.sort((a, b) => b.w * b.h - a.w * a.h);
for (const r of rows.slice(0, 14)) console.log(`${String(r.w).padStart(5)}x${String(r.h).padEnd(5)} ${r.lic.padEnd(16)} ${r.title.replace("File:", "").slice(0, 62).padEnd(62)} ${r.date.padEnd(28)} ${r.desc}`);
