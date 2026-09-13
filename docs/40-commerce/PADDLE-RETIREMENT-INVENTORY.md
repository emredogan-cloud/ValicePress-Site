# Paddle Retirement Inventory

**Date:** 2026-09-13 · **Branch:** `commerce/lemon-squeezy-migration` ·
**Decision:** Founder, 2026-09-13 — Paddle is retired as the payment
infrastructure; Lemon Squeezy replaces it.

Evidence tags follow the house convention: **GÖZLEM** = measured in this
session · **BELGE** = read from a written source · **MODEL** = inferred ·
**ENGEL** = blocker.

---

## 0. Why there is an inventory at all

The instruction was *"do not immediately delete Paddle."* Two kinds of Paddle
dependency are tangled together in this repository and they have opposite
correct treatments:

- the ones that **take money** — these must stop working, today;
- the ones that **record money already taken** — these must keep working
  forever, because an accounting question about an order has to be answerable
  years after the provider is gone.

Everything below is classified as one or the other before anything was
touched.

---

## 1. Live commerce path — REMOVED

| File | Function | Purpose | State | Replacement | Removal |
|---|---|---|---|---|---|
| `src/lib/paddle.ts` | `getPaddleClient`, `isPaddleConfigured` | Lazy Paddle SDK client | LIVE | `src/lib/payments/lemonsqueezy/client.ts` | **Deleted** |
| `src/app/api/webhooks/paddle/route.ts` | `POST` | Signature check → fulfilment | LIVE | `src/app/api/webhooks/lemonsqueezy/route.ts` | **Deleted** |
| `src/app/cart/actions.ts` | `createCheckoutSession()` | Built a multi-line Paddle transaction | LIVE | Rewritten: one book per checkout, via `getPaymentProvider()` | **Rewritten** |
| `src/components/cart/cart-summary.tsx` | `onCheckout` | Single "Checkout securely" button | LIVE | Removed; buy control moved to each `<CartLine>` | **Rewritten** |
| `package.json` | `@paddle/paddle-node-sdk` | SDK dependency | LIVE | none — the Lemon Squeezy adapter is plain `fetch` | Still installed; see §6 |

**GÖZLEM** — after the rewrite, `grep -rn "@paddle/paddle-node-sdk" src/`
returns nothing. The only importers left are three throwaway scripts under
`scripts/tmp/`.

---

## 2. Data model — KEPT, and widened

Nothing was dropped. One column was added beside each Paddle-specific one.

| Column | Purpose | State | Treatment |
|---|---|---|---|
| `books.paddle_price_id` | Paddle price for the digital edition | DEAD (read by nothing) | **Kept as history.** Orders taken through Paddle reference these prices. |
| `books.provider_price_id` | The ACTIVE provider's id — a Lemon Squeezy **variant** id | NEW | Written by `load-catalog.mjs`; read by checkout, the book page and the assistant. |
| `orders.mor_order_ref` | The provider's order reference; UNIQUE | LIVE | Unchanged. Holds Paddle `txn_…` before 2026-09-13 and Lemon Squeezy numeric order ids after. |
| `orders.payment_provider` | Which provider an order belongs to | NEW | Default `paddle`, so every existing row backfills correctly. |
| `commerce_events.provider_event_id` | Idempotency key, UNIQUE | LIVE | Unchanged. Key shape is now `lemonsqueezy:<event>:<order id>`. |
| `commerce_events.provider` | Which provider the event came from | NEW | Default `paddle`. Without it, two providers minting the same order number would collide on the UNIQUE index and the second event would be silently swallowed as a duplicate. |

Migration: `drizzle/0011_peaceful_sunset_bain.sql` — four additive statements,
every one with a default. No data is rewritten.

**ENGEL / GÖZLEM** — `npm run db:migrate` is **not trustworthy on these two
databases**. `drizzle.__drizzle_migrations` is empty on `bookstore` while the
schema plainly carries every earlier migration, so `drizzle-kit migrate` exits
`0` having done nothing. That is the worst failure mode available: it looks
like success. `scripts/catalog/apply-provider-migration.mjs` was written to
check the live schema, add only what is missing, and then **re-read the schema
to prove it**.

---

## 3. Catalogue — REWRITTEN

| Item | State | Treatment |
|---|---|---|
| `paddlePriceId` on 30 book rows | 27 live ids | Renamed to `providerPriceId` and **nulled**. A Paddle id in the live column would be a migration bug, not a price. |
| `RETIRED_PADDLE_PRICE_IDS` | NEW | All 27 ids frozen as a literal for audit. Nothing reads it at runtime. |
| `applyPaddleComplianceGate()` | LIVE | Replaced by `applySaleEligibility()`. The public-domain exclusion is gone with the provider that caused it; the "no phantom print edition" rule is kept. |
| `HIDE_PUBLIC_DOMAIN_DURING_PADDLE_REVIEW` | `true` | **Removed.** The 18 hidden titles are `published` again. |
| `scripts/catalog/provision-paddle.mjs`, `paddle-products.mjs`, `paddle-crosscheck.mjs`, `paddle-tax-category.mjs` | DEAD | **Kept, unmodified.** They document how the Paddle catalogue was built and are the only record of it. They cannot run: the env vars they need are not set in any deploy target. |

---

## 4. Copy that named Paddle to a reader — CORRECTED

These were not comments. They were statements to customers about who takes
their money and who holds their data, and after the retirement they were
false.

| File | Was | Now |
|---|---|---|
| `(legal)/terms` | "you're redirected to Paddle, our Merchant of Record" | Lemon Squeezy LLC, a Utah limited liability company, part of Stripe; statement descriptor `LEMSQZY*`; plus a new paragraph saying digital editions are bought one at a time |
| `(legal)/privacy` | "Paddle — your billing details and invoices" | Lemon Squeezy (United States), with the data-transfer destination stated |
| `(legal)/refund` | "we'll process the refund through Paddle" | Lemon Squeezy, and a new sentence that a refund also withdraws library access |
| `(legal)/kvkk` | "Paddle … (Birleşik Krallık)" | "Lemon Squeezy LLC … (Amerika Birleşik Devletleri, Utah; Stripe bünyesinde)" |
| `about/founder-card` | "Payments run through Paddle" + "the classics collection is not part of the storefront" | Lemon Squeezy; and the classics sentence rewritten, because they are back |
| `order/order-trust-strip` | "Processed by Paddle." | "Processed by Lemon Squeezy." |

**BELGE** — the entity, jurisdiction and Stripe relationship were read from
`lemonsqueezy.com/terms` on 2026-09-13: *"Lemon Squeezy LLC, a Utah limited
liability company"*, and *"registered trademarks or trademarks of Stripe,
Inc."*

---

## 5. Historical comments — KEPT VERBATIM

Roughly forty comments across `src/` still say "Paddle". Every one of them
describes something that actually happened — the 2026-09-12 compliance gate,
the `pri_test_meditations_999` incident, the Phase B idempotency finding —
and each is the reason a guard exists. Deleting them would delete the reason
and leave the guard looking arbitrary. They stay.

The exception is any comment whose *conclusion* stopped being true. Those were
rewritten, not deleted: `src/lib/bundles.ts` no longer says the bundle comes
back when "Paddle confirms the public-domain model in writing", because that
condition can never now be met.

---

## 6. Not yet removed, deliberately

| Item | Why it is still here |
|---|---|
| `@paddle/paddle-node-sdk` in `package.json` | Nothing in `src/` imports it. Removing it is a one-line change, held until Lemon Squeezy has taken a real payment — the only remaining rollback to Paddle would need it. |
| `PADDLE_API_KEY`, `PADDLE_ENVIRONMENT`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` in Vercel | Same reason, and §24 is explicit: *do not delete a secret until dependency analysis confirms it is unused.* The analysis is done and recorded here; the deletion waits for the first Lemon Squeezy order. Removed from `.env.example` already, so no new environment gets them. |
| `scripts/tmp/sigtest.mjs`, `adjtest.mjs`, `sigtest2.mjs` | Throwaway Paddle signature probes in an untracked scratch directory. Harmless; not part of any build. |

---

## 7. What the retirement cost

One thing, and it is worth naming rather than burying.

**Lemon Squeezy publishes exactly two order webhooks: `order_created` and
`order_refunded`** (**BELGE** — docs.lemonsqueezy.com/help/webhooks/event-types,
read 2026-09-13). Paddle sent four relevant events. Gone:

- `transaction.payment_failed` — a failed attempt now surfaces only as an
  `order_created` whose `status` is not `paid`;
- `transaction.canceled` — not observable at all;
- `adjustment.created` with a `chargeback` action — **there is no chargeback
  or dispute webhook.** Disputes must be read from the dashboard.

`ProviderCapabilities` in `src/lib/payments/types.ts` states each of these as
a boolean so that no future code waits forever for an event that will never
arrive.
