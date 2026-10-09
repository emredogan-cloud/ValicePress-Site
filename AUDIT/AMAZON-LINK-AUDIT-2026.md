# Amazon link audit — 2026-10

Branch `feat/site-update-2026-10`. Every number is from a run in this repository or from the live Amazon page; nothing is remembered. **55 ASINs, 55 read off their live `/dp/` pages, 0 disagreements with the catalogue, 0 changes between two reads a day apart.**

## 1. Method — four layers, each able to fail on its own

| Layer | What is checked | Instrument | Result |
|---|---|---|---|
| **Registry** | every `amazonUrl` is exactly `https://www.amazon.com/dp/<ASIN>`; no ASIN belongs to two books; no ISBN, slug or series number is used twice; a KDP-Select book's ebook is never offered here | `scripts/catalog/catalog-identity.test.ts` (13 tests) | pass |
| **The world** | each ASIN's live page is read — title, selected format, ISBN-13, page count, author line, price, sibling editions — and compared with the registry row that claims it. A `200` alone proves nothing: it does not say *whose* page it is | `scripts/catalog/verify-amazon-asins.mjs --catalog` (read-only `curl`, 6 s apart; Amazon answers a faster client with a 2 KB robot-check stub, reported as `throttled`, never as a verdict) | **55 / 55 `ok`**, 2026-10-07 (`data/catalog/amazon-verification.json`) and again **2026-10-08** (`AUDIT/data/amazon-asins-FINAL-2026-10-08.json`) — **no title, format, ISBN, page count, price or state changed between the two** |
| **The site** | each book's page links exactly the editions the catalogue gives that book, and nothing else; the quick view's "Buy on Amazon" leads to the **selected** edition's own URL; each ASIN appears on one book's pages only | `scripts/qa/book-matrix.mts` (every published book, 36 / 36), `e2e/catalog.pw.ts` (the priority books' pages and quick-view chips), `scripts/seo/audit.mjs` (a rule: one ASIN, one book), `scripts/mobile/books.mjs` (every popup and page on the phone) | **36 / 36**, 0 violations |
| **The click** | the button opens amazon.com **in a new tab, leaving this tab where it was**, with `rel="noopener noreferrer"`; its accessible name says where it goes and that it opens a new tab | `e2e/detail.pw.ts` (`target`, `rel`, accessible name); on the physical phone `scripts/mobile/final.mjs` ("a tap opens amazon.com in a NEW tab", "this site's tab is still where it was") | pass; 89 / 89 on the phone |

## 2. What was wrong, and what is right now

| Finding | Evidence | Now |
|---|---|---|
| **World Games had three ASINs that were wrong or out of date.** The Kindle `B0HG44FH1B` does not exist on Amazon ("Page Not Found"); the "hardcover" `B0HG41F21F` is a different format of the older 56-game edition, as is the paperback `B0HG3KMK9L` | `AUDIT/data/amazon-asins-catalog-BEFORE-2026-10-07.json` | All three retired. The current 63-game editions: paperback `B0HLLMNFTL`, hardcover `B0HLKPSLHH`; large print `B0HHNCVQVX` was right and is unchanged. **The brief's World Games Kindle edition does not exist** — the book's ebook is the DRM-free PDF sold on this site |
| Ten ASINs had never been recorded (three new books and one new hardcover) | the diff of the catalogue against `main` @ `d3a7ca9` | Added, each read off its live page: Weather Permitting `B0HLPPCVT3` · `B0HLXPRMRD`; The Long Way Back `B0HL6S3V5C` · `B0HL74PNCZ` · `B0HLXLDNPS`; All the Quiet Places `B0HC4KYYPM` · `B0HLXJH2R6`; The Sweetest Season hardcover `B0HLZYK267`; World Games `B0HLLMNFTL` · `B0HLKPSLHH`. **48 → 55 ASINs** (+10 added, −3 retired) |
| *Ridge Runner* has no live KDP edition | Amazon: none | **No ASIN is recorded and none is invented.** It is a draft; see `BOOK-CATALOG-AUDIT-2026.md` §5 |
| A Kindle Unlimited title's format swatch reads `$0.00` | the verifier's `selectedPrice` | The price recorded is the buy box's "or $X to buy" (`priceBasis` in the catalogue says so for each); a Select book is never recorded as free |
| `/review-long-way-back` | `next.config.ts` | a temporary (307) redirect to Amazon's review form for `B0HL6S3V5C` — the live Kindle ASIN of *The Long Way Back* |

## 3. For you: Amazon-side corrections that only KDP can make

`B0HDLQHQ7H` (paperback) and `B0HDLLPG5M` (hardcover) of **Codex Bestiarium** still carry the title *"A World Bestiary: 120 Legendary Creatures from 40 Traditions"*; the large-print edition `B0HDLT1V3P` says *"112 Legendary Creatures from 40 Traditions"* and **the book contains 112**. Nothing on this site says 120 (the site reads the book). The two titles can only be corrected in KDP.

Two more are recorded in the catalogue's own `blockers` for *The Great Book of World Games* (written when the editions were checked on 2026-10-07; **not re-verified today**): the **large-print** listing `B0HHNCVQVX` still carries the previous revision's title and subtitle, and the **hardcover** interior (`B0HLKPSLHH`) still prints the first-printing paperback's ISBN (noted in `KDP_READY/GBK-02`). Fix both in KDP before re-uploading anything.

## 4. Every ASIN

"Live page" is what Amazon's page says it is; "registry ISBN agrees" is `n/a` where the registry has none to compare or where Amazon prints none (a Kindle page has no ISBN-13).

| ASIN | Book | Registry format | Link is `/dp/<ASIN>` | Live page: format · ISBN-13 · pages | Registry ISBN agrees | State 2026-10-07 | State now |
|------|------|-----------------|-----------------------|-------------------------------------|----------------------|------------------|-----------|
| `B0HD8121RR` | Codex Mythologica | ebook | yes | KINDLE · — · 329 | n/a | ok | ok |
| `B0HCY8KY3X` | Codex Mythologica | paperback | yes | PAPERBACK · 979-8190712773 · 329 | n/a | ok | ok |
| `B0HDBFZRQ4` | Codex Mythologica | hardcover | yes | HARDCOVER · 979-8191248714 · 329 | n/a | ok | ok |
| `B0HDDR84MF` | Codex Mythologica | large print | yes | PAPERBACK · 979-8191243528 · 578 | n/a | ok | ok |
| `B0HDLS4W8Q` | Codex Bestiarium | ebook | yes | KINDLE · — · 436 | n/a | ok | ok |
| `B0HDLQHQ7H` | Codex Bestiarium | paperback | yes | PAPERBACK · 979-8191703688 · 435 | n/a | ok | ok |
| `B0HDLLPG5M` | Codex Bestiarium | hardcover | yes | HARDCOVER · 979-8191706177 · 435 | n/a | ok | ok |
| `B0HDLT1V3P` | Codex Bestiarium | large print | yes | PAPERBACK · 979-8191723020 · 599 | n/a | ok | ok |
| `B0HDQRPKST` | The Great Book of World Myths | ebook | yes | KINDLE · — · 234 | n/a | ok | ok |
| `B0HDTL5V2H` | The Great Book of World Myths | paperback | yes | PAPERBACK · 979-8191977737 · 234 | n/a | ok | ok |
| `B0HDZJ4PHQ` | The Great Book of World Myths | hardcover | yes | HARDCOVER · 979-8192043813 · 234 | n/a | ok | ok |
| `B0HK2GLCFG` | The Great Book of World Myths | large print | yes | PAPERBACK · 979-8174780811 · 234 | n/a | ok | ok |
| `B0HLLMNFTL` | The Great Book of World Games | paperback | yes | PAPERBACK · 979-8178107232 · 258 | yes | ok | ok |
| `B0HLKPSLHH` | The Great Book of World Games | hardcover | yes | HARDCOVER · 979-8177930060 · 258 | yes | ok | ok |
| `B0HHNCVQVX` | The Great Book of World Games | large print | yes | PAPERBACK · 979-8171397371 · 498 | yes | ok | ok |
| `B0HFP4KYX5` | The Myth Hunter's Field Book | paperback | yes | PAPERBACK · 979-8193475859 · 156 | n/a | ok | ok |
| `B0HJ5MJJ5K` | The Myth Hunter's Field Book | hardcover | yes | HARDCOVER · 979-8172681028 · 156 | n/a | ok | ok |
| `B0HJV1ZRSR` | The Greek Alphabet Handwriting Workbook | paperback | yes | PAPERBACK · 979-8172680830 · 100 | n/a | ok | ok |
| `B0HJ2TPX4T` | Codex Mythologica: The Puzzle Book | paperback | yes | PAPERBACK · 979-8172268281 · 156 | yes | ok | ok |
| `B0HJBY2CJW` | Codex Mythologica: The Puzzle Book | hardcover | yes | HARDCOVER · 979-8172680939 · 156 | n/a | ok | ok |
| `B0HHHWXGG4` | Korean Hangul Handwriting Workbook | paperback | yes | PAPERBACK · 979-8170602360 · 124 | n/a | ok | ok |
| `B0HHLZ31CV` | Korean Hangul Handwriting Workbook | hardcover | yes | HARDCOVER · 979-8170927647 · 124 | yes | ok | ok |
| `B0HHS2JW9N` | The Puzzles of Henry Dudeney | paperback | yes | PAPERBACK · 979-8171876937 · 144 | yes | ok | ok |
| `B0HJ6G2B4L` | Epictetus: The Discourses and Enchiridion | paperback | yes | PAPERBACK · 979-8172626982 · 176 | n/a | ok | ok |
| `B0HJDMFV1R` | Seneca: Selected Dialogues | paperback | yes | PAPERBACK · 979-8172687273 · 154 | n/a | ok | ok |
| `B0HJ7N35KS` | Myths and Legends of China | paperback | yes | PAPERBACK · 979-8172694240 · 108 | n/a | ok | ok |
| `B0HJ5RB8BR` | Indian Myth and Legend | paperback | yes | PAPERBACK · 979-8172694967 · 94 | n/a | ok | ok |
| `B0HJG58238` | Puzzles Old and New | paperback | yes | PAPERBACK · 979-8173206107 · 102 | n/a | ok | ok |
| `B0HJD2NCR4` | Mythical Monsters | paperback | yes | PAPERBACK · 979-8172695872 · 74 | n/a | ok | ok |
| `B0HJ5KZH5J` | Games Ancient and Oriental: The Egyptian Games | paperback | yes | PAPERBACK · 979-8172696701 · 78 | n/a | ok | ok |
| `B0HJ7JGJ4P` | Korean Games: The Games of Chance and Divination | paperback | yes | PAPERBACK · 979-8172697418 · 144 | n/a | ok | ok |
| `B0HGRZ3BRC` | Codex Enigmatica | ebook | yes | KINDLE · — · 274 | n/a | ok | ok |
| `B0HGSVF15Q` | Codex Enigmatica | paperback | yes | PAPERBACK · 979-8170191178 · 274 | n/a | ok | ok |
| `B0HH3B4HQ7` | Codex Enigmatica | hardcover | yes | HARDCOVER · 979-8170244751 · 276 | n/a | ok | ok |
| `B0HK7ZXM4B` | Codex Enigmatica | large print | yes | PAPERBACK · 979-8174787988 · 439 | n/a | ok | ok |
| `B0HK4T265V` | Pencil & Paper | paperback | yes | PAPERBACK · 979-8174791015 · 162 | n/a | ok | ok |
| `B0HJWTY45W` | Pencil & Paper | ebook | yes | KINDLE · — · 162 | n/a | ok | ok |
| `B0HJYDQ4Q4` | How the World Began | paperback | yes | PAPERBACK · 979-8174675223 · 232 | n/a | ok | ok |
| `B0HK7QRSKQ` | How the World Began | large print | yes | PAPERBACK · 979-8174682702 · 386 | yes | ok | ok |
| `B0HJWXPJN6` | How the World Began | ebook | yes | KINDLE · — · 232 | n/a | ok | ok |
| `B0HJWM4FG7` | The Trickster's Table | ebook | yes | KINDLE · — · 112 | n/a | ok | ok |
| `B0HJYHB14G` | The Trickster's Table | paperback | yes | PAPERBACK · 979-8174669574 · 112 | n/a | ok | ok |
| `B0HJWRYQW5` | Words from the Gods | ebook | yes | KINDLE · — · 334 | n/a | ok | ok |
| `B0HK4ZJWRK` | Words from the Gods | paperback | yes | PAPERBACK · 979-8174775428 · 334 | n/a | ok | ok |
| `B0HK7SV712` | Words from the Gods | hardcover | yes | HARDCOVER · 979-8174773745 · 334 | n/a | ok | ok |
| `B0HKTRTQY7` | The Sweetest Season | paperback | yes | PAPERBACK · 979-8176620368 · 292 | yes | ok | ok |
| `B0HLZYK267` | The Sweetest Season | hardcover | yes | HARDCOVER · 979-8178456965 · 292 | yes | ok | ok |
| `B0HKTJ3CMJ` | The Sweetest Season | ebook | yes | KINDLE · — · 292 | n/a | ok | ok |
| `B0HLPPCVT3` | Weather Permitting | ebook | yes | KINDLE · — · 292 | n/a | ok | ok |
| `B0HLXPRMRD` | Weather Permitting | paperback | yes | PAPERBACK · 979-8178851487 · 292 | yes | ok | ok |
| `B0HL6S3V5C` | The Long Way Back | ebook | yes | KINDLE · — · 258 | n/a | ok | ok |
| `B0HL74PNCZ` | The Long Way Back | paperback | yes | PAPERBACK · 979-8177403687 · 258 | yes | ok | ok |
| `B0HLXLDNPS` | The Long Way Back | hardcover | yes | HARDCOVER · 979-8178853214 · 258 | yes | ok | ok |
| `B0HC4KYYPM` | All the Quiet Places | ebook | yes | KINDLE · — · 264 | n/a | ok | ok |
| `B0HLXJH2R6` | All the Quiet Places | paperback | yes | PAPERBACK · 979-8178857373 · 264 | yes | ok | ok |

55 ASINs.

## 5. Limits of this audit

- A live page proves the listing exists and is the right edition **today**; Amazon can retire or re-title one tomorrow. Re-run `node scripts/catalog/verify-amazon-asins.mjs --catalog` (about six minutes) before any catalogue load, and after any KDP change.
- The checks run against a build served from `localhost` on the sandbox database. The links themselves are catalogue data and do not depend on the environment, but nothing here exercised the **production** deployment — that is after the go-ahead (`FINAL-RELEASE-REPORT-2026.md` §10).
- Prices are those read on 2026-10-07/08 and are shown on the site with their basis; Amazon prices move.
