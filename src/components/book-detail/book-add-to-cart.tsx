"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { addToCart, type AddToCartResult } from "@/app/cart/actions";
import { cartChanged, useInCart } from "@/components/cart/cart-store";
import { trackEvent } from "@/lib/analytics";
import { addToCartMessage } from "@/lib/cart-copy";

/**
 * Cinematic "Add to cart" button for `/books/[slug]`.
 *
 * Cart-control contract:
 *   - Calls `addToCart(bookId)` (writes the cart cookie server-side)
 *   - Then re-reads the cart from the server (`cartChanged`) and shows what the
 *     SERVER says: once the book is in the cart the button becomes a link to
 *     the cart and STAYS that way — it does not revert to "Add" after a few
 *     seconds, which invited a second press on a book that cannot be bought
 *     twice. The state is the store's, so it survives navigating away and back,
 *     and a reload re-reads it from the cookie.
 *   - A refusal or a failure is said in words (`addToCartMessage`), never
 *     swallowed, and the button stays usable.
 *   - A signed-in owner sees an "In your library" link instead
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
  const [failure, setFailure] = useState<string | null>(null);
  const [owned, setOwned] = useState(false);
  const inCart = useInCart(bookId);

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
    setFailure(null);
    startTransition(async () => {
      /* Say what actually happened. This used to set "Added to cart"
         unconditionally, including when the action had declined — measured on
         the Redmi: the button said Added, the cart count stayed 0, and the
         reader arrived at an empty cart. */
      let result: AddToCartResult;
      try {
        result = await addToCart(bookId);
      } catch {
        // The request itself failed (offline, a deploy in flight). Say so; the
        // cart is exactly as it was.
        setFailure(addToCartMessage(null));
        return;
      }
      if (!result.ok) {
        setFailure(addToCartMessage(result.reason));
        return;
      }
      if (result.state === "added") trackEvent("add_to_cart", { bookId });
      await cartChanged();
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

  // In the cart: the control is now the way to GET to the cart.
  if (inCart) {
    return (
      <Link
        href="/cart"
        prefetch={false}
        data-cart-state="in-cart"
        className="home-cta-secondary inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold tracking-tight"
      >
        <span
          aria-hidden
          className="h-2 w-2 rounded-full bg-emerald-bright shadow-[0_0_6px_rgba(51,240,170,0.7)]"
        />
        In your cart — view cart
        <span aria-hidden>→</span>
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
        data-cart-state={pending ? "pending" : failure ? "failed" : "idle"}
        className="home-cta-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold tracking-tight disabled:cursor-not-allowed disabled:opacity-80"
      >
        {pending ? (
          <>
            <span
              aria-hidden
              className="h-2 w-2 animate-pulse rounded-full bg-[#032015]"
            />
            Adding…
          </>
        ) : failure ? (
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
      {failure && (
        /* `role="alert"` so a screen reader hears it: the reader has just been
           told a purchase step worked when it did not, and silence here is the
           whole defect. */
        <p role="alert" className="mt-3 text-center text-[12px] leading-relaxed text-fg-soft">
          {failure}
        </p>
      )}
    </>
  );
}
