/**
 * Can a reader put this book in the cart — and so buy it here — right now?
 *
 * ONE DEFINITION, because it used to be three. The server's `addToCart` refused
 * a book unless it had a price AND a live checkout (`price_cents > 0` and a
 * provider price id); the cart's shelf offered a "+" on `priceCents > 0` alone;
 * and the shelf filled itself without asking either question, so five of its
 * eight cards were books this store does not sell and had no "+" at all. Every
 * surface that decides "may I show an add button for this?" calls this, and the
 * server calls it too, so a button can never promise what `addToCart` will
 * refuse.
 *
 * `buyableHere` is `books.provider_price_id is not null` (see `BookCardData`);
 * unknown is not "yes".
 */
export function isAddable(book: { priceCents: number; buyableHere?: boolean }): boolean {
  return book.priceCents > 0 && Boolean(book.buyableHere);
}
