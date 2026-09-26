"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { trackEvent } from "@/lib/analytics";
import { coverFit } from "@/lib/asset-map";
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
 * THE PREVIEWS ARE THE BOOK'S OWN PAGES. Rendered from the same PDF the buyer
 * receives, at ranges a person chose and read first (see
 * `scripts/catalog/preview-pages.mjs`). A book with two of them shows two.
 * Padding the panel out to a tidy four with another book's art, or with a
 * repeat, would turn a sample into a claim.
 *
 * A CARD IS STILL A LINK. The grid keeps a real `<a href>` to the book page —
 * crawlers follow it, middle-click and ⌘-click open it, and a visitor with no
 * JavaScript gets the page rather than nothing. Only a plain left click is
 * intercepted, and the modal it opens is a real dialog: labelled, modal,
 * focus moved in and returned, focus trapped, Escape and backdrop close, the
 * page behind it locked from scrolling.
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

export function QuickView({ book, onClose }: QuickViewProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const returnFocusTo = useRef<Element | null>(null);
  const [selected, setSelected] = useState<number>(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const editions = (book?.editions ?? [])
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
  useEffect(() => {
    if (!book) return;
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

  const close = useCallback(() => {
    onClose();
    const target = returnFocusTo.current;
    if (target instanceof HTMLElement) target.focus();
  }, [onClose]);

  useEffect(() => {
    if (!book) return;

    returnFocusTo.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const focusTimer = setTimeout(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>("[data-quickview-initial-focus]")
        ?.focus();
    }, 30);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      clearTimeout(focusTimer);
    };
  }, [book, close]);

  if (!book) return null;

  const previews = book.previews ?? [];
  const hasPreviews = previews.length > 0;
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

  /** Swipe between interior pages on a phone. */
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null || previews.length < 2) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(dx) < 40) return;
    setPreviewIndex((i) =>
      dx < 0
        ? Math.min(i + 1, previews.length - 1)
        : Math.max(i - 1, 0),
    );
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close quick view"
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 cursor-default bg-black/72 backdrop-blur-[2px]"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={heading}
        className="home-glass relative grid w-full max-w-[1020px] overflow-hidden rounded-t-[22px] sm:rounded-[22px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
        style={{ maxHeight: "min(92vh, 760px)", background: "#0a0f0c" }}
      >
        {/* ------------------- left: the book's own pages ------------------ */}
        {/*
          The panel scrolls, and the page image is capped, because the modal
          itself is capped at min(92vh, 760px) with overflow hidden: an
          uncapped 900×1350 page pushed the thumbnail strip past the rounded
          bottom edge and cut it in half. Measured in the browser, not
          assumed — the strip was visibly clipped at 1568×770.
        */}
        <div
          className="relative flex flex-col overflow-y-auto bg-black/30 p-5 sm:p-6"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {hasPreviews ? (
            <>
              <div className="relative flex justify-center overflow-hidden rounded-[10px] border border-white/[0.07]">
                {/* eslint-disable-next-line @next/next/no-img-element -- a
                    900×1350 WebP served straight from /public at the size it
                    renders; next/image would add a loader hop for bytes that
                    are already right, inside a modal that must open now. */}
                <img
                  src={previews[Math.min(previewIndex, previews.length - 1)]}
                  alt={`Interior page from ${book.title}`}
                  className="block h-auto max-h-[46vh] w-auto max-w-full object-contain sm:max-h-[52vh]"
                  decoding="async"
                />
              </div>
              {previews.length > 1 && (
                <div className="mt-3 flex gap-2">
                  {previews.map((src, i) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setPreviewIndex(i)}
                      aria-label={`Interior page ${i + 1} of ${previews.length}`}
                      aria-current={i === previewIndex || undefined}
                      className={`relative h-14 w-10 overflow-hidden rounded-[5px] border transition-colors ${
                        i === previewIndex
                          ? "border-emerald-bright/70"
                          : "border-white/[0.08] hover:border-white/[0.25]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
                      <img
                        src={src}
                        alt=""
                        aria-hidden
                        className="h-full w-full object-cover object-top"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-fg-fade">
                {previews.length === 1
                  ? "One real page from the book, rendered from the file you would receive."
                  : `${previews.length} real pages from the book, rendered from the file you would receive.`}
              </p>
            </>
          ) : (
            // No previews exist for this title yet. The cover is the honest
            // thing to show; a stock "interior" image would be a lie about a
            // book's typography, which is most of what this press sells.
            <div className="flex flex-1 items-center justify-center">
              {book.coverSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- the committed cover asset
                <img
                  src={book.coverSrc}
                  alt={`Cover of ${book.title}`}
                  className={`max-h-[420px] w-auto rounded-[8px] object-${coverFit(book.coverSrc)}`}
                  decoding="async"
                />
              ) : (
                <p className="text-sm text-fg-fade">No preview available yet.</p>
              )}
            </div>
          )}
        </div>

        {/* ----------------------- right: the offer ------------------------ */}
        <div className="relative overflow-y-auto p-5 sm:p-7">
          <button
            type="button"
            onClick={close}
            aria-label="Close quick view"
            data-quickview-initial-focus
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-fg-soft transition-colors hover:bg-white/[0.07] hover:text-fg-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-bright"
          >
            <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>

          {book.category && (
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-emerald-bright/80">
              {book.category}
            </p>
          )}
          <h2
            id={heading}
            className="mt-2.5 pr-10 font-serif text-[22px] font-medium leading-tight text-fg-hi sm:text-[26px]"
          >
            {book.title}
          </h2>
          {book.subtitle && (
            <p className="mt-2 text-[13.5px] leading-relaxed text-fg-mid">
              {book.subtitle}
            </p>
          )}
          <p className="mt-2 text-[12.5px] text-fg-soft">{book.author}</p>

          {/* The facts. Only ones the database actually holds. */}
          <dl className="mt-5 flex flex-wrap gap-x-7 gap-y-3 border-y border-white/[0.06] py-4">
            {book.pageCount ? (
              <Fact label="Pages" value={String(book.pageCount)} />
            ) : null}
            <Fact
              label="Editions"
              value={String(editions.length || "—")}
            />
            {book.hasEpub ? <Fact label="Digital" value="PDF + EPUB" /> : null}
          </dl>

          {/* --------- format selection, and the price that comes with it --- */}
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
                      className={`rounded-lg border px-3.5 py-2 text-left transition-colors ${
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

              {current && (
                <p className="mt-4 text-[13px] text-fg-mid">
                  <span className="font-serif text-[26px] tabular-nums text-fg-hi">
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
              )}

              {/* --------------------------- the CTAs -------------------- */}
              <div className="mt-5 flex flex-wrap gap-2.5">
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
                    className="rounded-full bg-[#c9a24a] px-5 py-2.5 text-[13px] font-semibold text-[#0b1d16] transition-colors hover:bg-[#d7b05b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a24a]"
                  >
                    Buy on Amazon
                    <span className="sr-only">
                      {`: ${book.title}, ${editionLabel(current, Boolean(book.hasEpub))} edition (opens amazon.com in a new tab)`}
                    </span>
                  </a>
                ) : null}

                {/* A direct edition only gets a buy route when it is wired to
                    a live checkout. `buyableHere` is `provider_price_id is
                    not null` — between retiring one payment provider and
                    provisioning the next, a book is priced, deliverable and
                    unbuyable all at once, and a button that cannot take money
                    is the defect this catalogue exists to prevent. */}
                {current?.fulfillment === "direct" && book.buyableHere ? (
                  <Link
                    href={`/books/${book.slug}`}
                    onClick={() =>
                      trackEvent("direct_checkout_click", { slug: book.slug })
                    }
                    className="rounded-full bg-emerald-bright px-5 py-2.5 text-[13px] font-semibold text-[#03281b] transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-bright"
                  >
                    Buy the digital edition
                  </Link>
                ) : null}

                <Link
                  href={`/books/${book.slug}`}
                  className="rounded-full border border-white/[0.14] px-5 py-2.5 text-[13px] font-medium text-fg-hi transition-colors hover:border-white/[0.3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-bright"
                >
                  Full details
                </Link>
              </div>

              {current?.fulfillment === "direct" && !book.buyableHere && (
                <p className="mt-3 text-[12px] leading-relaxed text-fg-soft">
                  This edition isn’t on sale through this site at the moment.
                  The book page lists every place it can be bought.
                </p>
              )}
            </>
          ) : (
            <div className="mt-5">
              <p className="text-[13px] leading-relaxed text-fg-mid">
                No edition of this book is on sale right now.
              </p>
              <Link
                href={`/books/${book.slug}`}
                className="mt-4 inline-block rounded-full border border-white/[0.14] px-5 py-2.5 text-[13px] font-medium text-fg-hi transition-colors hover:border-white/[0.3]"
              >
                Full details
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.2em] text-fg-fade">
        {label}
      </dt>
      <dd className="mt-1 text-[14px] tabular-nums text-fg-hi">{value}</dd>
    </div>
  );
}
