#!/usr/bin/env node
/**
 * For each author JSON in src/content/authors/, ask the Library of Congress Name Authority File for the
 * record whose life dates match the dataset's, and print it. The LoC record is the independent check on
 * dates: it is compiled by librarians from the books themselves, not from Wikipedia or Wikidata.
 *
 *   node scripts/authors/resolve-loc.mjs [slug ...]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = path.join(ROOT, "src/content/authors");
const UA = "ValicePressSite/1.0 (https://valicepress.com; author-directory research) node-fetch";
const write = process.argv.includes("--write");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
/** Records whose label does not carry numeric life dates the matcher can read (BC dates, "17 or 18 A.D."). */
const OVERRIDES = { ovid: "https://id.loc.gov/authorities/names/n79041738.html" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const authors = readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(DIR, f), "utf8")));

async function suggest(q) {
  const res = await fetch(`https://id.loc.gov/authorities/names/suggest2?${new URLSearchParams({ q, count: "12" })}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()).hits ?? [];
}

const variants = (a) => {
  const parts = a.name.replace(/\./g, ". ").replace(/\s+/g, " ").trim().split(" ");
  if (parts.length === 1) return [a.name];
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  // the dated heading first: for a common name ("Lee, Henry") the plain query's first 12 hits are other people
  return [`${last}, ${first}, ${Math.abs(a.bornYear)}`, `${last}, ${first}`, a.name, `${last}`];
};

for (const a of authors) {
  if (only.length && !only.includes(a.slug)) continue;
  let found = null;
  const tried = [];
  for (const q of variants(a)) {
    tried.push(q);
    const hits = await suggest(q);
    await sleep(250);
    const ok = hits.filter((h) => {
      const label = h.aLabel || h.suggestLabel || "";
      const nums = label.match(/\d{1,4}/g) || [];
      // a bare authority label for the person: ends with dates, no subdivision after them
      const dated = /,\s*(c\.\s*)?-?\d{1,4}\s*-\s*(-?\d{1,4}\b)?\s*(B\.C\.)?\s*$/.test(label) || /,\s*\d{4}\s*-\s*$/.test(label);
      const wantBorn = String(Math.abs(a.bornYear));
      return dated && nums.includes(wantBorn) && (a.diedYear == null || nums.includes(String(Math.abs(a.diedYear))));
    });
    if (ok.length) { found = ok[0]; break; }
  }
  const url = found ? `${found.uri.replace("http://", "https://")}.html` : OVERRIDES[a.slug] ?? null;
  const label = found ? found.aLabel || found.suggestLabel : OVERRIDES[a.slug] ? "(override)" : null;
  console.log(`${a.slug.padEnd(24)} ${url ? `${label}  ${url}` : `NOT FOUND (tried ${tried.join(" | ")})`}`);
  if (write && url && !a.sources.some((s) => s.url === url)) {
    a.sources.push({ label: `Library of Congress Name Authority File — ${label === "(override)" ? a.name : label}`, url });
    writeFileSync(path.join(DIR, `${a.slug}.json`), JSON.stringify(a, null, 2) + "\n");
  }
}
