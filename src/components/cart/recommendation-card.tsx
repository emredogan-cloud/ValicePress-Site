"use client";

import { Check, ExternalLink, Plus, Star } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { addToCart, type AddToCartResult } from "@/app/cart/actions";
import type { CatalogItem } from "@/components/catalog/catalog-item";
import { cartChanged, useInCart } from "@/components/cart/cart-store";
import { CoverArt } from "@/components/cinematic/cover-art";
import { trackEvent } from "@/lib/analytics";
import { shortAddToCartMessage } from "@/lib/cart-copy";
import { formatCatalogPrice } from "@/lib/format";
import { isAddable } from "@/lib/sellable";

/**
 * Single recommendation card for the "You might like" shelves (cart, library).
 *
 * Cover + meta, with the bottom row split: price LEFT, action RIGHT.
 *
 * The card is an <article>, not a link wrapped around everything. The old card
 * was one big <a> with the "+" <button> INSIDE it — interactive content nested
 * in a link, which assistive technology announces as one control or as none,
 * and which only worked because a click handler cancelled the link. Now the
 * title is the link (stretched over the card with a pseudo-element, so the whole
 * card is still clickable) and the "+" is its sibling, lifted above it.
 *
 * What the button does, and shows:
 *   - idle     "+"      — adds the book;
 *   - adding   a pulse  — the request is in flight; the button ignores presses;
 *   - in cart  a tick   — shown ONLY when the server's cart (`cart-store`) says
 *     the book is in it, not because a press was made. It stays: a reload, a
 *     return to the page, or removing the line elsewhere all change it, because
 *     the state is read, not remembered. The old tick lasted two seconds and then
 *     went back to "+", inviting a second press on a book that cannot be bought
 *     twice;
 *   - refused  a line of words under the row, as an alert. The old card returned
 *     silently on a refusal, and a thrown request blanked the page through the
 *     error boundary.
 * It is ONE element throughout (`aria-disabled`, never `disabled`, while busy or
 * in the cart) so keyboard focus is not dropped when its state changes.
 *
 * Two honesty rules, both learned from the Founder's screenshots:
 *
 *  1. The cover is the book's real cover (`item.coverSrc`, from the asset
 *     manifest). The gradient stand-in appears only for a book that has no
 *     cover asset at all.
 *  2. A title this store does not sell gets no add-to-cart button. It used to
 *     get one, and pressing it put a $0 line in the cart for a book nobody could
 *     check out. Such a card says "Not sold here" and links to the book page,
 *     where the real Amazon editions are listed. "Sold here" is the server's own
 *     test (`isAddable`: priced AND wired to a checkout), not just a price.
 */
export function RecommendationCard({ book }: { book: CatalogItem }) {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  const inCart = useInCart(book.id);
  const addable = isAddable(book);

  const onAdd = () => {
    if (pending || inCart) return;
    setFailure(null);
    startTransition(async () => {
      let result: AddToCartResult;
      try {
        result = await addToCart(book.id);
      } catch {
        setFailure(shortAddToCartMessage(null));
        return;
      }
      if (!result.ok) {
        setFailure(shortAddToCartMessage(result.reason));
        return;
      }
      if (result.state === "added") trackEvent("add_to_cart", { bookId: book.id });
      // Re-read the cart and WAIT, so the pulse becomes a tick in one step, with
      // the server's answer rather than ours.
      await cartChanged();
    });
  };

  const state = pending ? "adding" : inCart ? "in-cart" : "idle";
  const actionLabel = pending
    ? `Adding ${book.title} to cart`
    : inCart
      ? `${book.title} is in your cart`
      : `Add ${book.title} to cart`;

  return (
    <article
      data-recommendation={book.slug}
      className="group relative flex w-[180px] flex-shrink-0 snap-start flex-col gap-3"
    >
      {/* Cover */}
      <div className="home-card-hover relative aspect-[2/3] overflow-hidden rounded-[16px] border border-white/[0.08] bg-[#0a1410] shadow-[0_20px_40px_-16px_rgba(0,0,0,0.7)]">
        <CoverArt src={book.coverSrc} title={book.title} eyebrow={book.category} sizes="180px" />
      </div>

      {/* Meta — the title link is stretched over the whole card */}
      <div className="flex flex-col gap-1 px-0.5">
        <h3 className="line-clamp-1 font-serif text-[14px] font-medium leading-snug text-fg-hi transition-colors group-hover:text-emerald-bright">
          <Link
            href={`/books/${book.slug}`}
            className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-emerald-bright/60"
          >
            {book.title}
          </Link>
        </h3>
        <p className="text-xs text-fg-soft">{book.author}</p>
      </div>

      {/* Bottom row — price LEFT, action RIGHT. Lifted above the stretched link. */}
      <div className="relative z-10 mt-auto flex items-end justify-between px-0.5">
        <div className="flex flex-col gap-1">
          {/* No invented stars — see <CatalogBookCard>. */}
          {book.rating > 0 && (
            <div className="flex items-center gap-1 text-xs text-fg-mid">
              <Star aria-hidden className="h-3 w-3 fill-[#f4c44b] text-[#f4c44b]" />
              <span className="tabular-nums">{book.rating.toFixed(1)}</span>
            </div>
          )}
          {/* "Not sold here" for a title this store does not sell. */}
          <span className="text-sm font-semibold tabular-nums text-fg-hi">{formatCatalogPrice(book.priceCents, "USD")}</span>
        </div>

        {addable ? (
          <button
            type="button"
            onClick={onAdd}
            aria-label={actionLabel}
            aria-disabled={pending || inCart}
            data-cart-state={state}
            className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/60 sm:h-8 sm:w-8 ${
              inCart
                ? "cursor-default border-emerald-bright/60 bg-emerald-bright/15 text-emerald-bright shadow-[0_0_14px_rgba(51,240,170,0.45)]"
                : pending
                  ? "cursor-progress border-emerald-bright/40 bg-emerald-bright/10 text-emerald-bright"
                  : "border-white/[0.1] bg-white/[0.03] text-fg-mid hover:scale-105 hover:border-emerald-bright/50 hover:bg-emerald-bright/10 hover:text-emerald-bright hover:shadow-[0_0_14px_rgba(51,240,170,0.4)]"
            }`}
          >
            {inCart ? (
              <Check aria-hidden className="h-4 w-4" />
            ) : pending ? (
              <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-emerald-bright" />
            ) : (
              <Plus aria-hidden className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span
            aria-hidden
            title="Print editions on Amazon — see the book page"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-fg-fade sm:h-8 sm:w-8"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      {failure && (
        <p role="alert" className="relative z-10 px-0.5 text-[12px] leading-snug text-[#ff9b9b]">
          {failure}
        </p>
      )}
    </article>
  );
}
