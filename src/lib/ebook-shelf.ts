/**
 * What belongs on /ebooks.
 *
 * It used to be "a direct-sale ebook edition" — the shelf a reader could BUY FROM
 * on this site — and a pin on a book whose ebook is Amazon's alone could never
 * pull it in (`PINNED_BOOK_SLUGS` still says so: a pin only orders what a shelf
 * already chose). The shelf is now every published book that has an ebook edition
 * a reader can OBTAIN: sold here as a watermarked PDF, or a Kindle edition with a
 * verified Amazon page. The cards and the quick view already say which (the Kindle
 * chip reads "on Amazon"; the buy button says "Buy on Amazon"), and the page copy
 * says it up front, so a Kindle Unlimited novel is never presented as a download
 * from this site.
 *
 * Nothing about KDP Select changes: LISTING a Select title's Kindle edition and
 * linking to it is not selling or giving it away, and no file is made available
 * from here (`valice-catalog.test.ts` still refuses a direct-sale Select ebook).
 */
export interface FormatRowLike {
  format: string;
  availability: string;
  fulfillment: string;
  amazonUrl?: string | null;
}

export function hasObtainableEbook(formats: readonly FormatRowLike[]): boolean {
  return formats.some(
    (f) =>
      f.format === "ebook" &&
      f.availability === "available" &&
      (f.fulfillment === "direct" || Boolean(f.amazonUrl)),
  );
}
