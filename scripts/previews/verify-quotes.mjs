#!/usr/bin/env node
/**
 * A quotation on a book's preview must BE in the book.
 *
 *   node scripts/previews/verify-quotes.mjs                 # check every quote in src/content/book-media.json
 *   node scripts/previews/verify-quotes.mjs --slug weather-permitting
 *   node scripts/previews/verify-quotes.mjs --write         # record the proof (source, SHA-256, where, when) into book-media.json
 *
 * Each record in `src/content/book-media.json` names its `source` (a manuscript
 * file, or a built interior PDF) and a `sourceLocation`. This reads that file and
 * proves the quote occurs in it — as one CONTIGUOUS run of text, so a "quote" that
 * joins two unrelated passages, drops a sentence in the middle, or rewords one
 * fails.
 *
 * WHAT COUNTS AS THE SAME TEXT. The comparison ignores only what typesetting
 * changes without changing a word: curly versus straight quotation marks and
 * apostrophes, en/em dashes written as hyphens, runs of whitespace and line
 * breaks, and — for a PDF only — the hyphen a line break inserts inside a word.
 * Paragraph breaks are kept as breaks, so an exchange between two speakers must
 * be consecutive paragraphs. Nothing else is forgiven: not a changed word, not a
 * missing one, not a reordered clause.
 *
 * TWO PROOFS WHERE THERE ARE TWO TEXTS. A book is a manuscript AND the interior
 * file the printer was sent, and they are not guaranteed to agree. When a book's
 * entry names an `interior` PDF, every quote must ALSO occur in it, word for
 * word and in order — compared flat, because a PDF cannot say where a paragraph
 * ended — and that second proof is recorded under `verification.interior`. A card
 * that quotes a sentence the printed book does not contain is a false card, even
 * if the manuscript still has it. (A book whose only text IS the interior, such as
 * the reference books, names that PDF as `source` instead.)
 *
 * It exits non-zero on any quote it cannot prove. With --write, the proof is
 * stored next to the quote, and `src/lib/book-media.test.ts` refuses a quote
 * that lacks it.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MEDIA = path.join(ROOT, "src/content/book-media.json");

const argv = process.argv.slice(2);
const only = argv.includes("--slug") ? argv[argv.indexOf("--slug") + 1] : null;
const write = argv.includes("--write");

/** Typographic normalisation. Keeps paragraph breaks as "\n". */
export function normalise(text, { dehyphenate = false } = {}) {
  let t = text
    .replace(/\r/g, "")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/ /g, " ")
    .replace(/[*_]/g, ""); // markdown emphasis markers carry no words
  if (dehyphenate) t = t.replace(/-\n(?=[a-z])/g, ""); // a hyphen the line break put inside a word
  return t
    .split(/\n{1,}/) // paragraphs
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Flat containment for a PDF: every run of whitespace — line breaks, paragraph
 * breaks — becomes one space on BOTH sides, so what is proved is "these words, in
 * this order, are in the printed book", nothing about layout. A word the typesetter
 * broke across lines is rejoined; a real compound ("sixty-three") that happens to
 * break at its hyphen is kept as it was. Both readings are tried, and either counts.
 */
export function findFlat(rawPdfText, quote) {
  const base = rawPdfText.replace(/\r/g, "");
  const flat = (t) => normalise(t, { dehyphenate: false }).replace(/\s+/g, " ").trim();
  const needle = flat(quote);
  const readings = [
    flat(base.replace(/-\n(?=[a-z])/g, "")), // typesetter's hyphen: "perfor-\nmance" -> "performance"
    flat(base.replace(/-\n(?=[a-z])/g, "-")), // a real hyphen that fell at the line end: "sixty-\nthree" -> "sixty-three"
  ];
  for (const hay of readings) {
    const at = hay.indexOf(needle);
    if (at >= 0) return { at, words: needle.split(" ").length, more: hay.indexOf(needle, at + 1) >= 0 };
  }
  return null;
}

const sources = new Map();
const shaOf = (file) => {
  const k = `sha:${file}`;
  if (!sources.has(k)) sources.set(k, createHash("sha256").update(readFileSync(file)).digest("hex"));
  return sources.get(k);
};

function loadSource(file) {
  if (!sources.has(file)) sources.set(file, readSource(file));
  return sources.get(file);
}

function readSource(file) {
  if (/\.pdf$/i.test(file)) {
    const raw = execFileSync("pdftotext", ["-raw", file, "-"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    return { text: raw, dehyphenate: true, method: "pdftotext -raw; quotation marks, dashes and whitespace normalised; line-break hyphens joined" };
  }
  if (/\.json$/i.test(file)) {
    return { text: readFileSync(file, "utf8"), dehyphenate: false, method: "JSON text; quotation marks, dashes and whitespace normalised" };
  }
  return { text: readFileSync(file, "utf8"), dehyphenate: false, method: "manuscript text (markdown); quotation marks, dashes, emphasis markers and whitespace normalised" };
}

const media = JSON.parse(readFileSync(MEDIA, "utf8"));
let failures = 0;
let checked = 0;

for (const [slug, entry] of Object.entries(media)) {
  if (only && slug !== only) continue;
  for (const [i, q] of (entry.quoteVisuals ?? []).entries()) {
    const label = `${slug} quote ${i + 1}`;
    const source = q.verification?.source ?? q.source;
    if (!source || !existsSync(source)) {
      console.error(`✗ ${label}: source not found (${source ?? "none recorded"})`);
      failures++;
      continue;
    }
    const isPdf = /\.pdf$/i.test(source);
    const { text, dehyphenate, method } = loadSource(source);
    const needle = normalise(q.quote, { dehyphenate: false });
    let where;
    if (isPdf) {
      const hit = findFlat(text, q.quote);
      if (!hit) {
        console.error(`✗ ${label}: NOT FOUND in ${path.basename(source)}\n    "${needle.slice(0, 110).replace(/\n/g, " ¶ ")}…"`);
        failures++;
        continue;
      }
      where = `printed text, ${hit.more ? "occurs more than once" : "occurs once"}`;
    } else {
      const hay = normalise(text, { dehyphenate });
      const at = hay.indexOf(needle);
      if (at < 0) {
        console.error(`✗ ${label}: NOT FOUND in ${path.basename(source)}\n    "${needle.slice(0, 110).replace(/\n/g, " ¶ ")}…"`);
        failures++;
        continue;
      }
      const second = hay.indexOf(needle, at + 1);
      where = `paragraph ${hay.slice(0, at).split("\n").length}${second >= 0 ? ", occurs more than once" : ""}`;
    }

    // The second proof: the interior the printer was sent.
    let interiorProof = null;
    if (entry.interior) {
      if (!existsSync(entry.interior)) {
        console.error(`✗ ${label}: interior not found (${entry.interior})`);
        failures++;
        continue;
      }
      const pdf = loadSource(entry.interior);
      const hit = findFlat(pdf.text, q.quote);
      if (!hit) {
        console.error(`✗ ${label}: in the manuscript but NOT in the printed interior ${path.basename(entry.interior)}\n    "${needle.slice(0, 110).replace(/\n/g, " ¶ ")}…"`);
        failures++;
        continue;
      }
      where += `; also in ${path.basename(entry.interior)}`;
      interiorProof = {
        source: entry.interior,
        sourceSha256: shaOf(entry.interior),
        checkedAt: new Date().toISOString().slice(0, 10),
        method: pdf.method,
      };
    }

    console.log(`✓ ${label}: found in ${path.basename(source)} (${where}) — ${needle.split(/\s+/).length} words`);
    checked++;
    if (write) {
      q.verification = {
        source,
        sourceSha256: shaOf(source),
        checkedAt: new Date().toISOString().slice(0, 10),
        method: isPdf ? "pdftotext -raw; whitespace flattened (a PDF cannot say where a paragraph ended); quotation marks and dashes normalised; line-break hyphens joined" : method,
        ...(interiorProof ? { interior: interiorProof } : {}),
      };
    }
  }
}

if (write && failures === 0) {
  writeFileSync(MEDIA, JSON.stringify(media, null, 2) + "\n");
  console.log(`wrote proof for ${checked} quote(s) → src/content/book-media.json`);
}
console.log(`\n${checked} verified, ${failures} failed`);
process.exit(failures ? 1 : 0);
