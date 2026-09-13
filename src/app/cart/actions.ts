"use server";

import { revalidatePath } from "next/cache";

import { getCurrentLocalUserIdReadOnly } from "@/lib/account";
import { deleteCart, readCart, writeCart } from "@/lib/cart";
import { getOwnedBookIds } from "@/lib/db/queries/account";
import { getCheckoutItems } from "@/lib/db/queries/catalog";
import { getPaymentProvider } from "@/lib/payments";

// ---------------------------------------------------------------------------
// Cart-mutation actions (cookie-backed; from SUB-PR 1.4)
// ---------------------------------------------------------------------------

/**
 * Add a book to the cart. Idempotent — if the book is already in the
 * cart we no-op (digital books have an implicit quantity of 1).
 *
 * RETURNS A RESULT, and the caller must respect it.
 *
 * Every guard below is a legitimate refusal, but they used to be SILENT: the
 * action returned void, so `BookAddToCart` set "Added to cart" no matter what
 * happened. Measured on the Redmi in Phase 9 — a tap on a real product page
 * answered "Added to cart", `/api/cart/count` stayed at 0, and the cart was
 * empty when the reader got there. A store may decline to sell a book; it may
 * not tell the reader it sold them one.
 *
 * `inCart` is a success: the book is in the cart, which is what the reader
 * asked for. `unavailable` and `unknown` are not.
 */
export type AddToCartResult =
  | { ok: true; state: "added" | "inCart" }
  | { ok: false; reason: "unknown" | "unavailable" };

export async function addToCart(bookId: string): Promise<AddToCartResult> {
  if (!bookId) return { ok: false, reason: "unknown" };
  // Only a title this store actually sells may enter the cart. A book whose
  // every edition is fulfilled by Amazon has `price_cents = 0` and no provider
  // price; adding it produced a $0 line that checkout then refused. The
  // shelves no longer offer the button for such a book, and this guard makes
  // the rule hold even for a stale page or a hand-made request.
  const [book] = await getCheckoutItems([bookId]);
  // A stale ISR page can carry a book id the database no longer has — that is
  // exactly how this was found — so "unknown" and "unavailable" are separate.
  if (!book) return { ok: false, reason: "unknown" };
  if (book.priceCents <= 0 || !book.providerPriceId) {
    return { ok: false, reason: "unavailable" };
  }
  const cart = await readCart();
  if (cart.items.some((i) => i.bookId === bookId)) return { ok: true, state: "inCart" };
  cart.items.push({ bookId, addedAt: Date.now() });
  await writeCart(cart);
  revalidatePath("/cart");
  return { ok: true, state: "added" };
}

/** Remove a single book from the cart. */
export async function removeFromCart(bookId: string): Promise<void> {
  if (!bookId) return;
  const cart = await readCart();
  cart.items = cart.items.filter((i) => i.bookId !== bookId);
  await writeCart(cart);
  revalidatePath("/cart");
}

/** Clear the cart entirely. */
export async function clearCart(): Promise<void> {
  await deleteCart();
  revalidatePath("/cart");
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Open a checkout for ONE book and return the URL to send the buyer to.
 *
 * WHY ONE. Paddle took a transaction with as many line items as the cart had;
 * Lemon Squeezy binds a checkout to a single variant and has no multi-product
 * cart (`relationships.variant` is singular — verified against the Create a
 * Checkout contract on 2026-09-13). The honest translation of a three-book
 * cart is therefore three checkouts, not one, and the cart page now says so
 * and offers a button per line. The alternative — looping and charging the
 * buyer three times behind one "Checkout" button — is the kind of thing that
 * produces a chargeback, and Lemon Squeezy does not even send a webhook for
 * those.
 *
 * Every refusal below returns a calm sentence to the client; none propagates
 * as a 500:
 *   - the provider is unconfigured;
 *   - the book is not in the catalogue, or is no longer published;
 *   - the book has no provider price (not sellable here);
 *   - the signed-in buyer already owns it;
 *   - the provider's API rejects the request.
 */
export async function createCheckoutSession(
  bookId: string,
): Promise<CheckoutResult> {
  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    return { ok: false, error: "Checkout is not configured yet." };
  }
  if (!bookId) {
    return { ok: false, error: "No book was selected." };
  }

  const [book] = await getCheckoutItems([bookId]);
  if (!book) {
    return {
      ok: false,
      error: "That title is not available to buy here right now.",
    };
  }
  if (!book.providerPriceId || book.priceCents <= 0) {
    return {
      ok: false,
      error: `Not ready for checkout — “${book.title}” is not sold on this site.`,
    };
  }

  // Ownership guard — keep a signed-in owner from re-buying (and being charged
  // again for) a book they already hold. Purchases create a perpetual
  // entitlement, so a non-revoked grant means "already owned". Anonymous
  // visitors resolve to null and own nothing, so they pass straight through.
  const localUserId = await getCurrentLocalUserIdReadOnly();
  if (localUserId) {
    const owned = await getOwnedBookIds(localUserId, [book.id]);
    if (owned.has(book.id)) {
      return {
        ok: false,
        error: `Already in your library: ${book.title}. Open it from your account.`,
      };
    }
  }

  const result = await provider.createCheckout({
    lines: [
      {
        bookId: book.id,
        providerPriceId: book.providerPriceId,
        title: book.title,
        priceCents: book.priceCents,
        quantity: 1,
      },
    ],
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, url: result.url };
}
