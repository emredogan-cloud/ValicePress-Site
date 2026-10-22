/**
 * What stands on the spiral library's shelves, and in what order.
 *
 * This module holds no book data of its own. Its input is the `CatalogItem`
 * that `/books` already builds from `listPublishedBooks()`, plus the
 * collections each book belongs to; its output is that same object, sorted
 * onto shelves. The Quick View a reader opens from a shelf is handed the same
 * `item`, so the library cannot show a title, a cover or a link that the grid
 * would not. Where a book stands in space is the scene's business, not this
 * module's.
 *
 * ONE SHELF PER BOOK. Many books belong to two collections — every Valice
 * Classics reprint of a myth is in Myth & Folklore AND in Classics &
 * Philosophy. A book standing on two shelves at once reads as two copies, so
 * each book stands on the first of its collections in `SHELF_ORDER`, and the
 * collection filter — not the shelf — answers "everything in Classics &
 * Philosophy".
 *
 * `book_categories` has no order column, so the database cannot say which of
 * a book's collections is its main one. The catalogue can: `valice-catalog.mjs`
 * lists it first. `SHELF_ORDER` is written so that "first of its shelves in
 * this order" and "first in its catalogue record" agree for every published
 * book, and `library-shelves.test.ts` fails the day they stop agreeing — a new
 * book whose first collection would land it on another shelf is a decision for
 * a person, not a default.
 *
 * NO EMPTY SHELF, NO LOST BOOK. A shelf exists only because a book stands on
 * it. A collection whose every book stands on another shelf (today: Young
 * Explorers) is returned in `crossShelfCategories`, so the navigation can still
 * offer it. A book none of whose collections is known is returned in
 * `unshelved` rather than dropped — the test holds that list empty for the
 * real catalogue.
 */

import type { BookEdition } from "@/components/book-card";
import type { CatalogItem } from "@/components/catalog/catalog-item";
import { assetOrNull, assetSize } from "@/lib/asset-map";
import { editionLabel } from "@/lib/format-badges";

/** A collection, as the `categories` table stores it. */
export interface ShelfCategory {
  slug: string;
  name: string;
}

/**
 * The shelves, top to bottom, by collection slug — and the order in which a
 * book in several collections is offered a shelf. Romance leads because the
 * pinned titles lead (`@/lib/pinned-books`). Classics & Philosophy is last
 * because it is the widest collection, so a reprint stands with its subject.
 * Young Explorers comes after every collection its titles also belong to.
 *
 * Reordering shelves that share no book changes nothing but the order; moving a
 * collection past one it shares books with moves those books, and the
 * catalogue test says which.
 */
export const SHELF_ORDER: readonly string[] = [
  "romance",
  "myth-and-folklore",
  "games-and-play",
  "puzzle-and-challenge",
  "language-and-learning",
  "young-explorers",
  "classics-and-philosophy",
];

/** One Amazon edition a reader can be sent to. */
export interface AmazonEdition {
  format: BookEdition["format"];
  /** "Kindle", "Paperback", "Hardcover" or "Large Print" — `editionLabel`'s words. */
  label: string;
  /** The edition's own `book_formats.amazon_url`, never assembled here. */
  url: string;
}

/** A book as the library places it. */
export interface LibraryBook {
  /** Exactly what the catalogue grid and Quick View render — passed through, never copied. */
  item: CatalogItem;
  /** Every collection the book belongs to (`book_categories`), for the collection filter. */
  categorySlugs: readonly string[];
  /**
   * The image a shelf draws: the 432 px thumb (`/images/books/thumb/<slug>.webp`,
   * built by `scripts/assets/build-cover-thumbs.mjs`) when one exists, else the
   * full cover, else null. The full cover stays for Quick View, at reading size.
   */
  textureSrc: string | null;
  /**
   * Height over width of `textureSrc`, from the asset manifest, so a cover is
   * drawn at its own shape before its pixels arrive. 1.5 — a 6 × 9 trim — when
   * the manifest has no size: a placeholder's proportion, not a claim about a
   * book.
   */
  aspect: number;
  /**
   * The Amazon editions a reader can be sent to, in Quick View's order. Empty
   * means the book is not sold on Amazon, and the reader is offered the book
   * page instead — a missing link is never filled in.
   */
  amazonEditions: readonly AmazonEdition[];
}

export interface LibraryShelf {
  category: ShelfCategory;
  /** In the order the books were given: the catalogue's own (pinned books first, then newest). */
  books: readonly LibraryBook[];
}

export interface LibraryShelves {
  /** Top to bottom. Never empty shelves. */
  shelves: readonly LibraryShelf[];
  /** Collections that hold books but have no shelf, because each of their books stands on another. */
  crossShelfCategories: readonly ShelfCategory[];
  /** Books none of whose collections is known. Empty for the real catalogue. */
  unshelved: readonly LibraryBook[];
}

/** What the page hands this module: a catalogue item and the collections it belongs to. */
export interface LibraryInput {
  item: CatalogItem;
  categorySlugs: readonly string[];
}

/** A collection and the published books filed in it, as `listPublishedCollections()` reads them. */
export interface CollectionMembers extends ShelfCategory {
  bookSlugs: readonly string[];
}

/**
 * The page's two reads, joined: each catalogue item with the collections it is
 * filed in, and the collections themselves. A book that no collection lists
 * comes back with none, so `buildLibraryShelves` reports it in `unshelved` — it
 * is never dropped here.
 */
export function withCollections(
  items: readonly CatalogItem[],
  collections: readonly CollectionMembers[],
): { books: LibraryInput[]; categories: ShelfCategory[] } {
  const filedIn = new Map<string, string[]>();
  for (const c of collections) {
    for (const slug of c.bookSlugs) {
      const list = filedIn.get(slug);
      if (list) list.push(c.slug);
      else filedIn.set(slug, [c.slug]);
    }
  }
  return {
    books: items.map((item) => ({ item, categorySlugs: filedIn.get(item.slug) ?? [] })),
    categories: collections.map(({ slug, name }) => ({ slug, name })),
  };
}

/** The order Quick View lists editions in (`quick-view.tsx`), so a shelf and the dialog it opens agree. */
const FORMAT_ORDER: Record<BookEdition["format"], number> = {
  ebook: 0,
  paperback: 1,
  hardcover: 2,
  large_print: 3,
};

const PLACEHOLDER_ASPECT = 1.5;

/**
 * Is this an amazon.com page a reader may be sent to?
 *
 * The catalogue only stores `https://www.amazon.com/dp/<ASIN>` for an ASIN read
 * off its live page (`scripts/catalog/catalog-identity.test.ts`), and its
 * header allows a pasted Amazon Attribution URL on the same host. Anything else
 * — another scheme, another host, another marketplace — is not rendered as a
 * purchase link, whatever the database holds.
 */
export function isAmazonProductUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    (parsed.hostname === "www.amazon.com" || parsed.hostname === "amazon.com")
  );
}

/**
 * The editions this book can be bought in on Amazon, in Quick View's order.
 *
 * Only an `available`, Amazon-fulfilled edition with a product URL counts: a
 * `coming_soon` hardcover has no page to open. A direct ebook that is also on
 * Kindle already arrives as two editions (`withKindleEditions`), so its Kindle
 * row is found here like any other.
 */
export function amazonEditions(
  item: Pick<CatalogItem, "editions" | "hasEpub">,
): AmazonEdition[] {
  const out: AmazonEdition[] = [];
  const ordered = [...item.editions].sort(
    (a, b) => FORMAT_ORDER[a.format] - FORMAT_ORDER[b.format],
  );
  for (const e of ordered) {
    if (e.fulfillment !== "amazon" || e.availability !== "available") continue;
    if (!e.amazonUrl || !isAmazonProductUrl(e.amazonUrl)) continue;
    out.push({ format: e.format, label: editionLabel(e, item.hasEpub), url: e.amazonUrl });
  }
  return out;
}

/** A collection's place in `order`; one not listed comes after every listed one. */
function rankIn(order: readonly string[], slug: string): number {
  const i = order.indexOf(slug);
  return i === -1 ? order.length : i;
}

function byRankThenSlug(order: readonly string[]) {
  return (a: string, b: string): number =>
    rankIn(order, a) - rankIn(order, b) || (a < b ? -1 : a > b ? 1 : 0);
}

/**
 * The shelf a book stands on: the first of its collections in `order`. A
 * collection added to the catalogue after `order` was written still gets a
 * shelf — after every listed one, by slug — rather than losing its books.
 */
export function shelfFor(
  categorySlugs: readonly string[],
  order: readonly string[] = SHELF_ORDER,
): string | null {
  return [...categorySlugs].sort(byRankThenSlug(order))[0] ?? null;
}

function toLibraryBook({ item, categorySlugs }: LibraryInput): LibraryBook {
  // The same derivation the homepage shelf uses (`book-marquee.tsx`): a thumb
  // only ever stands in for a cover that exists.
  const cover = item.coverSrc ?? null;
  const thumb = cover
    ? assetOrNull(cover.replace("/images/books/", "/images/books/thumb/"))
    : null;
  const textureSrc = thumb ?? cover;
  const size = textureSrc ? assetSize(textureSrc) : null;
  return {
    item,
    categorySlugs,
    textureSrc,
    aspect: size ? size.height / size.width : PLACEHOLDER_ASPECT,
    amazonEditions: amazonEditions(item),
  };
}

/**
 * Sort the catalogue onto shelves. `categories` is the `categories` table (or
 * the catalogue's `CATEGORIES`); a collection slug a book carries that is not
 * in it is ignored.
 */
export function buildLibraryShelves(
  books: readonly LibraryInput[],
  categories: readonly ShelfCategory[],
  order: readonly string[] = SHELF_ORDER,
): LibraryShelves {
  const known = new Map(categories.map((c) => [c.slug, c]));
  const onShelf = new Map<string, LibraryBook[]>();
  const unshelved: LibraryBook[] = [];
  const members = new Set<string>();

  for (const input of books) {
    const book = toLibraryBook(input);
    const slugs = input.categorySlugs.filter((s) => known.has(s));
    for (const s of slugs) members.add(s);
    const shelf = shelfFor(slugs, order);
    if (shelf === null) {
      unshelved.push(book);
      continue;
    }
    const list = onShelf.get(shelf);
    if (list) list.push(book);
    else onShelf.set(shelf, [book]);
  }

  const sorted = byRankThenSlug(order);
  return {
    shelves: [...onShelf.keys()].sort(sorted).map((slug) => ({
      category: known.get(slug) as ShelfCategory,
      books: onShelf.get(slug) as LibraryBook[],
    })),
    crossShelfCategories: [...members]
      .filter((slug) => !onShelf.has(slug))
      .sort(sorted)
      .map((slug) => known.get(slug) as ShelfCategory),
    unshelved,
  };
}
