"use client";

import { useState, useTransition } from "react";

import { clearCart } from "@/app/cart/actions";
import { cartChanged } from "@/components/cart/cart-store";
import { REMOVE_FAILED_MESSAGE } from "@/lib/cart-copy";
import { formatPrice } from "@/lib/format";

/**
 * Cart totals + clear, in one glass panel.
 *
 * THE CHECKOUT BUTTON IS GONE, DELIBERATELY. Lemon Squeezy binds a checkout to
 * a single variant, so there is no request that buys a three-book cart. The
 * buy control therefore lives on each `<CartLine>`, and this panel's job is to
 * show what the shelf adds up to and to say — in the reader's own view, not in
 * a code comment — that digital editions are bought one at a time. A summary
 * that still showed "Checkout securely" over a total nothing could charge in
 * one go would be the storefront lying about its own mechanics.
 *
 * WHAT IT ADDS UP is the lines that can actually be bought: not a book the
 * reader already owns (checkout refuses it) and not one this site no longer
 * sells (it has no price to charge). The page passes only those, and says how
 * many more lines there are (`otherCount`) so the total is never a surprise in
 * either direction.
 *
 * Client Component for the clear control: `useTransition` for pending state,
 * and it re-reads the cart so the header badge and every "+" follow.
 */
export function CartSummary({
  totalCents,
  subtotalCents,
  bundleName,
  bundleDiscountCents,
  currency,
  itemCount,
  otherCount = 0,
}: {
  totalCents: number;
  subtotalCents: number;
  bundleName: string | null;
  bundleDiscountCents: number;
  currency: string;
  /** Lines that can be bought, and are what the total adds up. */
  itemCount: number;
  /** Lines in the cart that are not in the total (already owned, or no longer sold here). */
  otherCount?: number;
}) {
  const [clearPending, startClear] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClear = () => {
    if (clearPending) return;
    setError(null);
    startClear(async () => {
      try {
        await clearCart();
      } catch {
        setError(REMOVE_FAILED_MESSAGE);
        return;
      }
      await cartChanged();
    });
  };

  return (
    // A named region, not an <aside>: the summary lives inside <main>, and a
    // complementary landmark may not be nested in another landmark.
    <section aria-labelledby="order-summary-heading" data-order-summary="" className="home-glass relative overflow-hidden rounded-[24px] p-6 sm:p-7">
      {/* Top emerald edge line */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#33f0aa]/45 to-transparent"
      />

      <h2 id="order-summary-heading" className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">
        Order summary
      </h2>

      {itemCount === 0 ? (
        /* Nothing here can be bought. A total of "$0.00" would read as free. */
        <p className="mt-6 text-sm leading-relaxed text-fg-mid" data-summary-count={0}>
          Nothing in your cart can be bought right now.
        </p>
      ) : (
        <>
          {/* Line items count */}
          <div className="mt-6 flex items-baseline justify-between border-b border-white/[0.06] pb-4 text-sm">
            <span className="text-fg-mid" data-summary-count={itemCount}>
              {itemCount} {itemCount === 1 ? "book" : "books"}
            </span>
            <span className="text-fg-hi tabular-nums">
              {formatPrice(subtotalCents, currency)}
            </span>
          </div>

          {/* The bundle, when the cart holds every member of one. Shown as its own
              line so the reader can see WHY the total is lower than the books
              added up, and what it is called. */}
          {bundleName && bundleDiscountCents > 0 && (
            <div className="mt-4 flex items-baseline justify-between border-b border-emerald-bright/20 pb-4 text-sm">
              <span className="text-emerald-bright">{bundleName}</span>
              <span className="tabular-nums text-emerald-bright">
                −{formatPrice(bundleDiscountCents, currency)}
              </span>
            </div>
          )}

        </>
      )}

      {/* Lines that are in the cart but not in the total. */}
      {otherCount > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-fg-soft">
          {otherCount === 1 ? "1 more line is" : `${otherCount} more lines are`} in your cart but not in this total —
          already in your library, or no longer sold here.
        </p>
      )}

      {itemCount > 0 && (
        <>
          {/* Tax note — the Merchant of Record handles tax, so we're explicit */}
          <p className="mt-3 text-xs text-fg-fade">
            Local taxes are calculated at checkout by our Merchant of Record.
          </p>

          {/* Total */}
          <div className="mt-6 flex items-baseline justify-between">
            <span className="text-sm font-semibold uppercase tracking-[0.12em] text-fg-mid">
              {itemCount === 1 ? "Total" : "All " + itemCount + " together"}
            </span>
            <span className="font-serif text-3xl font-medium text-fg-hi tabular-nums">
              {formatPrice(totalCents, currency)}
            </span>
          </div>

          {/* How buying works here. Stated plainly, because the reader arriving
              from a cart expects one button and will not find one. */}
          {itemCount > 1 && (
            <p className="mt-7 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-fg-soft">
              Digital editions are bought one at a time — use the{" "}
              <span className="text-fg-hi">Buy</span> button on each book above.
              Each purchase is its own receipt and appears in your library straight
              away.
            </p>
          )}

        </>
      )}

      {/* Clear cart — subtle link-style */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onClear}
          disabled={clearPending}
          /* Deliberately understated — a destructive action should not shout.
             Below `sm:` it gets a 44px hit area from padding rather than from
             type size, so it looks exactly the same and is actually tappable;
             measured 54x16 before. Desktop keeps its original box. */
          className="inline-flex min-h-11 items-center px-3 text-xs text-fg-fade underline-offset-4 transition-colors hover:text-fg-mid hover:underline disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:px-0"
        >
          {clearPending ? "Clearing…" : "Clear cart"}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-xs text-[#ff9b9b]">
            {error}
          </p>
        )}
      </div>

      {/* Trust microcopy — each claim stays whole when the line wraps */}
      <div className="mt-7 border-t border-white/[0.06] pt-5">
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-[12px] uppercase tracking-[0.2em] text-fg-fade lg:text-[11px]">
          <span className="whitespace-nowrap">✓ Lemon Squeezy · MoR</span>
          <span className="whitespace-nowrap">✓ Watermarked PDF</span>
          <span className="whitespace-nowrap">✓ Yours to keep</span>
        </p>
      </div>
    </section>
  );
}
