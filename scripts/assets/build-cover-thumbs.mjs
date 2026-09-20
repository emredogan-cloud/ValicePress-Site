#!/usr/bin/env node
/**
 * build-cover-thumbs.mjs — the small copy of every book cover the homepage uses.
 *
 * WHY THIS EXISTS
 * `book-marquee.tsx` swaps `/images/books/<slug>.webp` for
 * `/images/books/thumb/<slug>.webp`, so the thumb is what the homepage actually
 * requests. Nothing generated them: they were made by hand, and on 2026-09-20 a
 * sweep found exactly two covers with no thumb — `puzzles-old-and-new` and
 * `words-from-the-gods`, the two books added to the catalogue most recently.
 * Hand-made assets go missing for whichever book was added last, every time.
 *
 * The thumb is a plain width-432 rendition of the cover with the aspect ratio
 * left alone, which is what the 30 thumbs that already existed measured as
 * (432x648 for a 2:3 cover, 432x691 for the taller ones).
 *
 *   node scripts/assets/build-cover-thumbs.mjs            # report what is missing
 *   node scripts/assets/build-cover-thumbs.mjs --write    # generate it
 *   node scripts/assets/build-cover-thumbs.mjs --write --all   # rebuild every thumb
 *
 * Dry run by default, like every other script in this repository.
 */
import { readdir, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const WIDTH = 432;
const COVERS = "public/images/books";
const THUMBS = "public/images/books/thumb";

const write = process.argv.includes("--write");
const all = process.argv.includes("--all");

const files = (await readdir(COVERS)).filter((f) => f.endsWith(".webp")).sort();
await mkdir(THUMBS, { recursive: true });

let made = 0;
let skipped = 0;
for (const f of files) {
  const src = path.join(COVERS, f);
  const dst = path.join(THUMBS, f);
  if (existsSync(dst) && !all) { skipped += 1; continue; }
  const meta = await sharp(src).metadata();
  const h = Math.round((meta.height * WIDTH) / meta.width);
  if (!write) {
    console.log(`  WOULD WRITE  ${f.padEnd(42)} ${meta.width}x${meta.height} -> ${WIDTH}x${h}`);
    made += 1;
    continue;
  }
  await sharp(src).resize({ width: WIDTH }).webp({ quality: 82 }).toFile(dst);
  const { size } = await stat(dst);
  console.log(`  WROTE        ${f.padEnd(42)} ${meta.width}x${meta.height} -> ${WIDTH}x${h}  ${Math.round(size / 1024)}KB`);
  made += 1;
}
console.log(`\n${write ? "wrote" : "would write"} ${made} · left alone ${skipped} · ${files.length} covers in all`);
if (!write && made > 0) console.log("Dry run. Add --write to generate.");
