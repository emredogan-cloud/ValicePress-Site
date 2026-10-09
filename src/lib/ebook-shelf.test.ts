import { describe, expect, it } from "vitest";

import { hasObtainableEbook } from "./ebook-shelf";

const row = (over: Partial<Parameters<typeof hasObtainableEbook>[0][number]>) => ({
  format: "ebook",
  availability: "available",
  fulfillment: "direct",
  amazonUrl: null,
  ...over,
});

describe("hasObtainableEbook — what /ebooks holds", () => {
  it("holds a book whose ebook is sold here", () => {
    expect(hasObtainableEbook([row({})])).toBe(true);
  });

  // The new romances: Kindle Unlimited, so the ebook is Amazon's alone.
  it("holds a book whose ebook is a Kindle edition with an Amazon page", () => {
    expect(hasObtainableEbook([row({ fulfillment: "amazon", amazonUrl: "https://www.amazon.com/dp/B0HLPPCVT3" })])).toBe(true);
  });

  it("does not hold an Amazon-fulfilled ebook that has no page to send the reader to", () => {
    expect(hasObtainableEbook([row({ fulfillment: "amazon", amazonUrl: null })])).toBe(false);
  });

  it("does not hold an ebook that is only an intention", () => {
    expect(hasObtainableEbook([row({ availability: "coming_soon" })])).toBe(false);
    expect(hasObtainableEbook([row({ availability: "unavailable" })])).toBe(false);
  });

  it("is not satisfied by a print edition", () => {
    expect(
      hasObtainableEbook([
        row({ format: "paperback", fulfillment: "amazon", amazonUrl: "https://www.amazon.com/dp/B0HLXPRMRD" }),
        row({ format: "hardcover", fulfillment: "amazon", amazonUrl: "https://www.amazon.com/dp/B0HLKPSLHH" }),
      ]),
    ).toBe(false);
  });
});
