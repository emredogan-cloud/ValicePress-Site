import { describe, expect, it } from "vitest";

import { isAddable } from "./sellable";

describe("isAddable — the one rule for 'this book can go in the cart'", () => {
  it("needs both a price and a live checkout", () => {
    expect(isAddable({ priceCents: 999, buyableHere: true })).toBe(true);
    expect(isAddable({ priceCents: 1, buyableHere: true })).toBe(true);
  });

  it("a book sold on Amazon (price 0) is not addable, whatever else is true", () => {
    expect(isAddable({ priceCents: 0, buyableHere: true })).toBe(false);
    expect(isAddable({ priceCents: 0, buyableHere: false })).toBe(false);
  });

  it("a priced book with no live checkout is not addable (the state the whole catalogue was in between payment providers)", () => {
    expect(isAddable({ priceCents: 999, buyableHere: false })).toBe(false);
  });

  it("unknown is not 'yes'", () => {
    expect(isAddable({ priceCents: 999 })).toBe(false);
  });

  it("a negative price is not a price", () => {
    expect(isAddable({ priceCents: -1, buyableHere: true })).toBe(false);
  });
});
