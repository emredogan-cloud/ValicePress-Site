/**
 * Commerce audit trail — append-only record of every MoR lifecycle transition
 * (paid / payment_failed / transaction_canceled / refunded / chargeback /
 * revoked), backed by the `commerce_events` table.
 *
 * The enum still carries `transaction_canceled` and `chargeback` although
 * Lemon Squeezy emits neither: the rows Paddle wrote under those types are
 * still in the table and must keep their meaning, and a support action can
 * still record a chargeback by hand. An event type that no provider currently
 * sends is not a dead type, it is a type with no automatic writer.
 *
 * This is the source of truth for "a purchased book's state history is
 * VISIBLE, AUDITABLE and RECOVERABLE" and the data layer for support
 * visibility. Writes are best-effort and idempotent; reads are read-only.
 */

import { db } from "@/lib/db";
import { commerceEvents } from "@/lib/db/schema";
import type { PaymentProviderId } from "@/lib/payments/types";

export type CommerceEventType =
  | "paid"
  | "payment_failed"
  | "transaction_canceled"
  | "refunded"
  | "chargeback"
  | "revoked";

export interface RecordCommerceEventArgs {
  type: CommerceEventType;
  /** Which merchant of record the event came from. Defaults to the active one. */
  provider?: PaymentProviderId;
  /**
   * STABLE per-event idempotency key — UNIQUE, so a re-delivered webhook
   * records exactly one row. Must be derived from the event (provider, name
   * and order ref), never from a per-delivery id, or a retry writes a second
   * row and the audit trail stops being a count of what happened.
   */
  providerEventId?: string | null;
  /** The provider's order reference; mirrors `orders.mor_order_ref`. */
  morOrderRef?: string | null;
  orderId?: string | null;
  entitlementId?: string | null;
  reason?: string | null;
}

/**
 * Append one audit row. **Idempotent** on `providerEventId` (UNIQUE) — a
 * re-delivered Paddle webhook records exactly one row. **Best-effort:** never
 * throws (an audit-write failure must never break the webhook / fulfillment /
 * revocation path). Returns `true` if a row was written, `false` if it was
 * deduplicated or the write failed.
 */
export async function recordCommerceEvent(
  args: RecordCommerceEventArgs,
): Promise<boolean> {
  try {
    const inserted = await db
      .insert(commerceEvents)
      .values({
        type: args.type,
        provider: args.provider ?? "lemonsqueezy",
        providerEventId: args.providerEventId ?? null,
        morOrderRef: args.morOrderRef ?? null,
        orderId: args.orderId ?? null,
        entitlementId: args.entitlementId ?? null,
        reason: args.reason?.slice(0, 500) ?? null,
      })
      // NULL provider ids never conflict (Postgres treats NULLs as distinct),
      // so non-provider events (e.g. support actions) always record; provider
      // events (id present) dedupe on re-delivery.
      .onConflictDoNothing({ target: commerceEvents.providerEventId })
      .returning({ id: commerceEvents.id });
    return inserted.length > 0;
  } catch (err) {
    console.error("[commerce-events] record failed:", err);
    return false;
  }
}

export interface CommerceEventRow {
  id: string;
  type: CommerceEventType;
  morOrderRef: string | null;
  orderId: string | null;
  entitlementId: string | null;
  reason: string | null;
  createdAt: Date;
}

const EVENT_COLUMNS = {
  id: true,
  type: true,
  morOrderRef: true,
  orderId: true,
  entitlementId: true,
  reason: true,
  createdAt: true,
} as const;

/** Support visibility — full audit timeline for an order, newest first. */
export async function getCommerceEventsForOrder(
  orderId: string,
): Promise<CommerceEventRow[]> {
  return db.query.commerceEvents.findMany({
    where: (e, { eq }) => eq(e.orderId, orderId),
    orderBy: (e, { desc }) => [desc(e.createdAt)],
    columns: EVENT_COLUMNS,
  });
}

/**
 * Support visibility — audit timeline by Paddle transaction ref. Covers events
 * that have no order row (e.g. a `payment_failed` attempt that never completed).
 */
export async function getCommerceEventsForRef(
  morOrderRef: string,
): Promise<CommerceEventRow[]> {
  return db.query.commerceEvents.findMany({
    where: (e, { eq }) => eq(e.morOrderRef, morOrderRef),
    orderBy: (e, { desc }) => [desc(e.createdAt)],
    columns: EVENT_COLUMNS,
  });
}
