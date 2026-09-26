import type { BookFormat } from "@/lib/db/queries/catalog";
import { formatPrice } from "@/lib/format";

/**
 * The editions a book is available in, and how each one is bought.
 *
 * The central rule this component exists to enforce: **a print edition is
 * never an add-to-cart.** Amazon's KDP print pipeline only fulfils orders
 * placed on Amazon — it has no mechanism to ship a book ordered on this
 * site. So `fulfillment === "amazon"` renders a link out, labelled so the
 * reader knows they are leaving, and `fulfillment === "direct"` renders the
 * add-to-cart the storefront can actually honour.
 *
 * The second rule: no button without a destination. A print edition that
 * has been typeset but not yet uploaded to KDP has no ASIN, so there is
 * nowhere for a "Buy on Amazon" button to go. Those render as a stated
 * forthcoming edition instead of a button that 404s on Amazon.
 */

const FORMAT_LABELS: Record<BookFormat["format"], string> = {
  ebook: "Ebook",
  paperback: "Paperback",
  hardcover: "Hardcover",
  large_print: "Large print",
};

/**
 * The row's name. An ebook Amazon sells is the Kindle edition — the name on
 * Amazon's own format switcher — and a book this site ALSO sells directly
 * now lists both, so "Ebook" twice would not tell a reader which is which.
 * Quick View's `editionLabel` draws the same line.
 */
function formatLabel(f: BookFormat): string {
  return f.format === "ebook" && f.fulfillment === "amazon"
    ? "Kindle"
    : FORMAT_LABELS[f.format];
}

/**
 * What the reader actually gets, in one line.
 *
 * The ebook line depends on who is selling it, not on the format. Our ebook
 * is a DRM-free watermarked PDF; Amazon's is a Kindle file with Kindle's
 * restrictions. Describing the second as the first would be a straight
 * misdescription of the product — and it is a live case, because Codex
 * Mythologica's Kindle edition is enrolled in KDP Select and therefore can
 * only ever be bought from Amazon.
 */
function formatNote(f: BookFormat, sellsDirectEbook: boolean): string {
  switch (f.format) {
    case "ebook":
      if (f.fulfillment !== "direct") return "Kindle edition, sold by Amazon";
      // A price beside a row nobody can buy is the contradiction this fixes:
      // the panel above says "Not sold here" while this line offered $9.99.
      return sellsDirectEbook
        ? "DRM-free watermarked PDF — yours to keep, readable on any device"
        : "DRM-free watermarked PDF — not sold through this site at the moment";
    case "paperback":
      return "Printed and shipped by Amazon";
    case "hardcover":
      return "Printed and shipped by Amazon";
    case "large_print":
      return "Larger type, printed and shipped by Amazon";
  }
}

function amazonHref(f: BookFormat): string | null {
  if (f.amazonUrl) return f.amazonUrl;
  if (f.amazonAsin) return `https://www.amazon.com/dp/${f.amazonAsin}`;
  return null;
}

export function FormatTable({
  title,
  formats,
  sellsDirectEbook = true,
  addToCartSlot,
}: {
  /** The book's title — names each Amazon link for a screen reader. */
  title: string;
  formats: BookFormat[];
  /**
   * Whether the direct ebook row is one this site will actually take money
   * for. False for the public-domain titles held out of the paid checkout on
   * 2026-09-12 — they keep their row, their description and their page count,
   * and lose the price, because the price is the one part that stopped being
   * true. Amazon rows are unaffected: that price is Amazon's and it is real.
   */
  sellsDirectEbook?: boolean;
  /**
   * The real add-to-cart island, rendered for the direct ebook row. Passed
   * in rather than imported so this stays a Server Component and the
   * client boundary remains exactly where it already was.
   */
  addToCartSlot?: React.ReactNode;
}) {
  if (formats.length === 0) return null;

  return (
    <section aria-labelledby="formats-heading" className="mt-12">
      <h2
        id="formats-heading"
        className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-bright"
      >
        Editions
      </h2>

      <ul className="mt-5 divide-y divide-white/[0.06] border-y border-white/[0.06]">
        {formats.map((f) => {
          const href = amazonHref(f);
          const buyable = f.availability === "available";
          const isDirect = f.fulfillment === "direct";

          return (
            <li
              // Format alone is not unique: a book sold here as a PDF can
              // also be a live Kindle edition, which is a second ebook row.
              key={`${f.format}-${f.fulfillment}`}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-serif text-[17px] text-fg-hi">
                  {formatLabel(f)}
                </p>
                <p className="mt-0.5 text-[13px] text-fg-soft">
                  {formatNote(f, sellsDirectEbook)}
                  {f.pageCount ? ` · ${f.pageCount} pages` : ""}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* Only a price we would actually charge. For a direct ebook
                    we no longer sell, the number is a leftover list price and
                    printing it contradicts the panel above. Amazon rows keep
                    theirs — that is Amazon's price and it is real. */}
                {f.priceCents !== null && (!isDirect || sellsDirectEbook) && (
                  <span className="font-serif text-[17px] tabular-nums text-fg-hi">
                    {formatPrice(f.priceCents, f.currency)}
                  </span>
                )}

                {/* Direct ebook, buyable now → the real add-to-cart. */}
                {isDirect && buyable && addToCartSlot}

                {/* Amazon edition, live → link out, clearly marked. */}
                {!isDirect && buyable && href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="home-cta-secondary inline-flex h-11 items-center rounded-full px-5 text-sm font-medium sm:h-10"
                  >
                    Buy on Amazon
                    <span aria-hidden className="ml-1.5">
                      ↗
                    </span>
                    {/* Every row's button reads "Buy on Amazon"; a screen
                        reader listing the page's links hears which edition
                        each one buys, and that it leaves the site. */}
                    <span className="sr-only">
                      {`: ${title}, ${formatLabel(f)} edition (opens amazon.com in a new tab)`}
                    </span>
                  </a>
                )}

                {/* Everything else: the edition exists, you cannot buy it
                    here yet, and we say which of those two it is rather
                    than showing a button that goes nowhere. */}
                {!buyable && (
                  <span className="text-[13px] text-fg-fade">Not yet available</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* About PRINT, so it waits for a print edition: a Kindle row alone
          goes to Amazon too, but is not printed or shipped by anyone. */}
      {formats.some((f) => f.fulfillment === "amazon" && f.format !== "ebook") && (
        <p className="mt-4 text-[13px] leading-relaxed text-fg-soft">
          Print editions are printed and shipped by Amazon. Valice Press
          cannot fulfil a print order placed on this site, so those buttons
          take you to Amazon to complete the purchase there.
        </p>
      )}
    </section>
  );
}
