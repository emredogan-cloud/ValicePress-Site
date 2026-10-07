"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { addToCart } from "@/app/cart/actions";
import { trackEvent } from "@/lib/analytics";

/**
 * Cinematic "Add to cart" button for `/books/[slug]`.
 *
 * Phase 1.C cart-control contract:
 *   - Calls `addToCart(bookId)` (writes the cart cookie server-side)
 *   - Dispatches `cart-changed` so the header's cart badge can refresh
 *   - Reverts the "Added" affordance after ~2.5s
 *   - Phase A: a signed-in owner sees an "In your library" link instead
 *     (ownership resolved client-side via `/api/entitlement`)
 *
 * Chrome differences:
 *   - `.home-cta-primary` — emerald gradient pill, not warm shadcn Button
 *   - Full-width by default; the buy panel layout controls the width
 *   - Pending-state pulse uses an emerald dot instead of a spinner glyph
 *
 * SSG-safe: this Client Component embedded inside an SSG page does not
 * promote the page to dynamic — only the button hydrates.
 */
export function BookAddToCart({ bookId }: { bookId: string }) {
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [owned, setOwned] = useState(false);

  // Ownership check — runs client-side so the SSG product page stays static.
  // A signed-in owner gets a "library" link instead of a buy button; anonymous
  // or non-owning visitors (and any hiccup) keep the normal add-to-cart control.
  useEffect(() => {
    let active = true;
    fetch(`/api/entitlement?bookId=${encodeURIComponent(bookId)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.owned === true) setOwned(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [bookId]);

  const handleClick = () => {
    startTransition(async () => {
      /* Say what actually happened. This used to set "Added to cart"
         unconditionally, including when the action had declined — measured on
         the Redmi: the button said Added, the cart count stayed 0, and the
         reader arrived at an empty cart. */
      const result = await addToCart(bookId);
      setFailed(!result.ok);
      setAdded(result.ok);
      if (result.ok) {
        trackEvent("add_to_cart", { bookId });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cart-changed"));
        }
      }
      window.setTimeout(() => { setAdded(false); setFailed(false); }, 4000);
    });
  };

  // Already owned — send them to the library instead of letting them re-buy.
  if (owned) {
    return (
      <Link
        href="/account/library"
        prefetch={false}
        className="home-cta-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold tracking-tight"
      >
        <span
          aria-hidden
          className="h-2 w-2 rounded-full bg-[#032015] shadow-[0_0_6px_rgba(3,32,21,0.6)]"
        />
        In your library
      </Link>
    );
  }

  return (
    <>
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || added}
      aria-live="polite"
      className="home-cta-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold tracking-tight disabled:cursor-not-allowed disabled:opacity-80"
    >
      {added ? (
        <>
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-[#032015] shadow-[0_0_6px_rgba(3,32,21,0.6)]"
          />
          Added to cart
        </>
      ) : pending ? (
        <>
          <span
            aria-hidden
            className="h-2 w-2 animate-pulse rounded-full bg-[#032015]"
          />
          Adding…
        </>
      ) : failed ? (
        <>Try again</>
      ) : (
        /* "Add to cart" alone never said what was in the cart. Paddle
           declined this domain twice for looking like it sells physical
           goods, and a buy button on a page that also lists a paperback is
           exactly the ambiguity a reviewer sees. The button now names the
           thing it adds. */
        <>Add digital edition</>
      )}
    </button>
    {failed && (
      /* `role="alert"` so a screen reader hears it: the reader has just been
         told a purchase step worked when it did not, and silence here is the
         whole defect. */
      <p role="alert" className="mt-3 text-center text-[12px] leading-relaxed text-fg-soft">
        We couldn&apos;t add this book just now. Reload the page and try again —
        nothing was charged and your cart is unchanged.
      </p>
    )}
    </>
  );
}
