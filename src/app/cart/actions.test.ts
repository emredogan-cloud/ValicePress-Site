/**
 * The cart's server actions, run against the REAL cookie module with only the
 * edges faked (the request's cookie jar, the database, the payment provider).
 *
 * What these guard, in order of how much it cost:
 *
 *  1. NO STATE SURVIVES A REQUEST. `readCart()` used to return one module-level
 *     `{ items: [] }` for every visitor without a cookie, and `addToCart` pushed
 *     into it — so the first visitor's book showed up in every other cookie-less
 *     visitor's cart until the server restarted, and pressing "+" on that title
 *     said "already in your cart" without writing a cookie. Each test below
 *     takes a fresh jar per "visitor" and checks nothing crosses over.
 *  2. A refusal is a refusal. Unknown ids, unsellable books and a full cart come
 *     back as `{ ok: false }` and leave the cookie exactly as it was.
 *  3. Adding twice is one line; removing the last line removes the cookie.
 *  4. Checkout never throws at the reader.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- the edges ---------------------------------------------------------------

class Jar {
  private store = new Map<string, string>();
  writes = 0;
  deletes = 0;
  get(name: string) {
    const value = this.store.get(name);
    return value === undefined ? undefined : { name, value };
  }
  set(name: string, value: string) {
    this.writes++;
    this.store.set(name, value);
  }
  delete(name: string) {
    this.deletes++;
    this.store.delete(name);
  }
}

let jar = new Jar();
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

interface Row {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  providerPriceId: string | null;
}
const X: Row = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", slug: "x", title: "Book X", priceCents: 999, currency: "USD", providerPriceId: "v-x" };
const Y: Row = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", slug: "y", title: "Book Y", priceCents: 699, currency: "USD", providerPriceId: "v-y" };
const AMAZON_ONLY: Row = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", slug: "z", title: "Book Z", priceCents: 0, currency: "USD", providerPriceId: null };
const NO_VARIANT: Row = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", slug: "w", title: "Book W", priceCents: 999, currency: "USD", providerPriceId: null };
let catalogue: Row[] = [];
const getCheckoutItems = vi.fn(async (ids: string[]) => catalogue.filter((b) => ids.includes(b.id)));
vi.mock("@/lib/db/queries/catalog", () => ({ getCheckoutItems: (ids: string[]) => getCheckoutItems(ids) }));

let signedInAs: string | null = null;
let owned = new Set<string>();
vi.mock("@/lib/account", () => ({ getCurrentLocalUserIdReadOnly: async () => signedInAs }));
vi.mock("@/lib/db/queries/account", () => ({ getOwnedBookIds: async (_user: string, ids: string[]) => new Set(ids.filter((i) => owned.has(i))) }));

let provider: { isConfigured: () => boolean; createCheckout: (input: unknown) => Promise<unknown> };
vi.mock("@/lib/payments", () => ({ getPaymentProvider: () => provider }));

// --- helpers -----------------------------------------------------------------

import { CART_COOKIE, MAX_CART_ITEMS, readCart, safeParseCart } from "@/lib/cart";

import { addToCart, clearCart, createCheckoutSession, removeFromCart } from "./actions";

const cookieIds = () => safeParseCart(jar.get(CART_COOKIE)?.value).items.map((i) => i.bookId);
const newVisitor = () => {
  jar = new Jar();
};

beforeEach(() => {
  newVisitor();
  catalogue = [X, Y, AMAZON_ONLY, NO_VARIANT];
  signedInAs = null;
  owned = new Set();
  revalidatePath.mockClear();
  getCheckoutItems.mockClear();
  provider = { isConfigured: () => true, createCheckout: async () => ({ ok: true, url: "https://pay.example/checkout/1" }) };
});

// --- 1. nothing crosses from one visitor to the next ---------------------------

describe("cart state never leaks between visitors", () => {
  it("a visitor with no cookie does not inherit the previous visitor's book", async () => {
    // Visitor A: first ever add, from a browser with no cart cookie.
    expect(await addToCart(X.id)).toEqual({ ok: true, state: "added" });
    expect(cookieIds()).toEqual([X.id]);

    // Visitor B arrives with nothing. Their cart is empty...
    newVisitor();
    expect((await readCart()).items).toEqual([]);

    // ...and pressing "+" on A's book ADDS IT (and writes B's cookie), instead of
    // answering "already in your cart" from a shared object.
    expect(await addToCart(X.id)).toEqual({ ok: true, state: "added" });
    expect(cookieIds()).toEqual([X.id]);

    // Visitor C adds something else and gets only that.
    newVisitor();
    expect(await addToCart(Y.id)).toEqual({ ok: true, state: "added" });
    expect(cookieIds()).toEqual([Y.id]);

    // Visitor D, who adds nothing, still sees an empty cart.
    newVisitor();
    expect((await readCart()).items).toEqual([]);
  });

  it("an unreadable cookie does not turn into a shared cart either", async () => {
    jar.set(CART_COOKIE, "{definitely not json");
    expect(await addToCart(X.id)).toEqual({ ok: true, state: "added" });
    newVisitor();
    jar.set(CART_COOKIE, "{definitely not json");
    expect((await readCart()).items).toEqual([]);
  });

  it("removing from an empty cart cannot empty or alter anyone else's", async () => {
    await addToCart(X.id);
    const aliceCookie = jar.get(CART_COOKIE)?.value;
    newVisitor();
    await removeFromCart(X.id);
    await clearCart();
    // Nothing of Alice's was touched: her jar object is gone, but re-reading what she held shows it intact.
    expect(safeParseCart(aliceCookie).items.map((i) => i.bookId)).toEqual([X.id]);
  });
});

// --- 2. refusals ---------------------------------------------------------------

describe("addToCart refuses what the store cannot sell, and says why", () => {
  it.each([
    ["an id that is not a uuid", "book-a", "unknown"],
    ["an empty id", "", "unknown"],
    ["an injection attempt", "'; drop table books; --", "unknown"],
    ["a uuid no book has", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "unknown"],
    ["a book sold only on Amazon (price 0)", AMAZON_ONLY.id, "unavailable"],
    ["a priced book with no checkout variant", NO_VARIANT.id, "unavailable"],
  ] as const)("%s", async (_what, id, reason) => {
    expect(await addToCart(id)).toEqual({ ok: false, reason });
    // No cookie was written and nothing was revalidated.
    expect(jar.writes).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("a malformed id never reaches the database", async () => {
    await addToCart("book-a");
    await addToCart("");
    expect(getCheckoutItems).not.toHaveBeenCalled();
  });

  it("a full cart refuses instead of writing a cookie the browser would drop", async () => {
    const many: Row[] = Array.from({ length: MAX_CART_ITEMS + 1 }, (_, n) => ({
      ...X,
      id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      slug: `b${n}`,
    }));
    catalogue = many;
    for (let n = 0; n < MAX_CART_ITEMS; n++) expect((await addToCart(many[n].id)).ok).toBe(true);
    const writesBefore = jar.writes;
    expect(await addToCart(many[MAX_CART_ITEMS].id)).toEqual({ ok: false, reason: "full" });
    expect(jar.writes).toBe(writesBefore);
    expect(cookieIds()).toHaveLength(MAX_CART_ITEMS);
    // A book that is already there is still a success when the cart is full.
    expect(await addToCart(many[0].id)).toEqual({ ok: true, state: "inCart" });
  });
});

// --- 3. add / re-add / remove -----------------------------------------------------

describe("add → add again → remove → re-add", () => {
  it("is one line however often it is added, and removing the last line removes the cookie", async () => {
    expect(await addToCart(X.id)).toEqual({ ok: true, state: "added" });
    expect(await addToCart(X.id)).toEqual({ ok: true, state: "inCart" }); // "increment": still one
    expect(await addToCart(X.id)).toEqual({ ok: true, state: "inCart" });
    expect(cookieIds()).toEqual([X.id]);
    expect(jar.writes).toBe(1); // the repeats wrote nothing
    expect(revalidatePath).toHaveBeenCalledTimes(1);

    await removeFromCart(X.id);
    expect(jar.get(CART_COOKIE)).toBeUndefined(); // no 30-day cookie saying "empty"
    expect(jar.deletes).toBe(1);

    expect(await addToCart(X.id)).toEqual({ ok: true, state: "added" }); // re-add
    expect(cookieIds()).toEqual([X.id]);
  });

  it("keeps the order books were added in and removes only the one asked for", async () => {
    await addToCart(X.id);
    await addToCart(Y.id);
    expect(cookieIds()).toEqual([X.id, Y.id]);
    await removeFromCart(X.id);
    expect(cookieIds()).toEqual([Y.id]);
    expect(jar.deletes).toBe(0); // one line left: rewritten, not deleted
  });

  it("removing a book that is not there, or a malformed id, writes nothing", async () => {
    await addToCart(X.id);
    const writes = jar.writes;
    await removeFromCart(Y.id);
    await removeFromCart("book-a");
    await removeFromCart("");
    expect(jar.writes).toBe(writes);
    expect(jar.deletes).toBe(0);
    expect(cookieIds()).toEqual([X.id]);
  });

  it("clearCart empties the cart", async () => {
    await addToCart(X.id);
    await addToCart(Y.id);
    await clearCart();
    expect(jar.get(CART_COOKIE)).toBeUndefined();
  });
});

// --- 4. checkout ---------------------------------------------------------------------

describe("createCheckoutSession", () => {
  it("returns the provider's url for a sellable book", async () => {
    expect(await createCheckoutSession(X.id)).toEqual({ ok: true, url: "https://pay.example/checkout/1" });
  });

  it("refuses a malformed id without touching the database", async () => {
    const r = await createCheckoutSession("book-a");
    expect(r.ok).toBe(false);
    expect(getCheckoutItems).not.toHaveBeenCalled();
  });

  it("refuses a book that is not sold here, in a sentence", async () => {
    const r = await createCheckoutSession(AMAZON_ONLY.id);
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.error).toMatch(/not sold on this site/i);
  });

  it("refuses a book the signed-in reader already owns", async () => {
    signedInAs = "user-1";
    owned = new Set([X.id]);
    const r = await createCheckoutSession(X.id);
    expect(r.ok === false && r.error).toMatch(/already in your library/i);
  });

  it("says so when the provider is not configured", async () => {
    provider = { ...provider, isConfigured: () => false };
    const r = await createCheckoutSession(X.id);
    expect(r.ok === false && r.error).toMatch(/not configured/i);
  });

  it("turns a provider that THROWS into a sentence, never into an unhandled rejection", async () => {
    provider = {
      isConfigured: () => true,
      createCheckout: async () => {
        throw new Error("ECONNRESET");
      },
    };
    const r = await createCheckoutSession(X.id);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/payment provider/i);
    expect(r.ok === false && r.error).not.toMatch(/ECONNRESET/);
  });

  it("passes the provider's own refusal through", async () => {
    provider = { isConfigured: () => true, createCheckout: async () => ({ ok: false, error: "Store is in test mode." }) };
    expect(await createCheckoutSession(X.id)).toEqual({ ok: false, error: "Store is in test mode." });
  });
});
