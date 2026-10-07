/**
 * Render each book's preview pages to WebP for the storefront.
 *
 * Output: public/images/previews/<slug>/p<N>.webp, plus a manifest at
 * src/lib/previews/manifest.json that the book page reads. The manifest is
 * generated rather than hand-written so a preview cannot be referenced by a
 * page that was never rendered.
 *
 * Rendered at 150 DPI and capped at 1100px wide: sharp on a high-density
 * phone screen at the size it is displayed, and far short of a resolution
 * anyone would reconstruct a book from.
 *
 * Requires poppler-utils (pdftoppm) and cwebp/ImageMagick for WebP.
 *
 * Usage: node scripts/catalog/build-previews.mjs                 # every configured book
 *        node scripts/catalog/build-previews.mjs <slug> [<slug>…]  # only these; the rest are left exactly as they are
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { PREVIEW_PAGES } from "./preview-pages.mjs";

const OUT_ROOT = "public/images/previews";
const MANIFEST = "src/lib/previews/manifest.json";
const DPI = 150;
const MAX_WIDTH = 1100;

mkdirSync("src/lib/previews", { recursive: true });

/**
 * Encode to WebP with whichever tool this machine has.
 *
 * `magick` is ImageMagick 7, `convert` is ImageMagick 6 — Ubuntu still ships
 * the latter. Trying each in turn and only failing once all three are gone
 * beats requiring one specific install, and every candidate is tried before
 * the error is raised so the message names all of them.
 */
const WEBP_ENCODERS = [
  ["cwebp", (png, webp) => ["-quiet", "-q", "82", "-resize", String(MAX_WIDTH), "0", png, "-o", webp]],
  ["magick", (png, webp) => [png, "-resize", `${MAX_WIDTH}x>`, "-quality", "82", webp]],
  ["convert", (png, webp) => [png, "-resize", `${MAX_WIDTH}x>`, "-quality", "82", webp]],
];

function toWebp(png, webp) {
  for (const [bin, args] of WEBP_ENCODERS) {
    try {
      execFileSync(bin, args(png, webp), { stdio: "pipe" });
      return;
    } catch (err) {
      // Only fall through when the binary is absent. A real encoding failure
      // must surface rather than being retried against another encoder and
      // reported as "nothing installed".
      if (err.code !== "ENOENT") throw err;
    }
  }
  throw new Error(
    `No WebP encoder found. Install one of: ${WEBP_ENCODERS.map(([b]) => b).join(", ")}.`,
  );
}

/**
 * Start from what is already published rather than from nothing.
 *
 * The source PDFs live in the book production repositories, which are NOT in
 * this repository and are not all present on every machine. Rebuilding the
 * manifest from scratch therefore used to DELETE the preview of any book
 * whose project happened to be absent or whose path had moved — which is
 * exactly what happened when the Hangul interior was renamed by the Phase 5
 * companion-page pass: a single unrelated run dropped a live book's preview
 * from the storefront, and only the catalog test caught it.
 *
 * So a missing source is now a warning that KEEPS the existing entry, as
 * long as the images it names are still on disk. The invariant the manifest
 * exists to hold is "every listed page was really rendered", and rendered
 * files on disk satisfy it just as well as a render performed this minute.
 */
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
let total = 0;

/** True when every image an entry lists is still present in public/. */
const entryIsIntact = (entry) =>
  Boolean(entry?.pages?.length) &&
  entry.pages.every((p) => existsSync(`public${p.src}`));

const ONLY = new Set(process.argv.slice(2));

/** A source path, or null when it cannot be resolved (a book project that is ambiguous or absent). */
function sourceOf(book) {
  try {
    return book.source;
  } catch (err) {
    console.error(`UNRESOLVABLE SOURCE  ${book.slug}: ${err.message.split("\n")[0]}`);
    return null;
  }
}

for (const entry of PREVIEW_PAGES) {
  if (ONLY.size && !ONLY.has(entry.slug)) continue;
  const book = { ...entry, source: sourceOf(entry) };
  if (!book.source || !existsSync(book.source)) {
    const kept = entryIsIntact(manifest[book.slug]);
    console.error(
      `MISSING SOURCE  ${book.slug}\n  ${book.source ?? "(path could not be resolved)"}\n  ` +
        (kept
          ? `keeping the ${manifest[book.slug].pages.length} image(s) already rendered`
          : "and nothing rendered before — this book has NO preview"),
    );
    if (!kept) delete manifest[book.slug];
    process.exitCode = 1;
    continue;
  }

  const dir = `${OUT_ROOT}/${book.slug}`;
  // Wipe first so a shortened range does not leave an orphaned page behind
  // that the manifest no longer lists but the bucket still serves.
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const [from, to] = book.pages;
  execFileSync("pdftoppm", [
    "-f", String(from),
    "-l", String(to),
    "-r", String(DPI),
    "-png",
    book.source,
    `${dir}/raw`,
  ]);

  const pages = [];
  for (const png of readdirSync(dir).filter((f) => f.endsWith(".png")).sort()) {
    const n = png.match(/raw-0*(\d+)\.png$/)?.[1];
    const webp = `${dir}/p${n}.webp`;
    toWebp(`${dir}/${png}`, webp);
    rmSync(`${dir}/${png}`);
    pages.push({
      src: `/images/previews/${book.slug}/p${n}.webp`,
      page: Number(n),
      bytes: statSync(webp).size,
    });
  }

  manifest[book.slug] = { note: book.note, pages: pages.map(({ src, page }) => ({ src, page })) };
  total += pages.length;
  const kb = (pages.reduce((n, p) => n + p.bytes, 0) / 1024).toFixed(0);
  console.log(`${book.slug.padEnd(32)} pages ${from}–${to}  ${pages.length} images  ${kb} KB`);
}

// A slug removed from PREVIEW_PAGES is a deliberate withdrawal, so it leaves
// the manifest even though its images may still be on disk.
const configured = new Set(PREVIEW_PAGES.map((b) => b.slug));
for (const slug of Object.keys(manifest)) {
  if (!configured.has(slug)) {
    console.log(`dropped (no longer configured)  ${slug}`);
    delete manifest[slug];
  }
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\n${total} preview images · manifest → ${MANIFEST}`);
