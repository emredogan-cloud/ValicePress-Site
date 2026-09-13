import { recordCommerceEvent } from "@/lib/commerce/events";
import type { PaymentProviderId } from "@/lib/payments/types";
import { db } from "@/lib/db";
import { getCheckoutItems } from "@/lib/db/queries/catalog";
import {
  entitlements,
  orderItems,
  orders,
  watermarkJobs,
  analyticsEvents,
} from "@/lib/db/schema";
import { upsertLocalUser } from "@/lib/db/users";
import {
  FULFILLMENT_EVENT,
  type FulfillmentTransactionCompletedData,
  inngest,
} from "@/lib/inngest/client";

import { appendFulfillmentLogEntry } from "./fulfillment-log";

export interface ProcessPaidOrderArgs {
  /** Which merchant of record this order came from. */
  provider: PaymentProviderId;
  /**
   * The provider's order reference — the canonical idempotency key, written to
   * `orders.mor_order_ref` (UNIQUE). Lemon Squeezy order id today; a Paddle
   * `txn_…` on rows written before 2026-09-13.
   */
  providerOrderRef: string;
  /** Stable per-event id for the audit trail. Never a per-delivery id. */
  providerEventId?: string | null;
  providerCustomerId: string | null;
  buyerEmail: string | null;
  /** Buyer's display name (used for the per-order watermark). */
  buyerName: string | null;
  /** Catalogue ids resolved from the event. */
  bookIds: string[];
  totalCents: number;
  taxCents: number;
  /** ISO-4217 currency code, upper-cased. */
  currency: string;
}

/**
 * Idempotent fulfilment of a paid order. Provider-neutral by construction —
 * nothing below knows or cares who took the money.
 *
 * Idempotency primitive:
 *   The provider's order reference is mapped onto `orders.mor_order_ref`,
 *   which carries a UNIQUE constraint (`orders_mor_order_ref_uk`). The
 *   `onConflictDoNothing(target).returning({id})` pattern *atomically* asks
 *   the database "is this the first time?" — a retry (the provider resends on
 *   a 5xx, or our handler raced with itself) finds an existing row, returns no
 *   rows, and we no-op cleanly. No double fulfilment, no second email.
 *
 * Atomic boundary:
 *   Order + OrderItems + Entitlements(pending) are written inside a single
 *   Drizzle transaction. If any insert mid-way fails the whole tx rolls back,
 *   and the provider's retry re-attempts cleanly.
 *
 * Watermark enqueue:
 *   Once the rows are committed, an `inngest.send(...)` triggers the watermark
 *   worker, which is what actually delivers the book. If the send fails
 *   (Inngest unset, network blip) the order is still safely committed and the
 *   failure is written to the fulfilment audit log so it can be replayed —
 *   the order is NOT reported as fulfilled on the strength of a queued job.
 */
export async function processPaidOrder(
  args: ProcessPaidOrderArgs,
): Promise<void> {
  const {
    provider,
    providerOrderRef: transactionId,
    providerEventId,
    providerCustomerId: customerId,
    buyerEmail: customerEmail,
    buyerName: customerName,
    bookIds,
    totalCents,
    taxCents,
    currency,
  } = args;

  if (!customerEmail) {
    console.error("[fulfillment] missing customer email for", transactionId);
    return;
  }
  if (bookIds.length === 0) {
    console.error("[fulfillment] no bookIds in customData for", transactionId);
    return;
  }

  // Idempotent local-user upsert keyed on email (UNIQUE). `auth_provider`
  // gets a provider placeholder when this is the first time we see the buyer;
  // a Clerk-webhook sync reconciles the row to `clerk:<id>` later.
  const localUserId = await upsertLocalUser({
    clerkUserId: customerId ?? `${provider}-customer-unknown`,
    email: customerEmail,
    name: customerName ?? undefined,
  });

  const books = await getCheckoutItems(bookIds);
  if (books.length === 0) {
    console.error(
      "[fulfillment] none of the bookIds map to published books for",
      transactionId,
      bookIds,
    );
    return;
  }

  // `createdOrderId` is captured from inside the tx so we know whether the
  // current invocation actually fulfilled the order (truthy) or whether it
  // was a Paddle retry of a previously-fulfilled transaction (null).
  let createdOrderId: string | null = null;

  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(orders)
      .values({
        userId: localUserId,
        morOrderRef: transactionId,
        paymentProvider: provider,
        totalCents,
        currency,
        taxCents,
        status: "paid",
      })
      .onConflictDoNothing({ target: orders.morOrderRef })
      .returning({ id: orders.id });

    if (inserted.length === 0) {
      // Idempotent path: another invocation already wrote this order.
      return;
    }

    const orderId = inserted[0].id;
    createdOrderId = orderId;

    for (const book of books) {
      await tx.insert(orderItems).values({
        orderId,
        bookId: book.id,
        priceCentsAtPurchase: book.priceCents,
      });

      const [grantedEntitlement] = await tx
        .insert(entitlements)
        .values({
          userId: localUserId,
          bookId: book.id,
          orderId,
          status: "pending",
        })
        .onConflictDoNothing({
          target: [entitlements.userId, entitlements.bookId],
        })
        .returning({ id: entitlements.id });

      // Queue a watermark job for each freshly-granted entitlement. The row's
      // status defaults to `queued`, so a fulfillment that never reaches the
      // worker (Inngest unsynced / silent queue) is VISIBLE as a `queued` row
      // that never advances — the diagnostic that turns the previously-dead
      // `watermark_jobs` table into a stuck-pipeline signal (Roadmap §6,
      // ADR-3). On a provider retry the order insert above no-ops and the
      // whole tx returns early, so this block never double-creates a job.
      if (grantedEntitlement) {
        await tx
          .insert(watermarkJobs)
          .values({ entitlementId: grantedEntitlement.id });
      }
    }
  });

  if (!createdOrderId) {
    console.log(
      `[fulfillment] transaction ${transactionId} already processed (idempotent return)`,
    );
    return;
  }

  // Phase F — audit the `paid` transition so the full commerce lifecycle
  // (paid → … → refunded/revoked) is queryable in `commerce_events`.
  // Best-effort + idempotent (keyed on the txn; only runs on genuine first
  // fulfillment since `createdOrderId` is truthy only once).
  await recordCommerceEvent({
    type: "paid",
    provider,
    providerEventId: providerEventId ?? `${provider}:paid:${transactionId}`,
    morOrderRef: transactionId,
    orderId: createdOrderId,
    reason: `order paid — ${books.length} item(s), ${totalCents} ${currency}`,
  });

  // First-party `purchase` funnel event, written server-side because the
  // buyer's browser never reliably sees a "completed" moment (the hosted
  // checkout redirects; the webhook is the truth). PII-free by construction:
  // ids, counts and cents only. Best-effort — never blocks fulfilment.
  try {
    await db.insert(analyticsEvents).values({
      event: "purchase",
      props: {
        itemCount: books.length,
        totalCents,
        currency,
        // Catalogue ids, not people: a book uuid identifies a product.
        bookIds: books.map((b) => b.id).join(","),
      },
      path: `/api/webhooks/${provider}`,
      bookSlug: null,
      source: "server",
    });
  } catch (err) {
    console.error(
      "[fulfillment] analytics purchase event failed (non-fatal):",
      err instanceof Error ? err.message : err,
    );
  }

  // Enqueue the watermark job. Order rows are already committed, so even
  // if the send fails (Inngest env unset, network blip) the canonical
  // record exists in Postgres and the worker can be replayed later by
  // re-dispatching the same event with the same data.
  const eventPayload = {
    transactionId,
    orderId: createdOrderId,
    userId: localUserId,
    buyerName: customerName ?? null,
    buyerEmail: customerEmail,
    bookIds: books.map((b) => b.id),
  } satisfies FulfillmentTransactionCompletedData;

  try {
    await inngest.send({
      name: FULFILLMENT_EVENT,
      data: eventPayload,
    });
    await appendFulfillmentLogEntry({
      timestamp: new Date().toISOString(),
      ...eventPayload,
      totalCents,
      currency,
      note: "watermark-job enqueued via inngest.send",
    });
  } catch (err) {
    console.error("[fulfillment] inngest.send failed:", err);
    await appendFulfillmentLogEntry({
      timestamp: new Date().toISOString(),
      ...eventPayload,
      totalCents,
      currency,
      note: "ENQUEUE FAILED — Inngest unreachable. Order is committed; replay this event manually once Inngest is configured.",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
