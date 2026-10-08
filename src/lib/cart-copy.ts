/**
 * What the cart says when something does not go to plan.
 *
 * One place, so the product page and the recommendation cards give the same
 * answer to the same refusal, and so a test can hold the wording to the facts:
 * every sentence says whether anything was charged or changed, because that is
 * the first thing a reader wonders when a purchase step fails.
 *
 * Client-safe: no imports from the server-only cart module.
 */

/** Why `addToCart` said no — or `null` when the request itself failed (offline, a deploy in flight). */
export type AddToCartFailure = "unknown" | "unavailable" | "full" | null;

export function addToCartMessage(reason: AddToCartFailure): string {
  switch (reason) {
    case "unavailable":
      return "This book can't be bought on this site right now, so it wasn't added. Nothing was charged and your cart is unchanged.";
    case "full":
      return "Your cart is full. Remove a book, or buy one, and then add this one. Nothing was charged.";
    case "unknown":
    case null:
      return "We couldn't add this book just now. Reload the page and try again — nothing was charged and your cart is unchanged.";
  }
}

/**
 * The same refusals in a few words, for a 180px recommendation card, where the
 * full sentences above would run to six lines. The product page keeps the long
 * form; both are held to the same facts by the test.
 */
export function shortAddToCartMessage(reason: AddToCartFailure): string {
  switch (reason) {
    case "unavailable":
      return "Can't be bought here right now.";
    case "full":
      return "Your cart is full.";
    case "unknown":
    case null:
      return "Couldn't add it — try again.";
  }
}

/** `removeFromCart` / `clearCart` failed to reach the server. */
export const REMOVE_FAILED_MESSAGE =
  "We couldn't update your cart just now. Reload the page and try again — nothing was charged.";

/** Checkout could not be opened for a reason the server did not put into words. */
export const CHECKOUT_FAILED_MESSAGE =
  "We couldn't open checkout just now. Nothing was charged — please try again in a moment.";
