import { describe, expect, it } from "vitest";

import { BOOKS } from "../../scripts/catalog/valice-catalog.mjs";
import { PINNED_BOOK_SLUGS, byPinnedRank, withPinnedFirst } from "./pinned-books";

const row = (slug: string) => ({ slug });
const slugs = (rows: ReadonlyArray<{ slug: string }>) => rows.map((r) => r.slug);

describe("PINNED_BOOK_SLUGS", () => {
  it("pins the five books the brief names, in the order named, then the two that follow them", () => {
    expect(PINNED_BOOK_SLUGS).toEqual([
      "weather-permitting",
      "ridge-runner",
      "the-sweetest-season",
      "the-great-book-of-world-games",
      "codex-bestiarium",
      "the-long-way-back",
      "all-the-quiet-places",
    ]);
  });

  // A pin on a slug the catalogue does not hold orders nothing, silently. The
  // catalogue is the source of truth; a typo here must fail, not no-op.
  it("names only books the catalogue holds — published, or the one staged draft", () => {
    const bySlug = new Map(BOOKS.map((b) => [b.slug, b]));
    for (const slug of PINNED_BOOK_SLUGS) {
      const book = bySlug.get(slug);
      expect(book, `${slug} is not in the catalogue`).toBeDefined();
      // A draft may be pinned only if it is deliberately staged: its record must
      // say why it is not live. (A pin on a draft is inert — see the file's header.)
      if (book!.websiteStatus !== "published") {
        expect(book!.websiteStatus, `${slug}`).toBe("draft");
        expect(book!.blockers.join(" "), `${slug} is a draft pin with no stated reason`).toMatch(/NOT ON AMAZON/);
      }
    }
  });

  it("has no duplicate pins", () => {
    expect(new Set(PINNED_BOOK_SLUGS).size).toBe(PINNED_BOOK_SLUGS.length);
  });
});

describe("byPinnedRank", () => {
  // How the catalog queries use it: as the last `.sort` after their own order.
  it("puts the pins first and keeps the order the list already had below them", () => {
    const newestFirst = [
      { slug: "the-sweetest-season", at: 5 },
      { slug: "how-the-world-began", at: 4 },
      { slug: "codex-bestiarium", at: 3 },
      { slug: "kwaidan", at: 2 },
      { slug: "the-great-book-of-world-games", at: 1 },
      { slug: "weather-permitting", at: 0 },
    ];
    const out = [...newestFirst].sort((a, b) => b.at - a.at).sort(byPinnedRank);
    expect(slugs(out)).toEqual([
      "weather-permitting",
      "the-sweetest-season",
      "the-great-book-of-world-games",
      "codex-bestiarium",
      "how-the-world-began",
      "kwaidan",
    ]);
  });

  it("treats every unpinned pair as equal, so it never reorders them", () => {
    expect(byPinnedRank(row("kwaidan"), row("mancala"))).toBe(0);
    expect(byPinnedRank(row("codex-bestiarium"), row("kwaidan"))).toBeLessThan(0);
    expect(byPinnedRank(row("kwaidan"), row("the-great-book-of-world-games"))).toBeGreaterThan(0);
    expect(byPinnedRank(row("weather-permitting"), row("codex-bestiarium"))).toBeLessThan(0);
  });
});

describe("withPinnedFirst", () => {
  it("moves the pinned books to the front in pin order, whatever order they came in", () => {
    const input = [
      "kwaidan",
      "the-sweetest-season",
      "mancala",
      "codex-bestiarium",
      "meditations",
      "the-great-book-of-world-games",
    ].map(row);
    expect(slugs(withPinnedFirst(input))).toEqual([
      "the-sweetest-season",
      "the-great-book-of-world-games",
      "codex-bestiarium",
      "kwaidan",
      "mancala",
      "meditations",
    ]);
  });

  it("keeps every other book in exactly the order it arrived", () => {
    const input = ["c", "a", "codex-bestiarium", "b"].map(row);
    expect(slugs(withPinnedFirst(input))).toEqual(["codex-bestiarium", "c", "a", "b"]);
  });

  // The category-integrity rule: a filtered list that holds only one pinned
  // book gets only that one at the top — nothing is pulled in from outside.
  it("never adds a book the list did not already hold", () => {
    const gamesShelf = ["mancala", "korean-games", "the-great-book-of-world-games"].map(row);
    const out = withPinnedFirst(gamesShelf);
    expect(slugs(out)).toEqual(["the-great-book-of-world-games", "mancala", "korean-games"]);
    expect(out).toHaveLength(gamesShelf.length);
    expect(slugs(withPinnedFirst(["kwaidan", "mancala"].map(row)))).toEqual([
      "kwaidan",
      "mancala",
    ]);
    expect(withPinnedFirst([])).toEqual([]);
  });

  it("returns the same objects rather than copies, and leaves the input untouched", () => {
    const input = ["kwaidan", "codex-bestiarium"].map(row);
    const before = [...input];
    const out = withPinnedFirst(input);
    expect(out[0]).toBe(input[1]);
    expect(input).toEqual(before);
  });

  it("reads the book from `slugOf` when the items are not books themselves", () => {
    const companions = [
      { slug: "hangul", bookSlug: "korean-hangul-handwriting-workbook" },
      { slug: "bestiarium", bookSlug: "codex-bestiarium" },
      { slug: "world-games", bookSlug: "the-great-book-of-world-games" },
    ];
    expect(withPinnedFirst(companions, (c) => c.bookSlug).map((c) => c.slug)).toEqual([
      "world-games",
      "bestiarium",
      "hangul",
    ]);
  });

  // An explicit sort still wins: sorting the pinned-first list by price with a
  // stable sort orders by price, and the pin only settles equal prices.
  it("lets a later stable sort take precedence and only breaks its ties", () => {
    const priced = [
      { slug: "kwaidan", price: 499 },
      { slug: "codex-bestiarium", price: 999 },
      { slug: "mancala", price: 999 },
      { slug: "the-great-book-of-world-games", price: 999 },
    ];
    const byPrice = [...withPinnedFirst(priced)].sort((a, b) => a.price - b.price);
    expect(slugs(byPrice)).toEqual([
      "kwaidan",
      "the-great-book-of-world-games",
      "codex-bestiarium",
      "mancala",
    ]);
  });
});
