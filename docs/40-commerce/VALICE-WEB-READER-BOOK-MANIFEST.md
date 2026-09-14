# Reader book manifest

**Generated 2026-09-14** from the database and `scripts/catalog/valice-catalog.mjs`.

---

## What a manifest is here

The directive (§27) asks for a canonical book manifest. This system deliberately
**does not add one as a new artefact**, because the project already has two and
a third would be a third thing to drift:

| Fact | Lives in | Why there |
|---|---|---|
| `bookId`, slug, title, price, status | `books` | written by `load-catalog.mjs` from `valice-catalog.mjs`, the source of truth |
| edition, availability, fulfilment channel | `book_formats` | one row per format; decides what is even sellable |
| cover asset | `/images/books/<slug>.webp` via `asset-map.ts` | one cover everywhere — storefront, library, companion, reader |
| master file key | `books.master_file_key` | private R2 key |
| provider variant id | `books.provider_price_id` | the purchase → book mapping |
| **page count, page geometry, table of contents** | **the PDF itself** | see below |
| reader features | the engine | uniform across all titles |

**The reader reads the last of those from the file, not from a record.** Page
count, page dimensions and the table of contents all come from the PDF the
customer owns. This is the §24 rule made structural: the reader cannot show a
chapter list the book does not have, cannot claim a page count the book does
not have, and cannot drift from the printed edition, because there is no second
copy of those facts to drift from.

`books.page_count` still exists and is what the storefront advertises. It is
*not* what the reader paginates by.

---

## Reader-eligible titles — 27

All 27 have a master PDF in R2. Total **5,011 pages**.

| slug | pages | price | PDF | EPUB | variant id |
|---|---:|---:|:-:|:-:|---|
| codex-bestiarium | 435 | $9.99 | yes | — | **unset** |
| british-goblins | 390 | $11.99 | yes | yes | **unset** |
| fairy-mythology-vol-1 | 336 | $9.99 | yes | yes | **unset** |
| fairy-mythology-vol-2 | 326 | $9.99 | yes | yes | **unset** |
| codex-enigmatica | 274 | $9.99 | yes | — | **unset** |
| traditional-games | 244 | $9.99 | yes | yes | **unset** |
| the-great-book-of-world-myths | 234 | $6.99 | yes | — | **unset** |
| how-the-world-began | 232 | $9.99 | yes | — | **unset** |
| sea-monsters-unmasked | 232 | $9.99 | yes | yes | **unset** |
| book-of-were-wolves | 198 | $8.99 | yes | yes | **unset** |
| epictetus-discourses-and-enchiridion | 176 | $9.99 | yes | yes | **unset** |
| pencil-and-paper | 162 | $6.99 | yes | — | **unset** |
| the-great-book-of-world-games | 160 | $9.99 | yes | — | **unset** |
| codex-mythologica-the-puzzle-book | 156 | $11.99 | yes | yes | **unset** |
| seneca-selected-dialogues | 154 | $9.99 | yes | yes | **unset** |
| meditations | 148 | $9.99 | yes | — | **unset** |
| the-puzzles-of-henry-dudeney | 144 | $9.99 | yes | yes | **unset** |
| korean-games | 144 | $8.99 | yes | yes | **unset** |
| kwaidan | 142 | $8.99 | yes | yes | **unset** |
| chess-and-playing-cards | 120 | $7.99 | yes | yes | **unset** |
| the-tricksters-table | 112 | $6.99 | yes | — | **unset** |
| myths-and-legends-of-china | 108 | $9.99 | yes | yes | **unset** |
| greek-alphabet-handwriting-workbook | 100 | $6.99 | yes | yes | **unset** |
| indian-myth-and-legend | 94 | $9.99 | yes | yes | **unset** |
| games-ancient-and-oriental | 78 | $7.99 | yes | yes | **unset** |
| mythical-monsters | 74 | $9.99 | yes | yes | **unset** |
| mancala | 38 | $4.99 | yes | yes | **unset** |

**19 of 27 also have an EPUB.** The EPUB is a second delivered artifact of the
same purchase, not a second product; it is offered from the library, not read
in the reader.

**Every `variant id` is unset, in production as well as in the sandbox.** That
is the purchase → book mapping, and without it nothing is buyable. See §4.

---

## Not reader-eligible — 3

Re-checked against the live catalogue rather than taken from the directive's
historical list (§26 asks for exactly that).

| Title | Pages | Why not |
|---|---:|---|
| **Codex Mythologica** | 329 | KDP Select — enrolment is exclusivity, and a Select ebook may not be sold here. `fulfillment: amazon`; the storefront links out. A test asserts this and must not be weakened. |
| **The Myth Hunter's Field Book** | 156 | Deliberately has no ebook. It is a write-in book; an e-reader edition would not work. `availability: unavailable`. |
| **Korean Hangul Handwriting Workbook** | 124 | Unresolved CC BY-NC question on source material. Not priced until that is signed off. A fixed-layout EPUB 3 exists as a reference edition; it is not sold. |

All three remain correct exclusions as of this date. The reader will serve any
of them the moment a `direct`/`available` ebook format and a master exist — no
reader code changes.

---

## Adding the 28th title

There is no step in this list that touches the reader.

1. Add the row to `scripts/catalog/valice-catalog.mjs` with an `ebook` format,
   `fulfillment: "direct"`, `availability: "available"`, and
   `websiteStatus: "published"`.
2. `node scripts/catalog/upload-masters.mjs` — master PDF into R2 MASTERS.
3. `node scripts/catalog/provision-lemonsqueezy.mjs` — create the product and
   variant, and write `provider_price_id` back.
4. `node scripts/catalog/load-catalog.mjs` — apply the catalogue.
5. Drop `/images/books/<slug>.webp` — the same cover the storefront uses becomes
   the reader's closed volume.
6. Check the title against the §51 list below.

---

## Per-title quality check (§51)

Most of this list is answered by construction, and saying which is more useful
than a checklist that pretends every line needs a human.

**Answered by construction — no per-title work:**

| Check | Why it cannot be wrong |
|---|---|
| correct cover | one asset path, shared with storefront and library |
| correct title | one `books` row |
| correct page count | read from the PDF, not from a record |
| correct page order | the PDF's own order |
| correct page dimensions | read from page 1 of that PDF |
| no missing/duplicate pages | the engine renders `1..numPages`, tested |
| no cross-book assets | the artifact key comes from that book's entitlement |
| page turning works | one engine |
| progress / entitlement | one gate, tested |
| direct asset protected | one route, tested |
| unauthorized access denied | one gate, tested |

**Genuinely per-title, because only a person can judge them:**

- [ ] The edition is the one intended (not a superseded cut).
- [ ] Typography is readable at spread width on a laptop.
- [ ] Typography is readable in single-page layout on a phone.
- [ ] No page renders corrupt (a bad embedded image, a missing font).
- [ ] The PDF outline resolves to sensible pages, or is honestly absent.

The last is worth naming: a book whose outline is missing gets an empty
contents drawer that says so and offers the page field instead. That is the
correct behaviour, not a defect — but it should be a known fact per title
rather than a surprise.

---

## Asset versioning (§28)

Masters live at `books/<slug>/master/v<n>/master.pdf`. Artifacts are per order
at `<orderId>/<uuid>.pdf` and are therefore **immutable**.

**A customer keeps the edition they bought.** Uploading `master/v2/` changes
nothing for existing buyers: their artifact was stamped from v1 and remains
theirs. New purchases receive the new edition. Migrating an existing buyer
forward is an explicit operator action — re-run the watermark worker for that
entitlement — and never a side effect of a catalogue load.

---

## Current blockers to a real purchase

Verified 2026-09-14 against production, not inferred.

| # | Blocker | Evidence | Owner |
|---|---|---|---|
| 1 | `LEMONSQUEEZY_WEBHOOK_SECRET` not set in production | an unsigned POST to the live webhook returns **503**, the code the handler emits when the secret is absent | Founder |
| 2 | `LEMONSQUEEZY_API_KEY` not set in production | absent from `vercel env pull --environment=production` | Founder |
| 3 | `provider_price_id` unset on all 27 books, in `neondb` as well as the sandbox | `select count(*) filter (where provider_price_id is not null) from books` → **0** | Founder, then `provision-lemonsqueezy.mjs` |
| 4 | Lemon Squeezy store is test-mode locked | recorded in project memory, 2026-09-13 | Founder |

Production currently holds **1 user, 0 orders, 0 entitlements**. None of these
four are reader defects; all four predate this work. Until they clear, the
reader is complete and has nothing to open.
