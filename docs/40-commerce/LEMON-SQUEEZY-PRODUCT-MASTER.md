# Lemon Squeezy Product Master

**Date:** 2026-09-13 · **Store:** Valice Press · **Store id:** `473583` ·
**Store URL:** `valicepress.lemonsqueezy.com` · **Currency:** USD ·
**Country:** Turkey · **Merchant of Record:** Lemon Squeezy LLC (Utah, USA)

> **STATUS: PROVISIONED AND LIVE (2026-09-18).** All 27 direct-sale-eligible
> books are published products with exactly one variant each, price-matched
> to the canonical catalog, `test_mode: false` confirmed on every one via the
> API. `BUYABLE (cleared + wired to a checkout)` in `load-catalog.mjs`'s own
> summary: **27**, up from 0. `providerPriceId` is real on all 27 in
> `valice-catalog.mjs` and in production `neondb`.
>
> **ENGEL 2 cleared 2026-09-18.** The Founder added a genuine live-mode
> `LEMONSQUEEZY_API_KEY` to Vercel production. Verified directly, not assumed:
> decoded the key's own claims locally (no network call), then confirmed
> liveness by creating a real webhook and observing `test_mode: false` on the
> response (webhook id 135161, events `order_created`/`order_refunded`,
> pointed at `https://valicepress.com/api/webhooks/lemonsqueezy`).
> `LEMONSQUEEZY_WEBHOOK_SECRET` was minted the supported way — `POST
> /v1/webhooks` returns the secret at creation — and set in Vercel production
> as a Sensitive variable. Confirmed live after a redeploy: an unsigned POST
> to the webhook endpoint now returns `401 Missing X-Signature header`
> (was `503 ... not configured` before).
>
> Products were created in the dashboard (API returns 405 on `POST /products`
> and `POST /variants` — confirmed unchanged, still dashboard-only) using the
> exact Name/Price/Description this file's own worksheet convention specifies,
> tax category set to **eBook** on every one (the default, Software as a
> Service, was wrong for a book). Verified end-to-end with a real API call:
> created an actual Lemon Squeezy checkout session for Meditations
> (`enabled_variants: [2142140]`) and confirmed the rendered checkout page
> shows the right title and price with working email/payment fields — no
> purchase was completed, per the standing rule that a real charge needs the
> Founder's own in-the-moment action.
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
| Meditations | `meditations` | 1370807 | 2142140 | $9.99 | USD | PDF | — | `/books/meditations` | PROVISIONED | 2026-09-18 |
| Codex Bestiarium | `codex-bestiarium` | 1370817 | 2142153 | $9.99 | USD | PDF | `/companion/codex-bestiarium` | `/books/codex-bestiarium` | PROVISIONED | 2026-09-18 |
| The Great Book of World Myths | `the-great-book-of-world-myths` | 1370818 | 2142154 | $6.99 | USD | PDF | `/companion/world-myths` | `/books/the-great-book-of-world-myths` | PROVISIONED | 2026-09-18 |
| The Great Book of World Games | `the-great-book-of-world-games` | 1370820 | 2142158 | $9.99 | USD | PDF | `/companion/world-games` | `/books/the-great-book-of-world-games` | PROVISIONED | 2026-09-18 |
| The Greek Alphabet Handwriting Workbook | `greek-alphabet-handwriting-workbook` | 1370826 | 2142168 | $6.99 | USD | PDF + EPUB | `/companion/greek` | `/books/greek-alphabet-handwriting-workbook` | PROVISIONED | 2026-09-18 |
| Codex Mythologica: The Puzzle Book | `codex-mythologica-the-puzzle-book` | 1370830 | 2142177 | $11.99 | USD | PDF + EPUB | `/companion/codex-puzzles` | `/books/codex-mythologica-the-puzzle-book` | PROVISIONED | 2026-09-18 |
| The Puzzles of Henry Dudeney | `the-puzzles-of-henry-dudeney` | 1370831 | 2142181 | $9.99 | USD | PDF + EPUB | `/companion/dudeney` | `/books/the-puzzles-of-henry-dudeney` | PROVISIONED | 2026-09-18 |
| Epictetus: The Discourses and Enchiridion | `epictetus-discourses-and-enchiridion` | 1370832 | 2142183 | $9.99 | USD | PDF + EPUB | `/companion/epictetus` | `/books/epictetus-discourses-and-enchiridion` | PROVISIONED | 2026-09-18 |
| Seneca: Selected Dialogues | `seneca-selected-dialogues` | 1370836 | 2142187 | $9.99 | USD | PDF + EPUB | `/companion/seneca` | `/books/seneca-selected-dialogues` | PROVISIONED | 2026-09-18 |
| Myths and Legends of China | `myths-and-legends-of-china` | 1370838 | 2142190 | $9.99 | USD | PDF + EPUB | `/companion/china-gods` | `/books/myths-and-legends-of-china` | PROVISIONED | 2026-09-18 |
| Indian Myth and Legend | `indian-myth-and-legend` | 1370840 | 2142193 | $9.99 | USD | PDF + EPUB | `/companion/vedic-gods` | `/books/indian-myth-and-legend` | PROVISIONED | 2026-09-18 |
| Mythical Monsters | `mythical-monsters` | 1370842 | 2142197 | $9.99 | USD | PDF + EPUB | `/companion/the-dragon` | `/books/mythical-monsters` | PROVISIONED | 2026-09-18 |
| Games Ancient and Oriental: The Egyptian Games | `games-ancient-and-oriental` | 1370844 | 2142199 | $7.99 | USD | PDF + EPUB | `/companion/games-ancient-and-oriental` | `/books/games-ancient-and-oriental` | PROVISIONED | 2026-09-18 |
| Korean Games: The Games of Chance and Divination | `korean-games` | 1370846 | 2142203 | $8.99 | USD | PDF + EPUB | `/companion/korean-games` | `/books/korean-games` | PROVISIONED | 2026-09-18 |
| Kwaidan: Stories and Studies of Strange Things | `kwaidan` | 1370850 | 2142207 | $8.99 | USD | PDF + EPUB | `/companion/kwaidan` | `/books/kwaidan` | PROVISIONED | 2026-09-18 |
| The Fairy Mythology, Volume I | `fairy-mythology-vol-1` | 1370854 | 2142216 | $9.99 | USD | PDF + EPUB | `/companion/fairy-mythology-vol-1` | `/books/fairy-mythology-vol-1` | PROVISIONED | 2026-09-18 |
| The Fairy Mythology, Volume II | `fairy-mythology-vol-2` | 1370856 | 2142217 | $9.99 | USD | PDF + EPUB | `/companion/fairy-mythology-vol-2` | `/books/fairy-mythology-vol-2` | PROVISIONED | 2026-09-18 |
| British Goblins | `british-goblins` | 1370858 | 2142219 | $11.99 | USD | PDF + EPUB | `/companion/british-goblins` | `/books/british-goblins` | PROVISIONED | 2026-09-18 |
| The Book of Were-Wolves | `book-of-were-wolves` | 1370861 | 2142225 | $8.99 | USD | PDF + EPUB | `/companion/book-of-were-wolves` | `/books/book-of-were-wolves` | PROVISIONED | 2026-09-18 |
| Sea Monsters Unmasked, and Sea Fables Explained | `sea-monsters-unmasked` | 1370865 | 2142228 | $9.99 | USD | PDF + EPUB | `/companion/sea-monsters-unmasked` | `/books/sea-monsters-unmasked` | PROVISIONED | 2026-09-18 |
| The Singing Games of England, Scotland, and Ireland | `traditional-games` | 1370866 | 2142229 | $9.99 | USD | PDF + EPUB | `/companion/traditional-games` | `/books/traditional-games` | PROVISIONED | 2026-09-18 |
| Chess and Playing Cards: The Chess, Divination and Card Collections | `chess-and-playing-cards` | 1370869 | 2142232 | $7.99 | USD | PDF + EPUB | `/companion/chess-and-playing-cards` | `/books/chess-and-playing-cards` | PROVISIONED | 2026-09-18 |
| Mancala, the National Game of Africa | `mancala` | 1370870 | 2142233 | $4.99 | USD | PDF + EPUB | `/companion/mancala` | `/books/mancala` | PROVISIONED | 2026-09-18 |
| Codex Enigmatica | `codex-enigmatica` | 1370874 | 2142237 | $9.99 | USD | PDF | — | `/books/codex-enigmatica` | PROVISIONED | 2026-09-18 |
| Pencil & Paper | `pencil-and-paper` | 1370876 | 2142239 | $6.99 | USD | PDF | `/companion/play-anywhere` | `/books/pencil-and-paper` | PROVISIONED | 2026-09-18 |
| How the World Began | `how-the-world-began` | 1370879 | 2142242 | $9.99 | USD | PDF | `/companion/under-every-sky` | `/books/how-the-world-began` | PROVISIONED | 2026-09-18 |
| The Trickster's Table | `the-tricksters-table` | 1370881 | 2142244 | $6.99 | USD | PDF | `/companion/tricksters-table` | `/books/the-tricksters-table` | PROVISIONED | 2026-09-18 |

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
