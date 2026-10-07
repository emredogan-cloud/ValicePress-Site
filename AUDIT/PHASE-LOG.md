# Phase log — site update 2026-10

A running record, one entry per phase, written when the phase's gate was passed. Every number is from a run in this repository or on the physical phone; nothing is estimated. The final reports in this directory are assembled from this log.

Baseline on `main` @ `d3a7ca9` before any change: `tsc` 0 · `eslint` 0 · Vitest (CI shape) **37 files · 464 passed · 166 skipped · 0 failed**.

---

## Phase 0 — audit  ✔  (commit `04cbd9a`)
`AUDIT/VALICE-PRESS-SITE-ARCHITECTURE-AUDIT.md`. No product code changed. Added: pinned `@playwright/test@1.62.1`, `scripts/catalog/verify-amazon-asins.mjs`, the visual-regression capture harness and its "before" manifest from the live site.

## Phase 1 — shared overlay layer + mobile header  ✔

**Root cause (measured, then reproduced on the Redmi):** `QuickView` was a CSS grid with `overflow: hidden` and only `max-height`; on a phone its two rows did not fit, nothing scrolled, Buy/Close sat in the clipped second row, only `body` (not `html`) was locked, Android Back left the site. The bonus pages have no popup of their own.

**Built:** `src/lib/overlay/{scroll-lock,overlay-stack,use-overlay}.ts` (ref-counted lock, top-only Escape, focus in/trap/return, app made inert, same-URL history entry so Back closes it) and `src/components/ui/dialog.tsx` (portal into `#overlay-root`; flex column bounded by `dvh`; one scroller; pinned footer; 44 px close outside the scroller). **Migrated:** QuickView (rewritten around Header / Body / pinned Footer), the catalogue filter sheet, MobileNav, the newsletter popup, FreeBookModal. **Removed:** five private `overflow` writers, four copy-pasted focus traps, dead `reader-shell.tsx`. A Vitest guard fails if anything but `scroll-lock.ts` writes `body|html.style.overflow`.

**Mobile header:** the right-hand cluster overflowed on every route (93 px at 320, 38 at 375, 23 at 390, 20 at 393). Account control is icon-only below `sm`; gaps tighten below 380; the search icon yields below 340 and the drawer gained a Search entry; padding 16 px on phones.

**Console errors removed at the source:** links to sign-in-gated `/account/*` pages no longer prefetch (header Library, footer, legal pages, cart, book page) — the prefetch followed Clerk's redirect to another origin and failed as a CORS error on every page.

**Newsletter popup:** never opens on `/bonus`, `/weather-permitting-bonus`, `/long-way-back-bonus`; waits until no overlay is open and nobody is typing; does not autofocus the email field on touch devices.

### Evidence
| Check | Before (live site) | After (this branch) |
|---|---|---|
| Playwright, mobile Chromium, same spec | header overflow 93/38/23/20/13/1 px at 320/375/390/393/360/412; Close 36 px; dialog wider than viewport | **26 passed** (all three projects), 0 failed |
| **Redmi Note 8 (2021), real touch + real `KEYCODE_BACK`** | **9 / 18 failed** — Close 36 px; "Full details" at y=1015 on a 744 px screen; only `body` locked; Back leaves `/books`; after Close the page still frozen (`scrollY 365 → 365`) | **18 / 18 passed** (`AUDIT/evidence/phase1/redmi-quickview-*.json`) |
| Vitest (CI shape) | 37 files · 464 passed | **40 files · 493 passed** · 166 skipped · 0 failed (+29 new tests) |
| `tsc` / `eslint` / `next build` | 0 / 0 / ok | 0 / 0 / ok |

The e2e spec was also run against the OLD live site to prove it can fail — it did, in exactly the places above — before it was trusted to pass on the new build.

### Notes
- The device is a **Redmi Note 8 (2021)**, not a Note 11R.
- Local production preview runs on `http://localhost:3210` through `scripts/e2e/serve.mjs`, which refuses to start unless `DATABASE_URL` is the sandbox `bookstore`, and blanks MailerLite / Resend / R2 / Lemon Squeezy keys.
- Clerk's `pk_live` key cannot initialise on localhost, so the account slot stays a neutral placeholder locally; it is a Sign-in icon on the live site.

## Phase 2 — the registry is tested against the world  ✔

The registry already existed — `scripts/catalog/valice-catalog.mjs` is the one file that says what the store sells, and the loader applies it to the database. What was missing was anything that **proved the registry agrees with reality**. Added `scripts/catalog/catalog-identity.test.ts` (13 tests): slugs, ASINs and ISBNs are unique across the whole catalogue; a series number is used once; every Amazon URL is the one its ASIN produces; no ASIN belongs to two books; a KDP-Select ebook is never offered here (the existing guard, untouched); and **every ASIN has a row of evidence read from the live Amazon `/dp/` page — title, format and ISBN — that agrees with the registry** (`data/catalog/amazon-verification.json`).

**What it found, on the first run**
- two of the 48 existing ASINs were wrong, both World Games: the Kindle ASIN `B0HG44FH1B` does not exist on Amazon, and the "hardcover" `B0HG41F21F` is a different format of the older 56-game edition (`AUDIT/data/amazon-asins-catalog-BEFORE-2026-10-07.json`);
- "Valice Classics #15" was used by two books (`puzzles-old-and-new` carried an unverified volume number) — removed rather than invented.

**The verifier** (`scripts/catalog/verify-amazon-asins.mjs`) is resumable and now fetches with `curl`. Node's `fetch` gets Amazon's ~2 KB robot-check stub for pages that `curl`, with identical headers, reads in full: three `fetch` passes left 16 ASINs "throttled"; one `curl` pass read all 16.

**Order is data, deterministic.** `PINNED_BOOK_SLUGS` + `byPinnedRank` apply last and never add a book; the remainder is `published_at desc nulls last, slug asc` (`src/lib/shelf-order.ts`, tested). Before: ties fell back to whatever order Postgres returned.

## Phase 3 — new books, correct links, priority order  ✔

| Book | Status | Formats on Amazon (ASIN) |
|---|---|---|
| Weather Permitting | published | Kindle `B0HLPPCVT3` · paperback `B0HLXPRMRD` |
| Ridge Runner | **draft — not on the site** | no live KDP edition exists, so no ASIN is recorded |
| The Sweetest Season | published (+ hardcover) | paperback `B0HKTRTQY7` · hardcover `B0HLZYK267` · Kindle `B0HKTJ3CMJ` |
| The Great Book of World Games | corrected | paperback `B0HLLMNFTL` · hardcover `B0HLKPSLHH` · large print `B0HHNCVQVX` · PDF sold here (rebuilt from the current interior) |
| Codex Bestiarium | current assets | unchanged ASINs; cover/back/previews from the current files |
| The Long Way Back | published | Kindle `B0HL6S3V5C` · paperback `B0HL74PNCZ` · hardcover `B0HLXLDNPS` |
| All the Quiet Places | published | Kindle `B0HC4KYYPM` · paperback `B0HLXJH2R6` |

Catalogue: **33 → 37 books** (36 published + 1 draft), **89 → 99 formats**, **48 → 55 ASINs, every one verified on its live page** (`data/catalog/amazon-verification.json`: 55 ok, 0 mismatches).

**Priority order** (`/books`, `/ebooks`): Weather Permitting, The Sweetest Season, World Games, Codex Bestiarium, The Long Way Back, All the Quiet Places — Ridge Runner takes its place the day it is published. `/ebooks` now lists every book a reader can obtain as an ebook, whether sold here or on Kindle (it used to show only ebooks sold here, which hid the Kindle-only romances).

**Quick view** offers one chip per edition that exists, and "Buy on Amazon" always leads to the **selected** edition's own URL (a test would fail if book A's title sat beside book B's link).

### Evidence (Phases 2–4 together, production build)
| Check | Result |
|---|---|
| `tsc` / `eslint` / `next build` | 0 / 0 / ok |
| Vitest, CI shape (`VALICE_BOOKS_ROOT=/nonexistent`) | **44 files · 716 passed · 166 skipped · 0 failed** (baseline 464) |
| Playwright, desktop Chromium + mobile Chromium + desktop Firefox, vs. the local production build on the sandbox DB | **81 passed · 36 skipped (mobile-only specs on desktop projects) · 0 failed** |
| ASIN evidence | 55 / 55 verified against the live Amazon page |

### Decisions to confirm
1. **Ridge Runner stays a draft.** The brief asks for it among the priority books, but it has no live KDP edition, and the project rule is "no ASIN without a live edition". It is staged: images, previews, quotations are ready; `websiteStatus: "published"` + its ASINs are the only thing missing.
2. The brief's World Games Kindle edition **does not exist** (Amazon: Page Not Found). The book's ebook is the PDF sold on this site.

## Phase 4 — a preview for every book, from the book's own words  ✔

**Every one of the 37 books now has the same four panels: front cover, back cover, two passages** — or, where the book has no printed edition and therefore no back cover, front, two passages and one of the book's own interior pages. Nothing is borrowed from another book and nothing is invented: a back cover is cropped from the book's paperback wrap (27 books), and when there is no wrap there is no back cover.

**The passages are the book's.** `scripts/previews/quote-picks.json` says *where* each passage is (file, paragraph, the words it starts and stops at) and nothing about what it says; `select-quotes.py` cuts the words out of the manuscript or the typeset PDF; `verify-quotes.mjs` proves each cut is **contiguous, in order, with nothing dropped**, against the manuscript (paragraph-exact) **and** against the printed interior (flat) — 74 passages, 0 failures — and writes the proof (file, SHA-256, date, method) next to the quote. A negative control confirmed it rejects a changed word, a reordered clause and a dropped sentence. `book-media.test.ts` (199 tests) refuses a passage without its proof, a card that is not the file that was ingested, and two books sharing a quotation.

**The typography is ours.** `quote-card.py` sets every glyph from font files (EB Garamond, Cinzel); an image generator never spells the book's words. Backgrounds: the two Weather Permitting cards use a generated night-chalet plate (`scripts/previews/plates/`, disclosed in the provenance record); every other card uses a soft-focus crop of **that book's own cover** — chosen so no lettering of the cover survives (earlier attempts leaked cover titles into the blur; they were caught on the contact sheets and the crops moved). Parchment/ink themes follow the cover: games and workbooks on paper, mythologies on dark.

**Editorial notes are labelled.** Where a passage is from this edition's own notes rather than the author's text, the card says so ("Editor's note · …"); a passage from an author is never set under the editor's name or the reverse.

### Notes
- The ChatGPT image path (the brief's suggestion for backgrounds) was tried and abandoned for all but one plate: its downloads open a native save dialog that freezes the automated tab. The covers' own art gives each book a distinct, truthful atmosphere with no generative step.
- `pdf_blocks.py` reads a typeset PDF as paragraphs (PyMuPDF) and strips glyphs the PDF could not map; it caught a NUL-character artefact in one passage before it reached a card.

## Phase 5 — book pages that follow the reference, and a Look Inside that shows the book  ✔

`src/app/books/[slug]/page.tsx` now composes, in the order of `images/book-details-page.png`: **hero** (cover; author eyebrow, serif title, italic subtitle, a rating line, the opening of the description, chips, the primary and secondary buttons, pages and language) → **tab strip** (Overview · Preview · About the book · About the author · Editions — anchors, only the sections that exist, current one marked by scroll position) → **Editions card** (an icon, price and Amazon button per edition; the print-fulfilment note beside it) → **Look inside** → **About the book / What you'll find inside / About the author** → reviews → related books. Every rule the old page enforced is kept: a price only where this site really sells the book, a rating only where a review exists, one Amazon URL per edition from the catalogue, the free-promotion strip and add-to-cart as the same client islands, JSON-LD unchanged.

**Nothing on the page is written for the page.** The chips are claims the book's own record makes — each carries the words of its description/subtitle that make it, and `book-highlights.test.ts` (39 tests) fails if those words are not there (a negative control confirmed it). The author card shows the biography the author record holds; where there is none (Quinn Gallagher) it says only "Author of Weather Permitting on Valice Press" — no bio is written, and no face is drawn (an initial stands where there is no portrait file).

**Look inside** shows, strongest first: the book's own A+ pictures → real interior pages → back cover → the two passages; the row shows the first of them, a viewer (the shared `Dialog`: scroll-lock once, Escape and Android Back close it, focus returns; plus ←/→ and swipe) steps through all. 22 A+ pictures from 7 books' final export folders, each ingested with provenance.

**A finding for the Founder — A+ pictures that print lines the book does not contain.** Every quotation printed on an A+ picture was checked against the printed interior. Pictures whose lines are all in the book (verbatim, or the same words in order across a speech tag) are used. These were **left out** (they are not on the site; check whether they are live on Amazon):
- *Weather Permitting* A+ 01 (`"You want to know what the air ambulance needs?"`, `"I want to know whether it can survive."`), 03 (`"I should go."`), 06 (`"That's the correct answer."` — the book says `"It's the correct answer."`);
- *The Sweetest Season* hero-dock module (`"It's forty feet from the boat shop to the kitchen door."` is the description's hook line, not a line of the book), the split-duo module (`"If it leaves late, the hot component's dead."`), the canoes module (`"…and took her hand from the bad part of the gravel and did not let go."`) and the window-quote module (`"It was the easiest thing in the world to argue with her. The hard part was remembering why she wanted to."` — nowhere in the book, and the first line is clipped at the picture's right edge).
Books whose A+ files are older builds (Codex Mythologica, Myth Hunter's, World Myths, Hangul, Enigmatica) get pages, back cover and passages instead; no picture from another book is ever used.

### Evidence
| Check | Result |
|---|---|
| Vitest, CI shape | **46 files · 763 passed · 166 skipped · 0 failed** |
| `tsc` / `eslint` / `next build` | 0 / 0 / ok |
| Playwright × 3 projects on the new build | **166 passed · 53 skipped (mobile-only on desktop) · 0 failed** — includes `e2e/detail.pw.ts`: section order, tab per section, Editions rows and links = the catalogue's, the viewer steps and closes with focus back, nothing wider than the screen at 320–412 px, no picture from another book |
