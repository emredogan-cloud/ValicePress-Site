import type { NextRequest } from "next/server";

import { handleRefund } from "@/lib/commerce/lifecycle";
import { recordCommerceEvent } from "@/lib/commerce/events";
import { getBookIdByProviderPriceId } from "@/lib/db/queries/catalog";
import { processPaidOrder } from "@/lib/fulfillment";
import { logger } from "@/lib/logger";
import { getPaymentProvider } from "@/lib/payments";
import { readVariantId } from "@/lib/payments/lemonsqueezy/webhook";

// Drizzle transactions inside the handler → Node runtime required.
export const runtime = "nodejs";
// Headers are read and the database is written; never cache.
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/lemonsqueezy
 *
 * The order of operations is the security property, so it is worth stating:
 *
 *  1. **Signature first.** No parse, no database call, no log of the payload
 *     happens before the HMAC over the raw body matches `X-Signature`. A bad
 *     signature is a flat 401 with nothing else done.
 *  2. **Dispatch on the signed event name.** `X-Event-Name` is a convenience
 *     header sitting outside the signed body; `meta.event_name` is inside it.
 *     Only the signed one decides what runs.
 *  3. **Idempotent fulfilment.** `orders.mor_order_ref` is UNIQUE, so a
 *     re-delivery finds the row, writes nothing and returns 200.
 *  4. **200 only after the write committed** (or was deduplicated). Anything
 *     thrown becomes a 500 so Lemon Squeezy retries — but note it retries only
 *     three more times (5s, 25s, 125s) and then gives up for good, so a 500
 *     here is a genuine incident, not a queue.
 *
 * WHAT THIS ENDPOINT CANNOT SEE. Lemon Squeezy publishes exactly two order
 * events, `order_created` and `order_refunded`. There is no payment-failure
 * event and no chargeback event. A failed attempt is visible only as an
 * `order_created` whose status is not `paid`, which is recorded as
 * `payment_failed` in the audit trail; a dispute is not visible here at all
 * and must be read from the dashboard. This is a real loss against Paddle and
 * is written down rather than smoothed over.
 */
export async function POST(request: NextRequest) {
  const provider = getPaymentProvider();

  // Lemon Squeezy signs the raw body — read it as text, never as JSON.
  const rawBody = await request.text();
  const verified = await provider.verifyWebhook(rawBody, request.headers);

  if (!verified.ok) {
    // 401/400 are logged without the body: an unverified payload is attacker-
    // controlled and does not belong in our logs.
    logger.error(
      `[ls-webhook] rejected (${verified.status}): ${verified.message}`,
    );
    return new Response(verified.message, { status: verified.status });
  }

  const { event } = verified;

  try {
    switch (event.type) {
      case "order_paid": {
        const order = event.order;
        if (!order) {
          // Cannot happen with the current adapter, but a 400 is the honest
          // answer if it ever did: retrying an event with no order attached
          // will never succeed.
          return new Response("order_paid without an order", { status: 400 });
        }

        // Resolve the book. First choice is what we put into the checkout
        // ourselves; the fallback covers a purchase made straight from the
        // Lemon Squeezy storefront, which carries no custom data at all.
        let bookIds = order.bookIds;
        if (bookIds.length === 0) {
          const variantId = readVariantId(JSON.parse(rawBody));
          const resolved = variantId
            ? await getBookIdByProviderPriceId(variantId)
            : null;
          if (resolved) {
            bookIds = [resolved];
            logger.warn(
              "[ls-webhook] no custom data — resolved the book by variant id",
              { orderRef: order.providerOrderRef, variantId },
            );
          }
        }

        await processPaidOrder({
          provider: event.provider,
          providerEventId: event.providerEventId,
          providerOrderRef: order.providerOrderRef,
          providerCustomerId: order.providerCustomerId,
          buyerEmail: order.buyerEmail,
          buyerName: order.buyerName,
          bookIds,
          totalCents: order.totalCents,
          taxCents: order.taxCents,
          currency: order.currency,
        });
        break;
      }

      case "order_not_paid": {
        // No order row: a pending/failed attempt can later become the SAME
        // order id when the buyer retries, and a row keyed on `mor_order_ref`
        // would then collide with the idempotent paid-insert and block
        // fulfilment. The state lives in the audit trail, queryable by ref.
        await recordCommerceEvent({
          type: "payment_failed",
          provider: event.provider,
          providerEventId: event.providerEventId,
          morOrderRef: event.providerOrderRef,
          reason: event.reason ?? null,
        });
        logger.warn("[ls-webhook] order not paid", {
          orderRef: event.providerOrderRef,
          reason: event.reason ?? undefined,
        });
        break;
      }

      case "order_refunded": {
        await handleRefund({
          provider: event.provider,
          providerOrderRef: event.providerOrderRef,
          providerEventId: event.providerEventId,
          reason: event.reason ?? "order_refunded",
        });
        break;
      }

      case "ignored":
      default: {
        // Acknowledged so Lemon Squeezy stops retrying, and recorded so the
        // audit trail shows the endpoint saw it. Subscribing to an event we
        // do not handle is a configuration mistake worth being able to find.
        logger.info(`[ls-webhook] ignoring: ${event.reason ?? event.type}`);
        break;
      }
    }
  } catch (err) {
    logger.error("[ls-webhook] handler failed", err, {
      orderRef: event.providerOrderRef,
      type: event.type,
    });
    return new Response("Handler error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
