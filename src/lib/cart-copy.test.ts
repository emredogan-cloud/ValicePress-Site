import { describe, expect, it } from "vitest";

import { CHECKOUT_FAILED_MESSAGE, REMOVE_FAILED_MESSAGE, addToCartMessage, shortAddToCartMessage, type AddToCartFailure } from "./cart-copy";

const REASONS: AddToCartFailure[] = ["unknown", "unavailable", "full", null];

describe("cart copy", () => {
  it("has a sentence for every way adding can fail, and they are not blank", () => {
    for (const reason of REASONS) {
      expect(addToCartMessage(reason).length, String(reason)).toBeGreaterThan(30);
    }
  });

  it("every failure sentence says nothing was charged — the first thing a reader wonders", () => {
    for (const reason of REASONS) expect(addToCartMessage(reason), String(reason)).toMatch(/nothing was charged/i);
    expect(REMOVE_FAILED_MESSAGE).toMatch(/nothing was charged/i);
    expect(CHECKOUT_FAILED_MESSAGE).toMatch(/nothing was charged/i);
  });

  it("different refusals read differently; an unknown book and a dead request read the same", () => {
    expect(addToCartMessage("unavailable")).not.toBe(addToCartMessage("full"));
    expect(addToCartMessage("unavailable")).not.toBe(addToCartMessage("unknown"));
    expect(addToCartMessage("unknown")).toBe(addToCartMessage(null));
  });

  it("never leaks an internal reason code or a stack to the reader", () => {
    for (const reason of REASONS) {
      expect(addToCartMessage(reason), String(reason)).not.toMatch(/unavailable|unknown|ECONN|undefined|null|\bok\b/);
    }
  });

  it("the short form fits a 180px card and says the same thing", () => {
    for (const reason of REASONS) {
      const short = shortAddToCartMessage(reason);
      expect(short.length, String(reason)).toBeLessThanOrEqual(40);
      expect(short.length, String(reason)).toBeGreaterThan(8);
    }
    expect(shortAddToCartMessage("unavailable")).toMatch(/bought here/i);
    expect(shortAddToCartMessage("full")).toMatch(/full/i);
    expect(shortAddToCartMessage("unknown")).toBe(shortAddToCartMessage(null));
  });
});
