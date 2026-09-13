/**
 * Lemon Squeezy webhook verification and translation.
 *
 * Contract, read off the provider's own documentation on 2026-09-13
 * (docs.lemonsqueezy.com/help/webhooks/{webhook-requests,signing-requests,event-types}):
 *
 *   • `X-Signature`  — HMAC-SHA256 **hex digest of the raw body**, keyed with
 *                      the webhook's signing secret. Compared timing-safely.
 *   • `X-Event-Name` — the event name, ALSO present at `meta.event_name`.
 *                      The header is not trusted on its own: it is outside the
 *                      signed body, so a forged header could steer the handler
 *                      even on a genuine payload. `meta.event_name` is what is
 *                      signed, so that is what is dispatched on.
 *   • Retries        — three more attempts on a non-200 (5s, 25s, 125s), then
 *                      the delivery is abandoned for good. There is no manual
 *                      replay beyond the dashboard's Resend button, which is
 *                      why every failure path below is loud.
 *
 * WHAT LEMON SQUEEZY DOES NOT SEND. There is no payment-failed event and no
 * chargeback/dispute event for one-off orders — the published event list has
 * exactly two order events, `order_created` and `order_refunded`. A failed
 * attempt surfaces only as an `order_created` whose `status` is not `paid`.
 * This is a genuine reduction from Paddle and is recorded rather than papered
 * over; see the migration report §9 and §27.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  PaymentEvent,
  WebhookVerification,
} from "@/lib/payments/types";

/** Events this storefront acts on. Anything else is acknowledged and ignored. */
const HANDLED_EVENTS = new Set(["order_created", "order_refunded"]);

export function getWebhookSecret(): string | null {
  return process.env.LEMONSQUEEZY_WEBHOOK_SECRET || null;
}

/**
 * Constant-time comparison of the request signature against ours.
 *
 * `timingSafeEqual` throws on a length mismatch rather than returning false,
 * so the lengths are checked first — an attacker probing with a short
 * signature would otherwise get a 500 (and a stack trace) where they should
 * get a flat 401.
 */
export function isSignatureValid(
  rawBody: string,
  secret: string,
  signature: string,
): boolean {
  const digest = Buffer.from(
    createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"),
    "utf8",
  );
  const given = Buffer.from(signature, "utf8");
  if (digest.length !== given.length) return false;
  return timingSafeEqual(digest, given);
}

// ---------------------------------------------------------------------------
// Payload shape (only what is read)
// ---------------------------------------------------------------------------

interface LsOrderItem {
  variant_id?: number | string;
  product_id?: number | string;
  product_name?: string;
  variant_name?: string;
}

interface LsOrderAttributes {
  store_id?: number;
  customer_id?: number | string | null;
  identifier?: string;
  order_number?: number;
  user_name?: string | null;
  user_email?: string | null;
  currency?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  status?: string;
  refunded?: boolean;
  first_order_item?: LsOrderItem | null;
  test_mode?: boolean;
}

interface LsWebhookBody {
  meta?: {
    event_name?: string;
    test_mode?: boolean;
    custom_data?: Record<string, unknown> | null;
  };
  data?: {
    type?: string;
    id?: string;
    attributes?: LsOrderAttributes;
  };
}

/**
 * Book ids, in order of trust.
 *
 * 1. `meta.custom_data.book_ids` — what *we* put into the checkout. Lemon
 *    Squeezy stringifies custom data, so it travels as a comma-separated list
 *    rather than an array; both shapes are accepted because a hand-made test
 *    payload naturally writes the array.
 * 2. nothing. A caller that gets an empty list must resolve by variant id
 *    against the catalogue (see `resolveBookIdsForOrder`), which is the path a
 *    purchase made straight from the Lemon Squeezy storefront takes — it never
 *    passed through our checkout and so carries no custom data at all.
 */
export function readBookIdsFromCustomData(
  custom: Record<string, unknown> | null | undefined,
): string[] {
  if (!custom) return [];
  const raw = custom.book_ids ?? custom.bookIds;
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}

/** The variant id the order was for, as a string, or null. */
export function readVariantId(body: unknown): string | null {
  const item = (body as LsWebhookBody)?.data?.attributes?.first_order_item;
  const v = item?.variant_id;
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}

/**
 * Verify and translate. Performs no I/O beyond the HMAC, so it is safe to call
 * before any database work and is directly unit-testable.
 */
export function verifyAndParse(
  rawBody: string,
  headers: Headers,
): WebhookVerification {
  const secret = getWebhookSecret();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      message:
        "LEMONSQUEEZY_WEBHOOK_SECRET is not configured — refusing to process.",
    };
  }

  const signature = headers.get("x-signature");
  if (!signature) {
    return { ok: false, status: 401, message: "Missing X-Signature header" };
  }
  if (!rawBody) {
    return { ok: false, status: 400, message: "Empty body" };
  }
  if (!isSignatureValid(rawBody, secret, signature)) {
    return { ok: false, status: 401, message: "Invalid signature" };
  }

  // Signature is good, so a parse failure is Lemon Squeezy sending a shape we
  // do not understand. 400, not 500: retrying cannot help.
  let body: LsWebhookBody;
  try {
    body = JSON.parse(rawBody) as LsWebhookBody;
  } catch {
    return { ok: false, status: 400, message: "Unparseable JSON body" };
  }

  const eventName = body.meta?.event_name;
  if (!eventName) {
    return { ok: false, status: 400, message: "Missing meta.event_name" };
  }

  const orderId = body.data?.id;
  if (!orderId) {
    return { ok: false, status: 400, message: "Missing data.id" };
  }

  const attrs = body.data?.attributes ?? {};
  const testMode = Boolean(attrs.test_mode ?? body.meta?.test_mode);

  if (!HANDLED_EVENTS.has(eventName)) {
    return {
      ok: true,
      event: {
        type: "ignored",
        provider: "lemonsqueezy",
        // Stable per (event, order) so a re-delivered ignorable event still
        // dedupes rather than filling the audit trail with duplicates.
        providerEventId: `lemonsqueezy:${eventName}:${orderId}`,
        providerOrderRef: orderId,
        reason: `unhandled event ${eventName}`,
        testMode,
      },
    };
  }

  if (eventName === "order_refunded") {
    return {
      ok: true,
      event: {
        type: "order_refunded",
        provider: "lemonsqueezy",
        providerEventId: `lemonsqueezy:order_refunded:${orderId}`,
        providerOrderRef: orderId,
        reason: "order_refunded",
        testMode,
      },
    };
  }

  // order_created. `status` decides whether money actually moved. Lemon
  // Squeezy uses `pending` / `failed` / `paid` / `refunded`; only `paid` may
  // deliver a book, and `refunded` here means the order arrived already
  // reversed, which must not fulfil either.
  const status = String(attrs.status ?? "").toLowerCase();
  if (status !== "paid") {
    return {
      ok: true,
      event: {
        type: "order_not_paid",
        provider: "lemonsqueezy",
        providerEventId: `lemonsqueezy:order_created:${orderId}`,
        providerOrderRef: orderId,
        reason: `order_created with status='${status || "unknown"}' — no fulfilment`,
        testMode,
      },
    };
  }

  const buyerEmail = attrs.user_email?.trim() || "";
  const event: PaymentEvent = {
    type: "order_paid",
    provider: "lemonsqueezy",
    providerEventId: `lemonsqueezy:order_created:${orderId}`,
    providerOrderRef: orderId,
    testMode,
    order: {
      providerOrderRef: orderId,
      providerCustomerId:
        attrs.customer_id === undefined || attrs.customer_id === null
          ? null
          : String(attrs.customer_id),
      buyerEmail,
      buyerName: attrs.user_name?.trim() || null,
      bookIds: readBookIdsFromCustomData(body.meta?.custom_data),
      // Lemon Squeezy sends money as integer cents (unlike Paddle's strings),
      // but a missing field must be 0 rather than NaN.
      totalCents: Number.isFinite(attrs.total) ? Number(attrs.total) : 0,
      taxCents: Number.isFinite(attrs.tax) ? Number(attrs.tax) : 0,
      currency: String(attrs.currency ?? "USD").toUpperCase(),
    },
  };

  return { ok: true, event };
}
