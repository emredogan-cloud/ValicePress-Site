#!/usr/bin/env node
/**
 * Cut the Valice Press logo into the files the site uses — without touching the source.
 *
 *   node scripts/brand/build-logo.mjs [--source /home/emre/Pictures/ValicePress-main-logo.png]
 *
 * THE SOURCE is the founder's 1254 x 1254 PNG: a green V standing in an open book before a
 * globe, a gold star over a laurel sprig, and under it the wordmark and the tagline, all on
 * a flat cream ground. The ground is OPAQUE (the file has an alpha channel and every pixel
 * of it is 255). It is never modified and never copied into the repo: this script only reads
 * it, and records its SHA-256 so a changed source is noticed.
 *
 * WHAT IS MADE, and why each exists:
 *
 *   mark      the V, the book, the globe and the star — everything above the wordmark — cropped
 *             to a square (the cream ground extended by a few rows at the foot, not stretched)
 *             at 64/96/128/256/512. This is what a 40px header tile can carry. It is the actual
 *             artwork, not a redrawing.
 *   logo      the whole lockup (mark + wordmark + tagline) at 320/640/1254 for the places that
 *             have room to read it: the About page, the footer, structured data.
 *   icons     favicon.ico (16/32/48), icon.png (512), apple-icon.png (180), in src/app/ where
 *             Next's file convention turns them into the right <link> tags.
 *
 * NOTHING IS STRETCHED. Every derivative keeps its source's aspect ratio (the mark is made
 * square by adding ground, never by scaling one axis). The ground stays cream: on this site's
 * dark pages the logo sits on a cream tile, because the V and the wordmark are dark green and
 * would vanish on a dark ground — recolouring the brand artwork would be altering it.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const SOURCE = argv.includes("--source") ? argv[argv.indexOf("--source") + 1] : "/home/emre/Pictures/ValicePress-main-logo.png";
const OUT = path.join(ROOT, "public/images/brand");
const APP = path.join(ROOT, "src/app");
mkdirSync(OUT, { recursive: true });

const src = readFileSync(SOURCE);
const sha = createHash("sha256").update(src).digest("hex");
const meta = await sharp(src).metadata();
if (meta.width !== 1254 || meta.height !== 1254) throw new Error(`expected the 1254x1254 logo, got ${meta.width}x${meta.height}`);

// The ground colour, read from the file rather than guessed.
const { data } = await sharp(src).extract({ left: 0, top: 0, width: 24, height: 24 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const ground = { r: data[0], g: data[1], b: data[2] };

// The mark occupies rows 69-848 and columns 219-1028 (measured on the pixels); the wordmark
// begins at row 860. A 12px margin keeps the artwork off the tile edge without touching the
// wordmark's capitals.
const MARK = { left: 207, top: 56, width: 834, height: 800 };
const side = MARK.width; // square side
const markSquare = await sharp(src)
  .removeAlpha()
  .extract(MARK)
  .extend({ bottom: side - MARK.height, background: ground })
  .png()
  .toBuffer();

const written = [];
const out = async (file, pipeline) => {
  const f = path.join(OUT, file);
  await pipeline.toFile(f);
  written.push(path.relative(ROOT, f));
};

for (const w of [64, 96, 128, 256, 512]) {
  await out(`valice-press-mark-${w}.webp`, sharp(markSquare).resize(w, w, { kernel: "lanczos3" }).webp({ quality: w <= 128 ? 94 : 90, effort: 6 }));
}
await out("valice-press-mark-512.png", sharp(markSquare).resize(512, 512, { kernel: "lanczos3" }).png({ compressionLevel: 9 }));

const full = sharp(src).removeAlpha();
for (const w of [320, 640, 1254]) {
  await out(`valice-press-logo-${w}.webp`, full.clone().resize(w, w, { kernel: "lanczos3", withoutEnlargement: true }).webp({ quality: 92, effort: 6 }));
}
await out("valice-press-logo-512.png", full.clone().resize(512, 512, { kernel: "lanczos3" }).png({ compressionLevel: 9 }));

// ---- icons. Next turns src/app/icon.png, apple-icon.png and favicon.ico into the <link> tags.
// RGBA on purpose: Next's ICO reader refuses a PNG frame without an alpha channel, and the source's ground is opaque, so
// ensureAlpha() adds a fully-opaque 4th channel rather than changing a single colour.
const pngAt = (n) => sharp(markSquare).resize(n, n, { kernel: "lanczos3" }).sharpen({ sigma: 0.6 }).ensureAlpha().png().toBuffer();
writeFileSync(path.join(APP, "icon.png"), await pngAt(512));
writeFileSync(path.join(APP, "apple-icon.png"), await pngAt(180));
written.push("src/app/icon.png", "src/app/apple-icon.png");

// favicon.ico: three PNG-compressed images in an ICO container (every current browser reads them).
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map(pngAt));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = pngs.map((png, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(sizes[i], 0); // width
  e.writeUInt8(sizes[i], 1); // height
  e.writeUInt8(0, 2); // palette
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); // planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(png.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += png.length;
  return e;
});
writeFileSync(path.join(APP, "favicon.ico"), Buffer.concat([header, ...entries, ...pngs]));
written.push("src/app/favicon.ico");

writeFileSync(
  path.join(ROOT, "src/content/brand-provenance.json"),
  JSON.stringify(
    {
      source: SOURCE,
      sourceSha256: sha,
      sourcePixels: `${meta.width}x${meta.height}`,
      ground: `rgb(${ground.r}, ${ground.g}, ${ground.b})`,
      markCrop: MARK,
      note: "Derivatives only. The source file is read, never written. The mark is the artwork above the wordmark, extended to a square with the file's own ground colour; nothing is scaled on one axis.",
      builtBy: "scripts/brand/build-logo.mjs",
      files: written,
    },
    null,
    2,
  ) + "\n",
);
console.log(`source sha256 ${sha}\nground rgb(${ground.r}, ${ground.g}, ${ground.b})\n${written.join("\n")}`);
