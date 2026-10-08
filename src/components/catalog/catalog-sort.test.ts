import { describe, expect, it } from "vitest";

import { availableSorts, effectiveSort, sortBooks } from "./catalog-sort";

const b = (id: string, priceCents: number, rating = 0) => ({ id, priceCents, rating });
const ids = (arr: Array<{ id: string }>) => arr.map((x) => x.id).join(" ");

describe("sortBooks — price", () => {
  // d and e are not sold here (price 0): they are NOT the cheapest books.
  const shelf = [b("a", 899), b("d", 0), b("b", 499), b("e", 0), b("c", 1199)];

  it("low → high lists priced books cheapest first, and unpriced books last in their old order", () => {
    expect(ids(sortBooks(shelf, "price-low"))).toBe("b a c d e");
  });

  it("high → low lists priced books dearest first, and unpriced books STILL last", () => {
    expect(ids(sortBooks(shelf, "price-high"))).toBe("c a b d e");
  });

  it("books at the same price keep the order they came in", () => {
    const tied = [b("x", 499), b("y", 499), b("z", 299)];
    expect(ids(sortBooks(tied, "price-low"))).toBe("z x y");
    expect(ids(sortBooks(tied, "price-high"))).toBe("x y z");
  });

  it("all unpriced → nothing moves", () => {
    const none = [b("p", 0), b("q", 0), b("r", 0)];
    expect(ids(sortBooks(none, "price-low"))).toBe("p q r");
    expect(ids(sortBooks(none, "price-high"))).toBe("p q r");
  });
});

describe("sortBooks — the rest", () => {
  it("newest is the order the catalogue already has", () => {
    const shelf = [b("a", 1), b("b", 2), b("c", 3)];
    expect(ids(sortBooks(shelf, "newest"))).toBe("a b c");
  });

  it("top rated puts the best-reviewed first", () => {
    expect(ids(sortBooks([b("a", 1, 3.2), b("b", 1, 4.8), b("c", 1, 0)], "rating"))).toBe("b a c");
  });

  it("never mutates what it was given", () => {
    const shelf = [b("a", 900), b("b", 100)];
    const copy = [...shelf];
    sortBooks(shelf, "price-low");
    expect(shelf).toEqual(copy);
  });
});

describe("availableSorts / effectiveSort", () => {
  it("offers 'Top Rated' only once a book has a rating", () => {
    expect(availableSorts([b("a", 499), b("b", 899)])).toEqual(["newest", "price-low", "price-high"]);
    expect(availableSorts([b("a", 499, 4.5), b("b", 899)])).toEqual(["newest", "price-low", "price-high", "rating"]);
  });

  it("offers price sorts only when at least two books have a price", () => {
    expect(availableSorts([b("a", 499), b("b", 0)])).toEqual(["newest"]);
    expect(availableSorts([])).toEqual(["newest"]);
  });

  it("a link that asks for a sort that is not on offer gets the default order", () => {
    const unrated = [b("a", 499), b("b", 899)];
    expect(effectiveSort("rating", unrated)).toBe("newest");
    expect(effectiveSort("price-low", unrated)).toBe("price-low");
    expect(effectiveSort("price-low", [b("a", 0)])).toBe("newest");
  });
});
