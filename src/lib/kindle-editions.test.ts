import { describe, expect, it } from "vitest";

import { type SplittableFormat, withKindleEditions } from "./kindle-editions";

const row = (over: Partial<SplittableFormat>): SplittableFormat => ({
  format: "ebook",
  availability: "available",
  fulfillment: "direct",
  priceCents: 999,
  pageCount: 182,
  amazonAsin: null,
  amazonUrl: null,
  isbn: null,
  masterFileKey: "books/x/master/v1/master.pdf",
  ...over,
});

const KINDLE = "https://www.amazon.com/dp/B0HG44FH1B";

describe("withKindleEditions", () => {
  // The World Games case: sold here as a PDF AND live on Kindle.
  it("turns a direct ebook with a live Kindle ASIN into this site's edition plus Amazon's", () => {
    const [direct, kindle, ...rest] = withKindleEditions([
      row({ amazonAsin: "B0HG44FH1B", amazonUrl: KINDLE }),
    ]);
    expect(rest).toEqual([]);

    // This site's edition keeps its price, file and pages, and gives up the link.
    expect(direct).toMatchObject({
      format: "ebook",
      fulfillment: "direct",
      priceCents: 999,
      pageCount: 182,
      masterFileKey: "books/x/master/v1/master.pdf",
      amazonAsin: null,
      amazonUrl: null,
    });

    // Amazon's edition: the link, and nothing the catalogue does not know
    // about it — no price, no page count, no ISBN, and never a file of ours.
    expect(kindle).toMatchObject({
      format: "ebook",
      fulfillment: "amazon",
      availability: "available",
      amazonAsin: "B0HG44FH1B",
      amazonUrl: KINDLE,
      priceCents: null,
      pageCount: null,
      isbn: null,
      masterFileKey: null,
    });
  });

  it("lists the Kindle edition even when this site is not selling its own ebook", () => {
    const out = withKindleEditions([
      row({ availability: "coming_soon", amazonAsin: "B0HG44FH1B", amazonUrl: KINDLE }),
    ]);
    expect(out.map((f) => [f.fulfillment, f.availability])).toEqual([
      ["direct", "coming_soon"],
      ["amazon", "available"],
    ]);
  });

  it("leaves every other row exactly as it was", () => {
    const select = row({ fulfillment: "amazon", masterFileKey: null, amazonAsin: "B0HD8121RR", amazonUrl: "https://www.amazon.com/dp/B0HD8121RR" });
    const directOnly = row({});
    const paperback = row({ format: "paperback", fulfillment: "amazon", masterFileKey: null, amazonAsin: "B0HG3KMK9L", amazonUrl: "https://www.amazon.com/dp/B0HG3KMK9L" });
    const input = [select, directOnly, paperback];
    const out = withKindleEditions(input);
    expect(out).toHaveLength(3);
    out.forEach((f, i) => expect(f).toBe(input[i]));
  });

  it("puts the Kindle edition straight after this site's, so a stable format sort keeps ours first", () => {
    const out = withKindleEditions([
      row({ amazonAsin: "B0HG44FH1B", amazonUrl: KINDLE }),
      row({ format: "paperback", fulfillment: "amazon", masterFileKey: null, amazonAsin: "B0HG3KMK9L", amazonUrl: "https://www.amazon.com/dp/B0HG3KMK9L" }),
    ]);
    expect(out.map((f) => `${f.format}/${f.fulfillment}`)).toEqual([
      "ebook/direct",
      "ebook/amazon",
      "paperback/amazon",
    ]);
  });
});
