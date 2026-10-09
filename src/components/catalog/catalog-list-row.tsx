"use client";

import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { GiftBox } from "@/components/campaign/gift-box";
import { coverFit } from "@/lib/asset-map";
import { formatBadges } from "@/lib/format-badges";

import { CardFormatChips, pagesOf } from "./card-format-chips";
import type { CatalogItem } from "./catalog-item";

/**
 * The catalogue's list view: the same book, laid out as a row.
 *
 * It follows the SAME geometry as the grid card (`.catalog-card*` in
 * globals.css): a fixed 2:3 cover frame, and a text column in which the title,
 * the author, the page-count line and the chips each have the room they can
 * need reserved — so every row at a given width is the same height whatever the
 * book, and the title, author and chips start at the same place in every row.
 *
 * Two things it used to do that it no longer does:
 *   - it painted a typographic stand-in (a gradient with the first two words of
 *     the title) even for books that have real cover art — a cover that is not
 *     the cover. The real cover is shown whenever there is one; the stand-in is
 *     only for a book with no art, exactly as in the grid.
 *   - it had no link to the book's page at all, only a "Quick view" button. The
 *     whole row is now one link, like a grid card: a plain click opens Quick
 *     View, a modified click (new tab, ⌘-click) or no JavaScript goes to the
 *     page.
 */
export function CatalogListRow({
  book,
  onQuickView,
}: {
  book: CatalogItem;
  onQuickView: (b: CatalogItem) => void;
}) {
  const hasRealCover = Boolean(book.coverSrc);
  const badges = formatBadges(book);
  const pages = pagesOf(badges);

  return (
    <article className="catalog-row home-card-hover home-glass group relative flex items-center gap-3 rounded-2xl p-3 sm:gap-4 sm:p-4">
      <Link
        href={`/books/${book.slug}`}
        aria-label={`View ${book.title}`}
        title={book.title}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onQuickView(book);
        }}
        className="absolute inset-0 z-[1] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/50"
      />

      <div
        className="relative aspect-[2/3] w-[68px] shrink-0 overflow-hidden rounded-lg sm:w-[84px]"
        style={{
          background: hasRealCover
            ? "linear-gradient(160deg, #12140f 0%, #0a0b08 100%)"
            : book.cover.gradient,
        }}
      >
        {hasRealCover ? (
          <Image
            src={book.coverSrc!}
            alt=""
            fill
            sizes="84px"
            className={coverFit(book.coverSrc) === "contain" ? "object-contain" : "object-cover"}
          />
        ) : (
          <div className="flex h-full flex-col justify-between p-2 text-[8px]">
            <span
              className="font-semibold uppercase tracking-[0.12em]"
              style={{ color: book.cover.darkText ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.5)" }}
            >
              {book.category.slice(0, 3)}
            </span>
            <span
              className="font-serif text-[10px] leading-tight"
              style={{ color: book.cover.darkText ? "#1a1612" : "#fff" }}
            >
              {book.title.split(" ").slice(0, 2).join(" ")}
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col self-stretch">
        <h2 className="catalog-card__title font-serif font-medium text-fg-hi transition-colors group-hover:text-emerald-bright">
          {book.title}
        </h2>
        <p className="mt-1 truncate text-xs leading-4 text-fg-soft sm:text-sm sm:leading-5">{book.author}</p>

        <div className="mt-0.5 flex min-h-[26px] items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] leading-4 text-fg-mid">{pages}</span>
          <span className="flex shrink-0 items-center gap-2">
            {/* Hidden entirely with no reviews — see <CatalogBookCard>. */}
            {book.rating > 0 && (
              <span className="flex items-center gap-1 text-xs text-fg-mid">
                <Star aria-hidden className="h-3 w-3 fill-[#f4c44b] text-[#f4c44b]" />
                <span className="tabular-nums">{book.rating.toFixed(1)}</span>
              </span>
            )}
            <GiftBox
              book={{
                slug: book.slug,
                title: book.title,
                author: book.author,
                priceCents: book.priceCents,
                deliverableFree: book.deliverableFree,
                coverSrc: book.coverSrc ?? null,
              }}
            />
          </span>
        </div>

        <div className="mt-auto pt-2">
          <CardFormatChips badges={badges} />
        </div>
      </div>
    </article>
  );
}
