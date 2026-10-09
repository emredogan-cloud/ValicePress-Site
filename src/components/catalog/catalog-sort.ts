import type { CatalogItem } from "./catalog-item";
import type { SortOption } from "./catalog-toolbar";

/**
 * How the catalogue orders itself — kept out of the component so the two
 * rules that matter can be tested without a browser.
 *
 * 1. A book with no price is "not sold here", NOT "free" (`price_cents = 0`
 *    means exactly that in this catalogue). Sorting by the raw number put
 *    every Amazon-only title at the top of "Price: Low → High", as if they
 *    were the cheapest books in the shop. Unpriced books now sort after every
 *    priced one, in both directions, in the order they already had.
 * 2. Nothing has a rating yet. "Top Rated" over a catalogue where every
 *    rating is 0 orders nothing, so it is not offered until a review exists
 *    (the rating filter in the sidebar is hidden for the same reason), and a
 *    shared link that asks for it behaves like the default order instead of
 *    showing a dropdown with no matching option.
 */

type Sortable = Pick<CatalogItem, "priceCents" | "rating">;

const ALL: readonly SortOption[] = ["newest", "price-low", "price-high", "rating"];

const isPriced = (b: Sortable) => b.priceCents > 0;

/** The sorts worth offering for this set of books, in display order. */
export function availableSorts(books: readonly Sortable[]): SortOption[] {
  const anyRating = books.some((b) => b.rating > 0);
  const pricedCount = books.filter(isPriced).length;
  return ALL.filter((s) => {
    if (s === "rating") return anyRating;
    // A price sort needs at least two priced books to mean anything.
    if (s === "price-low" || s === "price-high") return pricedCount >= 2;
    return true;
  });
}

/** What the page really does when asked for `sortBy` — the default order when that sort is not on offer. */
export function effectiveSort(sortBy: SortOption, books: readonly Sortable[]): SortOption {
  return availableSorts(books).includes(sortBy) ? sortBy : "newest";
}

/** A new array in the requested order; never mutates its input. Ties keep their existing order. */
export function sortBooks<T extends Sortable>(books: readonly T[], sortBy: SortOption): T[] {
  const arr = [...books];
  switch (sortBy) {
    case "price-low":
      return arr.sort((a, b) => (isPriced(a) === isPriced(b) ? a.priceCents - b.priceCents : isPriced(a) ? -1 : 1));
    case "price-high":
      return arr.sort((a, b) => (isPriced(a) === isPriced(b) ? b.priceCents - a.priceCents : isPriced(a) ? -1 : 1));
    case "rating":
      return arr.sort((a, b) => b.rating - a.rating);
    case "newest":
    default:
      return arr;
  }
}
