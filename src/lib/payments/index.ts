/**
 * The payment provider registry.
 *
 * One place decides who takes the money. Everything else in the application —
 * the cart, the book page, the webhook route, the admin — asks here and never
 * imports a provider module directly. That is the whole point of the layer:
 * the next migration should be a change to `PAYMENT_PROVIDER` and a new folder
 * under `./`, not a sweep through forty files.
 *
 * `PAYMENT_PROVIDER` defaults to `lemonsqueezy` because that is what Valice
 * Press sells through as of 2026-09-13. Paddle is retired: its adapter is not
 * registered, its webhook route is gone, and its ids survive only as history in
 * `books.paddle_price_id` and in orders already taken.
 */

import type { PaymentProvider, PaymentProviderId } from "./types";
import { lemonSqueezyProvider } from "./lemonsqueezy/provider";

export * from "./types";

const PROVIDERS: Record<string, PaymentProvider> = {
  lemonsqueezy: lemonSqueezyProvider,
};

/** The provider that is allowed to take money today. */
export function getPaymentProvider(): PaymentProvider {
  const id = (process.env.PAYMENT_PROVIDER ?? "lemonsqueezy").toLowerCase();
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new Error(
      `PAYMENT_PROVIDER='${id}' has no adapter. Known: ${Object.keys(PROVIDERS).join(", ")}. ` +
        "Paddle was retired on 2026-09-13 and is deliberately not registered.",
    );
  }
  return provider;
}

/** The id, without constructing the provider — safe in any environment. */
export function getPaymentProviderId(): PaymentProviderId {
  const id = (process.env.PAYMENT_PROVIDER ?? "lemonsqueezy").toLowerCase();
  return id === "paddle" ? "paddle" : "lemonsqueezy";
}

/** Cheap pre-flight for UI that must not offer a button that cannot work. */
export function isCheckoutConfigured(): boolean {
  try {
    return getPaymentProvider().isConfigured();
  } catch {
    return false;
  }
}
