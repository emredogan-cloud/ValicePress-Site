#!/usr/bin/env node
/**
 * Crop the checked, downloaded portraits to 3:4 and publish them, recording where each came from.
 *
 *   node scripts/authors/fetch-portraits.mjs        # first: licence check + download + contact sheet
 *   node scripts/authors/ingest-portraits.mjs       # preview sheet only (scripts/tmp/authors/portraits/final-sheet.png)
 *   node scripts/authors/ingest-portraits.mjs --write
 *
 * Rules: 3:4 exactly; never enlarged (a 339px source stays 322px wide — the card and the page scale it
 * down, and a page that wants it bigger shows it at its own size); metadata stripped; WebP. The author's
 * JSON gets a `portrait` object with the credit line, licence, source URL, the SHA-1 Commons holds for the
 * source and the SHA-256 of what was written, so a replaced or edited file is noticed.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { NO_PORTRAIT, PORTRAITS } from "./portraits.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "scripts/tmp/authors/portraits");
const PUB = path.join(ROOT, "public/images/authors");
const DATA = path.join(ROOT, "src/content/authors");
const write = process.argv.includes("--write");
const meta = JSON.parse(readFileSync(path.join(SRC, "meta.json"), "utf8"));
const TODAY = new Date().toISOString().slice(0, 10);
mkdirSync(PUB, { recursive: true });

const MAX_W = 900;
const preview = [];

for (const [slug, cfg] of Object.entries(PORTRAITS)) {
  const authorFile = path.join(DATA, `${slug}.json`);
  const author = JSON.parse(readFileSync(authorFile, "utf8"));
  const m = meta[slug];
  if (!m) {
    // refused or unavailable: the identity mark, and the reason
    author.portrait = null;
    author.portraitNote = cfg.refusedNote ?? "No freely licensed photograph has been located.";
    if (write) writeFileSync(authorFile, JSON.stringify(author, null, 2) + "\n");
    console.log(`none ${slug.padEnd(24)} ${author.portraitNote}`);
    continue;
  }
  const hay = `${m.creator} ${m.credit} ${m.wikitext ?? ""}`.toLowerCase();
  for (const k of [].concat(cfg.key || [])) {
    if (!hay.includes(k.toLowerCase())) throw new Error(`${slug}: the Commons record does not mention "${k}" — the credit line would be unsupported:\n  ${m.creator} | ${m.credit}`);
  }

  const srcDir = path.join(SRC, "src");
  const srcFile = readdirSync(srcDir).find((f) => f.startsWith(`${slug}.`));
  const img = sharp(path.join(srcDir, srcFile)).rotate();
  const { width: W, height: H } = await img.metadata();

  let [x0, y0, x1, y1] = cfg.crop ?? [];
  if (!cfg.crop) {
    // widest 3:4 box in the source, top-anchored when the source is taller, centred when it is wider
    if (W / H < 0.75) { x0 = 0; x1 = W; y0 = 0; y1 = Math.round((W * 4) / 3); }
    else { y0 = 0; y1 = H; const cw = Math.round((H * 3) / 4); x0 = Math.round((W - cw) / 2); x1 = x0 + cw; }
  }
  const cw = x1 - x0, ch = y1 - y0;
  if (Math.abs(cw / ch - 0.75) > 0.004) throw new Error(`${slug}: crop ${cw}x${ch} is not 3:4`);
  if (x0 < 0 || y0 < 0 || x1 > W || y1 > H) throw new Error(`${slug}: crop [${x0},${y0},${x1},${y1}] outside the ${W}x${H} source`);

  // Never enlarge: the output is the crop itself unless the crop is wider than MAX_W.
  const outW = Math.min(MAX_W, cw);
  const outH = Math.min(ch, Math.round((outW * 4) / 3));
  const buf = await img.extract({ left: x0, top: y0, width: cw, height: ch }).resize(outW, outH, { kernel: "lanczos3", fit: "fill" }).webp({ quality: cw < 600 ? 90 : 84, effort: 6 }).toBuffer();
  const written = await sharp(buf).metadata(); // what was actually produced is what gets recorded
  const sha256 = createHash("sha256").update(buf).digest("hex");
  preview.push({ slug, buf, outW, outH });

  author.portrait = {
    src: `/images/authors/${slug}.webp`,
    width: written.width,
    height: written.height,
    alt: cfg.alt,
    credit: cfg.credit,
    licence: m.licence,
    licenceUrl: m.licenceUrl,
    sourceUrl: m.sourceUrl,
    sourceFile: m.file,
    sourceSha1: m.sourceSha1,
    sourceSize: `${m.sourceWidth}x${m.sourceHeight}`,
    crop: [x0, y0, x1, y1],
    sha256,
    retrievedAt: TODAY,
  };
  delete author.portraitNote;
  if (write) {
    writeFileSync(path.join(PUB, `${slug}.webp`), buf);
    writeFileSync(authorFile, JSON.stringify(author, null, 2) + "\n");
  }
  console.log(`${write ? "wrote" : "prev "} ${slug.padEnd(24)} ${String(written.width).padStart(3)}x${String(written.height).padEnd(4)} ${Math.round(buf.length / 1024)} KB  ${m.licence}`);
}

for (const [slug, note] of Object.entries(NO_PORTRAIT)) {
  const f = path.join(DATA, `${slug}.json`);
  const a = JSON.parse(readFileSync(f, "utf8"));
  a.portrait = null;
  a.portraitNote = note;
  if (write) writeFileSync(f, JSON.stringify(a, null, 2) + "\n");
}

// final sheet: every published crop at 200x267
const TW = 200, TH = 267, COLS = 8;
const comp = [];
for (let i = 0; i < preview.length; i++) {
  const t = preview[i];
  comp.push({ input: await sharp(t.buf).resize(TW, TH).png().toBuffer(), left: (i % COLS) * (TW + 6), top: Math.floor(i / COLS) * (TH + 6) });
}
await sharp({ create: { width: COLS * (TW + 6), height: Math.ceil(preview.length / COLS) * (TH + 6), channels: 3, background: "#0b0b0b" } }).composite(comp).png().toFile(path.join(SRC, "final-sheet.png"));
console.log("sheet: scripts/tmp/authors/portraits/final-sheet.png");
