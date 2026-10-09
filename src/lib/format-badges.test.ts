import { describe, expect, it } from "vitest";

import type { BookEdition } from "@/components/book-card";

import { formatBadges, formatKeys } from "./format-badges";

/**
 * The badge is the card's whole claim about what it sells, so these tests pin
 * what it says — and that the short form a narrow card prints (`compact`) says
 * the same thing in fewer words and never anything else.
 */

const ed = (format: BookEdition["format"], fulfillment: BookEdition["fulfillment"] = "amazon", availability: BookEdition["availability"] = "available"): BookEdition => ({
  format,
  availability,
  fulfillment,
  priceCents: null,
  currency: "USD",
  amazonUrl: null,
  pageCount: null,
});

const labels = (b: ReturnType<typeof formatBadges>) => b.map((x) => x.label);
const compacts = (b: ReturnType<typeof formatBadges>) => b.map((x) => x.compact);

describe("formatBadges — the digital badge", () => {
  it("says PDF + EPUB when the press holds an EPUB, and PDF when it does not", () => {
    const epub = formatBadges({ editions: [ed("ebook", "direct")], hasEpub: true });
    expect(labels(epub)).toEqual(["eBook · PDF + EPUB"]);
    expect(compacts(epub)).toEqual(["PDF + EPUB"]);

    const pdf = formatBadges({ editions: [ed("ebook", "direct")], hasEpub: false });
    expect(labels(pdf)).toEqual(["eBook · PDF"]);
    expect(compacts(pdf)).toEqual(["PDF"]);
  });

  it("an ebook that Amazon fulfils is a Kindle edition, not a download from here", () => {
    const b = formatBadges({ editions: [ed("ebook", "amazon")] });
    expect(labels(b)).toEqual(["Kindle"]);
    expect(compacts(b)).toEqual(["Kindle"]);
  });
});

describe("formatBadges — the print badge", () => {
  const cases: Array<[string, BookEdition["format"][], string, string]> = [
    ["one print edition names it", ["paperback"], "Paperback", "Paperback"],
    ["a hardcover alone is a hardcover", ["hardcover"], "Hardcover", "Hardcover"],
    ["two print editions", ["paperback", "hardcover"], "Paperback · Hardcover", "Paperback +1"],
    ["paperback and large print", ["paperback", "large_print"], "Paperback · Large Print", "Paperback +1"],
    ["three print editions", ["paperback", "hardcover", "large_print"], "Paperback · Hardcover · Large Print", "Paperback +2"],
    ["print reads paperback → hardcover → large print whatever order the rows came in", ["large_print", "hardcover", "paperback"], "Paperback · Hardcover · Large Print", "Paperback +2"],
    ["hardcover and large print lead with the hardcover", ["large_print", "hardcover"], "Hardcover · Large Print", "Hardcover +1"],
  ];
  for (const [name, formats, label, compact] of cases) {
    it(name, () => {
      const b = formatBadges({ editions: formats.map((f) => ed(f)) });
      expect(labels(b)).toEqual([label]);
      expect(compacts(b)).toEqual([compact]);
    });
  }

  it("an edition that is unavailable is not claimed", () => {
    const b = formatBadges({ editions: [ed("paperback"), ed("hardcover", "amazon", "unavailable")] });
    expect(labels(b)).toEqual(["Paperback"]);
  });

  it("a coming-soon edition counts, as it does for the filter", () => {
    expect(formatKeys({ editions: [ed("hardcover", "amazon", "coming_soon")] })).toEqual(["Hardcover"]);
  });
});

describe("formatBadges — pages and the rest", () => {
  it("the page count is the quiet badge and reads the same compact", () => {
    const b = formatBadges({ editions: [ed("paperback")], pageCount: 292 });
    expect(b.map((x) => [x.label, x.compact, x.tone])).toEqual([
      ["Paperback", "Paperback", "format"],
      ["292 pages", "292 pages", "content"],
    ]);
  });

  it("no pages, no badge — a zero or a missing count is not printed", () => {
    expect(labels(formatBadges({ editions: [ed("paperback")], pageCount: 0 }))).toEqual(["Paperback"]);
    expect(labels(formatBadges({ editions: [ed("paperback")], pageCount: null }))).toEqual(["Paperback"]);
  });

  it("a book with no editions produces nothing — the card shows less rather than guess", () => {
    expect(formatBadges({})).toEqual([]);
    expect(formatBadges({ editions: [] })).toEqual([]);
  });

  it("never more than three, digital first, print second, pages last", () => {
    const b = formatBadges({
      editions: [ed("ebook", "direct"), ed("paperback"), ed("hardcover"), ed("large_print")],
      hasEpub: true,
      pageCount: 435,
    });
    expect(labels(b)).toEqual(["eBook · PDF + EPUB", "Paperback · Hardcover · Large Print", "435 pages"]);
    expect(b.length).toBeLessThanOrEqual(3);
  });
});

describe("formatBadges — the short form says nothing the long form does not", () => {
  // Every combination of what a book can hold.
  const FORMATS: BookEdition["format"][] = ["ebook", "paperback", "hardcover", "large_print"];
  const subsets = (arr: BookEdition["format"][]): BookEdition["format"][][] =>
    arr.reduce<BookEdition["format"][][]>((acc, x) => acc.concat(acc.map((s) => [...s, x])), [[]]);

  it("is never longer, and every word of it is in the full label", () => {
    for (const fulfil of ["direct", "amazon"] as const) {
      for (const hasEpub of [true, false]) {
        for (const set of subsets(FORMATS)) {
          const editions = set.map((f) => ed(f, f === "ebook" ? fulfil : "amazon"));
          for (const b of formatBadges({ editions, hasEpub, pageCount: 100 })) {
            expect(b.compact.length, `${b.label} → ${b.compact}`).toBeLessThanOrEqual(b.label.length);
            const words = b.compact.replace(/\+(\d+)/, "").split(/\s+/).filter((w) => w && w !== "+");
            for (const w of words) expect(b.label, `"${w}" of "${b.compact}"`).toContain(w);
          }
        }
      }
    }
  });

  it("a '+N' counts the print editions that are really there", () => {
    for (const set of subsets(["paperback", "hardcover", "large_print"])) {
      if (set.length < 2) continue;
      const [print] = formatBadges({ editions: set.map((f) => ed(f)) });
      expect(print.compact).toMatch(new RegExp(`\\+${set.length - 1}$`));
    }
  });
});
