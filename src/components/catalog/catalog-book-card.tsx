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
 * Catalog book card — premium glass + CSS-rendered cover.
 *
 * Per the reference: large cover dominates the card; title / author /
 * formats beneath; absolute top-left "Bestseller / Popular / New" badge for
 * highlighted titles.
 *
 * ONE GEOMETRY. Every card is the same size at a given width — the cover is a
 * fixed 2:3 frame, and the title, the author line, the page-count line and the
 * chips each sit in an area reserved for the most they can need
 * (`.catalog-card*` in globals.css) — so a long title or a book with three print
 * editions cannot make a card taller than its neighbours, and the title,
 * author and chips start at the same height on every card in a row.
 *
 * What it does NOT carry any more: a wishlist heart and a lock. The heart was a
 * button with no handler (wishlist is "reserved for a future feature" in the
 * schema) and the lock's tooltip said "Locked — buy to unlock", which is not
 * true of a book that can only be bought on Amazon. Both sat on top of the
 * cover art and hid the end of the title or the author line on every cover.
 *
 * No client interactivity inside the card itself — hover lift + glow are
 * pure CSS via `.home-card-hover` (reused from the homepage system).
 */
export function CatalogBookCard({
  book,
  priority = false,
  onQuickView,
}: {
  book: CatalogItem;
  priority?: boolean;
  /** When given, a plain left click opens Quick View instead of navigating. */
  onQuickView?: (b: CatalogItem) => void;
}) {
  const hasRealCover = Boolean(book.coverSrc);
  const badges = formatBadges(book);
  const pages = pagesOf(badges);

  return (
    <article className="catalog-card home-card-hover home-glass group relative flex h-full flex-col overflow-hidden rounded-[22px] p-2.5 sm:p-3">
      {/* Issue 4 — the whole card navigates to the product detail page.
          An overlay link keeps the markup valid (the gift box, while a
          promotion runs, stays a real, separately-clickable button at a
          higher z-index) while making the entire card a single large click
          target. */}
      {/*
        STILL A REAL LINK. Crawlers follow it, ⌘-click and middle-click open
        the book page in a tab, and a visitor whose JavaScript never arrives
        gets the page rather than a dead card. Only a plain left click is
        intercepted, and only when a Quick View handler was actually passed —
        a card on a surface without the modal behaves exactly as before.
      */}
      <Link
        href={`/books/${book.slug}`}
        aria-label={`View ${book.title}`}
        title={book.title}
        onClick={(e) => {
          if (!onQuickView) return;
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onQuickView(book);
        }}
        className="absolute inset-0 z-[1] rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/50"
      />

      {/* Cover */}
      <div className="relative overflow-hidden rounded-[14px]">
        {/* The ground under the cover.

            When the book HAS real art this is a quiet, neutral frame — not
            the per-book gradient. The image above it is lazy-loaded, so
            whatever is painted here is what a visitor sees for the length of
            the request, and on a slow connection that was a page of
            saturated coloured rectangles that looked exactly like the
            placeholder covers Phase 4 set out to remove. An empty dark frame
            says "loading"; a coloured panel says "this is the cover", and one
            of those is a lie.

            When the book has NO art, the gradient and the typographic
            stand-in below are the deliberate design for that state. */}
        <div
          className="relative flex aspect-[2/3] flex-col justify-between p-4"
          style={{
            background: hasRealCover
              ? "linear-gradient(160deg, #12140f 0%, #0a0b08 100%)"
              : book.cover.gradient,
          }}
        >
          {/* Corner glow */}
          {!hasRealCover && (
            <div
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-50"
              style={{
                background: `radial-gradient(circle, ${book.cover.accent}50 0%, transparent 70%)`,
              }}
            />
          )}

          {/* Subtle library lines pattern — only on dark covers */}
          {!hasRealCover && !book.cover.darkText && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, transparent 0, transparent 12px, rgba(255,255,255,0.4) 12px, rgba(255,255,255,0.4) 13px)",
                maskImage:
                  "linear-gradient(180deg, transparent 0%, black 35%, black 70%, transparent 95%)",
              }}
            />
          )}

          {/* The typographic cover — category + title set on the gradient.
              It is a STAND-IN for missing art, so it is suppressed the moment
              real art exists. Both used to render, and because the text
              carries `z-10` and the image does not, every real cover in the
              catalog was published with a second, redundant title printed
              across artwork that already had one. */}
          {!hasRealCover && (
            <>
              <span
                className="relative z-10 text-[8px] font-semibold uppercase tracking-[0.2em]"
                style={{
                  color: book.cover.darkText
                    ? "rgba(0,0,0,0.45)"
                    : "rgba(255,255,255,0.45)",
                }}
              >
                {book.category}
              </span>

              {/* Painted lettering, not a heading: the title is the <h2> under the cover. */}
              <span
                aria-hidden
                className="relative z-10 block font-serif text-[20px] font-medium leading-[1.05] tracking-tight"
                style={{
                  color: book.cover.darkText ? "#1a1612" : "#ffffff",
                }}
              >
                {book.title}
              </span>
            </>
          )}

          {/* Right edge highlight — page thickness illusion */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-[2px] bottom-[2px] w-[2px]"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.14) 100%)",
            }}
          />
        </div>

        {/* The real cover (/images/books/{slug}.webp). `alt=""` because the
            title is announced by the heading directly beneath it — a screen
            reader hearing the title twice is not better served. */}
        {hasRealCover && (
          <Image
            src={book.coverSrc!}
            alt=""
            fill
            /* Measured, not guessed: the cover box is 145 CSS px at a 392px
               viewport (2-up grid inside px-4 with gap-5) = 37vw, and ~28vw in
               the 3-up `sm:` grid. 50vw over-fetched every card. */
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 28vw, 40vw"
            // The first row is above the fold on every viewport this store is
            // used at. Lazy-loading it is what produced the loading state
            // described above; `priority` removes it entirely for those cards.
            priority={priority}
            // The other eight cards are below the fold: say so, because on a slow link Chrome widens what
            // `loading="lazy"` may fetch early and they were taking the link from the first row's cover (the
            // LCP element). On the Redmi at 1.6 Mbps / 70 ms: /books LCP 3.78 s → 3.40 s (three samples each).
            fetchPriority={priority ? "high" : "low"}
            className={coverFit(book.coverSrc) === "contain" ? "object-contain" : "object-cover"}
          />
        )}

        {/* Floating badge */}
        {book.badge && <BadgePill {...book.badge} />}

      </div>

      {/* Meta — every area reserved; see `.catalog-card*` in globals.css. */}
      <div className="mt-3 flex flex-1 flex-col sm:mt-3.5">
        <h2 className="catalog-card__title font-serif font-medium text-fg-hi transition-colors group-hover:text-emerald-bright">
          {book.title}
        </h2>
        <p className="mt-1 truncate text-xs leading-4 text-fg-soft">{book.author}</p>

        {/* The quiet line: pages on the left, then whatever else the book
            has to say. `rating` is 0 for every book in this catalog, and a
            zero-star badge makes a book that nobody has reviewed look like a
            book everybody disliked, so it renders as nothing. The gift box
            stays: it removes itself when the promotion is not running (it
            consults the server clock, because this card can be served from a
            CDN an hour after the campaign ended), and while one IS running
            "free" is a fact about availability rather than a price tag. The
            row is tall enough for the gift box, so it never changes the card. */}
        <div className="mt-0.5 flex min-h-[26px] items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] leading-4 text-fg-mid">{pages}</span>
          <span className="flex shrink-0 items-center gap-2">
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

        {/* Format, not price. Pinned to the foot so the chips of every card in
            a row start at the same height. */}
        <div className="mt-auto pt-2">
          <CardFormatChips badges={badges} />
        </div>
      </div>
    </article>
  );
}

function BadgePill({
  label,
  tone,
}: {
  label: string;
  tone: "bestseller" | "popular" | "new";
}) {
  const tones = {
    bestseller: {
      bg: "rgba(22, 199, 132, 0.95)",
      color: "#03281b",
      shadow: "0 4px 12px rgba(22,199,132,0.4)",
    },
    popular: {
      bg: "rgba(94, 156, 245, 0.95)",
      color: "#06182f",
      shadow: "0 4px 12px rgba(94,156,245,0.4)",
    },
    new: {
      bg: "rgba(245, 200, 70, 0.95)",
      color: "#2a1f06",
      shadow: "0 4px 12px rgba(245,200,70,0.35)",
    },
  } as const;
  const t = tones[tone];
  return (
    <span
      className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[12px] lg:text-[9px] font-bold uppercase tracking-[0.12em]"
      style={{ background: t.bg, color: t.color, boxShadow: t.shadow }}
    >
      {label}
    </span>
  );
}
