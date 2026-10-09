# Final release report — Valice Press site update, 2026-10

Branch `feat/site-update-2026-10` (worktree `/home/emre/Downloads/valice-siteupdate`), **17 commits** on `main` @ `d3a7ca9` — through Phase 14 (`2d43ec9`) **567 files changed, +46,419 −7,389**; Phase 15 adds the reports, two phone scripts, the book matrix and three image-priority hints. The phase-by-phase record, with the evidence for each, is `PHASE-LOG.md`; the detail reports are `VALICE-PRESS-FULL-SITE-AUDIT-2026.md`, `BOOK-CATALOG-AUDIT-2026.md`, `AMAZON-LINK-AUDIT-2026.md`, `ADMIN-CONSOLIDATION-REPORT-2026.md`, `MOBILE-REDMI-NOTE-11R-QA-2026.md` and `FINAL-BOOK-MATRIX.md`. Every number below is from a run in this repository or on the physical phone.

## 0. Status

> ### NOT READY — no code fixes remain; two things are yours
>
> The brief offers two final statuses, "PRODUCTION READY" and "NOT READY — FIXES REMAIN". Neither is accurate, so this is the accurate one. The site as built passes every gate the brief sets that a machine can pass (§17). What stops the word *ready*:
>
> 1. **The physical QA ran on a Redmi Note 8 (2021), not on a Redmi Note 11R.** The brief's success condition says "Redmi Note 11R physical QA passed"; ADB showed one device and it was not that one. Everything passed on the phone that was there. Either confirm that it counts, or plug in a Note 11R and run the three scripts named in `MOBILE-REDMI-NOTE-11R-QA-2026.md` (about forty minutes).
> 2. **Nothing has been merged, deployed, uploaded or loaded into production.** Four steps need your explicit go-ahead (§10) — and one of them, the World Games PDF, must happen *before* the catalogue is loaded, or buyers would be sent the earlier 182-page revision under the new 258-page description.

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
| **QA** | 37 unit-test files, no browser tests, a phone harness run by hand | 74 unit files, **729 browser tests in three browsers**, a signed-in admin harness, a crawl, a sweep, a book matrix, a phone harness of five scripts |

## 2. Routes

**Added:** `/admin/books`, `/admin/data`, `/admin/email`, `/admin/email/[id]`, `/admin/email/export`, the admin layout; `/icon.png`, `/apple-icon.png`. **Content rebuilt:** `/`, `/about`, `/authors` (+ 31 pages), `/books`, `/ebooks`, `/books/[slug]`, `/cart`. **Removed:** `/admin/books/[slug]/edit`, `/admin/contacts`, `/admin/contacts/export` — each redirects (`next.config.ts`) to its new home, which is behind the same gate. 66 routes in the build (22 static, 7 generated from data, 37 on demand; 19 of them API handlers); sitemap 122 URLs (98 before).

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

## 10. What needs your go-ahead — none of it has been done

| # | Step | Why it is yours | What to know |
|---|---|---|---|
| 1 | **Upload the rebuilt World Games PDF to R2** (`node scripts/catalog/upload-masters.mjs --env <env> --commit`, after a dry run) | writes to storage buyers are served from | **Do this first.** The master in R2 is the earlier 182-page revision; the catalogue describes the 258-page edition. The rebuilt file is `scripts/tmp/digital-editions/the-great-book-of-world-games.pdf` in this worktree (**258 pages, 17.2 MB, sha256 `eec8715ba85b9c9a1e4aab8b2d6d504fa751803012d46614b0c0a3b239dca7a0`**, title page "63 Games from 5,000 Years … 42 Cultures" — it sits in a git-ignored scratch folder, so copy it somewhere safe before the worktree is cleaned; rebuild: `node scripts/catalog/build-digital-editions.mjs the-great-book-of-world-games`). The uploader never overwrites an object of the same size |
| 2 | **Load the catalogue into production** — `node scripts/catalog/load-catalog.mjs --env scripts/tmp/.env.production` is the dry run; the write adds `--commit --i-know-this-is-production` | writes to the production database (`neondb`; `.env.local` is the `bookstore` sandbox) | The loader demotes as well as promotes (a `draft` is taken off sale) and rejects a `providerPriceId` that is not a real Lemon Squeezy variant id |
| 3 | **Merge `feat/site-update-2026-10` and deploy** | publishes to valicepress.com | Merge and deploy through your usual pipeline |
| 4 | **After deploy** I can run the same instruments read-only against `https://valicepress.com` | — | `npm run seo:audit -- --base https://valicepress.com`, `npm run qa:desktop -- --base https://valicepress.com --strict`, `npm run mobile:cwv -- --url https://valicepress.com --no-throttle`, `mobile:books -- --url https://valicepress.com` |

**Check after deploy:** you can still sign in to `/admin` (your address must be *verified* in Clerk); `/cart` in two private windows (press "Add digital edition" in one — the other must be empty); one canonical URL says `valicepress.com`; migration `0013_long_slayback` exists on production; the console on production (the Cloudflare beacon, below).

## 11. Tests

| | Baseline (`d3a7ca9`) | Final |
|---|---|---|
| `tsc` / `eslint` / `next build` | 0 / 0 / ok | 0 / 0 / ok |
| Vitest, CI shape | 37 files · 464 passed | **74 files · 1,398 passed** · 194 skipped (opt-in sandbox-database suites) · 0 failed |
| Playwright (desktop Chromium, Pixel 5, desktop Firefox) | none | **729 tests · 541 passed · 188 skipped (project-specific) · 0 failed** (5.8 min) — 13 spec files |
| Admin, signed in (stub-auth copy) | none | **55 passed · 2 skipped by design · 0 failed** |
| Crawl (`seo:audit`) | 5 errors · 95 warnings | **131 pages · 0 errors · 12 warnings** |
| Desktop sweep, Chromium + Firefox | — | **344 loads · 0 page problems · CLS 0** |
| axe-core | 2 rules / 12 hits | **0 violations** (28 pages × 2 sizes) |
| Physical phone | 9 / 18 on the popup lock | popup lock **18 / 18** · checklist **89 / 89** · every book: popups **36 / 36**, pages **36 / 36** · journeys **44 / 44** · contract grid **206 / 206** · admin **19 / 19** |
| Book matrix | — | **36 / 36** published books pass every column |

**The checks can fail.** The new browser specs were run against a build of the code from before the fix and failed there; the cart tests fail on the original `cart.ts`; the focus-indicator, image-size and axe tests were each broken on purpose and caught; the admin gate's branches were mutation-tested. One unit-test file (`api/newsletter/route.test.ts`, two cases) failed in one full run on 2026-10-08 while a production build was compiling beside it, and passed in all thirteen further runs (six of that file alone, seven of the whole suite); its code is untouched by this program, and I do not have that run's trace, so it is reported, not diagnosed (`PHASE-LOG.md`, Phase 14).

**Which build each run saw:** the last source change (three `fetchpriority="low"` hints on below-the-fold images, Phase 15) was followed by `next build`, the full Playwright suite, Vitest, `tsc`, `eslint`, the 89-check phone checklist, the Core Web Vitals runs and the every-book phone sweep. The admin e2e, the crawl, the desktop sweeps and the book matrix ran on the build before it; none of them touches an `<img>`'s priority, and the hints change no markup a test reads.

## 12. Known limitations

- **Home-page speed on the slowest link.** Largest paint on the phone at 1.6 Mbps in the lab: **4.9 s** — the hero photograph shares the link with ~580 kB of scripts. Production's HTTP/2 should do better; that is unmeasured until deploy. The lever is Clerk and Sentry for visitors who never sign in (`VALICE-PRESS-FULL-SITE-AUDIT-2026.md` §6). Every other page measured is 2.0–3.2 s, CLS 0.
- Prices are those read from Amazon on 2026-10-07/08. Page counts are the built interiors'.
- **Whether direct checkout is live is not something this environment can say.** Lemon Squeezy is not keyed here (the journeys stop before payment on purpose), and the store was in test mode when last checked (2026-09-13). The site's copy says downloads are on sale only if the database says some are.
- No source for page views or Amazon / KDP sales exists in this system; the dashboard says so.
- The shelf, the cards and the covers are real; where a person has no free portrait the page shows an initials mark and says it is not a likeness.
- The catalogue's per-book `blockers` hold 184 operational notes; they are the catalogue's own record.

## 13. Unresolved — decisions and non-code items

1. **Cloudflare Web Analytics** — turn off automatic setup (or allow it in the CSP and name it on the privacy page). One console error per page on production today.
2. **The bonus pages' index status** — add `/weather-permitting-bonus` and `/long-way-back-bonus` to the sitemap, or `noindex` them.
3. **Clerk + Sentry JavaScript** for anonymous visitors (above).
4. **The controller named in Terms / Privacy / Refund / KVKK** is `emre30283@gmail.com`; About and the footer use `hello@valicepress.com` (which receives mail but cannot send). Which one is yours. Terms still calls the shop "a first-party online store for digital books".
5. **`/api/newsletter`** has no double opt-in or honeypot; the limiter fails open without Upstash. **No admin audit log** (needs a production migration). MailerLite subscribers are not in "Mailable".
6. **"Watermarked PDF"** was removed from the homepage and the share image and replaced with "DRM-free" (true: the file carries a visible licence line and no lock). If the promise is meant to be an *unstamped* file, the delivery pipeline would have to change.
7. **No quantity stepper in the cart, on purpose** (one licence per title). If you want gift copies or seats, that is a new product.
8. **The Redmi Note 8 (2021) vs the Note 11R** (§0).
9. **Amazon-side:** two Codex Bestiarium titles say 120; the World Games large-print listing and hardcover interior carry the previous revision's details.
10. **Ridge Runner** stays a draft until KDP issues live editions.
11. **The 14 cover files that are 5:8, not 2:3**, lose 3.2 % of their height on the cards (unchanged rule; say if you would rather see them whole on a matte).

## 14. Success conditions (the brief's §68)

| Condition | |
|---|---|
| Site builds successfully · production build works | ✔ |
| All major public routes work | ✔ 131 pages, 0 errors |
| No critical console errors | ✔ on the build; the live site's Cloudflare beacon line is a Cloudflare setting (§13.1) |
| New books appear · priority books pinned correctly | ✔ (Ridge Runner staged, §3) |
| World Games links corrected | ✔ (its PDF is **not yet uploaded**, §10) |
| All book cards visually normalised | ✔ 12 widths, both views |
| Book popups work on desktop · on mobile | ✔ 36 / 36 on the phone |
| Bonus routes work on mobile · modal scrolling works · body scrolling restores | ✔ |
| Detail pages use the reference design · Look Inside previews are book-specific · quote visuals use real book text | ✔ |
| No cross-book asset contamination | ✔ tests + matrix 36 / 36 + phone |
| Homepage featured books correct · background improved · logo updated · social links updated everywhere | ✔ |
| Authors page populated with researched real authors · author pages work · About updated | ✔ |
| Cart plus works · **cart minus works** | ✔ plus · **minus does not exist by design** (one licence per title; Remove is the way down) — §13.7 |
| Cart carousel arrows work · cart state persists | ✔ |
| One `/admin` is authoritative · old variants removed or redirected · authorization works · email management works · no fake analytics or sales data | ✔ |
| SEO validated · accessibility validated | ✔ |
| Performance validated | ◐ measured and improved everywhere except the home page on the slowest link (§12) |
| Browser QA passed | ✔ Chromium + Firefox, 344 sweep loads, 541 tests |
| **Redmi Note 11R physical QA passed** | **✘ not as written — Redmi Note 8 (2021)** (§0) |
| No critical issues remain | ✔ none known in the code; the open items are decisions |

## 15. Terminal summary

```
PROJECT:                          Valice Press
SOURCE:                           /home/emre/Downloads/Valice-Press-Site   (work in /home/emre/Downloads/valice-siteupdate, branch feat/site-update-2026-10)
PUBLIC SITE:                      https://valicepress.com/   (nothing deployed yet)

BOOKS ADDED:                      4  (3 published, 1 staged draft)
BOOKS VERIFIED:                   36 of 36 published (+ the draft verified absent)
BOOKS WITH BOOK-SPECIFIC PREVIEWS: 36 of 36 published (37 with the staged draft) — 144 panels; 74 verified passages across 37 books
BOOK DETAIL PAGES VERIFIED:       36
AUTHORS ADDED:                    28 researched, each with sources (31 people now listed, with the 3 living authors)
ADMIN SYSTEMS BEFORE:             1 gated area of 5 unrelated pages, 5 hand-rolled gates
ADMIN SYSTEMS AFTER:              1
BONUS MOBILE ISSUES FIXED:        3  (the newsletter popup no longer opens over the three bonus routes; it waits until no overlay is open and nobody is typing; it no longer autofocuses a field on touch)
CART ISSUES FIXED:                11
AMAZON LINK ISSUES FIXED:         3 retired ASINs + the quick view's edition link  (55 ASINs verified, 0 mismatches)
SOCIAL LINKS UPDATED:             YES
LOGO UPDATED:                     YES
HOMEPAGE FEATURED BOOKS:          PASS
BOOK CARD EQUALITY:               PASS
DESKTOP QA:                       PASS   (Chromium + Firefox, 344 loads, 0 page problems)
REDMI NOTE 11R QA:                PASS on the attached Redmi Note 8 (2021) — NOT a Note 11R
PLAYWRIGHT:                       PASS   (541 passed, 0 failed)
TYPECHECK:                        PASS
LINT:                             PASS
BUILD:                            PASS
ACCESSIBILITY:                    PASS
SEO:                              PASS
PERFORMANCE:                      PASS with one finding (home page LCP 4.9 s on the slowest link, lab)
CROSS-BOOK CONTAMINATION:         PASS
ADMIN SECURITY:                   PASS

FINAL STATUS:                     NOT READY — NO CODE FIXES REMAIN; TWO DECISIONS ARE YOURS
  1. The brief's Redmi Note 11R QA ran on a Redmi Note 8 (2021). Confirm it counts, or run the scripts on a Note 11R.
  2. Production steps need your go-ahead (§10): upload the rebuilt World Games PDF to R2 FIRST, then load the
     catalogue, then merge and deploy.
```
