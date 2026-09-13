/**
 * Commerce lifecycle transitions — the order/entitlement state machine beyond
 * the happy path. Provider-neutral: the caller has already verified and
 * translated the event.
 *
 *   order not paid  → audit only, NO order row (see `handlePaymentFailure`)
 *   order refunded  → order `refunded` + entitlements `revoked` + audit + alert
 *
 * A purchased book can be paid / failed / refunded / revoked, and every
 * transition is VISIBLE (audit trail), AUDITABLE (`commerce_events`) and
 * RECOVERABLE (idempotent, replayable). The revoked gate is enforced by the
 * download and reader paths, which require `status === 'ready'` — so revoking
 * flips access off with no change at those call sites.
 *
 * ON REVOKING AFTER A REFUND. Lemon Squeezy sends `order_refunded` for a
 * PARTIAL refund as well as a full one, and the payload's order-level
 * `refunded` flag does not distinguish them. This code revokes on either,
 * which is the safe direction for a press: a reader who got money back loses
 * access and can be re-granted by hand, whereas the opposite mistake gives the
 * book away. The choice is deliberate and is recorded in the migration report
 * §27 rather than left to be rediscovered from behaviour.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { entitlements, orders } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

import type { PaymentProviderId } from "@/lib/payments/types";

import { recordCommerceEvent } from "./events";

// ---------------------------------------------------------------------------
// Revocation lifecycle (reusable: refund/chargeback handler + future support
// action). Marks the order `refunded` and ALL its entitlements `revoked`,
// atomically, then audits each transition.
// ---------------------------------------------------------------------------
export interface RevokeOrderArgs {
  orderId: string;
  /** The provider's order reference (`orders.mor_order_ref`). */
  transactionId: string;
  provider?: PaymentProviderId;
  /** Audit event type for the order transition. */
  eventType: "refunded" | "chargeback";
  providerEventId?: string | null;
  reason?: string | null;
}

export async function revokeEntitlementsForOrder(
  args: RevokeOrderArgs,
): Promise<{ revokedIds: string[] }> {
  let revokedIds: string[] = [];

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: "refunded" })
      .where(eq(orders.id, args.orderId));

    // Revoke ONLY this order's entitlements (never another order's grant for
    // the same book → a legitimate re-purchase keeps its access).
    const revoked = await tx
      .update(entitlements)
      .set({ status: "revoked" })
      .where(eq(entitlements.orderId, args.orderId))
      .returning({ id: entitlements.id });
    revokedIds = revoked.map((r) => r.id);
  });

  // Audit: one order-level event + one per revoked entitlement.
  await recordCommerceEvent({
    type: args.eventType,
    provider: args.provider,
    providerEventId: args.providerEventId,
    morOrderRef: args.transactionId,
    orderId: args.orderId,
    reason: args.reason ?? `${args.eventType}: ${revokedIds.length} entitlement(s) revoked`,
  });
  for (const entitlementId of revokedIds) {
    await recordCommerceEvent({
      type: "revoked",
      provider: args.provider,
      // Per-entitlement provider id keeps re-delivery idempotent without
      // colliding with the order-level event's id.
      providerEventId: args.providerEventId
        ? `${args.providerEventId}:${entitlementId}`
        : null,
      morOrderRef: args.transactionId,
      orderId: args.orderId,
      entitlementId,
      reason: `revoked via ${args.eventType}`,
    });
  }

  return { revokedIds };
}

// ---------------------------------------------------------------------------
// Refund
// ---------------------------------------------------------------------------
export interface RefundArgs {
  provider: PaymentProviderId;
  /** The provider's order reference → `orders.mor_order_ref`. */
  providerOrderRef: string;
  /** STABLE per-event id — idempotency + audit. */
  providerEventId?: string | null;
  reason?: string | null;
  /** Treat as a dispute rather than a refund (support action; no webhook). */
  chargeback?: boolean;
}

export interface RefundResult {
  orderFound: boolean;
  revoked: boolean;
  revokedCount: number;
  alreadyRefunded: boolean;
}

export async function handleRefund(args: RefundArgs): Promise<RefundResult> {
  const { provider, providerOrderRef, providerEventId, reason } = args;
  const eventType = args.chargeback ? "chargeback" : "refunded";

  const order = await db.query.orders.findFirst({
    where: (o, { eq: _eq }) => _eq(o.morOrderRef, providerOrderRef),
    columns: { id: true, status: true },
  });

  if (!order) {
    // Money returned but we have no order (fulfilment never completed, or a
    // foreign order). Audit + alert; nothing to revoke.
    logger.error(
      `[commerce] ALERT: ${eventType} for unknown order ${providerOrderRef}`,
      undefined,
      { providerOrderRef, provider },
    );
    await recordCommerceEvent({
      type: eventType,
      provider,
      providerEventId,
      morOrderRef: providerOrderRef,
      reason: `${eventType}: no matching order`,
    });
    return { orderFound: false, revoked: false, revokedCount: 0, alreadyRefunded: false };
  }

  // Idempotency: a re-delivered refund must not re-revoke / double-audit.
  if (order.status === "refunded") {
    await recordCommerceEvent({
      type: eventType,
      provider,
      providerEventId,
      morOrderRef: providerOrderRef,
      orderId: order.id,
      reason: `${eventType}: order already refunded (idempotent no-op)`,
    });
    return { orderFound: true, revoked: false, revokedCount: 0, alreadyRefunded: true };
  }

  const { revokedIds } = await revokeEntitlementsForOrder({
    orderId: order.id,
    transactionId: providerOrderRef,
    provider,
    eventType,
    providerEventId,
    reason: reason
      ? `${eventType} (${reason})`
      : `${eventType}: order refunded, entitlements revoked`,
  });

  // Operational alert — a refund is money out plus access revoked.
  logger.error(
    `[commerce] ALERT: ${eventType} — order ${order.id} refunded, ${revokedIds.length} entitlement(s) revoked`,
    undefined,
    { providerOrderRef, provider, orderId: order.id, revokedCount: revokedIds.length },
  );

  return {
    orderFound: true,
    revoked: true,
    revokedCount: revokedIds.length,
    alreadyRefunded: false,
  };
}

// ---------------------------------------------------------------------------
// Failed / canceled payment
// ---------------------------------------------------------------------------
export interface PaymentFailureArgs {
  provider?: PaymentProviderId;
  transactionId: string;
  providerEventId?: string | null;
  reason?: string | null;
  /** true → canceled; false/undefined → payment failed. */
  canceled?: boolean;
}

/**
 * Record a failed / canceled payment attempt in the audit trail.
 *
 * **Deliberately writes NO order row.** A failed (or canceled) attempt can
 * share its order reference with the eventual paid event (the buyer retries),
 * so inserting a `failed` order keyed on `mor_order_ref` would collide with
 * the idempotent paid-insert and BLOCK fulfilment — the Phase B finding, and
 * the reason this stayed an audit-only path through the provider change. The
 * failed STATE is captured as an audit event: visible, auditable, queryable by
 * order ref, and harmless to the proven paid → fulfilment path.
 */
export async function handlePaymentFailure(
  args: PaymentFailureArgs,
): Promise<void> {
  const type = args.canceled ? "transaction_canceled" : "payment_failed";
  await recordCommerceEvent({
    type,
    provider: args.provider,
    providerEventId: args.providerEventId,
    morOrderRef: args.transactionId,
    reason: args.reason ?? null,
  });
  logger.warn(`[commerce] ${type}`, {
    transactionId: args.transactionId,
    reason: args.reason ?? undefined,
  });
}
