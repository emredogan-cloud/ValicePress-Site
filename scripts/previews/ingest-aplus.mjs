#!/usr/bin/env node
/**
 * Bring each book's chosen A+ Content pictures into /images/lookinside/<slug>/.
 *
 *   node scripts/previews/ingest-aplus.mjs            # dry run
 *   node scripts/previews/ingest-aplus.mjs --commit
 *   node scripts/previews/ingest-aplus.mjs --commit --slug the-long-way-back
 *
 * The list is scripts/previews/aplus-picks.json (source file, crop, alt text per picture).
 * Each picture goes through scripts/covers/ingest-art.mjs, so its source path, SHA-256
 * and output are recorded in src/content/book-art-provenance.json like every other image.
 * The alt texts are written to src/content/book-lookinside.json for the page to read.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const commit = argv.includes("--commit");
const only = argv.includes("--slug") ? argv[argv.indexOf("--slug") + 1] : null;
const picks = JSON.parse(readFileSync(path.join(ROOT, "scripts/previews/aplus-picks.json"), "utf8"));
const out = {};
for (const [slug, items] of Object.entries(picks)) {
  if (slug.startsWith("_") || (only && slug !== only)) continue;
  out[slug] = [];
  for (const it of items) {
    const args = [
      path.join(ROOT, "scripts/covers/ingest-art.mjs"),
      "--slug", slug, "--slot", "lookinside", "--name", it.name, "--source", it.source, "--width", "1200",
      "--note", `A+ Content picture, from the book's own final export (${path.basename(it.source)})${it.crop ? `; the soft letterbox bands are cropped away (${it.crop})` : ""}; every quotation printed on it was checked against the printed book`,
    ];
    if (it.crop) args.push("--crop", it.crop);
    if (commit) args.push("--commit");
    const r = execFileSync("node", args, { encoding: "utf8" });
    console.log(r.split("\n").filter((l) => l.includes("→ /images")).join("\n"));
    out[slug].push({ name: it.name, alt: it.alt });
  }
}
if (commit) {
  const file = path.join(ROOT, "src/content/book-lookinside.json");
  let all = {};
  try { all = JSON.parse(readFileSync(file, "utf8")); } catch {}
  Object.assign(all, out);
  writeFileSync(file, JSON.stringify(all, null, 2) + "\n");
  console.log(`wrote alt texts for ${Object.keys(out).length} book(s) → src/content/book-lookinside.json`);
}
