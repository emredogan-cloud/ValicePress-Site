"use client";

import { useTransition } from "react";

import { clearCart } from "@/app/cart/actions";
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
 * Client Component for the clear control: `useTransition` for pending state,
 * and it emits the `cart-changed` event the header cart-count listens for.
 */
export function CartSummary({
  totalCents,
  subtotalCents,
  bundleName,
  bundleDiscountCents,
  currency,
  itemCount,
}: {
  totalCents: number;
  subtotalCents: number;
  bundleName: string | null;
  bundleDiscountCents: number;
  currency: string;
  itemCount: number;
}) {
  const [clearPending, startClear] = useTransition();

  const onClear = () => {
    startClear(async () => {
      await clearCart();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cart-changed"));
      }
    });
  };

  return (
    <aside className="home-glass relative overflow-hidden rounded-[24px] p-6 sm:p-7">
      {/* Top emerald edge line */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#33f0aa]/45 to-transparent"
      />

      <h2 className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">
        Order summary
      </h2>

      {/* Line items count */}
      <div className="mt-6 flex items-baseline justify-between border-b border-white/[0.06] pb-4 text-sm">
        <span className="text-fg-mid">
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
      </div>

      {/* Trust microcopy */}
      <div className="mt-7 border-t border-white/[0.06] pt-5">
        <p className="text-center text-[12px] lg:text-[11px] uppercase tracking-[0.2em] text-fg-fade">
          ✓ Lemon Squeezy · MoR &nbsp;·&nbsp; ✓ Watermarked PDF &nbsp;·&nbsp; ✓ Yours to keep
        </p>
      </div>
    </aside>
  );
}
