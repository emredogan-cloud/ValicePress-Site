/**
 * Compose the Lemon Squeezy product image for every book this store sells.
 *
 * Lemon Squeezy shows one image per product at checkout, in the receipt email,
 * and in any social unfurl of a checkout link. It asks for **1600 × 1200 (4:3)**.
 * A book cover is 2:3 portrait. Dropping a portrait cover into a landscape slot
 * either letterboxes it with whatever grey the provider picks, or — worse —
 * centre-crops it and cuts the title off.
 *
 * So the cover is not resized to fit the slot; it is PLACED in one. The book's
 * own artwork is never stretched, cropped or recoloured (the house rule: a
 * cover is the book's, not a texture to edit). What changes is only what sits
 * around it: a deep evergreen plinth, a hairline in gold so a dark cover still
 * has an edge against a dark ground, a soft contact shadow, and the imprint
 * line. The result is 29 images that read as one shelf.
 *
 * Source of truth for WHICH books need one is the catalogue, not the directory
 * listing: a cover exists on disk for books that are not sold here at all.
 *
 * Usage:
 *   node scripts/commerce/build-product-images.mjs              # all sellable books
 *   node scripts/commerce/build-product-images.mjs --slug kwaidan
 *   node scripts/commerce/build-product-images.mjs --out <dir>
 */
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { BOOKS } from "../catalog/valice-catalog.mjs";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};

const OUT = arg("out", "public/images/commerce/lemonsqueezy");
const ONLY = arg("slug", null);

// 4:3, the ratio Lemon Squeezy's own uploader asks for.
const W = 1600;
const H = 1200;
// The cover's height on the plinth. 1000 of 1200 leaves a 100px air gap top and
// bottom — enough that the shadow has somewhere to fall and the crop that some
// surfaces apply to a 4:3 thumbnail never reaches the artwork.
const COVER_H = 1000;

const INK = "#0c1d16";      // deep evergreen — the press's dark ground
const INK_2 = "#15332589";  // the lift behind the cover
const GOLD = "#c9a24a";

function background() {
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="lift" cx="50%" cy="44%" r="62%">
      <stop offset="0%" stop-color="${INK_2}"/>
      <stop offset="100%" stop-color="#0c1d1600"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${INK}"/>
  <rect width="${W}" height="${H}" fill="url(#lift)"/>
</svg>`);
}

/** The gold hairline and the contact shadow, drawn for one cover's geometry. */
function frameAndShadow(x, y, w, h) {
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="contact" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00000055"/>
      <stop offset="100%" stop-color="#00000000"/>
    </linearGradient>
  </defs>
  <ellipse cx="${x + w / 2}" cy="${y + h + 14}" rx="${w * 0.56}" ry="18" fill="url(#contact)"/>
  <rect x="${x - 0.5}" y="${y - 0.5}" width="${w + 1}" height="${h + 1}"
        fill="none" stroke="${GOLD}" stroke-opacity="0.55" stroke-width="1.5"/>
</svg>`);
}

function imprint() {
  // Letterspaced small caps, the same line the companion pages carry.
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="${W / 2}" y="${H - 46}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="21"
        letter-spacing="7" fill="${GOLD}" fill-opacity="0.82">VALICE PRESS</text>
  <line x1="${W / 2 - 150}" y1="${H - 76}" x2="${W / 2 + 150}" y2="${H - 76}"
        stroke="${GOLD}" stroke-opacity="0.3" stroke-width="1"/>
</svg>`);
}

/** The books that have a Lemon Squeezy product, i.e. the ones this can run on. */
function sellable() {
  return BOOKS.filter((b) => {
    if (b.websiteStatus !== "published" || b.directSale === false) return false;
    const e = (b.formats ?? []).find((f) => f.format === "ebook");
    return Boolean(
      e &&
        e.fulfillment === "direct" &&
        e.availability === "available" &&
        e.masterFileKey &&
        e.priceCents > 0,
    );
  });
}

const books = sellable().filter((b) => !ONLY || b.slug === ONLY);
mkdirSync(OUT, { recursive: true });

let made = 0;
const missing = [];

for (const book of books) {
  const src = path.join("public/images/books", `${book.slug}.webp`);
  if (!existsSync(src)) {
    // Never substitute another book's art or a stock image for a missing cover.
    missing.push(book.slug);
    continue;
  }

  const cover = sharp(readFileSync(src));
  const meta = await cover.metadata();
  const w = Math.round((meta.width / meta.height) * COVER_H);
  const x = Math.round((W - w) / 2);
  const y = Math.round((H - COVER_H) / 2) - 18; // sit slightly high; the imprint owns the foot

  const resized = await cover.resize(w, COVER_H, { fit: "fill" }).toBuffer();

  await sharp(background())
    .composite([
      { input: frameAndShadow(x, y, w, COVER_H), top: 0, left: 0 },
      { input: resized, top: y, left: x },
      { input: frameAndShadow(x, y, w, COVER_H), top: 0, left: 0 },
      { input: imprint(), top: 0, left: 0 },
    ])
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
    .toFile(path.join(OUT, `${book.slug}.jpg`));

  made += 1;
}

console.log(`books needing a product image : ${books.length}`);
console.log(`written to ${OUT}            : ${made}`);
if (missing.length) {
  console.log(`NO COVER ON DISK (not faked)  : ${missing.join(", ")}`);
  process.exitCode = 1;
}
