/**
 * The Lemon Squeezy adapter.
 *
 * ONE CHECKOUT SELLS ONE BOOK. Lemon Squeezy binds a checkout to a single
 * variant (`relationships.variant` is singular; `variant_quantities` only sets
 * quantities for variants already enabled on that checkout). There is no
 * multi-product cart. Paddle had one, and this storefront was built around it.
 * Rather than fake a combined checkout by charging the buyer several times,
 * `createCheckout` refuses a multi-line cart outright and says why — the
 * storefront asks `capabilities.multiItemCheckout` first and offers a per-book
 * button instead. A refusal the reader can see beats a silent second charge.
 */

import type {
  CreateCheckoutArgs,
  CreateCheckoutResult,
  PaymentProvider,
  ProviderCapabilities,
  WebhookVerification,
} from "@/lib/payments/types";

import {
  getStoreId,
  isLemonSqueezyConfigured,
  LemonSqueezyError,
  lsRequest,
  type LsCheckoutAttrs,
  type LsResource,
} from "./client";
import { verifyAndParse } from "./webhook";

const CAPABILITIES: ProviderCapabilities = {
  // Verified against the Create-a-Checkout API contract, 2026-09-13.
  multiItemCheckout: false,
  // Verified against the published event list, 2026-09-13: the only order
  // events are order_created and order_refunded.
  paymentFailedWebhook: false,
  chargebackWebhook: false,
  refundWebhook: true,
  merchantOfRecord: true,
};

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    "https://valicepress.com"
  );
}

export const lemonSqueezyProvider: PaymentProvider = {
  id: "lemonsqueezy",
  capabilities: CAPABILITIES,

  isConfigured(): boolean {
    return isLemonSqueezyConfigured() && Boolean(process.env.LEMONSQUEEZY_STORE_ID);
  },

  async createCheckout(args: CreateCheckoutArgs): Promise<CreateCheckoutResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        error:
          "Checkout is not configured yet — LEMONSQUEEZY_API_KEY or LEMONSQUEEZY_STORE_ID is missing.",
      };
    }
    if (args.lines.length === 0) {
      return { ok: false, error: "Nothing to buy." };
    }
    if (args.lines.length > 1) {
      return {
        ok: false,
        error:
          "Digital editions are bought one at a time. Open the book you want and use its Buy Digital Edition button.",
      };
    }

    const line = args.lines[0];
    if (!line.providerPriceId) {
      return {
        ok: false,
        error: `Not ready for checkout — “${line.title}” has no Lemon Squeezy variant yet.`,
      };
    }

    // `custom` values are what come back in `meta.custom_data` on the webhook.
    // Lemon Squeezy stringifies them, so the book id travels as a string and
    // is read back by `readBookIdsFromCustomData`.
    const checkoutData: Record<string, unknown> = {
      custom: { book_ids: line.bookId },
    };
    if (args.buyerEmail) checkoutData.email = args.buyerEmail;
    if (args.buyerName) checkoutData.name = args.buyerName;

    try {
      const res = await lsRequest<{ data: LsResource<LsCheckoutAttrs> }>({
        method: "POST",
        path: "/checkouts",
        body: {
          data: {
            type: "checkouts",
            attributes: {
              checkout_data: checkoutData,
              product_options: {
                redirect_url: args.successUrl ?? `${appUrl()}/account/library`,
                receipt_button_text: "Read it now",
                receipt_link_url: `${appUrl()}/account/library`,
                receipt_thank_you_note:
                  "Thank you for buying directly from Valice Press. Your download is in your library.",
                // Without this the checkout offers every variant of the
                // product, which for a book means offering the buyer a
                // format we did not mean to sell them here.
                enabled_variants: [Number(line.providerPriceId)],
              },
              checkout_options: { embed: false, media: true, logo: true },
            },
            relationships: {
              store: { data: { type: "stores", id: getStoreId() } },
              variant: { data: { type: "variants", id: line.providerPriceId } },
            },
          },
        },
      });

      const url = res.data?.attributes?.url;
      if (!url) {
        return { ok: false, error: "Lemon Squeezy did not return a checkout URL." };
      }
      return { ok: true, url, providerCheckoutId: res.data.id ?? null };
    } catch (err) {
      if (err instanceof LemonSqueezyError) {
        console.error("[checkout] Lemon Squeezy rejected the checkout:", err.message);
        return { ok: false, error: err.message };
      }
      console.error("[checkout] Lemon Squeezy checkout failed:", err);
      return {
        ok: false,
        error:
          err instanceof Error ? err.message : "Checkout failed — please try again.",
      };
    }
  },

  async verifyWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<WebhookVerification> {
    return verifyAndParse(rawBody, headers);
  },
};
