import { describe, expect, it } from "vitest";

import { validateEventPayload } from "./event-payload";

describe("validateEventPayload", () => {
  it("accepts a known event with PII-free props", () => {
    const v = validateEventPayload({
      event: "view_item",
      props: { slug: "meditations", priceCents: 999, currency: "USD" },
      path: "/books/meditations?utm=x",
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.bookSlug).toBe("meditations");
      expect(v.path).toBe("/books/meditations");
      expect(v.props).toEqual({ slug: "meditations", priceCents: 999, currency: "USD" });
    }
  });

  it("drops unknown events", () => {
    expect(validateEventPayload({ event: "made_up" })).toMatchObject({ ok: false, reason: "unknown-event" });
  });

  it("refuses PII-looking keys and values", () => {
    expect(validateEventPayload({ event: "purchase", props: { email: "a@b.co" } })).toMatchObject({ ok: false });
    expect(validateEventPayload({ event: "purchase", props: { note: "write to a@b.co" } })).toMatchObject({ ok: false });
  });

  it("caps props and strings", () => {
    const many = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`k${i}`, i]));
    expect(validateEventPayload({ event: "search", props: many })).toMatchObject({ ok: false, reason: "too-many-props" });
    expect(validateEventPayload({ event: "search", props: { s: "x".repeat(121) } })).toMatchObject({ ok: false });
  });

  it("rejects non-pathname paths", () => {
    expect(validateEventPayload({ event: "view_item", path: "https://evil.example/" })).toMatchObject({ ok: false, reason: "bad-path" });
  });
});
