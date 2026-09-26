/**
 * A directly sold ebook that is ALSO live on Kindle is two editions, not one.
 *
 * `book_formats` holds one row per format (`book_formats_book_format_uk`), so
 * the catalogue records a Kindle ASIN on the same ebook row as the DRM-free
 * PDF this site sells. Every storefront surface read that row as the direct
 * edition alone, which left the Kindle editions of World Games, Codex
 * Bestiarium, Codex Enigmatica, Pencil & Paper and Words from the Gods live on
 * Amazon, recorded here against a verified ASIN, and linked from nowhere. (The
 * free-book email already read the same row as a Kindle edition — see
 * `selectAmazonEditions` — so the storefront was the one surface that did not.)
 *
 * Split once, in the catalog queries, and every surface lists it with no
 * knowledge of this case: the book page's editions table, Quick View's edition
 * chooser and the Kindle filter all read editions. The direct row keeps what
 * THIS site sells and gives up the link, so the URL exists exactly once. The
 * Kindle edition has no price, no page count and no ISBN: the row's price is
 * what this site charges, and the page count and ISBN describe the file this
 * site delivers — none of them is a fact the catalogue holds about Amazon's
 * edition. It is `available` because the catalogue only records an ebook ASIN
 * Amazon has put on sale (`valice-catalog.test.ts` holds it to that).
 */
export interface SplittableFormat {
  format: "ebook" | "paperback" | "hardcover" | "large_print";
  availability: "available" | "coming_soon" | "unavailable";
  fulfillment: "direct" | "amazon";
  priceCents: number | null;
  pageCount: number | null;
  amazonAsin: string | null;
  amazonUrl: string | null;
  isbn: string | null;
  masterFileKey: string | null;
}

export function withKindleEditions<T extends SplittableFormat>(
  rows: readonly T[],
): T[] {
  return rows.flatMap((f): T[] =>
    f.format === "ebook" && f.fulfillment === "direct" && f.amazonUrl
      ? [
          { ...f, amazonAsin: null, amazonUrl: null },
          {
            ...f,
            fulfillment: "amazon",
            availability: "available",
            priceCents: null,
            pageCount: null,
            isbn: null,
            masterFileKey: null,
          },
        ]
      : [f],
  );
}
