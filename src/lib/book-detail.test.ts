import { describe, expect, it } from "vitest";

import { bookHighlights, descriptionParagraphs, heroBlurb, lookInsideTiles, primaryAmazonEdition } from "./book-detail";
import type { BookFormat } from "@/lib/db/queries/catalog";

const fmt = (over: Partial<BookFormat>): BookFormat =>
  ({ format: "paperback", availability: "available", fulfillment: "amazon", priceCents: 1299, currency: "USD", pageCount: 100, amazonUrl: null, amazonAsin: null, ...over }) as BookFormat;

describe("descriptionParagraphs / heroBlurb", () => {
  it("splits on blank lines and keeps the wording", () => {
    expect(descriptionParagraphs("One.\n\nTwo\nlines.\n\n\n  Three.  ")).toEqual(["One.", "Two lines.", "Three."]);
    expect(descriptionParagraphs(null)).toEqual([]);
  });

  it("keeps whole paragraphs while they fit, then whole sentences, and says there is more", () => {
    const paras = ["Alpha beta gamma. Delta.", "Epsilon zeta eta theta iota kappa. Lambda mu nu xi omicron. Pi rho."];
    expect(heroBlurb(paras, 1000)).toEqual({ paragraphs: paras, truncated: false });
    const cut = heroBlurb(paras, 60);
    expect(cut.truncated).toBe(true);
    expect(cut.paragraphs[0]).toBe("Alpha beta gamma. Delta.");
    // never a half sentence
    expect(cut.paragraphs.join(" ")).toMatch(/[.!?]$/);
  });

  it("never returns nothing for a long first paragraph", () => {
    const long = "A sentence that is long enough to matter. " + "Another one follows here. ".repeat(40);
    const r = heroBlurb([long], 120);
    expect(r.paragraphs.length).toBe(1);
    expect(r.truncated).toBe(true);
    expect(r.paragraphs[0].length).toBeLessThanOrEqual(120);
  });
});

describe("primaryAmazonEdition", () => {
  it("prefers Kindle, then paperback, hardcover, large print — and only live, linked editions", () => {
    const rows = [
      fmt({ format: "hardcover", amazonAsin: "B0HARD" }),
      fmt({ format: "paperback", amazonAsin: "B0PAPER" }),
      fmt({ format: "ebook", amazonAsin: "B0KINDLE" }),
    ];
    expect(primaryAmazonEdition(rows)?.href).toBe("https://www.amazon.com/dp/B0KINDLE");
    expect(primaryAmazonEdition(rows.slice(0, 2))?.href).toBe("https://www.amazon.com/dp/B0PAPER");
    expect(primaryAmazonEdition([fmt({ format: "paperback", availability: "unavailable", amazonAsin: "B0X" })])).toBeNull();
    expect(primaryAmazonEdition([fmt({ format: "ebook", fulfillment: "direct" })])).toBeNull();
    expect(primaryAmazonEdition([fmt({ format: "paperback" })])).toBeNull(); // no destination, no button
  });
});

describe("bookHighlights", () => {
  it("returns a book's chips, and nothing for a book without any", () => {
    expect(bookHighlights("the-sweetest-season").map((h) => h.label)).toContain("Slow Burn");
    expect(bookHighlights("no-such-book")).toEqual([]);
  });
});

describe("lookInsideTiles", () => {
  it("shows a book's own pictures, strongest first, and never another book's", () => {
    for (const slug of ["weather-permitting", "the-long-way-back", "kwaidan", "the-great-book-of-world-games"]) {
      const { strip, all } = lookInsideTiles({ slug, title: "T" });
      expect(strip.length, slug).toBeGreaterThan(0);
      expect(all.length, slug).toBeGreaterThanOrEqual(strip.length);
      for (const t of all) {
        expect(t.src, `${slug}: ${t.kind}`).toContain(slug);
        expect(t.width).toBeGreaterThan(0);
        expect(t.alt.length).toBeGreaterThan(5);
      }
      // order: A+ pictures, then pages, then back cover, then passages
      const rank = { aplus: 0, page: 1, back: 2, quote: 3 } as const;
      const ranks = all.map((t) => rank[t.kind]);
      expect(ranks, slug).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it("a book with A+ pictures leads with them; one without leads with its pages", () => {
    expect(lookInsideTiles({ slug: "the-long-way-back", title: "T" }).strip[0].kind).toBe("aplus");
    expect(lookInsideTiles({ slug: "kwaidan", title: "T" }).strip[0].kind).toBe("page");
  });

  it("an unknown book has nothing to show", () => {
    expect(lookInsideTiles({ slug: "no-such-book", title: "T" }).all).toEqual([]);
  });
});
