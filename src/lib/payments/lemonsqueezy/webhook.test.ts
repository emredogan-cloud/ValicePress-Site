/**
 * The §38 delivery matrix, as executable assertions.
 *
 * Every row of the migration report's webhook test matrix has a case here, and
 * each one states the EXPECTED behaviour rather than the observed one — an
 * assertion written from what the code currently does cannot catch the code
 * changing.
 *
 * Payloads are built with a real HMAC over the exact bytes that would be sent,
 * because signing is the one thing that cannot be tested with a mock: the
 * defect this guards against is signing the parsed object instead of the raw
 * body, and a fixture that skips serialisation would pass either way.
 */

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  isSignatureValid,
  readBookIdsFromCustomData,
  readVariantId,
  verifyAndParse,
} from "./webhook";

const SECRET = "valice-test-signing-secret";
const BOOK_ID = "11111111-2222-3333-4444-555555555555";

function sign(raw: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(raw, "utf8").digest("hex");
}

function headersFor(raw: string, opts: { secret?: string; signature?: string } = {}) {
  const h = new Headers();
  h.set("content-type", "application/json");
  h.set("x-event-name", "order_created");
  h.set("x-signature", opts.signature ?? sign(raw, opts.secret ?? SECRET));
  return h;
}

function orderPayload(over: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) {
  return {
    meta: {
      event_name: "order_created",
      custom_data: { book_ids: BOOK_ID },
      ...meta,
    },
    data: {
      type: "orders",
      id: "987654",
      attributes: {
        store_id: 473583,
        customer_id: 8225613,
        identifier: "104e18a2-d755-4d4b-80c4-a6c1dcbe1c10",
        order_number: 12,
        user_name: "A Reader",
        user_email: "reader@example.com",
        currency: "USD",
        subtotal: 999,
        tax: 0,
        total: 999,
        status: "paid",
        refunded: false,
        first_order_item: {
          id: 1,
          order_id: 987654,
          product_id: 55,
          variant_id: 1043277,
          product_name: "Valice Press — Kwaidan",
          variant_name: "Default",
          price: 999,
        },
        test_mode: true,
        ...over,
      },
    },
  };
}

// `withEnv` keeps the secret out of the ambient process env between tests, so
// one test cannot pass because a previous one left a variable set.
function withEnv<T>(secret: string | undefined, fn: () => T): T {
  const prev = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (secret === undefined) delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  else process.env.LEMONSQUEEZY_WEBHOOK_SECRET = secret;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    else process.env.LEMONSQUEEZY_WEBHOOK_SECRET = prev;
  }
}

describe("signature verification", () => {
  it("accepts a hex HMAC-SHA256 over the raw body", () => {
    const raw = JSON.stringify(orderPayload());
    expect(isSignatureValid(raw, SECRET, sign(raw))).toBe(true);
  });

  it("rejects a signature made with a different secret", () => {
    const raw = JSON.stringify(orderPayload());
    expect(isSignatureValid(raw, SECRET, sign(raw, "wrong-secret"))).toBe(false);
  });

  /**
   * The defect this exists for: signing `JSON.stringify(JSON.parse(raw))`
   * instead of `raw`. Re-serialising reorders nothing here but DOES change
   * whitespace, and a verifier that normalises first would accept a body whose
   * bytes were never signed.
   */
  it("rejects a body whose bytes changed even when the object is equal", () => {
    const obj = orderPayload();
    const raw = JSON.stringify(obj);
    const reIndented = JSON.stringify(obj, null, 2);
    expect(reIndented).not.toBe(raw);
    expect(isSignatureValid(reIndented, SECRET, sign(raw))).toBe(false);
  });

  it("rejects a short signature without throwing", () => {
    const raw = JSON.stringify(orderPayload());
    expect(() => isSignatureValid(raw, SECRET, "abc")).not.toThrow();
    expect(isSignatureValid(raw, SECRET, "abc")).toBe(false);
  });

  it("rejects an empty signature", () => {
    const raw = JSON.stringify(orderPayload());
    expect(isSignatureValid(raw, SECRET, "")).toBe(false);
  });
});

describe("the §38 delivery matrix", () => {
  it("SUCCESS — a paid order becomes an order_paid event with the book resolved", () => {
    const raw = JSON.stringify(orderPayload());
    const result = withEnv(SECRET, () => verifyAndParse(raw, headersFor(raw)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.type).toBe("order_paid");
    expect(result.event.providerOrderRef).toBe("987654");
    expect(result.event.order?.bookIds).toEqual([BOOK_ID]);
    expect(result.event.order?.buyerEmail).toBe("reader@example.com");
    expect(result.event.order?.totalCents).toBe(999);
    expect(result.event.order?.currency).toBe("USD");
    expect(result.event.testMode).toBe(true);
  });

  /**
   * DUPLICATE. The idempotency key must be identical for two deliveries of the
   * same event. It is derived from (provider, event name, order id) precisely
   * so that a retry — which carries no delivery id we can rely on — collapses
   * onto the same `commerce_events.provider_event_id` and the same
   * `orders.mor_order_ref`.
   */
  it("DUPLICATE — a re-delivery produces a byte-identical idempotency key", () => {
    const raw = JSON.stringify(orderPayload());
    const a = withEnv(SECRET, () => verifyAndParse(raw, headersFor(raw)));
    const b = withEnv(SECRET, () => verifyAndParse(raw, headersFor(raw)));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.event.providerEventId).toBe(b.event.providerEventId);
    expect(a.event.providerEventId).toBe("lemonsqueezy:order_created:987654");
  });

  it("INVALID SIGNATURE — 401, and nothing is parsed", () => {
    const raw = JSON.stringify(orderPayload());
    const result = withEnv(SECRET, () =>
      verifyAndParse(raw, headersFor(raw, { signature: sign(raw, "attacker") })),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(401);
  });

  it("MISSING SIGNATURE — 401", () => {
    const raw = JSON.stringify(orderPayload());
    const h = new Headers();
    const result = withEnv(SECRET, () => verifyAndParse(raw, h));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(401);
  });

  it("UNCONFIGURED — 503 rather than a silent accept", () => {
    const raw = JSON.stringify(orderPayload());
    const result = withEnv(undefined, () => verifyAndParse(raw, headersFor(raw)));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(503);
  });

  it("UNPARSEABLE — a correctly signed non-JSON body is 400, not 401", () => {
    const raw = "this is not json";
    const result = withEnv(SECRET, () => verifyAndParse(raw, headersFor(raw)));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 400 and not 401 is the whole point: a 401 here sends whoever is
    // debugging to rotate a secret that was never wrong.
    expect(result.status).toBe(400);
  });

  it("EMPTY BODY — 400", () => {
    const result = withEnv(SECRET, () => verifyAndParse("", headersFor("")));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  /**
   * NOT PAID. Lemon Squeezy publishes no payment-failed event; a failed or
   * pending attempt arrives as `order_created` with a status that is not
   * `paid`. Delivering on one would give the book away for nothing.
   */
  it.each(["pending", "failed", "refunded", "", "PAID_BUT_TYPOED"])(
    "NOT PAID — status '%s' never fulfils",
    (status) => {
      const raw = JSON.stringify(orderPayload({ status }));
      const result = withEnv(SECRET, () => verifyAndParse(raw, headersFor(raw)));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.event.type).toBe("order_not_paid");
      expect(result.event.order).toBeUndefined();
    },
  );

  it("PAID is matched case-insensitively but not loosely", () => {
    const raw = JSON.stringify(orderPayload({ status: "Paid" }));
    const result = withEnv(SECRET, () => verifyAndParse(raw, headersFor(raw)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.type).toBe("order_paid");
  });

  it("REFUND — order_refunded translates and keeps its own idempotency key", () => {
    const raw = JSON.stringify(
      orderPayload({ status: "refunded", refunded: true }, { event_name: "order_refunded" }),
    );
    const result = withEnv(SECRET, () => verifyAndParse(raw, headersFor(raw)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.type).toBe("order_refunded");
    expect(result.event.providerEventId).toBe("lemonsqueezy:order_refunded:987654");
    // Must NOT collide with the paid event for the same order, or the refund
    // would dedupe against it and never be recorded.
    expect(result.event.providerEventId).not.toBe("lemonsqueezy:order_created:987654");
  });

  it("UNKNOWN EVENT — acknowledged as ignored, never treated as a sale", () => {
    const raw = JSON.stringify(orderPayload({}, { event_name: "subscription_updated" }));
    const result = withEnv(SECRET, () => verifyAndParse(raw, headersFor(raw)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.type).toBe("ignored");
    expect(result.event.order).toBeUndefined();
  });

  /**
   * The header is outside the signed body, so it must not be able to steer the
   * handler. A genuine `order_created` payload delivered with a forged
   * `X-Event-Name: order_refunded` header must still be read as a paid order.
   */
  it("dispatches on the SIGNED event name, not on the X-Event-Name header", () => {
    const raw = JSON.stringify(orderPayload());
    const h = headersFor(raw);
    h.set("x-event-name", "order_refunded");
    const result = withEnv(SECRET, () => verifyAndParse(raw, h));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.type).toBe("order_paid");
  });

  it("MISSING EVENT NAME — 400", () => {
    const raw = JSON.stringify({ data: { id: "1", attributes: {} }, meta: {} });
    const result = withEnv(SECRET, () => verifyAndParse(raw, headersFor(raw)));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("MISSING ORDER ID — 400, because there is no idempotency key without it", () => {
    const raw = JSON.stringify({
      meta: { event_name: "order_created" },
      data: { type: "orders", attributes: { status: "paid" } },
    });
    const result = withEnv(SECRET, () => verifyAndParse(raw, headersFor(raw)));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("money missing from the payload reads as 0, never NaN", () => {
    const raw = JSON.stringify(orderPayload({ total: undefined, tax: undefined }));
    const result = withEnv(SECRET, () => verifyAndParse(raw, headersFor(raw)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.order?.totalCents).toBe(0);
    expect(result.event.order?.taxCents).toBe(0);
  });
});

describe("resolving which book was bought", () => {
  it("reads a comma-separated custom_data list, as Lemon Squeezy sends it", () => {
    expect(readBookIdsFromCustomData({ book_ids: `${BOOK_ID},${BOOK_ID}` })).toEqual([
      BOOK_ID,
      BOOK_ID,
    ]);
  });

  it("reads an array too, for hand-made payloads", () => {
    expect(readBookIdsFromCustomData({ book_ids: [BOOK_ID] })).toEqual([BOOK_ID]);
  });

  it("returns nothing rather than guessing when custom data is absent", () => {
    expect(readBookIdsFromCustomData(null)).toEqual([]);
    expect(readBookIdsFromCustomData({})).toEqual([]);
    expect(readBookIdsFromCustomData({ book_ids: "" })).toEqual([]);
    expect(readBookIdsFromCustomData({ book_ids: 12345 })).toEqual([]);
  });

  it("exposes the variant id so a storefront purchase can still be resolved", () => {
    expect(readVariantId(orderPayload())).toBe("1043277");
  });

  it("returns null when there is no first order item to read", () => {
    expect(readVariantId(orderPayload({ first_order_item: null }))).toBeNull();
    expect(readVariantId({})).toBeNull();
  });

  /**
   * §37 — CROSS-WIRING. The named failure the directive calls out: "World Myths
   * checkout must NEVER deliver World Games." Both halves of the resolution
   * path are exact lookups on an id, so this pins that neither is a
   * near-match: a variant id that differs by one digit resolves to a different
   * book, and custom data for one book never yields another's id.
   */
  it("never resolves one book's purchase to another book", () => {
    const other = "99999999-8888-7777-6666-555555555555";
    const raw = JSON.stringify(orderPayload({}, { custom_data: { book_ids: other } }));
    const result = withEnv(SECRET, () => verifyAndParse(raw, headersFor(raw)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.order?.bookIds).toEqual([other]);
    expect(result.event.order?.bookIds).not.toContain(BOOK_ID);
    expect(readVariantId(orderPayload({ first_order_item: { variant_id: 1043278 } }))).toBe(
      "1043278",
    );
  });
});
