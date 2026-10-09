import { describe, expect, it } from "vitest";

import type { BookCardData } from "@/components/book-card";

import { pickRecommendations } from "./recommendations";

function book(slug: string, extra: Partial<BookCardData> = {}): BookCardData {
  return {
    id: `id-${slug}`,
    slug,
    title: slug,
    subtitle: null,
    coverKey: null,
    priceCents: 999,
    buyableHere: true,
    currency: "USD",
    authors: [{ slug: "house", name: "House" }],
    primaryCategory: "General",
    ...extra,
  };
}
const slugs = (books: BookCardData[]) => books.map((b) => b.slug);
const none = new Set<string>();

describe("pickRecommendations", () => {
  it("offers only books the cart will accept (the shelf that was five-eighths unbuyable)", () => {
    const all = [
      book("amazon-only-1", { priceCents: 0, buyableHere: false }),
      book("a"),
      book("amazon-only-2", { priceCents: 0, buyableHere: false }),
      book("b"),
      book("no-checkout", { buyableHere: false }),
      book("c"),
    ];
    expect(slugs(pickRecommendations({ all, exclude: none }))).toEqual(["a", "b", "c"]);
  });

  it("leaves out what is in the cart and what the reader owns", () => {
    const all = [book("a"), book("b"), book("c"), book("d")];
    const exclude = new Set(["id-b", "id-d"]);
    expect(slugs(pickRecommendations({ all, exclude }))).toEqual(["a", "c"]);
  });

  it("keeps the catalogue's order when there is nothing to relate to, and honours the limit", () => {
    const all = Array.from({ length: 20 }, (_, i) => book(`b${i}`));
    expect(slugs(pickRecommendations({ all, exclude: none, limit: 5 }))).toEqual(["b0", "b1", "b2", "b3", "b4"]);
    expect(pickRecommendations({ all, exclude: none })).toHaveLength(12);
  });

  it("puts the same author first, then the same collection, then the rest", () => {
    const seed = book("seed", { authors: [{ slug: "keightley", name: "Keightley" }, { slug: "house", name: "House" }], primaryCategory: "Folklore" });
    const sameAuthor = book("vol-2", { authors: [{ slug: "keightley", name: "Keightley" }, { slug: "house", name: "House" }], primaryCategory: "Other" });
    const sameShelf = book("same-shelf", { primaryCategory: "Folklore" });
    const unrelated = book("unrelated", { primaryCategory: "Games" });
    // Catalogue order puts the unrelated book first; relatedness must beat it.
    const all = [unrelated, sameShelf, sameAuthor, seed];
    const picks = pickRecommendations({ all, exclude: new Set([seed.id]), seeds: [seed] });
    expect(slugs(picks)).toEqual(["vol-2", "same-shelf", "unrelated"]);
  });

  it("a bundle partner outranks everything", () => {
    const seed = book("meditations");
    const partner = book("epictetus", { authors: [{ slug: "epictetus", name: "Epictetus" }] });
    const sameAuthorish = book("other");
    const picks = pickRecommendations({
      all: [sameAuthorish, partner, seed],
      exclude: new Set([seed.id]),
      seeds: [seed],
      bundledWith: (slug) => (slug === "meditations" ? ["meditations", "epictetus"] : []),
    });
    expect(slugs(picks)[0]).toBe("epictetus");
  });

  it("a two-book cart gets each book's best match, not twice the first book's", () => {
    const folk = book("folk", { primaryCategory: "Folklore", authors: [{ slug: "a1", name: "A1" }] });
    const game = book("game", { primaryCategory: "Games", authors: [{ slug: "a2", name: "A2" }] });
    const folk2 = book("folk-2", { primaryCategory: "Folklore", authors: [{ slug: "a3", name: "A3" }] });
    const folk3 = book("folk-3", { primaryCategory: "Folklore", authors: [{ slug: "a4", name: "A4" }] });
    const game2 = book("game-2", { primaryCategory: "Games", authors: [{ slug: "a5", name: "A5" }] });
    const picks = pickRecommendations({
      all: [folk, game, folk2, folk3, game2],
      exclude: new Set([folk.id, game.id]),
      seeds: [folk, game],
      limit: 2,
    });
    expect(slugs(picks).sort()).toEqual(["folk-2", "game-2"]);
  });

  it("never lists a book twice, however many cart lines point at it", () => {
    const s1 = book("s1", { primaryCategory: "X" });
    const s2 = book("s2", { primaryCategory: "X" });
    const picks = pickRecommendations({ all: [s1, s2, book("c1", { primaryCategory: "X" }), book("c2", { primaryCategory: "X" })], exclude: new Set([s1.id, s2.id]), seeds: [s1, s2] });
    expect(new Set(slugs(picks)).size).toBe(picks.length);
    expect(slugs(picks).sort()).toEqual(["c1", "c2"]);
  });

  it("returns nothing when nothing qualifies, so the shelf can be left out", () => {
    expect(pickRecommendations({ all: [], exclude: none })).toEqual([]);
    expect(pickRecommendations({ all: [book("x", { priceCents: 0, buyableHere: false })], exclude: none })).toEqual([]);
    expect(pickRecommendations({ all: [book("x")], exclude: new Set(["id-x"]) })).toEqual([]);
  });

  it("does not modify the list it was given", () => {
    const all = [book("a"), book("b")];
    const snapshot = JSON.stringify(all);
    pickRecommendations({ all, exclude: none, seeds: [all[0]] });
    expect(JSON.stringify(all)).toBe(snapshot);
  });
});
