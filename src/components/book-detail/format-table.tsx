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
  const hasPrint = formats.some((f) => f.fulfillment === "amazon" && f.format !== "ebook");

  return (
    <section
      id="editions"
      aria-labelledby="formats-heading"
      className="mx-auto mt-10 max-w-[1180px] scroll-mt-36 px-4 sm:mt-14 sm:px-6"
    >
      <div className="home-glass overflow-hidden rounded-[22px]">
        <div className={`grid ${hasPrint ? "lg:grid-cols-[minmax(0,_1fr)_minmax(0,_260px)]" : ""}`}>
          <div className="p-5 sm:p-8">
            <header className="flex items-start gap-4">
              <span aria-hidden className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-emerald-bright">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3 3 8l9 5 9-5-9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5" />
                </svg>
              </span>
              <div>
                <h2 id="formats-heading" className="font-serif text-[26px] font-medium leading-tight text-fg-hi sm:text-[30px]">
                  Editions
                </h2>
                <p className="mt-1 text-[14px] text-fg-mid sm:text-[15px]">Choose your preferred format.</p>
              </div>
            </header>

            <ul className="mt-6 divide-y divide-white/[0.06] border-t border-white/[0.06]">
              {formats.map((f) => {
                const href = amazonHref(f);
                const buyable = f.availability === "available";
                const isDirect = f.fulfillment === "direct";
                const showPrice = f.priceCents !== null && (!isDirect || sellsDirectEbook);

                return (
                  <li
                    // Format alone is not unique: a book sold here as a PDF can
                    // also be a live Kindle edition, which is a second ebook row.
                    key={`${f.format}-${f.fulfillment}`}
                    className="flex flex-wrap items-center gap-x-5 gap-y-3 py-5"
                  >
                    <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-fg-mid">
                      <FormatGlyph format={f.format} />
                    </span>

                    <div className="min-w-0 flex-1 basis-[200px]">
                      <p className="font-serif text-[19px] text-fg-hi">{formatLabel(f)}</p>
                      <p className="mt-0.5 text-[13px] leading-snug text-fg-soft">
                        {formatNote(f, sellsDirectEbook)}
                        {f.pageCount ? ` · ${f.pageCount} pages` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      {/* Only a price we would actually charge. For a direct ebook
                          we no longer sell, the number is a leftover list price and
                          printing it contradicts the panel above. Amazon rows keep
                          theirs — that is Amazon's price and it is real. */}
                      {showPrice && (
                        <span className="min-w-[3.5rem] text-right font-serif text-[19px] tabular-nums text-fg-hi">
                          {formatPrice(f.priceCents as number, f.currency)}
                        </span>
                      )}

                      {/* Direct ebook, buyable now → the real add-to-cart. */}
                      {isDirect && buyable && sellsDirectEbook && addToCartSlot && <div className="w-[210px]">{addToCartSlot}</div>}

                      {/* Amazon edition, live → link out, clearly marked. */}
                      {!isDirect && buyable && href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="home-cta-secondary inline-flex h-11 items-center gap-2.5 rounded-full px-5 text-sm font-medium"
                        >
                          <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[12px] font-bold leading-none">
                            a
                          </span>
                          Buy on Amazon
                          <span aria-hidden>↗</span>
                          {/* Every row's button reads "Buy on Amazon"; a screen
                              reader listing the page's links hears which edition
                              each one buys, and that it leaves the site. */}
                          <span className="sr-only">{`: ${title}, ${formatLabel(f)} edition (opens amazon.com in a new tab)`}</span>
                        </a>
                      )}

                      {/* Everything else: the edition exists, you cannot buy it
                          here yet, and we say which of those two it is rather
                          than showing a button that goes nowhere. */}
                      {!buyable && <span className="text-[13px] text-fg-fade">Not yet available</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* About PRINT, so it waits for a print edition: a Kindle row alone
              goes to Amazon too, but is not printed or shipped by anyone. */}
          {hasPrint && (
            // A note, not a landmark: it sits inside the editions section, and a complementary landmark
            // nested in another landmark is what screen-reader landmark lists get wrong.
            <div role="note" className="flex gap-3 border-t border-white/[0.06] p-5 text-[13px] leading-relaxed text-fg-mid sm:p-8 lg:border-l lg:border-t-0">
              <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-fg-soft" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
                <circle cx="7" cy="17.5" r="1.6" />
                <circle cx="17" cy="17.5" r="1.6" />
              </svg>
              <p>
                Print editions are printed and shipped by Amazon. Valice Press cannot fulfil a print order placed on this site, so those buttons take
                you to Amazon to complete the purchase there.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** A small drawing of the kind of edition: a phone for Kindle, a PDF page for ours, an open book for print. */
function FormatGlyph({ format }: { format: BookFormat["format"] }) {
  const common = { viewBox: "0 0 24 24", className: "h-6 w-6", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (format === "ebook") {
    return (
      <svg {...common}>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M11 18h2" />
      </svg>
    );
  }
  if (format === "large_print") {
    return (
      <svg {...common}>
        <path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />
        <path d="M7 9h2M15 9h2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />
    </svg>
  );
}
