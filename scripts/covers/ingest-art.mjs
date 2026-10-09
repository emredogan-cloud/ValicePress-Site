#!/usr/bin/env node
/**
 * Bring ONE piece of book art into the storefront, and record where it came from.
 *
 *   node scripts/covers/ingest-art.mjs --slug weather-permitting --slot front \
 *        --source ".../WEATHER-PERMITTING-KINDLE-COVER.jpg" --note "ebook cover, 10-04"
 *   node scripts/covers/ingest-art.mjs --slug weather-permitting --slot back \
 *        --source ".../PAPERBACK-COVER-6x9-292pp.pdf" --trim-width 6
 *   node scripts/covers/ingest-art.mjs ... --commit        # without it: a dry run, nothing written
 *
 * SLOTS (the convention lives in src/lib/asset-map.ts, the classifier in
 * scripts/assets/asset-manifest.mjs):
 *   front        /images/books/<slug>.webp            + the 432px thumb
 *   back         /images/books/back/<slug>.webp
 *   quote-N      /images/previews/<slug>/quote-N.webp
 *   lookinside   /images/lookinside/<slug>/<--name>.webp       (A+ visuals; add --crop x0,y0,x1,y1 to drop letterbox bands)
 *
 * A PDF source is a KDP print WRAP (back | spine | front, with bleed): page 1 is
 * rasterised and the requested panel is cropped out at TRIM size — inside the
 * bleed, outside nothing else. `--panel back` (default for slot back) or `--panel
 * front`. The panel width is the book's trim width, passed with `--trim-width`
 * (inches); the geometry then needs no spine arithmetic: back = [bleed, bleed +
 * trim], front = [pageWidth − bleed − trim, pageWidth − bleed].
 *
 * WHY PROVENANCE IS RECORDED. "Never mix one book's art with another's" is only
 * checkable if every committed image can be traced to the file it was made from.
 * `src/content/book-art-provenance.json` keeps, per image: the source path, its
 * SHA-256, size and mtime, the output's SHA-256 and pixel size, and a note. The
 * tests refuse a cover whose bytes equal another book's, and re-running this
 * on a changed source shows exactly which files moved.
 *
 * It never invents: no source, no output — a missing or unreadable source is an
 * error, never a placeholder.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROVENANCE = path.join(ROOT, "src/content/book-art-provenance.json");

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

const slug = opt("slug") ?? die("--slug is required");
const slot = opt("slot") ?? die("--slot is required (front | back | quote-N | lookinside)");
const source = opt("source") ?? die("--source is required");
const note = opt("note", "");
const commit = flag("commit");
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) die(`bad slug "${slug}"`);
if (!existsSync(source)) die(`source not found: ${source}`);

/** Where the output goes, and how big it should be. */
function target() {
  if (slot === "front") return { out: `public/images/books/${slug}.webp`, width: 1000, quality: 82, maxBytes: 400 * 1024, key: `${slug}:front` };
  if (slot === "back") return { out: `public/images/books/back/${slug}.webp`, width: 1000, quality: 82, maxBytes: 400 * 1024, key: `${slug}:back` };
  const q = slot.match(/^quote-(\d+)$/);
  if (q) return { out: `public/images/previews/${slug}/quote-${q[1]}.webp`, width: Number(opt("width", 1080)), quality: 88, maxBytes: 600 * 1024, key: `${slug}:${slot}` };
  if (slot === "lookinside") {
    const name = opt("name") ?? die("--name is required for slot lookinside");
    if (!/^[a-z0-9-]+$/.test(name)) die(`bad --name "${name}"`);
    return { out: `public/images/lookinside/${slug}/${name}.webp`, width: Number(opt("width", 1200)), quality: 86, maxBytes: 700 * 1024, key: `${slug}:lookinside:${name}` };
  }
  return die(`unknown slot "${slot}"`);
}

/** Load the source as a raster buffer. A PDF is a wrap: rasterise page 1 and crop the panel. */
async function loadRaster() {
  if (!/\.pdf$/i.test(source)) {
    // --crop x0,y0,x1,y1 (fractions of the image): used to drop the soft letterbox bands KDP's
    // 970x600 header format pads an ultra-wide picture with. Nothing is stretched or repainted.
    const crop = opt("crop");
    if (!crop) return { buffer: readFileSync(source), via: "image" };
    const [x0, y0, x1, y1] = crop.split(",").map(Number);
    if (![x0, y0, x1, y1].every((n) => n >= 0 && n <= 1) || x1 <= x0 || y1 <= y0) die(`bad --crop "${crop}"`);
    const meta = await sharp(readFileSync(source)).metadata();
    const box = {
      left: Math.round(x0 * meta.width),
      top: Math.round(y0 * meta.height),
      width: Math.round((x1 - x0) * meta.width),
      height: Math.round((y1 - y0) * meta.height),
    };
    return { buffer: await sharp(readFileSync(source)).extract(box).png().toBuffer(), via: `image, cropped to ${crop}`, box };
  }

  const trim = Number(opt("trim-width") ?? die("a PDF source needs --trim-width (inches)"));
  const bleed = Number(opt("bleed", 0.125));
  const dpi = Number(opt("dpi", 220));
  const panel = opt("panel", slot === "front" ? "front" : "back");
  if (!["front", "back"].includes(panel)) die(`--panel must be front or back`);

  const info = execFileSync("pdfinfo", [source], { encoding: "utf8" });
  const size = info.match(/Page size:\s+([\d.]+) x ([\d.]+) pts/);
  if (!size) die("pdfinfo gave no page size");
  const pageW = Number(size[1]) / 72;
  const pageH = Number(size[2]) / 72;

  const dir = mkdtempSync(path.join(tmpdir(), "wrap-"));
  try {
    execFileSync("pdftoppm", ["-r", String(dpi), "-f", "1", "-l", "1", "-png", source, path.join(dir, "p")]);
    // pdftoppm pads the page number by the document's page count (p-1, p-01, p-001).
    const png = readFileSync(path.join(dir, readdirSync(dir).find((n) => n.endsWith(".png")) ?? die("pdftoppm wrote no image")));
    const left = panel === "back" ? bleed : pageW - bleed - trim;
    const box = {
      left: Math.round(left * dpi),
      top: Math.round(bleed * dpi),
      width: Math.round(trim * dpi),
      height: Math.round((pageH - 2 * bleed) * dpi),
    };
    const buffer = await sharp(png).extract(box).png().toBuffer();
    return { buffer, via: `pdf wrap ${pageW.toFixed(3)}×${pageH.toFixed(3)} in, ${panel} panel ${trim}in @${dpi}dpi`, box };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const t = target();
const outPath = path.join(ROOT, t.out);
const srcBytes = readFileSync(source);
const { buffer, via, box } = await loadRaster();

// Resize to the slot's width, never upscaling, aspect ratio preserved. Step the
// quality down only if the byte budget is exceeded.
let quality = t.quality;
let webp;
for (;;) {
  webp = await sharp(buffer).resize({ width: t.width, withoutEnlargement: true }).webp({ quality, effort: 5 }).toBuffer();
  if (webp.length <= t.maxBytes || quality <= 55) break;
  quality -= 4;
}
const meta = await sharp(webp).metadata();

const record = {
  source,
  sourceSha256: sha256(srcBytes),
  sourceBytes: srcBytes.length,
  sourceMtime: statSync(source).mtime.toISOString(),
  via,
  ...(box ? { cropPx: box } : {}),
  output: `/${t.out.replace(/^public\//, "")}`,
  outputSha256: sha256(webp),
  width: meta.width,
  height: meta.height,
  bytes: webp.length,
  quality,
  note,
  ingestedAt: new Date().toISOString(),
};

console.log(`${commit ? "WRITE " : "DRY   "} ${t.key}\n       ${source}\n       → ${record.output}  ${meta.width}×${meta.height}  ${Math.round(webp.length / 1024)} KB  q${quality}  (${via})`);
if (!commit) process.exit(0);

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, webp);

if (slot === "front") {
  const thumb = path.join(ROOT, `public/images/books/thumb/${slug}.webp`);
  mkdirSync(path.dirname(thumb), { recursive: true });
  writeFileSync(thumb, await sharp(buffer).resize({ width: 432 }).webp({ quality: 80, effort: 5 }).toBuffer());
  console.log(`       → /images/books/thumb/${slug}.webp  (432 px)`);
}

mkdirSync(path.dirname(PROVENANCE), { recursive: true });
const all = existsSync(PROVENANCE) ? JSON.parse(readFileSync(PROVENANCE, "utf8")) : {};
all[t.key] = record;
writeFileSync(PROVENANCE, JSON.stringify(Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n");
console.log(`       provenance → src/content/book-art-provenance.json`);
