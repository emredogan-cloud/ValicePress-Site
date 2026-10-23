# Final release report — Valice Press site update, 2026-10

**Released to https://valicepress.com on 2026-10-09.** Branch `feat/site-update-2026-10` (20 commits: the 15 phases and the release-session fixes; 589 files changed) was merged into `main` as `7140f31` (PR #68) and deployed as `dpl_EHTSByx5p1uVYRpzYnNwixrQQjSN`. The phase-by-phase record, with the evidence for each, is `PHASE-LOG.md`; the detail reports are `VALICE-PRESS-FULL-SITE-AUDIT-2026.md`, `BOOK-CATALOG-AUDIT-2026.md`, `AMAZON-LINK-AUDIT-2026.md`, `ADMIN-CONSOLIDATION-REPORT-2026.md`, `MOBILE-REDMI-NOTE-11R-QA-2026.md` and `FINAL-BOOK-MATRIX.md`. §1–§9 describe what the program changed (unchanged from the pre-release version of this report apart from the figures the release moved); **§10 onwards is the record of the release itself.** Every number is from a run in this repository, on the live system or on the physical phone.

## 0. Status

> ### RELEASED — PARTIALLY VERIFIED
>
> The three production writes the brief authorised were made first, in the order that protects buyers — the **258-page World Games master in R2**, then the **37-book catalogue and migration `0013`** in the production database — and then the merge and the deploy. The live site passes every functional, security, SEO and accessibility instrument run against it (§11.2); two performance readings are "needs work" and one layout-shift finding is open (§11.3). **Nothing was rolled back and nothing needed to be.**
>
> **"Partially" is exact.** Four things cannot be seen from this machine; they are listed, not assumed (§12.5):
> 1. The physical QA ran on the attached **Redmi Note 8 (2021), model M1908C3JGG — not a Redmi Note 11R**, which was not attached. The brief allowed this ("if attached") on condition it is reported accurately; it is.
> 2. **Direct checkout and a buyer's download were not exercised through a real payment.** The Lemon Squeezy key available here is a test-mode key (it sees 0 products in store 473583) and buying is not mine to do. The delivery path is verified up to the stamping step, on the real R2 object (§10.2) — not through a paid order.
> 3. **Sign-in and the signed-in `/admin` against the real Clerk.** The signed-in half is tested on a stub-auth copy of the final tree (55 tests) and on the phone (19 / 19); the signed-out half on the live site. After this release, **open `/admin` once**: the gate now requires your address to be *verified* in Clerk.
> 4. **The Cloudflare and Vercel dashboards** were observed from outside and never changed.

| The release | |
|---|---|
| **Released** | 2026-10-09 · merge **13:26:00** (+03:00) = 10:26:00 UTC · deployment READY **13:27:26** (+03:00) = 10:27:26 UTC |
| **Production URL** | https://valicepress.com (apex primary; `www` and `http` redirect to it with 308) |
| **Branch → branch** | `feat/site-update-2026-10` → `main`, **PR #68**, merged with a merge commit (the repo's convention: `merge: …`) |
| **Tip of the feature branch** (what CI, the Vercel preview and the local gates tested) | `980574a` |
| **Merge commit = the deployed commit** | `7140f31b3b1e8398ab86b006314cf21e98187cec` |
| **Production deployment id** | **`dpl_EHTSByx5p1uVYRpzYnNwixrQQjSN`** (`valicepress-book-site-6ut5fyfkj-emre30283-4955s-projects.vercel.app`; target production; READY; aliased to `valicepress.com`) |
| **Previous production deployment** (the rollback target) | `dpl_HKyjr5gdrd78ZoLgVMW1MFjrmR4X` — commit `d3a7ca9`, 2026-10-01 10:35 UTC, still a rollback candidate |
| **This report** | committed on branch `docs/release-report-2026-10-09` (PR #69), **deliberately not merged**: a push to `main` deploys production, so merging it is a redeploy of identical code — your call, no urgency |

## 1. Architecture changes

| Area | Before | Now |
|---|---|---|
| **Overlays** | five private `overflow` writers, four copy-pasted focus traps; the quick view froze phones | one layer (`lib/overlay/*`, `components/ui/dialog.tsx`): a reference-counted scroll lock, a top-only Escape, focus in / trapped / returned, the app made inert, a same-URL history entry so Android Back closes it. A guard test fails if anything else writes `body|html.style.overflow` |
| **Catalogue** | the registry existed, and was never held to the world | `catalog-identity.test.ts`: slugs, ASINs, ISBNs unique; every ASIN read off its live page and agreeing; Select books never sold here. Order is data (`PINNED_BOOK_SLUGS` + newest-first, tested) |
| **Previews** | one image per book, some another book's | four panels per book from the book's own files; **74 passages typeset from text verified verbatim** against the manuscript and the printed interior; provenance recorded; a test refuses an unproven passage |
| **Book page** | an older composition | the reference design: hero → tab strip → Editions → Look Inside → About → reviews → related; a price only where the site sells the book, a rating only where a review exists |
| **Brand** | a hero of three covers no book has; a personal X handle and GitHub in the footer; no logo tile in the header | the real covers on the plate; the real logo (source file never written; sha256 checked); **one** `social.ts` for the four addresses, a test that fails on a second copy |
| **Authors** | the ten authors with books | a reference registry of **31 people**, each with sources a script fetches and checks; two kinds never blurred ("on the Valice list" / reference author) |
| **About** | the story of a different business | rewritten from the catalogue; its sentences are tied to the catalogue by a test; 40 links audited |
| **Cart** | a module-level `EMPTY_CART` shared by every cookie-less visitor | pure operations that copy; one store; arrows from real positions; recommendations the cart accepts |
| **Admin** | five pages, five hand-rolled gates, writes to catalogue rows, no test on the gate | **one** shell and **one** gate (§8), email management, tri-state data |
| **Cards** | 8 heights on one grid | one geometry from CSS container reservations, grid and list, 12 widths asserted |
| **SEO / a11y / perf** | an empty catalogue in the HTML; shared descriptions; images fetched at 3× their size | catalogue in the HTML, unique metadata, clean outline, `sizes` that tell the truth, cache lifetimes, 0 axe violations |
| **QA** | 37 unit-test files, no browser tests, a phone harness run by hand | 80 unit files (1,417 tests passing), **738 browser tests in three browsers**, a signed-in admin harness, a crawl, a sweep, a book matrix, a phone harness of five scripts |

## 2. Routes

**Added:** `/admin/books`, `/admin/data`, `/admin/email`, `/admin/email/[id]`, `/admin/email/export`, the admin layout; `/icon.png`, `/apple-icon.png`. **Content rebuilt:** `/`, `/about`, `/authors` (+ 31 pages), `/books`, `/ebooks`, `/books/[slug]`, `/cart`. **Removed:** `/admin/books/[slug]/edit`, `/admin/contacts`, `/admin/contacts/export` — each redirects (`next.config.ts`) to its new home, which is behind the same gate. 66 routes in the build (22 static, 7 generated from data, 37 on demand; 19 of them API handlers); sitemap 125 URLs (98 before; the three bonus-scene pages are listed from this release).

## 3. Books

**Added:** *Weather Permitting*, *The Long Way Back*, *All the Quiet Places* (published); *Ridge Runner* (**draft** — no live KDP edition; staged and pinned second, so publishing it is a catalogue edit). 33 → 37 books, 89 → 99 formats. **Reordered:** every listing opens with Weather Permitting, The Sweetest Season, The Great Book of World Games, Codex Bestiarium, The Long Way Back, All the Quiet Places (Ridge Runner takes second place the day it is published); below them, newest first.

## 4. Amazon links corrected

Three World Games ASINs retired — the Kindle `B0HG44FH1B` (does not exist), the paperback `B0HG3KMK9L` and hardcover `B0HG41F21F` (the older 56-game edition) — replaced by `B0HLLMNFTL` and `B0HLKPSLHH`; ten ASINs added; **55 ASINs, all read off their live page twice, none changed in 24 hours**; the quick view's "Buy on Amazon" leads to the *selected* edition. Two live Codex Bestiarium titles still say 120 creatures (the book has 112) — only KDP can change them (`AMAZON-LINK-AUDIT-2026.md`).

## 5. Preview visuals created

36 published books × **4 panels** (front, back, two passages — or front, two passages and an interior page where there is no print wrap): 144 panels; **26** back covers cropped from print wraps; **74** typeset passage cards; **22** A+ pictures from seven books' final export folders (pictures whose printed lines are not in the book were *left out* — the list is in `PHASE-LOG.md` Phase 5, for you to check against Amazon); 139 Look Inside tiles on the pages.

## 6. Detail pages updated

**36 of 36**, each compared with the catalogue (heading, structured data, cover file, panels, Amazon links, author) and walked on the phone (`FINAL-BOOK-MATRIX.md`).

## 7. Authors added

**31** people on `/authors`: 28 researched (10 historical voices, 5 of games and puzzles, 10 of sapphic romance, 3 more public-domain authors the press publishes) with 22 photographs — every one from Wikimedia Commons under a licence the fetcher checks, each credited — and the three living authors, whose pages are built only from approved biographies. The verifier caught 14 wrong Wikidata ids that had been typed from memory. **Quinn Gallagher has no biography on record; none is written.**

## 8. Admin consolidation

**Before:** 1 gated area of 5 unrelated pages, 5 hand-rolled gates. **After: 1 shell, 6 tabs, 1 gate.** Catalogue-writing actions deleted; email add / edit / suppress / opt-in / delete / duplicates / export under a consent policy that is pure rules; unsubscribes reach the book; the Overview says "unavailable" where it has no source. 78 signed-out and 55 signed-in browser checks, 19 / 19 on the phone (`ADMIN-CONSOLIDATION-REPORT-2026.md`).

## 9. Cart, logo, social links, mobile

- **Cart — 11 issues:** (1) the shared empty cart — every cookie-less visitor opened another's book, the likeliest cause of the reported "the plus doesn't add"; (2) "the plus doesn't add the adjacent book": the shelf offered five books the cart refuses, the plus was a button nested inside a link, refusals were silent, the tick vanished with the re-render; (3) arrows that did nothing at 1920 px and stuck at 1440 px; (4) the related-book carousel (one primitive in the cart, the library and the book page); (5) an ownership filter that could never match; (6) totals counting owned and unsold lines; (7) a demoted title showing "Buy $0.00"; (8) one stray id emptying the whole view; (9) badge ≠ list; (10) "Added" reverting after four seconds; (11) Buy opening two checkouts, a provider error unhandled. All 26 buyable books were driven add → no second add → remove → re-add → refresh in the browser.
- **Logo:** the real logo in the header, footer, `Organization.logo`, `twitter:site`, favicon, Apple icon (derivatives only; the source is never written).
- **Social links:** X `@ValicePress`, Instagram, Facebook, TikTok, from one file, in the footer, the phone drawer (48 px targets), the founder card, About, `sameAs`.
- **Mobile fixes:** the popup freeze (above); the header that overflowed every route by up to 93 px; console errors from prefetched sign-in links; the newsletter popup never opens on the bonus pages, waits until nobody is typing, no autofocus on touch; and what the phone found in Phase 14 — a book's buy button 1,070 px down the screen, drawer focus, the assistant covering the words being read, 44 px admin targets, whole covers on `/about`, round arrows on author cards, a Look Inside row that says it scrolls, an author's name above the fold, equal button widths.

## 10. Production operations — what was done to the live system, in order

Everything here was authorised in the release brief; nothing outside it was touched (no Cloudflare, Vercel, Clerk, Lemon Squeezy, KDP or Amazon setting was changed, and no order, entitlement, analytics row or contact was written). Times are 2026-10-09; the Founder's clock is UTC+3.

| # | Operation | UTC (+03:00) | Result |
|---|---|---|---|
| 1 | **World Games master PDF → Cloudflare R2** | 09:20–09:22 (12:20) | `books/the-great-book-of-world-games/master/v1/master.pdf` in `bookstore-masters-dev` (the production masters bucket) replaced: **182 → 258 pages**, 16,954,602 → **17,232,569 B** |
| 2 | **Production catalogue → Neon `neondb`** | 09:24–09:25 (12:24) | 33 → **37 books** (36 published + *Ridge Runner* as a draft), formats 69 → 78; post-load diff against the catalogue file: **0 differences** |
| 3 | **Migration `0013_long_slayback`** | right after the load | `contacts` and `popup_impressions` created — they had never existed on production |
| 4 | **PR #68** opened from `980574a`; CI and the Vercel preview | 10:18 → 10:21 (13:18) | CI (lint · typecheck · test · build) **pass, 1 m 56 s**; preview `dpl_BegDAtsAo5AfLXx8qGGub9fdZ49X` READY |
| 5 | **Merge into `main`** | **10:26:00 (13:26)** | merge commit `7140f31` |
| 6 | **Production deployment** | 10:26:05 → **10:27:26 (13:27)** | `dpl_EHTSByx5p1uVYRpzYnNwixrQQjSN` READY, aliased to `valicepress.com` |
| 7 | **Live verification** | 10:28 → ~11:50 (13:28 → 14:50) | §11 |

The order matters and was kept: the PDF went up **before** the catalogue (or buyers would be sent the 182-page revision under a 258-page description), and the catalogue went in **before** the deploy (the static pages read the database at build time). The previous code (`d3a7ca9`) served the new catalogue for the hour between the load and the deploy; its key pages answered 200 when checked, and the World Games page already read "258 pages".

### 10.1 The catalogue and the migration

- **Before** (read-only): 33 books (all published), 69 formats, 10 authors, 7 categories, 3 orders, 3 entitlements, 710 analytics events; `contacts` and `popup_impressions` **missing** — migration `0013` had never been applied to production although `0000`–`0012` all were. Diff against `valice-catalog.mjs`: 4 books to insert (*Weather Permitting*, *The Long Way Back*, *All the Quiet Places*, *Ridge Runner* as a draft), 1 author (Quinn Gallagher), 23 books updated (mostly a `published_at` that was null, plus World Games' subtitle, description, 258 pages, ASINs and ISBNs, and *The Sweetest Season*'s description and hardcover); **0 status changes, 0 price changes, 0 provider-id changes, 0 master-key changes**; 0 rows in the database that the catalogue does not contain.
- **Load**: `load-catalog.mjs --env scripts/tmp/.env.production --commit --i-know-this-is-production` → *"loaded 37 books into neondb; published 36; deliverable here 26; cleared to sell 26; BUYABLE 26; formats linking to Amazon 55 (all ASIN-verified)"*.
- **After**: diff 0 · books 37 · formats 78 · book_categories 55 · book_authors 45 · authors 11 · categories 7 · **orders 3 / entitlements 3 / analytics events 710 — unchanged**. Re-read after the deploy: still `neondb`, World Games `published`, 258 pages, key `…/master/v1/master.pdf`; `contacts` 0 rows (the e-mail tab starts empty — importing your contact list is yours).
- **Migration**: applied with `scripts/db/apply-migration.mjs` (12 statements, 0 skipped; `contacts` 19 columns, `popup_impressions` 9, read back from `information_schema`). Purely additive: 2 enums, 2 tables, 2 foreign keys, 6 indexes. (`drizzle-kit migrate` is not used for this: it exits 0 having applied nothing here. CI's own migrate step is inert here: the repository has no Actions secrets (`gh secret list` is empty), so on a push to `main` it only warns and exits 0.)
- The release adds **no schema change** relative to `main` and reads **no new runtime environment variable** (the two names the branch adds — `RUN_DB_TESTS`, `VALICE_SEPHIC_ROOT` — are read by tests and a script only).

### 10.2 The World Games master (and the delivery path)

| | As found | Now |
|---|---|---|
| Object | `books/the-great-book-of-world-games/master/v1/master.pdf` | the same key (so no catalogue row, no signed URL and no entitlement had to change) |
| Size | 16,954,602 B · modified 2026-09-19 · **182 pages** ("fifty-six games … thirty-nine cultures") | **17,232,569 B · 258 pages** ("sixty-three games … forty-two cultures"; 5,000 years) |
| ETag (md5) | `6f2481619fb827b0f9f3d748bc2d31e2` | `1e1d055a84f449f3d2941ee8630deb83` |
| sha256 | `c888a23593dd0cabad97da863a2d53406407afa0abcea8382ee685623585f4eb` | **`eec8715ba85b9c9a1e4aab8b2d6d504fa751803012d46614b0c0a3b239dca7a0`** |

- The file was checked before it went up (not encrypted or repaired; all 258 pages extract and render), uploaded with `upload-masters.mjs` (a dry run first: *"overwrites 16.17 MB"*; then *"PUT … 16.43 MB"*), **read back from R2 and compared byte for byte** with the local copy (`cmp` identical, same sha256, 258 pages), and re-listed after the deploy (size, ETag and the preserved copy unchanged).
- **Delivery path**: the watermark worker reads `books.master_file_key` from the masters bucket, stamps each order's copy with `pdf-lib` and writes it to the private artifacts bucket (no CDN in front of the masters). I ran the real `stampPdfWithWatermark` offline on the R2 object: **258 pages, "Licensed to … · Order … · Valice Press"**. Existing entitlements keep the copy they were already stamped with (the idempotency short-circuit), so no past buyer's file changed. What this does *not* prove is a paid order end to end (§12.5).

### 10.3 Cache

No invalidation was needed, and that was *checked*, not assumed. Cloudflare serves HTML dynamically and revalidates `/images/*` against the origin; after the deploy every file the release added (203) or replaced in place (14: two author photos, two covers, two thumbnails and eight preview pages — the places a stale copy would hide) was fetched from the live site and compared by sha256 with the repository: **all identical**; the 11 deleted hero files answer 404. The image optimizer's output for the six replaced covers, thumbnails and author photos (eight sizes) was compared by pixel difference with the old and the new source: **all derived from the new**. (The `/images/*` lifetime is now `max-age=86400, stale-while-revalidate=604800`: a replaced picture shows within a day, by design.)

### 10.4 Backups and rollback

**Backups, all preserved** (outside the repository, on this machine — copy them somewhere durable): `~/Downloads/valice-release-artifacts-2026-10-09/`
- `new-258pp-edition/` — the file that went up, with `SHA256SUMS`;
- `previous-r2-master-v1-182pp/master-v1-as-found-2026-10-09.pdf` — the object as found (sha256 above), with `SHA256SUMS`; and **inside R2**: `books/the-great-book-of-world-games/master/superseded/20260919-182pp-master.pdf` (a server-side copy, same size and ETag);
- `production-db-before-catalogue-load/` — JSON dumps of the six catalogue tables (categories 7 · authors 10 · books 33 · book_formats 69 · book_categories 51 · book_authors 41 rows) taken at 09:24:35 UTC, a `MANIFEST.txt` with a sha256 per table. No order, user, contact or payment data was dumped or touched.

**Rollback, in the order you would reach for it** (none was needed):
1. **The site**: promote the previous deployment `dpl_HKyjr5gdrd78ZoLgVMW1MFjrmR4X` (Vercel → Deployments → Instant Rollback; no rebuild). The catalogue in the database does not have to change: that code served it for an hour before the merge. (After an Instant Rollback Vercel pauses automatic promotion of new deployments until one is promoted again.)
2. **The PDF**: copy `…/master/superseded/20260919-182pp-master.pdf` over `…/master/v1/master.pdf` (R2 server-side copy) or upload the local backup. Revert the catalogue's World Games text with it, or buyers see "258 pages" over a 182-page file. Orders stamped from the 258-page master in the meantime keep their copy.
3. **The catalogue**: upsert the rows of the JSON dumps (they carry every column); there is no restore script: the load deleted nothing, so the dumps are only needed to put changed text back.
4. **The migration**: only after the code is rolled back (the e-mail tab and the popup use the tables): `DROP TABLE popup_impressions; DROP TABLE contacts; DROP TYPE popup_outcome; DROP TYPE marketing_consent;`.

## 11. Tests and verification

### 11.1 The gates, on the tip that was merged (`980574a`)

| | Result |
|---|---|
| `tsc` · `eslint` · `next build` | 0 · 0 · ok (Next 16.2.6) |
| Vitest, CI shape (`VALICE_BOOKS_ROOT=/nonexistent`) | 80 files · **1,417 passed** · 194 skipped (opt-in sandbox-database suites) · 0 failed |
| Playwright — desktop Chromium, Pixel 5, desktop Firefox, against a fresh production build | **738 tests · 549 passed · 189 skipped (project-specific) · 0 failed · 0 flaky** (6.0 min); includes the 78 signed-out admin-security tests |
| Admin, signed in (`test:e2e:admin`, a throw-away stub-auth copy of the final tree) | **55 passed · 2 skipped by design · 0 failed** (3.6 min) |
| Crawl (`seo:audit`, local build) | sitemap 125 URLs · 132 pages · **0 errors · 10 warnings** (12 before: the two "indexable but not in the sitemap" are gone) |
| Phone checklist (`mobile:final`, final local build) | **89 / 89** |
| CI on PR #68 (lint · typecheck · test · build) | pass, 1 m 56 s · Vercel build of the branch: READY |
| Secrets scan of every line the branch adds | no key pattern; the one `postgres://` hit is a 1-character user / 1-character password test fixture; no sensitive file name; no file over 5 MB |

### 11.2 The live site, after the deploy — every instrument was run against https://valicepress.com

| Instrument | Result |
|---|---|
| **Post-deploy checks** (read-only, 49) — 16 pages (200, a title, the production canonical), sitemap, the draft, the World Games and Bestiarium pages, the admin area, robots, headers, the public files | **49 / 49** |
| — the sitemap | 125 URLs, all on `https://valicepress.com`; lists the three bonus-scene pages; lists **exactly the 36 published books**; *Ridge Runner* absent and `/books/ridge-runner` → 404; every `lastmod` a real past date |
| — the editions | World Games page: "258 pages" ×6, "182 pages" ×0; Codex Bestiarium page: "112" ×6, "120 … Creatures" ×0 |
| — admin, as a stranger | 7 addresses → 307 to the hosted sign-in, 3 legacy addresses → 307 to their new homes, **5 admin APIs → 401**, not in the sitemap, `Disallow: /admin` in robots; no admin content in any body |
| — the files | all **203 added**, **14 replaced in place** (the stale-copy risk) and 11 deleted public files: live bytes equal the repository's (sha256) / 404 |
| Crawl (`seo:audit`) | 125 URLs · 132 pages · 248 internal link targets · **0 errors · 10 warnings** (3 sign-in redirects by design, 7 long editorial titles) |
| Catalogue validator (`validate-catalog.mjs --origin https://valicepress.com`) | 119 pass · 0 warn · 0 error · 2 skipped; with the R2 keys: **142 pass · 3 warn · 0 error** — the 26 direct masters all exist in R2 (World Games 16.43 MB); the 3 warnings are digital masters over 20 MB (Bestiarium 103.9, Enigmatica 67.1, *Words from the Gods* 62.6 MB), unchanged by this release |
| Amazon links as the visitor is given them | 36 book pages · **55 `/dp/<ASIN>` links, each page's set equal to the catalogue's for that book**, no ASIN shown on two books, no tracking tags — 0 problems |
| Cart, three brand-new browsers | **6 / 6** — A adds *Meditations*; B (another browser) has an **empty** cart and can add the same book; C is still empty |
| Bonus pages | `/bonus`, `/weather-permitting-bonus`, `/long-way-back-bonus`: 200, canonical, listed, accessible; on the phone no overflow and a finger-sized email field on both forms (the two extra checks of the live run) |
| axe-core, WCAG 2.2 AA + best practice | 21 pages × desktop and phone = 42 loads · **0 violations** |
| Desktop sweep, Chromium + Firefox | 25 pages × 1440 px = 50 loads, all 200 · **0 page problems** · CLS ≤ 0.009 · the only message on any page is the Cloudflare beacon blocked by the CSP (§12.3) |
| Page weight (`page-weight.mjs`, 6 pages × a phone and a desktop profile) | 1.1–2.0 MB on the wire per page; on the phone profile 1.5–1.9 MB with 632–753 kB of JavaScript (27–34 files), 34 kB of CSS, 89–140 kB of fonts; the home page loads 18 of its 87 images at first |
| **Physical phone** (Redmi Note 8 (2021)), `mobile:final` | **91 / 91** (the local build gave 89; the two extra are the bonus forms' email fields, which exist only in production) |
| **Physical phone**, `mobile:books` (all 36 books) | pages **36 / 36**; popups **33 / 36** on the first pass, **36 / 36** after the three misses were re-run (below) |
| Image deferral, observed live | 0 shelf covers and 0 poster requests while the first screen loads; 4 requested as the shelf is reached; the markup carries 72 deferred images; with JavaScript off the real covers are present — 7 / 7 |
| R2 and the database, read back | the master: 17,232,569 B, ETag `1e1d055a…`, the preserved copy beside it; the DB: `neondb`, World Games 258 pages and its master key, 36 published + 1 draft, `contacts` and `popup_impressions` present, orders 3 / entitlements 3 / analytics 710 |
| Redirects and 404s | `http` → `https` 308; `www` → apex 308; the draft and a made-up address → 404 |

**The three popups.** On the first live pass *The Trickster's Table*, *Codex Mythologica: The Puzzle Book* and *The Myth Hunter's Field Book* reported "main panel did not decode". The check reads the popup's picture 500 ms after it opens; on a first visit the image optimizer has to *make* that size (measured: about 1.0–1.4 s cold, 0.4–0.6 s warm). Re-run once the sizes existed, all three passed (3 / 3), and all 36 book pages (cover decoded, buy button on the first screen, own Amazon links, own Look Inside tiles, no console error) passed first time. I read it as the check's window against a cold CDN, not a defect — and I am saying so, because it was a failure in the output.

**The rate limiter.** Production rate-limits per IP (Upstash, 100 requests / 10 s). A crawl, a sweep and an axe run launched together were answered "Too many requests", and the first live axe pass reported five violations on ten pages that were all that sentence. Re-run one tool at a time, every number above is clean. A single reader scrolling the heaviest pages (96–175 requests in 6–8 s) is not limited. That closes an open item from the admin report: **the limiter is live in production**, not failing open. The verification scripts now take `--pause` / `MOBILE_PACE_MS` and mark themselves as internal traffic; `analytics_events` stayed at 710.

### 11.3 Core Web Vitals on the physical phone — production

Redmi Note 8 (2021), Chrome 154, cache off, median of 3 (lab measurements on one phone — not field data, not a 75th percentile). `docs/execution/mobile/release-2026-10-09/cwv-production-*.json`.

| Page | **LCP, real network** | CLS | INP (lab proxy) | Wire | LCP element |
|---|---|---|---|---|---|
| `/` | **1,724 ms — good** (1,260 · 1,724 · 1,976) | 0 | 88 ms | 1,453 kB (JS 585 · images 675 · fonts 88) | the hero photograph |
| `/books` | 3,212 ms — needs work | 0.003 | 208 ms | 1,941 kB | a card cover |
| `/books/weather-permitting` | 1,520 ms — good | 0 | 272 ms | 1,356 kB | the first paragraph |
| `/about` | 1,804 ms — good | 0 | 184 ms | 1,708 kB | the first paragraph |
| `/authors` | 2,464 ms — good | **0.497 (see below)** | 232 ms | 1,521 kB | the hero atmosphere |
| `/` on the **slow-link emulation** (1.6 Mbps · 70 ms, stacked on the live network) | **3,848 ms — needs work** (2,416 – 4,804, 5 runs) | 0 | 88 ms | same | the hero photograph |

**The home page, answered.** The brief's "1.9 → 4.9 s" compares two different things: 1.88 s was the earlier program's *slow-link lab* run, when the largest paint was a paragraph; 4.95 s is the same lab and phone after the new hero made the largest paint a photograph. On the **real network the live home page paints its largest element at 1.7 s**. On the slow-link emulation the live site gives **3.85 s** — better than the 4.95 s the branch measured before the fix and in line with the 4.16 s the lab measured after it, and still not good. Where the time goes there: the hero photograph (130 kB) shares a 1.6 Mbps link with about 600 kB of JavaScript and, until this release, 550 kB of shelf covers fetched 1.7 s in; those covers now wait until they are about to be seen (§12.2). What remains is the JavaScript. Clerk's two bundles are 83 kB and 46 kB on the wire (brotli) behind a redirect on `clerk.valicepress.com`; the rest is the app and Sentry. **I did not touch Clerk, Sentry or the auth flow**: `prefetchUI={false}` would stop the early download of Clerk's UI bundle, but the signed-in `UserButton` needs that bundle and a signed-in session cannot be exercised from here — so it is a follow-up for a session that can sign in, not a guess shipped on a live site. INP proxies are unchanged from the local lab (88 / 208 / 272 / 184 / 232 ms against 80 / 216 / 288 / 200 / 272).

**`/authors` has a layout shift on the real phone that the local lab could not see.** The phone's own CWV script measured 0.497 once, then 0.066 and 0 on two repeats. Traced load by load (13 loads, with every shifted node and rectangle recorded) it is always the same single event, ≈ 0.033, in 7 of the 13 and nothing in the other 6: when the page's web fonts arrive, 1.5–3.2 s in, the hero grows 10 px and everything under it moves 26 px (`font-display: swap`, over a fallback whose line breaks differ; the headline is set in Fraunces). With the slow-link emulation it happened in 3 of 3. On `localhost` the fonts are there before the first paint, so the local lab showed 0. The typical value is "good" (< 0.1); the 0.497 outlier I could not reproduce in 21 further loads and I do not know its cause beyond a stronger version of the same swap. Not changed — `font-display: optional` would trade the brand's typeface for stability, which is the Founder's call (§12.3).

### 11.4 The checks can fail

The new browser specs were run against a build of the code from before the fix and failed there; the cart tests fail on the original `cart.ts`; the focus-indicator, image-size and axe tests were each broken on purpose and caught; the admin gate's branches were mutation-tested; the new sitemap test catches three deliberate breakages (the entries removed, a `lastmod` older than the page, a path under a `robots.txt`-disallowed prefix). **The newsletter route test that failed once on 2026-10-08 is no longer "reported, not diagnosed":** it was reproduced (3 of 5 full-suite runs under load failed, two failures each), the cause found — the first test paid for the dynamic import of the route, which can exceed Vitest's 5 s default, and its stalled request later wrote into the next test's shared state — and fixed **in the test only** (import once in `beforeAll` with its own 60 s budget, an epoch guard, a 30 s ceiling); 6 of 6 full-suite runs under the same load pass. The route itself was never wrong.

## 12. Findings — separated

### 12.1 Blockers

**None.** Nothing found before, during or after the release stops the site from doing what it says, and nothing was rolled back.

### 12.2 Fixed during the release

| | Finding | What was done |
|---|---|---|
| A | **The newsletter route test failed intermittently** (once on 2026-10-08, "reported, not diagnosed") | Reproduced (3 of 5 loaded full-suite runs failed), diagnosed (a cold import over Vitest's 5 s default, then a stalled request writing into the next test's state), fixed **in the test only**; 6 of 6 loaded runs pass. The route is untouched. |
| C | **The bonus-scene pages were indexable but missing from the sitemap** (two flagged; `/bonus` not even audited) | All three listed, each `lastmod` taken from the last commit that touched its route (not borrowed from the static revision, which predates them); `sitemap.test.ts`, 6 tests, 3 mutations caught; the crawl's "unlisted" list shrank. Live: listed, 200, canonical. |
| — | **Home-page LCP** | Below-the-fold pictures (the 12 shelf covers, the brand-film poster) are now requested only when they are about to be seen (`ImageDeferrer`, one `IntersectionObserver`, `<noscript>` fallbacks; 13 unit and 3 browser tests). Lab on the phone at 1.6 Mbps: **4.95 → 4.16 s**, 762 kB less at load; **live: 1.72 s on the real network, 3.85 s on the emulated slow link** (§11.3). Observed working on the live site. |
| — | **Production was missing migration `0013`** (`contacts`, `popup_impressions`) and was behind the catalogue | Applied and loaded (§10). The Email tab and the newsletter popup would otherwise have failed on the first request. |
| — | The crawl reported a "broken link" on the live site (`/cdn-cgi/l/email-protection`) | Cloudflare's own rewriting of `mailto:` links, restored by a script in a real browser; the audit now skips Cloudflare's `/cdn-cgi/` namespace. |
| — | Verification tools were not safe to point at a live site | They now pace themselves (`--pause`, `MOBILE_PACE_MS`) and mark their traffic as internal (`mark-internal.mjs` for the phone); the verification itself is kept as `scripts/release/` (README inside) and `scripts/mobile/shifts.mjs`. On the docs branch with this report. |

### 12.3 Non-blocking

- **B — SEO warnings, kept (10):** three `/account/*` links in the header that lead a signed-out visitor to the hosted sign-in (by design; the links no longer prefetch); seven titles of 72–95 characters (six blog posts and the *Chess and Playing Cards* companion; editorial titles the search results will shorten).
- **D — Cloudflare Web Analytics beacon: one console error per page, nothing collected.** Cloudflare's "automatic setup" injects `static.cloudflareinsights.com/beacon.min.js` into every HTML response; the site's CSP (`script-src` without that host) blocks it. **I did not widen the CSP:** it would start third-party collection that the site's consent and internal-traffic model does not govern, and the privacy page does not name it. The fix is one switch on the Cloudflare side (§12.5).
- **Cloudflare Email Address Obfuscation is on.** Every `mailto:` is rewritten to `/cdn-cgi/l/email-protection#…` and restored by a same-origin script (the CSP allows it): in a real browser all addresses work (checked on `/`, `/about`, `/terms`); a client without JavaScript sees "[email protected]". It includes the legal pages' contact address.
- **`/authors` hero: a layout shift of ≈ 0.033 when the web fonts arrive** (one outlier of 0.497, not reproduced) — §11.3.
- **First visit to a book's popup waits ~1 s** for the image optimizer to make a size nobody has asked for yet (§11.2).
- **Three digital masters over 20 MB** (Bestiarium 103.9, Enigmatica 67.1, *Words from the Gods* 62.6 MB) — a validator warning older than this release.
- **One Firefox-only message**, once in 50 loads: a Cloudflare cookie (`_cfuvid`) "rejected for invalid domain" on a request to `clerk.valicepress.com`.
- **Home LCP on the emulated slow link is 3.85 s** (needs improvement); the remaining lever is the JavaScript — Clerk and Sentry for visitors who never sign in (§11.3).
- **The per-IP limiter counts every non-static request**; a visitor behind a shared address scrolling long pages is not limited at today's traffic (probed), but a crawler is, and a larger crowd behind one address could be. Worth raising or excluding prefetches if traffic grows; not changed.

### 12.4 External — KDP and Amazon (this site cannot change these)

1. **Codex Bestiarium — two live titles say "120 Legendary Creatures"; the book has 112.** Paperback `B0HDLQHQ7H` and hardcover `B0HDLLPG5M` (the large print `B0HDLT1V3P` already says 112). **F — the site is right:** the catalogue, the book page, every description and the JSON-LD say 112 (the live book page: "112" ×6, "120 … Creatures" ×0). The correction is a KDP metadata edit.
2. **World Games** — the large-print listing `B0HHNCVQVX` still carries the previous revision's title and subtitle, and the hardcover `B0HLKPSLHH`'s interior still prints the first-printing paperback's ISBN (recorded on 2026-10-07 in the catalogue's `blockers`; not re-verified since — Amazon was unreachable for it today, below). KDP edits.
3. **Ridge Runner** stays a draft on the site until KDP issues live editions (no ASIN is invented; publishing it is a catalogue edit).
4. **Amazon was not re-read on release day.** `verify-amazon-asins.mjs --catalog` was started and Amazon answered its throttling stub on the first two requests; a single plain GET then returned a CAPTCHA page. I stopped and did not try to get round it. The standing evidence is the full read of 2026-10-08 (55 / 55 ok, 0 disagreements, nothing changed since 2026-10-07), plus today's check that the live site links exactly the catalogue's ASINs (55 links, 0 problems). Expect this machine's address to be challenged by Amazon for a while.

### 12.5 Owner-dependent — decisions and actions that are yours — and what could not be verified from here

1. **Cloudflare Web Analytics** (Analytics & Logs → Web Analytics → `valicepress.com`): turn off *Automatic setup* to remove the console error; or, if you want the numbers, allow the host in the CSP **and** name it on the privacy page (a decision about consent, not a tweak). **Email Address Obfuscation** (Scrape Shield): leave it (works with JavaScript) or turn it off so crawlers and no-JavaScript readers see the address.
2. **The controller named in Terms / Privacy / Refund / KVKK, the order-page support card and the order-ready e-mail's fallback** is `emre30283@gmail.com`; About, the footer and every public page use `hello@valicepress.com`, which **receives (forwarded) but cannot send**. I used no value that was not already on the site and did not unify them: a legal document names the controller, and a support thread answered from Gmail would not come from `hello@`. Say which you want everywhere (E).
3. **Direct checkout.** The Lemon Squeezy key available here is a test-mode key (it sees 0 products in store 473583), so whether the live store sells, and whether the 26 variant ids exist in live mode, is not verifiable from here, and a purchase is not mine to make. **Make one small purchase** (or confirm in the dashboard) and check the stamped 258-page PDF arrives — that is the only part of the delivery path I could not walk.
4. **Open `/admin` once.** The gate now needs your primary address to be *verified* in Clerk. If it says "Not authorized", that address is unverified in the Clerk dashboard. The signed-in half could only be tested on a stub-auth copy.
5. **The Redmi Note 11R** was not attached; everything above ran on the Redmi Note 8 (2021). Say whether that counts or plug in a Note 11R and run `mobile:final`, `mobile:books`, `mobile:cwv` (about forty minutes).
6. **The contact book is empty** (`contacts`: 0 rows). Importing your list is yours: the consent policy in the admin refuses to mark anyone mailable without evidence.
7. **Vercel Preview deployments read the production database** — the branch's preview sitemap carried the production catalogue's load timestamps. A preview of any branch can therefore read, and through the newsletter or free-book forms write, real data. Consider a separate Neon branch for the Preview environment.
8. **Copy `~/Downloads/valice-release-artifacts-2026-10-09/` somewhere durable** (§10.4) — the only copies of the previous PDF and the pre-load catalogue are on this machine (the previous PDF is also in R2).
9. **Decisions carried from the program, still open:** `/api/newsletter` has no double opt-in or honeypot; no admin audit log (needs a migration); MailerLite subscribers are not counted in "Mailable"; "Watermarked PDF" was replaced on the homepage and share image by "DRM-free" (true: a visible licence line, no lock) — if the promise is an *unstamped* file the delivery pipeline would have to change; no quantity stepper in the cart, on purpose (one licence per title); 14 cover files are 5:8, not 2:3, and lose 3.2 % of their height on cards; Terms still calls the shop "a first-party online store for digital books".
10. **Left behind on this machine** (outside the repository): `/tmp/valice-admin-e2e` (905 MB, the gate-less stub-auth build — **safe to delete, never to serve beyond 127.0.0.1**; my attempt to remove it was refused by the sandbox and I did not retry), and two Chrome markers on the phone (`vp_internal` cookie, `va-disable` key for `valicepress.com`) that keep the tools out of the analytics. Cleaned up: the derived production environment file `scripts/tmp/.env.production` (deleted), the local test server on port 3210 (stopped), the phone's adb forwards (removed).

## 13. Known limitations

- **Lab, not field.** Every Core Web Vitals figure is a lab measurement on one phone (a Redmi Note 8 (2021)), over the real network or an emulated one — not a field 75th percentile. There is no source for page views in this system either; the dashboard says "unavailable".
- **The home page on the slowest link is 3.85 s** (live, emulated 1.6 Mbps · 70 ms); 1.7 s on the real network. The remaining lever is the JavaScript for visitors who never sign in.
- Prices are those read from Amazon on 2026-10-07/08; Amazon could not be re-read on release day (§12.4). Page counts are the built interiors'.
- **Whether direct checkout is live is not something this environment can say** (§12.5): the Lemon Squeezy key here is test-mode, and the store was in test mode when last checked (2026-09-13). The site's copy says downloads are on sale only if the database says some are.
- No source for Amazon / KDP sales exists in this system; the dashboard says so.
- The shelf, the cards and the covers are real; where a person has no free portrait the page shows an initials mark and says it is not a likeness.
- The catalogue's per-book `blockers` hold 184 operational notes; they are the catalogue's own record.

## 14. Success conditions (the brief's §68)

| Condition | |
|---|---|
| Site builds successfully · production build works | ✔ local build, CI, Vercel build, and the deployment is READY |
| All major public routes work | ✔ live: 132 pages, 0 errors |
| No critical console errors | ✔ none from the site; one per page from Cloudflare's injected beacon, which the CSP blocks (§12.3, §12.5) |
| New books appear · priority books pinned correctly | ✔ live: 36 published books in the sitemap and on their pages; *Ridge Runner* staged, 404 |
| World Games links corrected | ✔ and its **258-page PDF is in R2**, the catalogue says 258, the page says 258 |
| All book cards visually normalised | ✔ 12 widths, both views |
| Book popups work on desktop · on mobile | ✔ live phone: 36 / 36 (three first-view timing misses re-run clean, §11.2) |
| Bonus routes work on mobile · modal scrolling works · body scrolling restores | ✔ live phone 91 / 91 |
| Detail pages use the reference design · Look Inside previews are book-specific · quote visuals use real book text | ✔ |
| No cross-book asset contamination | ✔ tests + matrix 36 / 36 + phone, live: each page links its own ASINs |
| Homepage featured books correct · background improved · logo updated · social links updated everywhere | ✔ |
| Authors page populated with researched real authors · author pages work · About updated | ✔ |
| Cart plus works · **cart minus works** | ✔ plus · **minus does not exist by design** (one licence per title; Remove is the way down) — §12.5.9 |
| Cart carousel arrows work · cart state persists | ✔ and live: three browsers, no cart crosses between them |
| One `/admin` is authoritative · old variants removed or redirected · authorization works · email management works · no fake analytics or sales data | ✔ live: refused to a stranger on every address; signed-in half on the stub copy and the phone |
| SEO validated · accessibility validated | ✔ live crawl 0 errors; axe 0 violations on 42 loads |
| Performance validated | ◐ live LCP good on the real network on 4 of 5 pages (`/books` 3.2 s); home 3.85 s on the emulated slow link (§11.3) |
| Browser QA passed | ✔ Chromium + Firefox, 549 tests, and a live sweep of 50 loads |
| **Redmi Note 11R physical QA passed** | **✘ not as written — Redmi Note 8 (2021)**, local 89 / 89 and live 91 / 91 (§0, §12.5.5) |
| No critical issues remain | ✔ none known; the open items are decisions and other people's dashboards |

## 15. Terminal summary

```
PROJECT:                          Valice Press
SOURCE:                           /home/emre/Downloads/Valice-Press-Site   (work in /home/emre/Downloads/valice-siteupdate)
PUBLIC SITE:                      https://valicepress.com/   RELEASED 2026-10-09 13:26 (+03:00)
                                  merge 7140f31b3b1e8398ab86b006314cf21e98187cec  ·  PR #68
                                  deployment dpl_EHTSByx5p1uVYRpzYnNwixrQQjSN  ·  READY 13:27:26 (+03:00)
ROLLBACK TARGET:                  dpl_HKyjr5gdrd78ZoLgVMW1MFjrmR4X (d3a7ca9) — not needed

R2:                               World Games master replaced: 182 → 258 pages, 17,232,569 B, sha256 eec8715b…a7a0 — verified byte for byte
CATALOGUE:                        production loaded: 37 books (36 published + 1 draft), post-load diff 0; migration 0013 applied
BOOKS ON THE LIVE SITE:           36 of 36 published (+ the draft verified absent)
AMAZON LINKS:                     55 shown on 36 pages = the catalogue's 55; live Amazon re-read not possible today (throttled)
BONUS PAGES / CART:               PASS (listed in the sitemap; three-browser cart isolation 6 / 6)
ADMIN SECURITY:                   PASS (10 addresses and 5 APIs refuse a stranger; signed-in half on the stub copy)
DESKTOP QA:                       PASS (Chromium + Firefox: 549 tests; live sweep 50 loads, 0 page problems)
REDMI QA:                         PASS on the attached Redmi Note 8 (2021) — local 89/89, live 91/91, 36/36 pages — NOT a Note 11R
PLAYWRIGHT:                       PASS (549 passed, 0 failed)     VITEST: PASS (1,417 passed)
TYPECHECK / LINT / BUILD:         PASS / PASS / PASS
ACCESSIBILITY:                    PASS (axe: 42 loads, 0 violations)
SEO:                              PASS (live crawl: 125 URLs, 0 errors, 10 warnings)
PERFORMANCE (live, phone):        home LCP 1.72 s real network · 3.85 s on the 1.6 Mbps emulation (4.95 s before the fix, lab)
CORE WEB VITALS FINDING:          /authors font-swap layout shift ≈ 0.033 (one 0.497 outlier, not reproduced)

RELEASE STATUS:                   SUCCESS — no rollback
FINAL VERDICT:                    PARTIALLY VERIFIED — four things this machine cannot see (§0, §12.5):
  1. the physical QA ran on a Redmi Note 8 (2021), not a Note 11R;
  2. direct checkout and a buyer's download were not exercised through a payment (test-mode key);
  3. sign-in / signed-in /admin on the real Clerk — open /admin once;
  4. the Cloudflare and Vercel dashboards were observed, never changed (Web Analytics beacon, email obfuscation).
```
