import { readCart } from "@/lib/cart";
import { getCheckoutItems } from "@/lib/db/queries/catalog";

/**
 * Route Handler — what the visitor's cart holds: `{ count, ids }`.
 *
 * Every cart control in the browser (`cart-store.ts`) asks this once on load
 * and again after each change. Putting the cookie read in this dedicated
 * dynamic endpoint keeps the layout (and every catalog route inheriting it)
 * safely STATIC / SSG — the cookie read never bleeds upward into
 * `app/layout.tsx`.
 *
 * IT COUNTS WHAT THE CART PAGE WILL SHOW. The cookie can hold an id whose book
 * has since been unpublished; the cart page lists only books that exist, so a
 * badge reading "2" over a cart showing one line is a lie told by the header.
 * Ids are checked against the catalogue here, one narrow query, and only when
 * the cart is not empty — the common visitor costs no database work at all.
 * `ids` is what lets a "+" button know its book is already in the cart.
 */
export async function GET() {
  const cart = await readCart();
  const headers = { "Cache-Control": "no-store" };
  if (cart.items.length === 0) {
    return Response.json({ count: 0, ids: [] }, { headers });
  }
  const live = new Set((await getCheckoutItems(cart.items.map((i) => i.bookId))).map((b) => b.id));
  const ids = cart.items.map((i) => i.bookId).filter((id) => live.has(id));
  return Response.json({ count: ids.length, ids }, { headers });
}
