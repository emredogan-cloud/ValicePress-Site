# Lemon Squeezy Product Master

**Date:** 2026-09-13 · **Store:** Valice Press · **Store id:** `473583` ·
**Store URL:** `valicepress.lemonsqueezy.com` · **Currency:** USD ·
**Country:** Turkey · **Merchant of Record:** Lemon Squeezy LLC (Utah, USA)

> **STATUS: NOT PROVISIONED.** Every `PRODUCT ID` and `VARIANT ID` below is
> empty, and that is the honest state, not an omission. Two things stand
> between this table and real ids, both of them Founder actions — see §3.
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

**ENGEL 1 — the store is in test mode and cannot leave it without the
Founder.** A new Lemon Squeezy store starts unactivated. Activation requires
**identity verification** and a **connected bank account**, both of them
personal-identity and financial-credential entry that an agent must not
perform. Store-level identity shows *Action Required* even though the account
holder is verified at account level.

**ENGEL 2 — the API key was never captured.** A key named
`Valice Press Site (test)` was created on 2026-09-13 and displayed once. Its
value could not be read out of the page, so it was not saved. Create a fresh
one and paste it into `.env.local`; the old one can be deleted from the
dashboard.

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
