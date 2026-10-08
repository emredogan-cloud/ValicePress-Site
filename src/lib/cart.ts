/**
 * Cookie-backed cart — stateless, server-rendered (Roadmap §4 + §9).
 *
 * Design notes:
 *   - State lives in a single httpOnly cookie. No database row, no auth
 *     requirement — works pre- and post-sign-in identically. When auth
 *     lands, the cart cookie can be merged into a DB-backed `carts` table
 *     by a JIT upsert (same pattern as `upsertLocalUser`).
 *   - Items are *sets* keyed by `bookId`. Digital books have an implicit
 *     quantity of 1 (you can't buy two copies of the same title), so the
 *     data shape is `Array<{ bookId, addedAt }>`, not a quantity map.
 *   - All cookie reads/writes go through this module so the cookie name,
 *     serialization, and validation live in exactly one place.
 *   - Reads work in any Server Component or Server Action. Writes only
 *     work in Server Actions / Route Handlers (Next.js restriction).
 *
 * NOTHING HERE MAY BE SHARED BETWEEN REQUESTS. A server process answers many
 * visitors, and module scope outlives every one of them. This file used to keep
 * one `EMPTY_CART = { items: [] }` and hand that very object back whenever the
 * cookie was missing or unreadable — and `addToCart` then pushed into it. The
 * first visitor to add a book from a browser with no cart cookie put that book
 * into the process-wide "empty" cart, and from then on EVERY cookie-less
 * visitor on that server instance opened /cart to find a stranger's book in it;
 * pressing "+" on that same title answered "already in your cart" without
 * writing a cookie, so the button said yes and the cart stayed empty. It was
 * found on the local server by a `curl` with no cookies returning "1 book".
 * So: every parse returns a NEW object, and every operation below returns a
 * new cart and leaves its argument alone.
 */

import { cookies } from "next/headers";

export const CART_COOKIE = "dbs_cart";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * The most lines one cart may hold.
 *
 * A cookie is capped near 4 KB by browsers, and a browser that is handed a
 * larger one drops it WITHOUT SAYING SO — the action would report success and
 * the cart would silently stay as it was. A line costs about 120 bytes once
 * URL-encoded, so 30 lines (≈3.6 KB) is the most that is safe. The catalogue is
 * a few dozen books; this is a guard against a quiet failure, not a quota.
 */
export const MAX_CART_ITEMS = 30;

export interface CartItem {
  bookId: string;
  /** Epoch ms when the item was added — used to preserve display order. */
  addedAt: number;
}

export interface Cart {
  items: CartItem[];
}

/** A NEW empty cart, every time. See the header: this must never be a shared constant. */
export function emptyCart(): Cart {
  return { items: [] };
}

const BOOK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Is this a well-formed book id (a canonical UUID)?
 *
 * `books.id` is a Postgres `uuid`. Handing the driver anything else makes the
 * whole `WHERE id IN (...)` fail, which `safeQuery` turns into "no books" — so a
 * single stray id in the cookie used to empty the entire cart view while the
 * header badge still counted it. The cookie is untrusted input; this is the one
 * place it is checked.
 */
export function isBookId(value: unknown): value is string {
  return typeof value === "string" && BOOK_ID.test(value);
}

/**
 * Defensive parser — never throws. Returns an empty cart if the cookie
 * is missing, malformed, or stuffed with garbage by a third party.
 *
 * Besides dropping malformed entries it drops ids that are not UUIDs, folds an
 * id that appears twice into its first appearance, lower-cases ids (Postgres
 * prints uuids in lower case, and a cart line is matched to its book by string
 * equality), and stops at `MAX_CART_ITEMS`.
 *
 * Exported (SUB-PR 4.5) so it can be unit-tested in isolation from
 * `next/headers` — pure string-in / Cart-out function, no I/O.
 */
export function safeParseCart(raw: string | undefined): Cart {
  if (!raw) return emptyCart();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyCart();
    const items = (parsed as { items?: unknown }).items;
    if (!Array.isArray(items)) return emptyCart();
    const cleaned: CartItem[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (cleaned.length >= MAX_CART_ITEMS) break;
      if (!item || typeof item !== "object") continue;
      const { bookId, addedAt } = item as Partial<CartItem>;
      if (!isBookId(bookId)) continue;
      if (typeof addedAt !== "number" || !Number.isFinite(addedAt)) continue;
      const id = bookId.toLowerCase();
      if (seen.has(id)) continue;
      seen.add(id);
      cleaned.push({ bookId: id, addedAt });
    }
    return { items: cleaned };
  } catch {
    return emptyCart();
  }
}

// ---------------------------------------------------------------------------
// Pure operations — no cookie, no I/O, and they never modify what they are given.
// ---------------------------------------------------------------------------

/** Is this book already a line in the cart? */
export function cartHas(cart: Cart, bookId: string): boolean {
  const id = bookId.toLowerCase();
  return cart.items.some((i) => i.bookId === id);
}

export type AddItemResult =
  | { outcome: "added"; cart: Cart }
  | { outcome: "inCart"; cart: Cart }
  | { outcome: "full"; cart: Cart };

/**
 * Add one book. A book already in the cart is a no-op (digital titles have an
 * implicit quantity of 1); a cart at `MAX_CART_ITEMS` refuses rather than write
 * a cookie the browser would drop. The returned cart is always a new object.
 */
export function addItem(cart: Cart, bookId: string, now: number): AddItemResult {
  const id = bookId.toLowerCase();
  const copy: Cart = { items: cart.items.map((i) => ({ ...i })) };
  if (cartHas(copy, id)) return { outcome: "inCart", cart: copy };
  if (copy.items.length >= MAX_CART_ITEMS) return { outcome: "full", cart: copy };
  copy.items.push({ bookId: id, addedAt: now });
  return { outcome: "added", cart: copy };
}

/** Remove one book (a book that is not there changes nothing). Returns a new cart. */
export function removeItem(cart: Cart, bookId: string): Cart {
  const id = bookId.toLowerCase();
  return { items: cart.items.filter((i) => i.bookId !== id).map((i) => ({ ...i })) };
}

/**
 * Keep only the lines whose book still exists. A title can be unpublished after
 * a visitor added it; its id then lingers in the cookie, counted by the badge
 * but shown nowhere. Returns a new cart, order preserved.
 */
export function pruneItems(cart: Cart, keep: ReadonlySet<string>): Cart {
  return { items: cart.items.filter((i) => keep.has(i.bookId)).map((i) => ({ ...i })) };
}

// ---------------------------------------------------------------------------
// Cookie I/O
// ---------------------------------------------------------------------------

/** Read the cart from the request cookie. Safe in any server context. */
export async function readCart(): Promise<Cart> {
  const store = await cookies();
  return safeParseCart(store.get(CART_COOKIE)?.value);
}

/** Write the cart to the response cookie. Only callable from Server Actions / Route Handlers. */
export async function writeCart(cart: Cart): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, JSON.stringify(cart), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}

/** Delete the cart cookie. Only callable from Server Actions / Route Handlers. */
export async function deleteCart(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE);
}
