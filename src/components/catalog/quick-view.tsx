"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { trackEvent } from "@/lib/analytics";
import { editionLabel } from "@/lib/format-badges";
import { formatCatalogPrice } from "@/lib/format";

import type { CatalogItem } from "./catalog-item";
import type { BookEdition } from "@/components/book-card";

/**
 * Quick View — where the price first appears.
 *
 * THE POINT OF THE REDESIGN IS THIS COMPONENT. Cards no longer carry a price,
 * so a visitor browsing the catalogue is reading a shelf rather than a price
 * list. The price is not hidden — it is deferred to the moment a reader has
 * shown interest in one particular book, which is here, one click in, beside
 * the interior pages and the facts that make a price mean something.
 *
 * EVERY NUMBER ON THIS PANEL IS READ, NOT WRITTEN. The format buttons come
 * from the book's own `book_formats` rows; the price on each button is that
 * row's own `price_cents`; the Amazon link is that row's own `amazon_url`.
 * There is no `$4.99` anywhere in this file, and there must never be: a
 * hard-coded price in a modal is a price that stops being true the first time
 * anybody changes one and nothing fails.
 *
 * THE GALLERY IS THE BOOK'S OWN, IN A FIXED ORDER: front cover, back cover, up to
 * two passages set in type from the manuscript, and — only when fewer than four
 * of those exist — its own interior pages (see `@/lib/book-media`). A book with
 * three panels shows three. Padding the gallery out to a tidy four with another
 * book's art, or with a repeat, would turn a sample into a claim.
 *
 * A CARD IS STILL A LINK. The grid keeps a real `<a href>` to the book page —
 * crawlers follow it, middle-click and ⌘-click open it, and a visitor with no
 * JavaScript gets the page rather than nothing. Only a plain left click is
 * intercepted, and the modal it opens is the shared `Dialog`.
 *
 * WHY THE LAYOUT IS WHAT IT IS (this used to freeze phones). The panel is a
 * flex column of three parts that never overlap:
 *
 *   HEADER   title + Close. `flex: none`, so the way out is on screen on every
 *            phone, in portrait and landscape, whatever the content's height.
 *   BODY     the one scroller: the pages, then the facts and editions. On a
 *            phone it is a single column; from `md` it is two columns that
 *            scroll independently.
 *   FOOTER   the price and the buy buttons. Pinned, so the thing the visitor
 *            came here to do cannot be scrolled — or clipped — out of reach.
 *
 * The previous version was a CSS grid with `overflow: hidden` and only a
 * `max-height`. On a phone its two rows did not fit; nothing could scroll; the
 * Buy and Close buttons were in the clipped second row; and the page behind it
 * was locked.
 */

export interface QuickViewProps {
  book: CatalogItem | null;
  onClose: () => void;
}

/** Display order: what we sell ourselves first, then print by weight. */
const FORMAT_ORDER: Record<BookEdition["format"], number> = {
  ebook: 0,
  paperback: 1,
  hardcover: 2,
  large_print: 3,
};

function isBuyable(e: BookEdition): boolean {
  return e.availability === "available";
}

/**
 * What stands where a price would, for an edition with none recorded.
 *
 * A Kindle edition of a book this site also sells directly carries no price
 * of its own (see `withKindleEditions` in the catalog queries): the only price
 * on that row was ours. "Not priced yet" would be false — Amazon prices it —
 * so the panel says where the price is instead of inventing one.
 */
function unpricedLabel(e: BookEdition): string {
  return e.fulfillment === "amazon" ? "Price on Amazon" : "Not priced yet";
}

const CTA_BASE =
  "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

export function QuickView({ book, onClose }: QuickViewProps) {
  return (
    <Dialog
      open={book !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      labelledBy={book ? `quick-view-${book.slug}` : undefined}
      size="xl"
    >
      {book ? <QuickViewContent book={book} /> : null}
    </Dialog>
  );
}

function QuickViewContent({ book }: { book: CatalogItem }) {
  const [selected, setSelected] = useState<number>(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const editions = (book.editions ?? [])
    .filter(isBuyable)
    .slice()
    .sort((a, b) => FORMAT_ORDER[a.format] - FORMAT_ORDER[b.format]);

  const current = editions[selected] ?? editions[0] ?? null;

  // NOTE ON RESETTING BETWEEN BOOKS: there is no effect here that zeroes
  // `selected` and `previewIndex` when the book changes, because the shell
  // mounts this component under `key={book.slug}`. React throws the old
  // instance away and the new one starts at its initial state — which is the
  // same outcome without a cascading render, and without a window in which
  // the panel shows one book's title beside another book's chosen edition.

  // The two commercial events the redesign exists to measure: the modal
  // opened, and a price became visible for the first time in the journey.
  // Fired once per mounted instance — the instance is the open.
  useEffect(() => {
    trackEvent("quick_view_open", { slug: book.slug });
    const first = (book.editions ?? []).filter(isBuyable)[0];
    if (first?.priceCents && first.priceCents > 0) {
      trackEvent("price_revealed", {
        slug: book.slug,
        format: first.format,
        price_cents: first.priceCents,
      });
    }
  }, [book]);

  const panels = book.panels ?? [];
  const hasPanels = panels.length > 0;
  const safeIndex = Math.min(previewIndex, Math.max(panels.length - 1, 0));
  const heading = `quick-view-${book.slug}`;

  const selectEdition = (i: number) => {
    setSelected(i);
    const e = editions[i];
    if (!e) return;
    trackEvent("format_selected", { slug: book.slug, format: e.format });
    if (e.priceCents && e.priceCents > 0) {
      trackEvent("price_revealed", {
        slug: book.slug,
        format: e.format,
        price_cents: e.priceCents,
      });
    }
  };

  const step = (delta: number) =>
    setPreviewIndex((i) => Math.max(0, Math.min(panels.length - 1, i + delta)));

  /**
   * Swipe between pages on a phone. Only a gesture that is clearly HORIZONTAL
   * counts: a thumb scrolling the dialog moves a little sideways too, and the
   * old handler turned that into a page flip.
   */
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!start || !t || panels.length < 2) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    step(dx < 0 ? 1 : -1);
  };

  return (
    <>
      {/* ------------------------------ header -------------------------------
          Never scrolls. The Close button lives here, not in the offer column,
          so it cannot be clipped, scrolled away or hidden behind the content. */}
      <div className="flex flex-none items-start gap-3 border-b border-white/[0.06] py-3 pl-4 pr-2 sm:py-4 sm:pl-6 sm:pr-4">
        <div className="min-w-0 flex-1">
          {book.category && (
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-emerald-bright/80">
              {book.category}
            </p>
          )}
          <h2
            id={heading}
            className="mt-1.5 line-clamp-2 font-serif text-[20px] font-medium leading-tight text-fg-hi sm:text-[26px]"
          >
            {book.title}
          </h2>
          <p className="mt-1 truncate text-[12.5px] text-fg-soft">{book.author}</p>
        </div>
        <DialogClose aria-label="Close quick view" />
      </div>

      {/* -------------------------------- body --------------------------------
          One column that scrolls on a phone; two independent scrollers from md. */}
      <DialogBody className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
        {/* ----------------------- the book's own pages --------------------- */}
        <section
          aria-label="Preview"
          className="bg-black/25 p-4 sm:p-6 md:min-h-0 md:overflow-y-auto"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {hasPanels ? (
            <>
              {/* The panel is shown whole: covers are 2:3 and so are the passage
                  cards, so `object-contain` inside a bounded height never crops a
                  title or an author line. */}
              <div className="relative flex justify-center overflow-hidden rounded-[10px] border border-white/[0.07]">
                {/* eslint-disable-next-line @next/next/no-img-element -- a
                    WebP served straight from /public at the size it renders;
                    next/image would add a loader hop for bytes that are
                    already right, inside a modal that must open now. */}
                <img
                  src={panels[safeIndex].src}
                  alt={panels[safeIndex].alt}
                  className="block h-auto max-h-[min(38dvh,380px)] w-auto max-w-full object-contain sm:max-h-[min(54dvh,520px)]"
                  decoding="async"
                />
                {panels.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => step(-1)}
                      disabled={safeIndex === 0}
                      aria-label="Previous view"
                      className="absolute left-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-fg-hi backdrop-blur transition-opacity hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-emerald-bright disabled:pointer-events-none disabled:opacity-0"
                    >
                      <ChevronLeft aria-hidden className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => step(1)}
                      disabled={safeIndex === panels.length - 1}
                      aria-label="Next view"
                      className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-fg-hi backdrop-blur transition-opacity hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-emerald-bright disabled:pointer-events-none disabled:opacity-0"
                    >
                      <ChevronRight aria-hidden className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
              {panels.length > 1 && (
                <div className="mt-3 flex items-center gap-2" role="group" aria-label="Views of the book">
                  {panels.map((panel, i) => (
                    <button
                      key={panel.src}
                      type="button"
                      onClick={() => setPreviewIndex(i)}
                      aria-label={`Show ${panel.caption.toLowerCase()}`}
                      aria-current={i === safeIndex || undefined}
                      className={`relative h-14 w-10 overflow-hidden rounded-[5px] border transition-colors ${
                        i === safeIndex
                          ? "border-emerald-bright/70"
                          : "border-white/[0.08] hover:border-white/[0.25]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
                      <img
                        src={panel.src}
                        alt=""
                        aria-hidden
                        className="h-full w-full object-cover object-top"
                        decoding="async"
                      />
                    </button>
                  ))}
                  <span className="ml-auto text-[11px] tabular-nums text-fg-fade" aria-live="polite">
                    {safeIndex + 1} / {panels.length}
                  </span>
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-fg-fade" aria-live="polite">
                {panels[safeIndex].caption}
              </p>
            </>
          ) : (
            // No cover and no preview exist for this title. Say so; a stock image
            // would be a claim about a book's look that nothing backs.
            <div className="flex items-center justify-center py-2">
              <p className="text-sm text-fg-fade">No preview available yet.</p>
            </div>
          )}
        </section>

        {/* ---------------------------- the offer -------------------------- */}
        <section aria-label="Editions" className="p-4 sm:p-7 md:min-h-0 md:overflow-y-auto">
          {book.subtitle && (
            <p className="text-[13.5px] leading-relaxed text-fg-mid">{book.subtitle}</p>
          )}

          {/* The facts. Only ones the database actually holds. */}
          <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-3 border-y border-white/[0.06] py-4">
            {book.pageCount ? <Fact label="Pages" value={String(book.pageCount)} /> : null}
            <Fact label="Editions" value={String(editions.length || "—")} />
            {book.hasEpub ? <Fact label="Digital" value="PDF + EPUB" /> : null}
          </dl>

          {editions.length > 0 ? (
            <>
              <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">
                Choose an edition
              </h3>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Editions">
                {editions.map((e, i) => {
                  const active = i === selected;
                  return (
                    <button
                      key={`${e.format}-${e.fulfillment}`}
                      type="button"
                      onClick={() => selectEdition(i)}
                      aria-pressed={active}
                      className={`min-h-11 rounded-lg border px-3.5 py-2 text-left transition-colors ${
                        active
                          ? "border-emerald-bright/60 bg-emerald-bright/[0.09]"
                          : "border-white/[0.09] bg-white/[0.02] hover:border-white/[0.22]"
                      }`}
                    >
                      <span className="block text-[12.5px] font-medium text-fg-hi">
                        {editionLabel(e, Boolean(book.hasEpub))}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] tabular-nums text-fg-soft">
                        {e.priceCents && e.priceCents > 0
                          ? formatCatalogPrice(e.priceCents, e.currency)
                          : e.fulfillment === "amazon"
                            ? "on Amazon"
                            : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {current?.fulfillment === "direct" && !book.buyableHere && (
                <p className="mt-4 text-[12px] leading-relaxed text-fg-soft">
                  This edition isn’t on sale through this site at the moment.
                  The book page lists every place it can be bought.
                </p>
              )}
            </>
          ) : (
            <p className="mt-5 text-[13px] leading-relaxed text-fg-mid">
              No edition of this book is on sale right now.
            </p>
          )}
        </section>
      </DialogBody>

      {/* ------------------------------ footer --------------------------------
          Pinned: the price and the way to buy are never scrolled out of reach. */}
      <DialogFooter className="border-t border-white/[0.07] bg-[#0a0f0c]">
        <div className="flex flex-col gap-3 px-4 pb-4 pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          {current ? (
            <p className="text-[13px] text-fg-mid">
              <span className="font-serif text-[24px] tabular-nums text-fg-hi sm:text-[26px]">
                {current.priceCents && current.priceCents > 0
                  ? formatCatalogPrice(current.priceCents, current.currency)
                  : unpricedLabel(current)}
              </span>
              <span className="ml-2 text-[12.5px] text-fg-soft">
                {current.fulfillment === "direct"
                  ? "· download here, DRM-free"
                  : current.format === "ebook"
                    ? // Nothing is shipped: the same wording the editions
                      // table uses for this row.
                      "· Kindle edition, sold by Amazon"
                    : "· sold and shipped by Amazon"}
              </span>
            </p>
          ) : (
            <span />
          )}

          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            {current?.fulfillment === "amazon" && current.amazonUrl ? (
              <a
                href={current.amazonUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent("amazon_click", {
                    slug: book.slug,
                    format: current.format,
                  })
                }
                className={`${CTA_BASE} w-full bg-[#c9a24a] text-[#0b1d16] hover:bg-[#d7b05b] focus-visible:outline-[#c9a24a] sm:w-auto`}
              >
                Buy on Amazon
                <span className="sr-only">
                  {`: ${book.title}, ${editionLabel(current, Boolean(book.hasEpub))} edition (opens amazon.com in a new tab)`}
                </span>
              </a>
            ) : null}

            {/* A direct edition only gets a buy route when it is wired to a
                live checkout. `buyableHere` is `provider_price_id is not null`
                — between retiring one payment provider and provisioning the
                next, a book is priced, deliverable and unbuyable all at once,
                and a button that cannot take money is the defect this
                catalogue exists to prevent. */}
            {current?.fulfillment === "direct" && book.buyableHere ? (
              <Link
                href={`/books/${book.slug}`}
                onClick={() => trackEvent("direct_checkout_click", { slug: book.slug })}
                className={`${CTA_BASE} w-full bg-emerald-bright text-[#03281b] hover:brightness-110 focus-visible:outline-emerald-bright sm:w-auto`}
              >
                Buy the digital edition
              </Link>
            ) : null}

            <Link
              href={`/books/${book.slug}`}
              className={`${CTA_BASE} w-full border border-white/[0.14] font-medium text-fg-hi hover:border-white/[0.3] focus-visible:outline-emerald-bright sm:w-auto`}
            >
              Full details
            </Link>
          </div>
        </div>
      </DialogFooter>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.2em] text-fg-fade">{label}</dt>
      <dd className="mt-1 text-[14px] tabular-nums text-fg-hi">{value}</dd>
    </div>
  );
}
