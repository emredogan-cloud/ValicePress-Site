"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { createCheckoutSession, removeFromCart } from "@/app/cart/actions";
import { cartChanged, useInCart } from "@/components/cart/cart-store";
import { CoverArt } from "@/components/cinematic/cover-art";
import { trackEvent } from "@/lib/analytics";
import { CHECKOUT_FAILED_MESSAGE, REMOVE_FAILED_MESSAGE } from "@/lib/cart-copy";
import { formatCatalogPrice, formatPrice } from "@/lib/format";

/**
 * Single cart-line item — glass card with mini cover + meta + remove.
 *
 * Client Component because the buy and remove controls wrap Server Actions via
 * `useTransition` for pending state, and because what it shows is read from the
 * cart store (`cart-store.ts`), not remembered.
 *
 * The mini cover is the book's real cover (`coverSrc`, attached by the
 * catalog query from the asset manifest). It used to be a fixed emerald
 * gradient for every line, whatever was in the cart.
 *
 * EACH LINE BUYS ITSELF. Lemon Squeezy binds a checkout to one variant, so
 * there is no single "check out everything" request to make. Rather than hide
 * that behind a button that would charge the reader once per book without
 * saying so, the buy control lives on the line it belongs to.
 *
 * THREE KINDS OF LINE, because a cart outlives the catalogue it was filled from:
 *   - buyable        a price and a Buy button;
 *   - already owned  a link to the library instead of a button (`owned`);
 *   - no longer sold the title was demoted to Amazon-only after it was added
 *     (`sellable` false). It used to render "Buy $0.00" over a button that
 *     could only fail; now it says so and offers only the way out.
 * The last two are excluded from the summary's total by the page.
 *
 * REMOVING. The line asks the server, then re-reads the cart; once the server's
 * cart no longer holds the book the line steps aside, without waiting for the
 * page to re-render around it (locally that render takes seconds). It steps
 * aside only while the store agrees the book is out of the cart, so adding the
 * same book back (from the shelf below) shows the line again even if React kept
 * this instance — a flag of its own would have hidden it for good.
 */
export interface CartLineBook {
  id: string;
  slug: string;
  title: string;
  authors: ReadonlyArray<{ name: string }>;
  priceCents: number;
  currency: string;
  coverSrc?: string | null;
}

export function CartLine({
  book,
  owned = false,
  sellable = true,
}: {
  book: CartLineBook;
  /** Signed-in user already owns this book (non-revoked entitlement). */
  owned?: boolean;
  /** This store still sells it (priced and wired to a checkout). */
  sellable?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [buying, startBuy] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const inCart = useInCart(book.id);
  const gone = removed && !inCart;

  // Coming back from the payment page via the back button restores this page
  // from the browser's cache with the button still reading "Opening checkout…".
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) setRedirecting(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const busy = buying || redirecting;

  const onBuy = () => {
    if (busy || pending) return;
    setError(null);
    trackEvent("begin_checkout", {
      itemCount: 1,
      totalCents: book.priceCents,
      currency: book.currency,
    });
    startBuy(async () => {
      let result: Awaited<ReturnType<typeof createCheckoutSession>>;
      try {
        result = await createCheckoutSession(book.id);
      } catch {
        setError(CHECKOUT_FAILED_MESSAGE);
        return;
      }
      if (result.ok) {
        // Stay "busy" while the browser leaves: the transition ends the moment
        // we assign the location, and a second press in that gap would open a
        // second checkout for the same book.
        setRedirecting(true);
        window.location.assign(result.url);
      } else {
        setError(result.error);
      }
    });
  };

  const onRemove = () => {
    if (pending || busy) return;
    setError(null);
    startTransition(async () => {
      try {
        await removeFromCart(book.id);
      } catch {
        setError(REMOVE_FAILED_MESSAGE);
        return;
      }
      setRemoved(true);
      await cartChanged();
    });
  };

  if (gone) {
    // The line has left the cart; announce it, and let the page catch up.
    return (
      <p role="status" className="sr-only">
        {book.title} was removed from your cart.
      </p>
    );
  }

  const state = owned ? "owned" : !sellable ? "unavailable" : busy ? "opening-checkout" : "buyable";

  return (
    <article
      data-cart-line={book.slug}
      data-line-state={state}
      data-pending={pending ? "true" : "false"}
      className="home-glass home-card-hover relative flex items-center gap-5 rounded-2xl p-4 transition-opacity duration-300 data-[pending=true]:opacity-50"
    >
      {/* Mini cover */}
      <Link
        href={`/books/${book.slug}`}
        aria-hidden
        tabIndex={-1}
        className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-md bg-[#0a1410] shadow-[0_8px_16px_-6px_rgba(0,0,0,0.6)]"
      >
        <CoverArt
          src={book.coverSrc}
          title={book.title}
          sizes="64px"
          titleClassName="font-serif text-[12px] lg:text-[9px] font-medium leading-tight text-white line-clamp-3"
        />
      </Link>

      {/* Meta */}
      <div className="min-w-0 flex-1">
        <Link
          href={`/books/${book.slug}`}
          className="block font-serif text-base font-medium leading-tight text-fg-hi transition-colors hover:text-emerald-bright"
        >
          {book.title}
        </Link>
        {book.authors.length > 0 && (
          <p className="mt-1 text-sm text-fg-soft">
            {book.authors.map((a) => a.name).join(", ")}
          </p>
        )}
        <p className="mt-2 text-sm font-semibold text-fg-hi tabular-nums">
          {/* "Not sold here" for a demoted title, never "$0.00". */}
          {formatCatalogPrice(book.priceCents, book.currency)}
        </p>
        {owned ? (
          <Link
            href="/account/library"
            prefetch={false}
            className="mt-2 inline-flex w-fit items-center gap-1 rounded-full border border-[#f4c44b]/30 bg-[#f4c44b]/10 px-2.5 py-0.5 text-[12px] lg:text-[11px] font-medium text-[#f4c44b] transition-colors hover:border-[#f4c44b]/50"
          >
            Already in your library — open it there
          </Link>
        ) : !sellable ? (
          <p className="mt-2 text-xs leading-relaxed text-fg-soft">
            This book is no longer sold on this site, so it can&apos;t be bought from your cart. Remove it, or{" "}
            <Link href={`/books/${book.slug}`} className="text-emerald-bright underline-offset-2 hover:underline">
              see where it is sold
            </Link>
            .
          </p>
        ) : (
          <button
            type="button"
            onClick={onBuy}
            disabled={busy || pending}
            aria-busy={busy}
            className="home-cta-primary mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold tracking-tight disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Opening checkout…" : `Buy ${formatPrice(book.priceCents, book.currency)}`}
            <span aria-hidden>→</span>
          </button>
        )}
        {error && (
          <p
            role="alert"
            className="mt-2 rounded-md border border-[#ff7a7a]/30 bg-[#ff7a7a]/5 px-3 py-2 text-xs text-[#ff9b9b]"
          >
            {error}
          </p>
        )}
      </div>

      {/* Remove — circular glass icon button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={pending || busy}
        aria-label={`Remove ${book.title} from cart`}
        className="flex h-11 w-11 flex-shrink-0 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-fg-soft transition-all hover:border-[#ff7a7a]/40 hover:bg-[#ff7a7a]/10 hover:text-[#ff9b9b] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </article>
  );
}
