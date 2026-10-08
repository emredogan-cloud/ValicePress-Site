import type { BookCardData } from "@/components/book-card";
import { relatedBooks } from "@/lib/related-books";
import { isAddable } from "@/lib/sellable";

/**
 * Which books a "You might like" shelf offers.
 *
 * It used to be "the first eight published books that are not in the cart",
 * which on the live catalogue meant five Amazon-only titles — no "+" on them,
 * because this store does not sell them — and three that could be added. A
 * shelf whose purpose is to put books in the cart was mostly books that cannot
 * go in the cart, and a reader who pressed the one place a "+" should have been
 * and found a link icon concluded, reasonably, that the button did not work.
 *
 * So the shelf now offers:
 *   - only titles `isAddable` says the cart will accept (`@/lib/sellable`);
 *   - never a book already in the cart, and never one the reader already owns
 *     (the old ownership filter was computed over the cart's own lines, so it
 *     could never match a recommendation — it filtered nothing);
 *   - when the cart is not empty, the books MOST RELATED to what is in it come
 *     first — a bundle partner, then the same distinctive author, then the same
 *     collection (`relatedBooks`, the same ranking the product page uses), one
 *     cart line's best matches at a time so a two-book cart is not dominated by
 *     whichever came first;
 *   - the rest in the catalogue's own order, which puts pinned titles first.
 *
 * Pure: a list in, a list out, no database.
 */

export interface PickOptions {
  /** Every published book, in the catalogue's order. */
  all: readonly BookCardData[];
  /** Book ids to leave out: what is in the cart, what the reader owns. */
  exclude: ReadonlySet<string>;
  /** The books the shelf should be related to (the cart's lines, or the reader's library), in order. */
  seeds?: readonly BookCardData[];
  /** Books sold together with a given slug; the strongest relationship there is. */
  bundledWith?: (slug: string) => readonly string[];
  limit?: number;
}

export function pickRecommendations({ all, exclude, seeds = [], bundledWith, limit = 12 }: PickOptions): BookCardData[] {
  const candidates = all.filter((b) => isAddable(b) && !exclude.has(b.id));
  if (seeds.length === 0) return candidates.slice(0, limit);

  const lists = seeds.map((seed) =>
    relatedBooks(seed, candidates, { bundledWith: bundledWith?.(seed.slug) ?? [], limit: candidates.length }),
  );
  const out: BookCardData[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < limit && lists.some((l) => i < l.length); i++) {
    for (const list of lists) {
      const book = list[i];
      if (book && !seen.has(book.id) && out.length < limit) {
        seen.add(book.id);
        out.push(book);
      }
    }
  }
  return out;
}
