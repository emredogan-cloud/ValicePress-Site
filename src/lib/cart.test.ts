/**
 * Unit tests for the cart cookie parser (SUB-PR 4.5) and the pure cart operations.
 *
 * `safeParseCart` is the trust boundary between an untrusted cookie value and
 * our typed cart model. It runs on every request that touches the cart and any
 * throw here would 500 the cart page, so it gets a dense battery of edge cases.
 *
 * The second half is the regression for the worst defect the cart had: ONE
 * module-level empty cart handed to every cookie-less request and mutated by
 * `addToCart`, which leaked one visitor's book into every other visitor's cart
 * on the same server instance. The tests below fail if any function returns, or
 * modifies, an object that outlives the call.
 */

import { describe, expect, it } from "vitest";

import {
  MAX_CART_ITEMS,
  addItem,
  cartHas,
  emptyCart,
  isBookId,
  pruneItems,
  removeItem,
  safeParseCart,
  type Cart,
} from "./cart";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";
/** An id with letters in it, so that upper and lower case are really different strings. */
const HEX = "abcdef01-2345-4678-89ab-cdef01234567";

/** The n-th distinct UUID, for filling a cart to its limit. */
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("safeParseCart", () => {
  it("returns empty cart when cookie is undefined", () => {
    expect(safeParseCart(undefined)).toEqual({ items: [] });
  });

  it("returns empty cart when cookie is the empty string", () => {
    expect(safeParseCart("")).toEqual({ items: [] });
  });

  it("returns empty cart on malformed JSON (never throws)", () => {
    expect(safeParseCart("{not-valid")).toEqual({ items: [] });
    expect(safeParseCart("undefined")).toEqual({ items: [] });
  });

  it("returns empty cart when JSON parses to a non-object", () => {
    expect(safeParseCart("null")).toEqual({ items: [] });
    expect(safeParseCart('"a string"')).toEqual({ items: [] });
    expect(safeParseCart("42")).toEqual({ items: [] });
  });

  it("returns empty cart when items is missing or not an array", () => {
    expect(safeParseCart('{"items":null}')).toEqual({ items: [] });
    expect(safeParseCart('{"items":"not-an-array"}')).toEqual({ items: [] });
    expect(safeParseCart('{"items":{}}')).toEqual({ items: [] });
    expect(safeParseCart("{}")).toEqual({ items: [] });
  });

  it("filters out invalid items (drops them, keeps the valid)", () => {
    const cookie = JSON.stringify({
      items: [
        { bookId: A, addedAt: 1717000000 },
        { bookId: 123, addedAt: 1717000000 }, // bookId must be string
        { bookId: B, addedAt: "not-a-number" }, // addedAt must be number
        { bookId: C, addedAt: Number.NaN }, // addedAt must be finite
        { bookId: D, addedAt: 1717000001 },
        null,
        "garbage",
      ],
    });
    expect(safeParseCart(cookie)).toEqual({
      items: [
        { bookId: A, addedAt: 1717000000 },
        { bookId: D, addedAt: 1717000001 },
      ],
    });
  });

  it("returns the parsed cart unchanged on the happy path", () => {
    const cookie = JSON.stringify({
      items: [
        { bookId: A, addedAt: 1717000000 },
        { bookId: B, addedAt: 1717000100 },
      ],
    });
    expect(safeParseCart(cookie)).toEqual({
      items: [
        { bookId: A, addedAt: 1717000000 },
        { bookId: B, addedAt: 1717000100 },
      ],
    });
  });

  it("strips extraneous fields from items (defensive against tampering)", () => {
    const cookie = JSON.stringify({
      items: [{ bookId: A, addedAt: 1717000000, isAdmin: true, price: 0 }],
    });
    const result = safeParseCart(cookie);
    expect(result.items[0]).toEqual({ bookId: A, addedAt: 1717000000 });
    // Confirm extra properties are NOT carried through:
    expect(result.items[0]).not.toHaveProperty("isAdmin");
    expect(result.items[0]).not.toHaveProperty("price");
  });

  it("drops an id that is not a UUID instead of letting it poison the book query", () => {
    const cookie = JSON.stringify({
      items: [
        { bookId: "book-a", addedAt: 1 },
        { bookId: "'; drop table books; --", addedAt: 2 },
        { bookId: "", addedAt: 3 },
        { bookId: A, addedAt: 4 },
        { bookId: `${B}x`, addedAt: 5 }, // right shape, wrong length
      ],
    });
    expect(safeParseCart(cookie).items.map((i) => i.bookId)).toEqual([A]);
  });

  it("folds a duplicated id into its first appearance", () => {
    const cookie = JSON.stringify({
      items: [
        { bookId: A, addedAt: 10 },
        { bookId: B, addedAt: 20 },
        { bookId: A, addedAt: 30 },
      ],
    });
    expect(safeParseCart(cookie)).toEqual({
      items: [
        { bookId: A, addedAt: 10 },
        { bookId: B, addedAt: 20 },
      ],
    });
  });

  it("lower-cases ids, so a line always matches its book by plain string equality", () => {
    const cart = safeParseCart(JSON.stringify({ items: [{ bookId: HEX.toUpperCase(), addedAt: 1 }] }));
    expect(cart.items).toEqual([{ bookId: HEX, addedAt: 1 }]);
    // The same id spelled in two cases is one line.
    const both = safeParseCart(JSON.stringify({ items: [{ bookId: HEX.toUpperCase(), addedAt: 1 }, { bookId: HEX, addedAt: 2 }] }));
    expect(both.items).toEqual([{ bookId: HEX, addedAt: 1 }]);
  });

  it(`keeps at most ${MAX_CART_ITEMS} lines`, () => {
    const items = Array.from({ length: MAX_CART_ITEMS + 12 }, (_, n) => ({ bookId: uuid(n), addedAt: n }));
    expect(safeParseCart(JSON.stringify({ items })).items).toHaveLength(MAX_CART_ITEMS);
  });

  it("never hands out an object that outlives the call (the cross-visitor leak)", () => {
    // Every unreadable or missing cookie used to resolve to the SAME `{ items: [] }`.
    const results = [
      safeParseCart(undefined),
      safeParseCart(""),
      safeParseCart("{not-valid"),
      safeParseCart("null"),
      safeParseCart('{"items":null}'),
    ];
    const everyObject = [...results, safeParseCart(undefined), emptyCart(), emptyCart()];
    expect(new Set(everyObject).size).toBe(everyObject.length);
    expect(new Set(everyObject.map((c) => c.items)).size).toBe(everyObject.length);

    // And writing into one must not show up in the next.
    results[0].items.push({ bookId: A, addedAt: 1 });
    expect(safeParseCart(undefined)).toEqual({ items: [] });
    expect(emptyCart()).toEqual({ items: [] });
  });
});

describe("isBookId", () => {
  it("accepts canonical UUIDs in either case and nothing else", () => {
    expect(isBookId(A)).toBe(true);
    expect(isBookId(HEX)).toBe(true);
    expect(isBookId(HEX.toUpperCase())).toBe(true);
    for (const bad of ["", "book-a", "1", `${A} `, ` ${A}`, `{${A}}`, A.replace(/-/g, ""), null, undefined, 7, {}, [A]]) {
      expect(isBookId(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("addItem", () => {
  it("adds a book to an empty cart", () => {
    const r = addItem(emptyCart(), A, 100);
    expect(r.outcome).toBe("added");
    expect(r.cart).toEqual({ items: [{ bookId: A, addedAt: 100 }] });
  });

  it("is idempotent: adding it again changes nothing (quantity is implicitly 1)", () => {
    const once = addItem(emptyCart(), A, 100).cart;
    const twice = addItem(once, A, 999);
    expect(twice.outcome).toBe("inCart");
    expect(twice.cart).toEqual({ items: [{ bookId: A, addedAt: 100 }] });
    expect(cartHas(twice.cart, A)).toBe(true);
  });

  it("keeps the order books were added in", () => {
    let cart = emptyCart();
    for (const [n, id] of [A, B, C].entries()) cart = addItem(cart, id, n).cart;
    expect(cart.items.map((i) => i.bookId)).toEqual([A, B, C]);
  });

  it("matches an id however it is cased", () => {
    const r = addItem(addItem(emptyCart(), HEX, 1).cart, HEX.toUpperCase(), 2);
    expect(r.outcome).toBe("inCart");
    expect(r.cart.items).toEqual([{ bookId: HEX, addedAt: 1 }]);
    // ...and a mixed-case id is stored in the one form the database prints.
    expect(addItem(emptyCart(), HEX.toUpperCase(), 3).cart.items[0].bookId).toBe(HEX);
  });

  it("refuses to grow past the limit instead of writing a cookie the browser would drop", () => {
    let cart = emptyCart();
    for (let n = 0; n < MAX_CART_ITEMS; n++) cart = addItem(cart, uuid(n), n).cart;
    expect(cart.items).toHaveLength(MAX_CART_ITEMS);
    const r = addItem(cart, uuid(MAX_CART_ITEMS), 1);
    expect(r.outcome).toBe("full");
    expect(r.cart.items).toHaveLength(MAX_CART_ITEMS);
    // A book that is already there is still "in the cart", even when the cart is full.
    expect(addItem(cart, uuid(3), 1).outcome).toBe("inCart");
  });

  it("does not modify the cart it was given, and never returns it", () => {
    const original: Cart = { items: [{ bookId: A, addedAt: 1 }] };
    const snapshot = JSON.stringify(original);
    const added = addItem(original, B, 2);
    const again = addItem(original, A, 3);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(added.cart).not.toBe(original);
    expect(again.cart).not.toBe(original);
    expect(again.cart.items[0]).not.toBe(original.items[0]);
  });

  it("two visitors adding from nothing never see each other's books", () => {
    // The shape of the production bug, with the module-level object taken out:
    // both visitors start from `emptyCart()` / `safeParseCart(undefined)`.
    const first = addItem(safeParseCart(undefined), A, 1).cart;
    const second = addItem(safeParseCart(undefined), B, 2).cart;
    expect(first.items.map((i) => i.bookId)).toEqual([A]);
    expect(second.items.map((i) => i.bookId)).toEqual([B]);
    expect(safeParseCart(undefined).items).toEqual([]);
  });
});

describe("removeItem", () => {
  const cart = (): Cart => ({ items: [{ bookId: A, addedAt: 1 }, { bookId: B, addedAt: 2 }, { bookId: C, addedAt: 3 }] });

  it("removes exactly that book and keeps the order of the rest", () => {
    expect(removeItem(cart(), B).items.map((i) => i.bookId)).toEqual([A, C]);
  });

  it("removing the last line leaves an empty cart", () => {
    expect(removeItem({ items: [{ bookId: A, addedAt: 1 }] }, A)).toEqual({ items: [] });
  });

  it("removing a book that is not there changes nothing", () => {
    expect(removeItem(cart(), D)).toEqual(cart());
  });

  it("is case-insensitive about the id", () => {
    const withHex: Cart = { items: [{ bookId: HEX, addedAt: 1 }, { bookId: B, addedAt: 2 }] };
    expect(removeItem(withHex, HEX.toUpperCase()).items.map((i) => i.bookId)).toEqual([B]);
  });

  it("does not modify the cart it was given", () => {
    const original = cart();
    const snapshot = JSON.stringify(original);
    const result = removeItem(original, A);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(result).not.toBe(original);
  });

  it("ADD → REMOVE → RE-ADD returns to a one-line cart (no ghost, no duplicate)", () => {
    let c = addItem(emptyCart(), A, 1).cart;
    c = removeItem(c, A);
    expect(c.items).toEqual([]);
    c = addItem(c, A, 2).cart;
    expect(c).toEqual({ items: [{ bookId: A, addedAt: 2 }] });
  });
});

describe("pruneItems", () => {
  it("drops lines whose book no longer exists and keeps the order of the rest", () => {
    const cart: Cart = { items: [{ bookId: A, addedAt: 1 }, { bookId: B, addedAt: 2 }, { bookId: C, addedAt: 3 }] };
    expect(pruneItems(cart, new Set([C, A])).items.map((i) => i.bookId)).toEqual([A, C]);
    expect(pruneItems(cart, new Set()).items).toEqual([]);
  });

  it("does not modify the cart it was given", () => {
    const cart: Cart = { items: [{ bookId: A, addedAt: 1 }] };
    const pruned = pruneItems(cart, new Set([A]));
    expect(pruned).toEqual(cart);
    expect(pruned).not.toBe(cart);
    expect(pruned.items[0]).not.toBe(cart.items[0]);
  });
});
