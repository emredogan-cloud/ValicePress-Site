/**
 * The asset-to-entity map — where every real image lives, by convention.
 *
 * One rule, applied everywhere: a storefront entity resolves to the same
 * asset on every route. A book has ONE cover, and the homepage, the catalog,
 * the cart, the library, the related-books shelf, search and the order page
 * all ask this module for it. Before Phase 4 three routes resolved the cover
 * themselves and six others quietly rendered a gradient, so the same book
 * showed its real cover on /ebooks and a coloured rectangle on the home page.
 *
 * ── Slots ─────────────────────────────────────────────────────────────────
 *
 *   book slug        → /images/books/<slug>.webp             cover, 2:3
 *                    → /images/previews/<slug>/p<n>.webp     sample pages
 *                    → (social card = the cover, absolutised by the page)
 *   category slug    → /images/categories/<slug>.webp        optional bespoke art;
 *                      when absent, the card composes the covers of the books
 *                      actually filed in the category (see <CategoryCoverStack>)
 *   author slug      → /images/authors/<slug>.webp           portrait, 3:4 — only
 *                      a verified photograph or a public-domain likeness; when
 *                      absent, the designed identity mark renders instead
 *   blog slug        → /images/blog/<slug>.webp              article image, wide
 *   page atmosphere  → /images/<page>/<name>.webp            decorative only
 *
 * ── What "exists" means ───────────────────────────────────────────────────
 * Existence is answered from `asset-manifest.json`, a committed list written by
 * `scripts/assets/asset-manifest.mjs` from the contents of public/images with
 * each file's measured size. The manifest is the same on the server, in a
 * client bundle, at build time and inside an ISR regeneration; a filesystem
 * check is not. `npm test` fails when the manifest is stale.
 *
 * Nothing here touches the filesystem, so this module is safe to import from
 * client components.
 */

import manifest from "./asset-manifest.json";

export interface AssetRecord {
  path: string;
  width: number | null;
  height: number | null;
  bytes: number;
  slot: string;
  entity: string | null;
}

const ASSETS: ReadonlyMap<string, AssetRecord> = new Map(
  (manifest.assets as AssetRecord[]).map((a) => [a.path, a]),
);

export function bookCoverPath(slug: string): string {
  return `/images/books/${slug}.webp`;
}

export function bookPreviewPath(slug: string, page: number): string {
  return `/images/previews/${slug}/p${page}.webp`;
}

export function categoryArtPath(slug: string): string {
  return `/images/categories/${slug}.webp`;
}

export function authorPortraitPath(slug: string): string {
  return `/images/authors/${slug}.webp`;
}

export function blogImagePath(slug: string): string {
  return `/images/blog/${slug}.webp`;
}

/** The manifest record for a public path, or null when no such asset exists. */
export function assetRecord(publicPath: string): AssetRecord | null {
  return ASSETS.get(publicPath) ?? null;
}

/** True when the asset is in the committed manifest. */
export function assetExists(publicPath: string): boolean {
  return ASSETS.has(publicPath);
}

/** `publicPath` when it exists, otherwise null — the shape components consume. */
export function assetOrNull(publicPath: string): string | null {
  return ASSETS.has(publicPath) ? publicPath : null;
}

/**
 * The book's cover, or null. Anything that is not a plausible book shape
 * (portrait, between 1.2:1 and 1.75:1) is refused rather than rendered wrong:
 * a square or landscape file in a cover slot is a mistake, not a cover. Real
 * covers range from 2:3 (6 × 9 trims) to about 1.29:1 (8.5 × 11 workbooks);
 * `coverFit` tells the renderer which ones must not be cropped.
 */
export function bookCoverSrc(slug: string): string | null {
  const rec = assetRecord(bookCoverPath(slug));
  if (!rec) return null;
  if (rec.width && rec.height) {
    const ratio = rec.height / rec.width;
    if (ratio < 1.2 || ratio > 1.75) return null;
  }
  return rec.path;
}

/**
 * How a cover should sit in a 2:3 slot. A 2:3 file fills it (`cover`); a
 * squarer large-trim cover is shown whole on a dark ground (`contain`) so
 * that no title or author line is cropped away — "no accidental cropping"
 * is a rule, not a preference.
 */
export function coverFit(src: string | null | undefined): "cover" | "contain" {
  if (!src) return "cover";
  const rec = assetRecord(src);
  if (!rec?.width || !rec.height) return "cover";
  const ratio = rec.height / rec.width;
  // Taller-than-2:3 covers (1.6:1 is common) lose a sliver of margin to
  // object-cover and read fine; squarer ones would lose their title line.
  return ratio < 1.42 || ratio > 1.72 ? "contain" : "cover";
}

export function authorPortraitSrc(slug: string): string | null {
  return assetOrNull(authorPortraitPath(slug));
}

export function categoryArtSrc(slug: string): string | null {
  return assetOrNull(categoryArtPath(slug));
}

export function blogImageSrc(slug: string): string | null {
  return assetOrNull(blogImagePath(slug));
}

/** Every book slug that has a cover in the manifest — for integrity checks. */
export function bookSlugsWithCovers(): string[] {
  return [...ASSETS.values()].filter((a) => a.slot === "book-cover" && a.entity).map((a) => a.entity as string);
}

/** Attach `coverSrc` to any row that carries a slug. One call, every surface. */
export function withCoverSrc<T extends { slug: string }>(
  rows: readonly T[],
): Array<T & { coverSrc: string | null }> {
  return rows.map((row) => ({ ...row, coverSrc: bookCoverSrc(row.slug) }));
}

/**
 * The interior pages this book has a rendered preview for, in page order.
 *
 * These are REAL pages of the book, rendered from the same PDF the buyer
 * receives, and the ranges were chosen by hand and read before they were
 * chosen — see `scripts/catalog/preview-pages.mjs`. So this function lists
 * what exists and never pads: a book with two previews shows two. Inventing
 * a third, or substituting a page from another book, would turn a sample
 * into a claim.
 */
export function bookPreviewSrcs(slug: string): string[] {
  const pageOf = (path: string): number => {
    const m = path.match(/\/p(\d+)\.webp$/);
    return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
  };
  return [...ASSETS.values()]
    .filter((a) => a.slot === "book-preview" && a.entity === slug)
    .map((a) => a.path)
    .sort((a, b) => pageOf(a) - pageOf(b));
}
