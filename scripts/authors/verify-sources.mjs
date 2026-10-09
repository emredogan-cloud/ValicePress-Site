#!/usr/bin/env node
/**
 * Make "source-backed" mechanical.
 *
 *   node scripts/authors/verify-sources.mjs [slug ...]        # network; read-only against the sources
 *   node scripts/authors/verify-sources.mjs --offline         # re-use the cache only
 *
 * For every author in src/content/authors/*.json:
 *   1. every listed source URL answers 200 (Wikipedia and Wikisource through their text API, Wikidata and the
 *      Library of Congress through their JSON, anything else as HTML);
 *   2. the author's surname appears in that source's text;
 *   3. DATES AGREE across independent records: the Wikidata entity's birth and death years, and the Library of
 *      Congress authority label (compiled by librarians from the books), both equal the dataset's;
 *   4. EVERY YEAR in `works[].year` and `events[].year` appears in the combined text of the listed sources.
 *      That does not prove a sentence is true; it does catch a transposed or invented date, which is the
 *      mistake a hand-written dataset actually makes.
 *
 * Writes data/authors/verification.json — the evidence, with the date it was gathered — and exits 1 on any failure.
 * (This is the same pattern as data/catalog/amazon-verification.json: an instrument that reads the thing itself.)
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = path.join(ROOT, "src/content/authors");
const CACHE = path.join(ROOT, "scripts/tmp/authors/cache");
const OUT = path.join(ROOT, "data/authors/verification.json");
const UA = "ValicePressSite/1.0 (https://valicepress.com; author-directory verification) node-fetch";
const args = process.argv.slice(2);
const offline = args.includes("--offline");
const only = args.filter((a) => !a.startsWith("--"));
mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

async function get(url, asJson = false) {
  const key = path.join(CACHE, createHash("sha1").update(url + (asJson ? "j" : "t")).digest("hex"));
  if (existsSync(key)) return JSON.parse(readFileSync(key, "utf8"));
  if (offline) return { status: 0, body: "" };
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: asJson ? "application/json" : "text/html,*/*" }, redirect: "follow" });
      const body = asJson ? JSON.stringify(await res.json().catch(() => null)) : await res.text();
      last = { status: res.status, body };
      if (res.status !== 429 && res.status < 500) break;
    } catch (err) {
      last = { status: -1, body: String(err) };
    }
    await sleep(1200 * (i + 1));
  }
  writeFileSync(key, JSON.stringify(last));
  await sleep(250);
  return last;
}

const stripHtml = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");

/** Text of a source, and any structured dates it carries. */
async function readSource(url) {
  const u = new URL(url);
  if (/wikisource\.org$/.test(u.host)) {
    // Wikisource transcludes the transcribed text from the Page: namespace; `extracts` returns only the header.
    const title = decodeURIComponent(u.pathname.replace(/^\/wiki\//, ""));
    const api = `https://${u.host}/w/api.php?${new URLSearchParams({ action: "parse", format: "json", formatversion: "2", prop: "text", page: title, redirects: "1" })}`;
    const r = await get(api, true);
    const html = JSON.parse(r.body || "null")?.parse?.text ?? "";
    return { status: html ? r.status : 404, text: stripHtml(html) };
  }
  if (/wikipedia\.org$/.test(u.host)) {
    const title = decodeURIComponent(u.pathname.replace(/^\/wiki\//, ""));
    const api = `https://${u.host}/w/api.php?${new URLSearchParams({ action: "query", format: "json", formatversion: "2", prop: "extracts", explaintext: "1", titles: title, redirects: "1" })}`;
    const r = await get(api, true);
    const page = JSON.parse(r.body || "null")?.query?.pages?.[0];
    return { status: page && !page.missing ? r.status : 404, text: page?.extract ?? "" };
  }
  if (u.host === "www.wikidata.org") {
    const id = u.pathname.split("/").pop();
    const r = await get(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`, true);
    const e = JSON.parse(r.body || "null")?.entities?.[id];
    const yrs = (p) => (e?.claims?.[p] ?? []).map((c) => c.mainsnak?.datavalue?.value?.time).filter(Boolean).map((t) => Number(t.slice(0, 1) === "-" ? `-${Number(t.slice(1, 5))}` : Number(t.slice(1, 5))));
    return { status: e ? r.status : 404, text: e?.labels?.en?.value ?? "", born: yrs("P569")[0], died: yrs("P570")[0] };
  }
  if (u.host === "id.loc.gov") {
    const id = u.pathname.split("/").pop().replace(/\.html$/, "");
    const r = await get(`https://id.loc.gov/authorities/names/${id}.json`, true);
    const j = JSON.parse(r.body || "null");
    const nodes = Array.isArray(j) ? j : [];
    const main = nodes.find((n) => n["@id"]?.endsWith(`/${id}`) && n["http://www.loc.gov/mads/rdf/v1#authoritativeLabel"]);
    const label = main?.["http://www.loc.gov/mads/rdf/v1#authoritativeLabel"]?.[0]?.["@value"] ?? "";
    // The record may also carry a dated heading and a real-world-object birth date, on other nodes.
    const surname = fold(label.split(",")[0]);
    const labels = nodes
      .flatMap((n) => n["http://www.loc.gov/mads/rdf/v1#authoritativeLabel"] ?? [])
      .map((x) => x["@value"])
      .filter((v) => typeof v === "string" && v.includes(",") && fold(v).startsWith(surname));
    const births = nodes.flatMap((n) => n["http://id.loc.gov/ontologies/bibframe/birthDate"] ?? n["http://www.loc.gov/mads/rdf/v1#birthDate"] ?? []).map((x) => x["@value"] ?? x);
    const birthKeys = nodes.flatMap((n) => Object.entries(n).filter(([k]) => /birthDate$/.test(k)).flatMap(([, v]) => v.map((x) => x["@value"] ?? x)));
    return { status: label ? r.status : 404, text: [label, ...labels].join(" | "), label, labels: [...new Set([label, ...labels])], births: [...new Set([...births, ...birthKeys].filter((x) => typeof x === "string"))] };
  }
  const r = await get(url);
  return { status: r.status, text: stripHtml(r.body) };
}

/** Years named in a free-form year field: 1850, "1872–1889", "c. 170–180", "AD 8", "43 BC", "AD 9–12". */
function yearsIn(v) {
  if (typeof v === "number") return [String(v)];
  const s = String(v);
  const out = [];
  for (const m of s.matchAll(/\b(\d{1,4})\b/g)) {
    const around = s.slice(Math.max(0, m.index - 4), m.index + m[1].length + 4);
    const bc = /BC/.test(around);
    out.push({ n: m[1], bc });
  }
  return out.map((o) => (o.bc ? `${o.n} BC` : o.n));
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { authors: {} };
const report = { gatheredAt: new Date().toISOString(), authors: only.length ? { ...previous.authors } : {} };
let failures = 0;

for (const f of files) {
  const a = JSON.parse(readFileSync(path.join(DIR, f), "utf8"));
  if (only.length && !only.includes(a.slug)) continue;
  const problems = [];
  const sources = [];
  let combined = "";
  for (const s of a.sources) {
    const r = await readSource(s.url);
    const ok = r.status === 200;
    const surname = fold(a.name.replace(/\(.*?\)/g, "").trim().split(/\s+/).pop());
    const hasName = ok && (fold(r.text).includes(surname) || /wikidata|id\.loc/.test(s.url) ? fold(r.text).includes(surname) || !!r.label || r.born !== undefined : false);
    sources.push({ label: s.label, url: s.url, status: r.status, namePresent: hasName });
    if (!ok) problems.push(`source ${s.url} answered ${r.status}`);
    else if (!fold(r.text).includes(surname) && !/wikidata/.test(s.url)) problems.push(`source ${s.url} does not mention "${surname}"`);
    combined += `\n${r.text}`;
    if (/wikidata/.test(s.url) && ok) {
      if (r.born !== a.bornYear) problems.push(`Wikidata birth year ${r.born} ≠ dataset ${a.bornYear}`);
      if (a.diedYear != null && r.died !== a.diedYear) problems.push(`Wikidata death year ${r.died} ≠ dataset ${a.diedYear}`);
      if (a.diedYear == null && r.died != null) problems.push(`Wikidata gives a death year (${r.died}) but the dataset has none`);
    }
    if (/id\.loc\.gov/.test(s.url) && ok) {
      const yearsOf = (str) => (str.match(/\d{1,4}/g) ?? []).map((n) => String(Number(n)));
      // the most informative heading: any label that carries a year, else the main one
      const dated = r.labels.find((l) => yearsOf(l).length) ?? r.label;
      const nums = yearsOf(dated);
      const birthYears = r.births.map((b) => String(Number(b.slice(0, 4))));
      const hasDates = nums.length > 0 || birthYears.length > 0;
      if (s.identityOnly) {
        if (hasDates) problems.push(`LoC record "${r.label}" now carries dates — remove identityOnly and let it be checked`);
      } else if (!hasDates) {
        problems.push(`LoC record "${r.label}" carries no dates; if it only confirms identity, mark the source identityOnly`);
      } else if (s.expectDateMismatch) {
        const mismatch = !nums.includes(String(Math.abs(a.bornYear))) || (a.diedYear != null && !nums.includes(String(Math.abs(a.diedYear))));
        // A disagreement between sources is allowed only when it is written down, and only if it is real.
        if (!a.dateDiscrepancy) problems.push(`LoC label "${dated}" is marked as disagreeing but the author has no dateDiscrepancy note`);
        else if (!mismatch) problems.push(`LoC label "${dated}" is marked as disagreeing but it agrees — remove the note`);
      } else {
        const bornOk = nums.includes(String(Math.abs(a.bornYear))) || birthYears.includes(String(a.bornYear));
        if (!bornOk) problems.push(`LoC "${dated}" lacks birth year ${Math.abs(a.bornYear)}`);
        if (a.diedYear != null && !nums.includes(String(Math.abs(a.diedYear)))) problems.push(`LoC "${dated}" lacks death year ${Math.abs(a.diedYear)}`);
        if (a.diedYear == null && nums.length >= 2 && !/-\s*$/.test(dated)) problems.push(`LoC "${dated}" is not an open-ended (living) record`);
      }
    }
  }
  if (!a.sources.some((s) => /id\.loc\.gov/.test(s.url))) problems.push("no Library of Congress authority source");
  if (!a.sources.some((s) => /wikidata/.test(s.url))) problems.push("no Wikidata source");

  const unverified = [];
  const hay = fold(combined);
  const check = (label, v) => {
    for (const y of yearsIn(v)) {
      const needle = y.endsWith(" BC") ? new RegExp(`\\b${y.split(" ")[0]}\\s*(bc|b\\.c\\.)`, "i") : new RegExp(`\\b${y}\\b`);
      if (!needle.test(hay)) unverified.push(`${label}: ${y}`);
    }
  };
  for (const w of a.works ?? []) check(`work "${w.title}"`, w.year);
  for (const e of a.events ?? []) check(`event ${e.year}`, e.year);
  for (const u of unverified) problems.push(`year not in any source — ${u}`);
  // Key claims (awards, titles, epithets) that the dataset states and the sources must carry, word for word.
  for (const phrase of a.evidence ?? []) if (!hay.includes(fold(phrase))) problems.push(`claim not in any source — "${phrase}"`);

  report.authors[a.slug] = { name: a.name, ok: problems.length === 0, gatheredAt: new Date().toISOString(), sources, problems };
  failures += problems.length ? 1 : 0;
  console.log(`${problems.length ? "✗" : "✓"} ${a.slug.padEnd(26)} ${a.sources.length} sources${problems.length ? "\n    - " + problems.join("\n    - ") : ""}`);
}

// A slug no longer in the dataset must not linger in the evidence.
const present = new Set(files.map((f) => f.replace(/\.json$/, "")));
for (const k of Object.keys(report.authors)) if (!present.has(k)) delete report.authors[k];
console.log(`\n${Object.values(report.authors).filter((x) => x.ok).length}/${Object.keys(report.authors).length} authors verified → ${path.relative(ROOT, OUT)}`);
writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
process.exit(failures ? 1 : 0);
