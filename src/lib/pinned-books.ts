/**
 * The books every listing opens with, in this order.
 *
 * A Founder decision, widened on 2026-10-07 (the site-update brief, §25): these
 * lead every shelf the storefront draws — /books, /ebooks, the homepage, search,
 * the category and author pages, the recommendation shelves, the companion index —
 * ahead of whatever order that shelf would otherwise use. They are named by
 * catalogue slug, not by database id, so the pin survives a reseed;
 * `pinned-books.test.ts` fails if a slug here is not in the catalogue.
 *
 *   1  weather-permitting          Bristlecone Emergency 1  (new)
 *   2  ridge-runner                Bristlecone Emergency 2  (STAGED — see below)
 *   3  the-sweetest-season         Larkspur Lake 1
 *   4  the-great-book-of-world-games
 *   5  codex-bestiarium
 *   6  the-long-way-back           Larkspur Lake 2         (new, after the five named)
 *   7  all-the-quiet-places        Larkspur Lake 3         (new, after the five named)
 *
 * RIDGE RUNNER IS PINNED BEFORE IT IS PUBLISHED, ON PURPOSE. It has no Amazon
 * listing yet, so its catalogue record is a `draft` and no shelf lists it (a pin
 * never adds a book to a shelf). When KDP issues live editions and the record
 * becomes `published`, it appears at position two with no code change. Pinning it
 * now is what makes "publish Ridge Runner" a catalogue edit and nothing else.
 *
 * WHAT A PIN IS NOT: A PASS INTO A SHELF IT DOES NOT BELONG ON. The pin only
 * ever ORDERS the books a listing already chose. A category page still holds
 * only that category's books, a search still returns only what matched, and a
 * romance novel is never pinned into "Games & Play". That is why it is applied
 * after each query selects its rows, and never adds one.
 *
 * To pin another book, add its slug. To end a pin, delete it. Nothing else in
 * the codebase names these books for ordering purposes. Below the pins every
 * shelf falls back to `@/lib/shelf-order` — newest first, then slug.
 */
export const PINNED_BOOK_SLUGS: readonly string[] = [
  "weather-permitting",
  "ridge-runner",
  "the-sweetest-season",
  "the-great-book-of-world-games",
  "codex-bestiarium",
  "the-long-way-back",
  "all-the-quiet-places",
];

const PIN_RANK: ReadonlyMap<string, number> = new Map(
  PINNED_BOOK_SLUGS.map((slug, i) => [slug, i]),
);

/** A book's place in the pin order. Every unpinned book shares the last one. */
function pinRank(slug: string): number {
  return PIN_RANK.get(slug) ?? PINNED_BOOK_SLUGS.length;
}

/**
 * `Array.prototype.sort` comparator: pinned books first, in pin order.
 *
 * Every unpinned pair compares equal and `sort` is stable, so a list sorted
 * with this keeps its existing order below the pins. Apply it as the LAST
 * sort of a listing's own order, and it decides only which books come first.
 * An explicit sort a reader chooses afterwards (price, say) still decides the
 * order — sorted over a pinned-first list, the pin only settles its ties.
 */
export function byPinnedRank(a: { slug: string }, b: { slug: string }): number {
  return pinRank(a.slug) - pinRank(b.slug);
}

/**
 * The same ordering as a copy, leaving `items` untouched. `slugOf` names the
 * book when the items are not books themselves — a companion page carries its
 * book as `bookSlug`.
 */
export function withPinnedFirst<T extends { slug: string }>(items: readonly T[]): T[];
export function withPinnedFirst<T>(
  items: readonly T[],
  slugOf: (item: T) => string,
): T[];
export function withPinnedFirst<T>(
  items: readonly T[],
  slugOf: (item: T) => string = (item) => (item as { slug: string }).slug,
): T[] {
  return [...items].sort((a, b) => pinRank(slugOf(a)) - pinRank(slugOf(b)));
}
