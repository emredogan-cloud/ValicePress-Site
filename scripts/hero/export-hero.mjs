#!/usr/bin/env node
/**
 * Cut the composed hero master into the files the homepage loads.
 *
 *   python3 scripts/hero/compose-hero.py --plate-x4 <realesrgan output> --out scripts/tmp/hero/master.png
 *   node scripts/hero/export-hero.mjs [--master scripts/tmp/hero/master.png]
 *
 * Writes to public/images/homepage/:
 *   hero-featured-{640,960,1280,1672,2560,3344}.{avif,webp}   the whole scene, for screens >= 1280px (the books stand right of the type)
 *   hero-featured-wide-{960,1280,1672,2560}.{avif,webp}       the books across the full width, 1.9:1, for 640-1279px (stacked above the type)
 *   hero-featured-banner-{640,960,1280}.{avif,webp}           the books alone, 1.2:1, for phones (stacked above the type)
 *
 * Every width is a REDUCTION of the one 3344px master — nothing is enlarged here — so each
 * size is as sharp as its pixel count allows. AVIF is offered first, WebP second; the
 * smallest file that can still show a dark gradient without banding wins, which is why the
 * quality is not the library default (a near-black plate bands first, long before it looks soft).
 */
import { mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const master = argv.includes("--master") ? argv[argv.indexOf("--master") + 1] : path.join(ROOT, "scripts/tmp/hero/master.png");
const OUT = path.join(ROOT, "public/images/homepage");
mkdirSync(OUT, { recursive: true });

const buf = readFileSync(master);
const meta = await sharp(buf).metadata();
if (meta.width !== 3344 || meta.height !== 1882) throw new Error(`master must be 3344x1882, got ${meta.width}x${meta.height}`);

const kb = (f) => `${Math.round(statSync(f).size / 1024)} KB`;

// The wide picture.
for (const w of [640, 960, 1280, 1672, 2560, 3344]) {
  const img = sharp(buf).resize({ width: w, withoutEnlargement: true, kernel: "lanczos3" });
  const avif = path.join(OUT, `hero-featured-${w}.avif`);
  const webp = path.join(OUT, `hero-featured-${w}.webp`);
  await img.clone().avif({ quality: 52, effort: 6, chromaSubsampling: "4:4:4" }).toFile(avif);
  await img.clone().webp({ quality: 80, effort: 6 }).toFile(webp);
  console.log(`hero-featured-${w}   avif ${kb(avif)}   webp ${kb(webp)}`);
}

// The tablet / small-laptop banner: the whole width of the plate, from just above the tallest cover (its top is at 248)
// to the foot of the master, so the reflections have room to fade. 3344 x 1762 = 1.898:1.
const WIDE = { left: 0, top: 120, width: 3344, height: 1762 };
for (const w of [960, 1280, 1672, 2560]) {
  const img = sharp(buf).extract(WIDE).resize({ width: w, kernel: "lanczos3" });
  const avif = path.join(OUT, `hero-featured-wide-${w}.avif`);
  const webp = path.join(OUT, `hero-featured-wide-${w}.webp`);
  await img.clone().avif({ quality: 52, effort: 6, chromaSubsampling: "4:4:4" }).toFile(avif);
  await img.clone().webp({ quality: 80, effort: 6 }).toFile(webp);
  console.log(`hero-featured-wide-${w}   avif ${kb(avif)}   webp ${kb(webp)}`);
}

// The phone banner: the three books and their ledge, 1.217:1 (a 393px screen shows it 323px tall). It starts BELOW the
// header, so the 188px of dark wall above the tallest cover (top 248 in the master) is headroom the cover can fade up into,
// and it runs 180px past the covers' feet (SS stands at 1596) so only the table and the reflections melt into the page.
const crop = { left: 1154, top: 60, width: 2190, height: 1800 };
for (const w of [640, 960, 1280]) {
  const img = sharp(buf).extract(crop).resize({ width: w, kernel: "lanczos3" });
  const avif = path.join(OUT, `hero-featured-banner-${w}.avif`);
  const webp = path.join(OUT, `hero-featured-banner-${w}.webp`);
  await img.clone().avif({ quality: 54, effort: 6, chromaSubsampling: "4:4:4" }).toFile(avif);
  await img.clone().webp({ quality: 82, effort: 6 }).toFile(webp);
  console.log(`hero-featured-banner-${w}   avif ${kb(avif)}   webp ${kb(webp)}`);
}
