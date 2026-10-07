/**
 * The order a shelf is in once the pins are set aside: NEWEST FIRST, UNDATED
 * LAST, TIES BY SLUG.
 *
 * Before this, "newest" was `publishedAt desc, id asc`, and the loader never wrote
 * `publishedAt`, so every row compared equal on the first key and the order was
 * decided by the primary key — a random UUID, different in every database and
 * after every reseed. Two adjacent cards swapped places between two builds of
 * identical code. The date is now written by the loader (from `publishedOn`, a
 * date Amazon prints) and the last key is the slug: alphabetical, stable across
 * databases, and meaningful to a person reading a diff.
 *
 * NULLS LAST is stated explicitly because Postgres sorts NULLs FIRST on a
 * descending key, which would put every undated book — the ten Valice Classics
 * sold only here — ahead of every dated one. The three SQL `orderBy` clauses in
 * `db/queries/catalog.ts` say the same thing as this comparator in SQL; the
 * JS-sorted shelves (category cards, author pages) use this function.
 */
export interface Dated {
  slug: string;
  publishedAt: Date | null;
}

export function byNewest(a: Dated, b: Dated): number {
  const at = a.publishedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  const bt = b.publishedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  if (at !== bt) return bt > at ? 1 : -1; // later date first; -Infinity (undated) sorts last
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}
