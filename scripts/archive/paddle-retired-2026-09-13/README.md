# Paddle — retired 2026-09-13, archived 2026-09-19

These four scripts provisioned and cross-checked Paddle prices while Paddle was
the payment provider. Paddle is retired. Nothing here is wired to anything:

- `src/lib/payments/index.ts` does not register a Paddle adapter and throws with
  a named reason if `PAYMENT_PROVIDER` is ever set back to `paddle`;
- the webhook route is gone;
- all four `PADDLE_*` variables were deleted from every Vercel environment on
  2026-09-19, and `vercel env ls | grep -i paddle` returns nothing;
- `books.paddle_price_id` was nulled in production on 2026-09-19 — all nine rows
  that carried one already had a live `provider_price_id`, so no checkout was
  orphaned;
- `validate-catalog.mjs`'s Paddle check was rewritten as a Lemon Squeezy check.
  That check had been emitting one identical error per direct ebook — 27 of them
  — for a provider that no longer existed, which is why the gate was red and
  unread for five days.

**They are kept, not deleted, because they are the record of how 27 prices were
provisioned and cross-checked.** `RETIRED_PADDLE_PRICE_IDS` in
`scripts/catalog/valice-catalog.mjs` is the matching history of which id belonged
to which book. If Paddle is ever revisited, start from that table and these
scripts; do not resurrect a credential to satisfy a validation gate.
