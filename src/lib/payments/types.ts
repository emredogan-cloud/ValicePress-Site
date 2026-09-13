/**
 * Provider-neutral payment types (Lemon Squeezy migration, 2026-09-13).
 *
 * WHY THIS LAYER EXISTS. The storefront has now been through two merchants of
 * record in three weeks. The first migration was expensive because "Paddle"
 * was spelled out in the route name, the column name, the cart action, the
 * admin form, the checkout error strings and the analytics path — so changing
 * provider meant editing all of them. Nothing below names a provider. The
 * provider-specific code lives under `./<provider>/` and is reached only
 * through `getPaymentProvider()`.
 *
 * The vocabulary is deliberately the vocabulary of a *bookshop*, not of a
 * payments API: a checkout sells one or more `CheckoutLine`s, an order is
 * `paid` or it is not, and a refund revokes what the order granted. A provider
 * adapter's job is to translate its own API into these words, and to say
 * plainly — via `capabilities` — what it cannot do, rather than silently
 * pretending.
 */

/** Providers this codebase has an adapter for. `paddle` is retained read-only. */
export type PaymentProviderId = "lemonsqueezy" | "paddle";

/**
 * What a provider can actually do. Read this before assuming a lifecycle
 * transition is observable: Paddle emitted payment-failure and chargeback
 * webhooks, Lemon Squeezy does not, and code that waits for an event the
 * provider never sends is code that hangs forever in a state it calls
 * "pending". See `docs/commerce/LEMON-SQUEEZY-MIGRATION-REPORT-TR.md` §9.
 */
export interface ProviderCapabilities {
  /** A single checkout can carry more than one distinct product. */
  multiItemCheckout: boolean;
  /** The provider POSTs an event when a payment attempt fails. */
  paymentFailedWebhook: boolean;
  /** The provider POSTs an event for a chargeback / dispute. */
  chargebackWebhook: boolean;
  /** The provider POSTs an event when money is returned. */
  refundWebhook: boolean;
  /** The provider is the merchant of record (it owes the sales tax, not us). */
  merchantOfRecord: boolean;
}

/** One line of a checkout: a book, at the price the storefront is showing. */
export interface CheckoutLine {
  /** Our catalogue row id (uuid). Round-trips through the provider as custom data. */
  bookId: string;
  /** The provider's id for the thing being sold (LS variant id, Paddle price id). */
  providerPriceId: string;
  title: string;
  priceCents: number;
  quantity: number;
}

export interface CreateCheckoutArgs {
  lines: CheckoutLine[];
  /** Absolute URL the buyer returns to after paying. */
  successUrl?: string;
  /** Pre-fills the provider's email field for a signed-in buyer. Never invented. */
  buyerEmail?: string | null;
  buyerName?: string | null;
}

export type CreateCheckoutResult =
  | { ok: true; url: string; providerCheckoutId: string | null }
  | { ok: false; error: string };

/**
 * A payment event, after the adapter has verified it and translated it.
 *
 * `providerEventId` is the idempotency key and must be STABLE across
 * re-delivery of the same event — it is written to `commerce_events`, which
 * carries a UNIQUE index on it. It is NOT a per-delivery id: a provider that
 * retries with a fresh delivery id would then fulfil twice.
 */
export interface PaymentEvent {
  type: PaymentEventType;
  provider: PaymentProviderId;
  /** Stable per-event idempotency key, e.g. `lemonsqueezy:order_created:1234`. */
  providerEventId: string;
  /** The provider's order/transaction reference → `orders.mor_order_ref`. */
  providerOrderRef: string;
  /** Only present once the money is actually taken. */
  order?: PaidOrder;
  /** Free-text reason for the audit trail. Never PII beyond the buyer's name. */
  reason?: string | null;
  /** True when the provider says this was a test-mode event. */
  testMode: boolean;
}

export type PaymentEventType =
  | "order_paid"
  | "order_not_paid"
  | "order_refunded"
  | "ignored";

/** Everything fulfillment needs, with no provider vocabulary left in it. */
export interface PaidOrder {
  providerOrderRef: string;
  providerCustomerId: string | null;
  buyerEmail: string;
  buyerName: string | null;
  /** Catalogue ids resolved from the event. Empty means "could not resolve". */
  bookIds: string[];
  totalCents: number;
  taxCents: number;
  /** ISO-4217, upper case. */
  currency: string;
}

export type WebhookVerification =
  | { ok: true; event: PaymentEvent }
  | { ok: false; status: 400 | 401 | 503; message: string };

/**
 * The whole provider surface. Anything the storefront needs from a payment
 * provider is on this interface; anything not on it does not exist as far as
 * the rest of the application is concerned.
 */
export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly capabilities: ProviderCapabilities;
  /** False when the environment lacks the credentials to even try. */
  isConfigured(): boolean;
  createCheckout(args: CreateCheckoutArgs): Promise<CreateCheckoutResult>;
  /**
   * Verify a raw webhook body and translate it. Implementations MUST verify
   * the signature before parsing, and must not touch the database.
   */
  verifyWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<WebhookVerification>;
}
