# Lemon Squeezy Product Master

**Date:** 2026-09-13 · **Store:** Valice Press · **Store id:** `473583` ·
**Store URL:** `valicepress.lemonsqueezy.com` · **Currency:** USD ·
**Country:** Turkey · **Merchant of Record:** Lemon Squeezy LLC (Utah, USA)

> **STATUS: NOT PROVISIONED** (re-verified 2026-09-17). Every `PRODUCT ID` and
> `VARIANT ID` below is empty, and that is the honest state, not an omission.
>
> **ENGEL 1b HAS CLEARED SINCE 2026-09-15.** The storefront preflight
> (`lemonsqueezy-preflight.mjs`, fresh run today) reports `storeState:
> "activated"` — the merchant review that 403'd `valicepress.lemonsqueezy.com`
> on 2026-09-15 is done. **ENGEL 2 has NOT cleared** and is now the only open
> blocker: `LEMONSQUEEZY_API_KEY` and `LEMONSQUEEZY_WEBHOOK_SECRET` remain
> entirely absent from Vercel production (confirmed directly with `vercel env
> ls` across all environments — not hidden-as-Sensitive, genuinely unset). The
> only working key anywhere in this environment is the test-mode one in
> `.env.local` (`Valice Press Site (test)`, created 2026-09-13), which a
> fresh `GET /products` confirms sees **zero products in either mode** — the
> store is activated but nothing has been created in it yet, by API or by
> hand. The **other** dashboard key, `Lemonsqueezy_api_key` (created
> 2026-03-22), **expires 2026-09-22 — five days from this reading** and its
> value was never captured; if it is meant to be the production key, it needs
> reissuing before then regardless.
>
> Product/variant creation is dashboard-only (`POST /products` and `POST
> /variants` both 405) and no API exists to mint a new API key from an old
> one, so this blocker cannot be cleared by any agent working from this
> environment — it needs the Founder, in the Lemon Squeezy dashboard, to
> generate a live-mode API key and paste it into Vercel production
> (`LEMONSQUEEZY_API_KEY`). Once that exists, `POST /v1/webhooks` (confirmed
> working — this session created and deleted a real test-mode webhook to
> verify it) can mint a genuine live `LEMONSQUEEZY_WEBHOOK_SECRET` the same
> way, which is the supported path and needs no dashboard step of its own.
>
> Do not fill this table by hand. It is regenerated from the run output of
> `scripts/catalog/provision-lemonsqueezy.mjs`, which prints the exact
> `providerPriceId:` lines to paste back into `valice-catalog.mjs`. A product
> id that was typed rather than read is the failure this file exists to
> prevent — the storefront once carried `pri_test_meditations_999`, which
> passed every check anybody had written and failed at the till.

---

## 1. The product model

**ONE BOOK → ONE PRODUCT → ONE VARIANT.**

Lemon Squeezy binds a checkout to a single variant (**BELGE** — the Create a
Checkout contract, `relationships.variant`, singular, read 2026-09-13). A
second variant on a book would be a second thing the checkout could offer and
a second id fulfilment would have to resolve, for no gain: the digital edition
is one purchase that delivers every file the press holds for that book.

Formats are therefore **not** variants. PDF and EPUB arrive together from one
purchase. Paperback, hardcover and large print are Amazon's, and are linked
from the book page rather than sold here.

Product name, which is also the idempotency key the provisioning script
matches on:

```
Valice Press — <Book Title>
```

---

## 2. The mapping

| BOOK | SLUG | PRODUCT ID | VARIANT ID | PRICE | CURRENCY | DELIVERY | COMPANION | WEBSITE URL | STATUS | LAST VERIFIED |
|---|---|---|---|---|---|---|---|---|---|---|
| Meditations | `meditations` | — | — | $9.99 | USD | PDF | — | `/books/meditations` | NOT PROVISIONED | — |
| Codex Bestiarium | `codex-bestiarium` | — | — | $9.99 | USD | PDF | `/companion/codex-bestiarium` | `/books/codex-bestiarium` | NOT PROVISIONED | — |
| The Great Book of World Myths | `the-great-book-of-world-myths` | — | — | $6.99 | USD | PDF | `/companion/world-myths` | `/books/the-great-book-of-world-myths` | NOT PROVISIONED | — |
| The Great Book of World Games | `the-great-book-of-world-games` | — | — | $9.99 | USD | PDF | `/companion/world-games` | `/books/the-great-book-of-world-games` | NOT PROVISIONED | — |
| The Greek Alphabet Handwriting Workbook | `greek-alphabet-handwriting-workbook` | — | — | $6.99 | USD | PDF + EPUB | `/companion/greek` | `/books/greek-alphabet-handwriting-workbook` | NOT PROVISIONED | — |
| Codex Mythologica: The Puzzle Book | `codex-mythologica-the-puzzle-book` | — | — | $11.99 | USD | PDF + EPUB | `/companion/codex-puzzles` | `/books/codex-mythologica-the-puzzle-book` | NOT PROVISIONED | — |
| The Puzzles of Henry Dudeney | `the-puzzles-of-henry-dudeney` | — | — | $9.99 | USD | PDF + EPUB | `/companion/dudeney` | `/books/the-puzzles-of-henry-dudeney` | NOT PROVISIONED | — |
| Epictetus: The Discourses and Enchiridion | `epictetus-discourses-and-enchiridion` | — | — | $9.99 | USD | PDF + EPUB | `/companion/epictetus` | `/books/epictetus-discourses-and-enchiridion` | NOT PROVISIONED | — |
| Seneca: Selected Dialogues | `seneca-selected-dialogues` | — | — | $9.99 | USD | PDF + EPUB | `/companion/seneca` | `/books/seneca-selected-dialogues` | NOT PROVISIONED | — |
| Myths and Legends of China | `myths-and-legends-of-china` | — | — | $9.99 | USD | PDF + EPUB | `/companion/china-gods` | `/books/myths-and-legends-of-china` | NOT PROVISIONED | — |
| Indian Myth and Legend | `indian-myth-and-legend` | — | — | $9.99 | USD | PDF + EPUB | `/companion/vedic-gods` | `/books/indian-myth-and-legend` | NOT PROVISIONED | — |
| Mythical Monsters | `mythical-monsters` | — | — | $9.99 | USD | PDF + EPUB | `/companion/the-dragon` | `/books/mythical-monsters` | NOT PROVISIONED | — |
| Games Ancient and Oriental: The Egyptian Games | `games-ancient-and-oriental` | — | — | $7.99 | USD | PDF + EPUB | `/companion/games-ancient-and-oriental` | `/books/games-ancient-and-oriental` | NOT PROVISIONED | — |
| Korean Games: The Games of Chance and Divination | `korean-games` | — | — | $8.99 | USD | PDF + EPUB | `/companion/korean-games` | `/books/korean-games` | NOT PROVISIONED | — |
| Kwaidan: Stories and Studies of Strange Things | `kwaidan` | — | — | $8.99 | USD | PDF + EPUB | `/companion/kwaidan` | `/books/kwaidan` | NOT PROVISIONED | — |
| The Fairy Mythology, Volume I | `fairy-mythology-vol-1` | — | — | $9.99 | USD | PDF + EPUB | `/companion/fairy-mythology-vol-1` | `/books/fairy-mythology-vol-1` | NOT PROVISIONED | — |
| The Fairy Mythology, Volume II | `fairy-mythology-vol-2` | — | — | $9.99 | USD | PDF + EPUB | `/companion/fairy-mythology-vol-2` | `/books/fairy-mythology-vol-2` | NOT PROVISIONED | — |
| British Goblins | `british-goblins` | — | — | $11.99 | USD | PDF + EPUB | `/companion/british-goblins` | `/books/british-goblins` | NOT PROVISIONED | — |
| The Book of Were-Wolves | `book-of-were-wolves` | — | — | $8.99 | USD | PDF + EPUB | `/companion/book-of-were-wolves` | `/books/book-of-were-wolves` | NOT PROVISIONED | — |
| Sea Monsters Unmasked, and Sea Fables Explained | `sea-monsters-unmasked` | — | — | $9.99 | USD | PDF + EPUB | `/companion/sea-monsters-unmasked` | `/books/sea-monsters-unmasked` | NOT PROVISIONED | — |
| The Singing Games of England, Scotland, and Ireland | `traditional-games` | — | — | $9.99 | USD | PDF + EPUB | `/companion/traditional-games` | `/books/traditional-games` | NOT PROVISIONED | — |
| Chess and Playing Cards: The Chess, Divination and Card Collections | `chess-and-playing-cards` | — | — | $7.99 | USD | PDF + EPUB | `/companion/chess-and-playing-cards` | `/books/chess-and-playing-cards` | NOT PROVISIONED | — |
| Mancala, the National Game of Africa | `mancala` | — | — | $4.99 | USD | PDF + EPUB | `/companion/mancala` | `/books/mancala` | NOT PROVISIONED | — |
| Codex Enigmatica | `codex-enigmatica` | — | — | $9.99 | USD | PDF | — | `/books/codex-enigmatica` | NOT PROVISIONED | — |
| Pencil & Paper | `pencil-and-paper` | — | — | $6.99 | USD | PDF | `/companion/play-anywhere` | `/books/pencil-and-paper` | NOT PROVISIONED | — |
| How the World Began | `how-the-world-began` | — | — | $9.99 | USD | PDF | `/companion/under-every-sky` | `/books/how-the-world-began` | NOT PROVISIONED | — |
| The Trickster's Table | `the-tricksters-table` | — | — | $6.99 | USD | PDF | `/companion/tricksters-table` | `/books/the-tricksters-table` | NOT PROVISIONED | — |

**27 products.** Every row is a book that is published, cleared for direct
sale, priced, and has a master file in R2 — checked by
`scripts/catalog/load-catalog.mjs`, which refuses to load a catalogue that
fails those tests.

### Deliberately absent

| BOOK | WHY NOT SOLD HERE | REVISIT |
|---|---|---|
| Codex Mythologica | KDP Select exclusivity on the Kindle edition. Term 2026-08-06 → **2026-11-03**; auto-renew is off. Selling the ebook anywhere else before that date breaches an agreement with Amazon. | **2026-11-03.** Set `directSale: true`, re-run provisioning, reload. |
| The Myth Hunter's Field Book | No digital edition exists, by design — it is a write-in activity book whose puzzles are solved on the page. | Never. |
| Korean Hangul Handwriting Workbook | Gate 2 (rights) prepared but unsigned: the 2026-09-02 remediation replaced CC BY-SA / CC BY-NC sources and the result has not been signed off. | When the Founder signs Gate 2. |

---

## 3. What stands between this table and real ids

**Verified 2026-09-15 by reading the dashboard and Lemon Squeezy's own
servers, not by inference.**

**ENGEL 1 — CLEARED BY THE FOUNDER.** The Setup checklist
(app.lemonsqueezy.com/setup) shows green ticks on all four Founder actions:
*Create your store*, *Fine tune your store settings*, **Verify your
identity**, **Set up two-factor authentication**, and **Connect a bank
account**. The identity-and-bank blocker recorded on 2026-09-13 is gone. The
only unticked step is *Create your first product*, which is this document's
job and is done by the provisioning script.

**ENGEL 1b — OPEN, AND NOT OURS TO CLEAR.** The store is still not activated.
Lemon Squeezy is reviewing the merchant application:

> *"Your application has been received and will be reviewed as soon as
> possible"* — dashboard banner, every page, read 2026-09-15.

The consequences are observable from outside the account and were checked
directly rather than assumed:

| Probe | Result 2026-09-15 |
|---|---|
| `GET https://valicepress.lemonsqueezy.com/` | **HTTP 403 — "This store has not been activated."** |
| Dashboard mode indicator | **Test mode**, and it cannot be switched off while the application is pending |
| Settings » API banner | *"Test mode: These API keys will only work with test mode data."* |

This is Lemon Squeezy's review queue. No action by the Founder or by an agent
shortens it. **Until it clears, every product, variant and order this account
can create is test-mode, and a test variant id must never be written into the
production `books.provider_price_id`** — that is precisely the
`pri_test_meditations_999` failure this file exists to prevent.

**ENGEL 2 — OPEN.** No `LEMONSQUEEZY_API_KEY` exists in `.env`, `.env.local`,
`scripts/tmp/.env.production`, or the Vercel production environment. Two keys
exist in the dashboard and neither value is recoverable — Lemon Squeezy
displays a key once, at creation:

| Key name | Created | Expires |
|---|---|---|
| `Valice Press Site (test)` | 2026-09-13 | 2027-03-13 |
| `Lemonsqueezy_api_key` | 2026-03-22 | **2026-09-22 — seven days from this reading** |

`LEMONSQUEEZY_WEBHOOK_SECRET` is absent from production too, and the live
endpoint says so itself rather than failing open — which is the behaviour we
want:

```
POST https://valicepress.com/api/webhooks/lemonsqueezy
→ 503  LEMONSQUEEZY_WEBHOOK_SECRET is not configured — refusing to process.
```

### What IS ready, measured rather than assumed

`scripts/catalog/lemonsqueezy-preflight.mjs` proves the whole chain except the
provider. Run 2026-09-15 against production: **20 PASS · 4 FAIL**, and all
four failures are the blocker above or its direct consequence.

| Area | Result |
|---|---|
| Catalogue | 27 eligible; prices positive; slugs and product names unique; **no KDP Select book offered for direct sale** |
| Files | **27/27 PDF masters and 19/19 EPUBs present and non-empty in R2** — verified by `HeadObject`, not by reading a manifest |
| Database | `provider_price_id` present; `orders`, `order_items`, `entitlements`, `watermark_jobs`, `commerce_events` present; `orders_mor_order_ref_uk` UNIQUE index present (webhook idempotency); catalogue price == database price on all 27; nothing ineligible carries a provider id |
| Tests | 56/56 commerce + catalogue; 576/579 overall (the 3 failures are printed-companion-page assertions in the book factory, last touched 2026-09-07, unrelated to commerce) |
| Storefront | Honest while unprovisioned: the Bestiarium page reads *"not sold through this site at the moment"*, quotes no digital price, and leaks no provider id |

Two of those rows were false failures first time round, and both were the
instrument's fault rather than the system's — worth recording because the
pattern repeats:

- The R2 check reported all 27 masters missing. `scripts/tmp/.env.production`
  stores `[SENSITIVE]` in place of every secret, and merging it over the real
  credentials made the endpoint the literal string. **A redaction is not a
  value**; the loader now drops them.
- The idempotency check reported no UNIQUE constraint on `mor_order_ref`.
  There is one — `orders_mor_order_ref_uk`, a UNIQUE *index*, which has no row
  in `pg_constraint`. The question was being asked in the wrong catalog.

### Re-verified 2026-09-17 — 22 PASS · 2 FAIL, both ENGEL 2

`lemonsqueezy-preflight.mjs`, fresh run against production:

| Area | Result |
|---|---|
| Store activation | **activated** (was blocked-pending on 2026-09-15; cleared since) |
| Catalogue / files / database / tests | Same 20 PASS as 2026-09-15, unchanged |
| `0/27 mapped to a variant` | FAIL — direct consequence of ENGEL 2, not a new problem |
| `LEMONSQUEEZY_WEBHOOK_SECRET` configured | FAIL — same |

Also re-verified end-to-end, not assumed: `src/app/api/webhooks/lemonsqueezy/route.ts`
checks signature before any parse/DB/log call, and `processPaidOrder` /
`recordCommerceEvent` both insert with `onConflictDoNothing({ target:
orders.morOrderRef })` against the real `orders_mor_order_ref_uk` UNIQUE index —
retries cannot double-fulfil. A live rehearsal of checkout → webhook → entitlement
was not possible: zero products exist in either mode (`GET /products` with the
only available key returns `data: []`), so there is nothing yet to check out.
This is downstream of ENGEL 2, the same as everything else in this section.

28th book added to the catalogue since 2026-09-15: `words-from-the-gods`
(Etymon Vol. 1) — its 404 was fixed, its master uploaded to R2, its EKYGM
application filed (ref 1458898, pending). It sells through Amazon only until
ENGEL 2 clears, same as the other 27; see its `blockers` array in
`valice-catalog.mjs` for the detail.

### The sequence, once both are cleared


```bash
# 1. Environment — .env.local (never committed)
LEMONSQUEEZY_API_KEY=…          # Settings » API, Valice Press store selected
LEMONSQUEEZY_STORE_ID=473583
LEMONSQUEEZY_WEBHOOK_SECRET=…   # whatever you type when creating the webhook

# 2. See what would be created. Creates nothing.
node scripts/catalog/provision-lemonsqueezy.mjs

# 3. Create the 27 products and variants.
node scripts/catalog/provision-lemonsqueezy.mjs --commit

# 4. Paste the printed `providerPriceId:` lines into valice-catalog.mjs,
#    then load them, sandbox first.
node scripts/catalog/load-catalog.mjs --commit
node scripts/catalog/apply-provider-migration.mjs \
     --env scripts/tmp/.env.production --commit --i-know-this-is-production
node scripts/catalog/load-catalog.mjs --commit \
     --env scripts/tmp/.env.production --i-know-this-is-production

# 5. Webhook — Settings » Webhooks in the dashboard:
#    URL    https://valicepress.com/api/webhooks/lemonsqueezy
#    Events order_created, order_refunded        (and nothing else)
#    Secret the same string as LEMONSQUEEZY_WEBHOOK_SECRET
```

Step 4's loader prints `BUYABLE (cleared + wired to a checkout)`. When that
number reaches 27, this table is real and every book has a working buy button.

---

## 4. Checks the provisioning script performs

Each of these is a defect this project has actually shipped at least once.

| Check | Behaviour on failure |
|---|---|
| Store currency is USD | **Refuses to run.** Every price in `valice-catalog.mjs` is USD cents; a TRY store would mis-price all 27. The store was created defaulting to TRY and was corrected on 2026-09-13. |
| Catalogue price vs. live Lemon Squeezy price | Printed as a `PRICE MISMATCH` list. A storefront quoting a price the checkout will not charge is worse than quoting none. |
| Product already exists | Matched by name, reused, never duplicated and never silently repointed at a different book. |
| Dry run | The default. `--commit` is required to write anything. |
