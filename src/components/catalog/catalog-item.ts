/**
 * The shape the catalog UI renders, plus the facet-count helpers the filter
 * sidebar derives from a book list.
 *
 * This module used to double as a *fallback catalog*: it shipped eleven
 * hard-coded bestsellers (The Midnight Library, Atomic Habits, Dune, 1984,
 * Sapiens…) that rendered whenever the database returned no published
 * books. That fallback is gone, deliberately and permanently.
 *
 * The reason is not tidiness. Those titles are real books that Valice Press
 * does not publish and has no right to sell. Rendering them in a storefront
 * — with prices, covers, ratings and an add-to-cart button — is not a
 * placeholder, it is a shop window full of merchandise that does not exist.
 * A visitor cannot tell "demo data" from inventory, and neither can a
 * crawler. An empty catalog is a smaller problem than a false one.
 *
 * So: real books come from `listPublishedBooks()`, and when there are none,
 * the catalog says so. See `<CatalogEmptyState>`.
 */

import type { BookEdition } from "@/components/book-card";
import { bookCoverSrc, bookPreviewSrcs } from "@/lib/asset-map";
import { type FormatKey, formatKeys } from "@/lib/format-badges";

/**
 * One book as the catalog surfaces render it.
 *
 * Richer than the raw `BookCardData` DB row because the catalog UI needs
 * presentation dimensions (facet category, formats, cover treatment) that
 * the query layer does not expose. `mapRealBooksToShell()` in
 * `app/books/page.tsx` performs the DB row → this shape mapping.
 */
export interface CatalogItem {
  id: string;
  slug: string;
  title: string;
  author: string;
  priceCents: number;
  /**
   * Does this store hold a file it can give away? Carried through from
   * `books.master_file_key`; each card's gift box reads it. Separate from
   * price since the Paddle compliance gate of 2026-09-12 — see `<GiftBox>`.
   */
  deliverableFree?: boolean;
  /** 0 when the title has no reviews yet. Never invent a rating. */
  rating: number;
  /** Primary category name, as stored on the book. */
  category: string;
  /**
   * The editions this book exists in, from `book_formats`. The card's badges
   * and Quick View's format buttons both read this; neither may assume.
   */
  editions: ReadonlyArray<BookEdition>;
  /** `books.epub_file_key is not null`. */
  hasEpub: boolean;
  /** The work's page count, or null. */
  pageCount: number | null;
  /** Is it wired to a checkout here, right now (`provider_price_id`)? */
  buyableHere: boolean;
  /** The book's own interior pages, for Quick View. Only ones that exist. */
  previews: readonly string[];
  /** One-line subtitle, for Quick View's summary. */
  subtitle: string | null;
  /**
   * Format facets, DERIVED from `editions` — never assumed.
   *
   * This field used to be the literal array `["PDF"]` for every book in the
   * catalogue, written by `toCatalogItems` without looking at the book. The
   * filter built on it therefore offered one option that matched everything,
   * which is a filter that filters nothing.
   */
  formats: ReadonlyArray<FormatKey>;
  badge?: { label: string; tone: "bestseller" | "popular" | "new" };
  cover: { gradient: string; accent: string; darkText?: boolean };
  /**
   * Server-resolved real cover (`/images/books/{slug}.webp`) or null. Set by
   * the page; the gradient/typographic cover renders when null.
   */
  coverSrc?: string | null;
}

/**
 * The format vocabulary the filter offers, in the order it reads.
 *
 * MOBI is gone: this press has never produced one, and a filter row for a
 * format that does not exist is a promise of a shelf that is empty. The print
 * formats are here because the catalogue genuinely contains them — they are
 * bought on Amazon rather than here, which the Quick View says plainly.
 */
export const FORMATS = [
  "Digital",
  "PDF",
  "EPUB",
  "Kindle",
  "Paperback",
  "Hardcover",
  "Large Print",
] as const;

/**
 * Facet counts for the filter sidebar.
 *
 * Categories are derived from the books actually present rather than from a
 * fixed vocabulary. A hard-coded list produces "Science Fiction (0)" rows
 * for genres the press does not publish — filters that promise a shelf and
 * deliver an empty one.
 */
export function getCategoryCounts(books: CatalogItem[]): Array<{
  name: string;
  count: number;
}> {
  const counts = new Map<string, number>();
  for (const book of books) {
    if (!book.category) continue;
    counts.set(book.category, (counts.get(book.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Same for formats — fixed vocabulary, since the three we sell are fixed. */
export function getFormatCounts(books: CatalogItem[]): Array<{
  name: string;
  count: number;
}> {
  const counts = new Map<string, number>();
  for (const book of books) {
    for (const fmt of book.formats) {
      counts.set(fmt, (counts.get(fmt) ?? 0) + 1);
    }
  }
  // Only formats this catalog actually contains. A filter is a promise that
  // something is behind it, so a format with no books never gets a row.
  return FORMATS.filter((name) => (counts.get(name) ?? 0) > 0).map((name) => ({
    name,
    count: counts.get(name) as number,
  }));
}

/**
 * Per-rating-floor counts: 5★ = exactly 5; 4★ = 4.0..4.9; etc.
 *
 * Books with `rating === 0` (no reviews yet) fall into no bucket, so an
 * unreviewed catalog shows every rating filter at zero rather than
 * manufacturing a 1★ shelf out of missing data.
 */
export function getRatingCounts(books: CatalogItem[]): Array<{
  stars: number;
  count: number;
}> {
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: books.filter(
      (b) => b.rating > 0 && Math.floor(b.rating) === stars,
    ).length,
  }));
}

/** Cover palette — cycles so adjacent cards differ when no real cover exists. */
const COVER_PALETTE: CatalogItem["cover"][] = [
  { gradient: "linear-gradient(160deg, #1a3326 0%, #0a1f14 100%)", accent: "#33f0aa" },
  { gradient: "linear-gradient(160deg, #1a2c4f 0%, #050a1e 100%)", accent: "#7ab6ff" },
  { gradient: "linear-gradient(160deg, #c98341 0%, #4b1f0a 100%)", accent: "#ffce63" },
  { gradient: "linear-gradient(160deg, #b41c1c 0%, #4a0808 100%)", accent: "#f4d4a8" },
  { gradient: "linear-gradient(160deg, #2c1f1a 0%, #14110a 100%)", accent: "#d1a86a" },
];

/** A live catalog row as the queries return it. */
export interface CatalogRow {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  priceCents: number;
  /** `books.master_file_key is not null` — see `CatalogItem.deliverableFree`. */
  deliverableFree?: boolean;
  buyableHere?: boolean;
  hasEpub?: boolean;
  pageCount?: number | null;
  editions?: ReadonlyArray<BookEdition>;
  currency: string;
  authors: ReadonlyArray<{ name: string }>;
  primaryCategory?: string | null;
  coverSrc?: string | null;
}

/**
 * Translate live catalog rows into the shape the catalog UI consumes.
 *
 * `rating: 0` means "no reviews yet" and is rendered as absent, not as a
 * zero-star score — a new title must never look badly reviewed because
 * nobody has reviewed it.
 */
export function toCatalogItems(rows: readonly CatalogRow[]): CatalogItem[] {
  return rows.map((row, i) => {
    const editions = row.editions ?? [];
    const hasEpub = Boolean(row.hasEpub);
    return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? null,
    author: row.authors[0]?.name ?? "—",
    priceCents: row.priceCents,
    deliverableFree: row.deliverableFree,
    buyableHere: Boolean(row.buyableHere),
    rating: 0,
    category: row.primaryCategory ?? "",
    editions,
    hasEpub,
    pageCount: row.pageCount ?? null,
    previews: bookPreviewSrcs(row.slug),
    // Derived from the book's own format rows. The old value here was the
    // literal ["PDF"] for every title in the catalogue.
    formats: formatKeys({ editions, hasEpub }),
    cover: COVER_PALETTE[i % COVER_PALETTE.length],
    // The real cover, from the committed asset manifest. Resolved here — not
    // per page — so the cart, the library and the catalog cannot disagree.
    coverSrc: row.coverSrc ?? bookCoverSrc(row.slug),
    };
  });
}
