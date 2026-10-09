# Valice Press — full site audit (final) — 2026-10

The closing audit of the site-update program. It audits **the final production build** (`next build`, served by `next start` on the sandbox database, `http://localhost:3210`), the **physical phone**, and — read-only — the live site as the "before". Every number below comes from a run in this repository or on the phone; the run that produced it is named. The "before" is `VALICE-PRESS-SITE-ARCHITECTURE-AUDIT.md` (Phase 0, `main` @ `d3a7ca9`); the story phase by phase is `PHASE-LOG.md`.

> **Not audited, because it has not happened:** the production deployment. Nothing has been merged, deployed, uploaded to R2 or loaded into the production database; each of those needs your explicit go-ahead (`FINAL-RELEASE-REPORT-2026.md` §10). Everything here is therefore a statement about the build that *will* be deployed, not about valicepress.com today.

## 1. Verdict

| Area | Result | Instrument |
|---|---|---|
| Build | **pass** — `tsc` 0 · `eslint` 0 · `next build` ok | `npx tsc --noEmit` · `npx eslint .` · `npm run build` |
| Unit / component tests | **pass** — 74 files · **1,398 passed** · 194 skipped (the opt-in sandbox-database suites) · 0 failed | Vitest, CI shape (`VALICE_BOOKS_ROOT=/nonexistent`) |
| Browser tests | **pass** — 729 tests · **541 passed** · 188 skipped (project-specific by design) · **0 failed** · 7.1 min | Playwright: desktop Chromium, Pixel 5 emulation, desktop Firefox |
| Admin tests (signed in) | **pass** — **55 passed** · 2 skipped by design · 0 failed | `npm run test:e2e:admin` (stub-auth copy in `/tmp`) |
| Crawl | **pass** — 131 pages, **0 errors**, 12 warnings | `scripts/seo/audit.mjs` |
| Console / network / images / overflow / CLS, two engines | **pass** — **344 loads, 0 page problems, CLS 0** | `scripts/qa/desktop-sweep.mjs` |
| Accessibility | **pass** — axe-core WCAG 2.2 AA + best practice, 28 pages × desktop and phone, **0 violations**; focus indicator on the first 30 Tab stops of 4 pages | `e2e/quality.pw.ts` |
| Physical phone | **pass on the attached phone — which is a Redmi Note 8 (2021), not the Note 11R the brief names** | `MOBILE-REDMI-NOTE-11R-QA-2026.md` |
| Book identity (no cross-book contamination) | **pass** — 36 / 36 published books; the draft is correctly absent | `scripts/qa/book-matrix.mts` → `FINAL-BOOK-MATRIX.md` |
| Visual regression | **no severe regression**; 18 captures, all `200`, 0 sideways scroll, 0 broken images | `QA/visual-regression` |
| Performance | **measured; one regression found and explained, one open decision** — the home page's lab LCP on the slowest link is 4.9 s because its largest paint is now the hero photograph; the lever is the JavaScript every page ships (§6) | `scripts/perf/page-weight.mjs`, `mobile:cwv` and `mobile:trace` on the phone |

## 2. What is on the site — route inventory

`next build` reports **66 routes**: 22 static, 7 statically generated from data (`generateStaticParams`), 37 rendered on demand; of the 66, **19 are API handlers** and 47 are pages and files (`robots.txt`, `sitemap.xml`, the icons, the share image).

The crawl reads the sitemap and the public routes that are deliberately not in it, as Googlebot does:

| | |
|---|---|
| Sitemap | **122 URLs** (98 on the live site before this update) |
| Pages fetched | **131** — home 1 · static 17 · companion 29 · books 36 · categories 7 · authors 31 · blog 10 |
| Internal link targets followed | **248**, every one answers |
| External links | 180 (the four social profiles, Amazon, Wikipedia / Wikidata / Library of Congress for the authors, a few sources) |
| Share images | 59, every one answers `image/*` |
| A route that does not exist | a real **404**, `noindex` |

**Routes added** (since `d3a7ca9`): `/admin/books`, `/admin/data`, `/admin/email`, `/admin/email/[id]`, `/admin/email/export` and the admin layout; `/icon.png` and `/apple-icon.png` (the press's own mark, by Next's file convention). **Routes whose content changed:** `/authors` and `/authors/[slug]` existed and listed the ten authors who had books — they now list **31 people** (28 researched, each with sources, and the three living authors the press publishes); `/about`, `/cart`, `/books/[slug]`, `/books`, `/ebooks` and the home page are rebuilt; the three bonus routes already existed (the `/bonus` index was edited, and the newsletter popup now never opens on any of them). **Routes removed:** `/admin/books/[slug]/edit`, `/admin/contacts`, `/admin/contacts/export` — they redirect (`next.config.ts`) to `/admin/books`, `/admin/email`, `/admin/email/export`, and every `/admin*` address answers a signed-out visitor with a redirect to sign-in, the admin APIs with 403 (probed). **Assets removed** (obsolete, replaced, unreferenced): the old homepage hero (11 files) and the AI-generated About scene; a scan of the 593 files under `public/` for any whose name appears nowhere in the code, data, scripts or docs finds only five `create-next-app` scaffold SVGs (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`, under 3 kB together) and an empty verification file, `public/3444ea71…txt` — all deliberately left (the brief: "do not delete files simply because they appear old"); the image folders named by a book's slug were checked the other way, against the catalogue, and none belongs to a book that is not in it.

## 3. Crawl — status, render, errors, images, links

- **HTTP:** every one of the 131 pages answers 200 with its own title and canonical.
- **Render and JavaScript errors:** 344 page loads — all 130 public pages at 1440 px, and 14 key pages at 1024 / 1280 / 1920 px, each in **Chromium and Firefox**, scrolled to the bottom as a reader would — produced **0 page errors, 0 uncaught exceptions, 0 React / hydration warnings, 0 same-origin 4xx/5xx, 0 images that decoded to nothing, 0 sideways scroll and a worst layout shift of 0.**
- **What the console does show, and why it is not the page's:** a build served from `localhost` loads Clerk with its *production* keys (which refuse to run off `valicepress.com` and say so) and asks for Vercel's analytics beacons (which exist only on Vercel). The sweep lists them as *environment* and `--strict` counts them — which is the mode for the live site, after deployment.
- **What the live site shows today** (the Phase 0 baseline, 18 captures): **a Content-Security-Policy violation on every one — Cloudflare's Web Analytics beacon, injected by Cloudflare in front of the site and blocked by the site's CSP** — and CORS errors for `/account/library`, `/account/orders`, `/account/settings` on the desktop captures (Next prefetched links to sign-in-gated pages; the redirect is cross-origin). The second is **fixed on this branch** (those links are `prefetch={false}`) and takes effect on deploy; the first is a Cloudflare setting (§9).
- **Links:** 248 internal link targets and every `/about` link (40) answer, and every external profile is `target=_blank rel=noopener`. Footers and header: no link into `/admin`, none to a test host.
- **Stale text:** the crawl reads each page's visible text and links for what must never reach a reader — `undefined`, `[object Object]`, `NaN`, a price of `$0.00`, lorem ipsum, `localhost`, `loca.lt`, `valice-rehearsal`, a draft marker, the mock-up's name — and finds **none on any of the 131 pages**.

## 4. SEO — 5 errors → 0, 95 warnings → 12

The audit checks, per page and across pages: title, description, canonical, Open Graph, Twitter card, robots, `<html lang>`, one `<h1>` and no skipped level, an `alt` on every image, JSON-LD that parses and says the right thing for the page type, titles and descriptions not shared between pages, the sitemap listing exactly the indexable pages, every internal link answering, no public link into the admin area, **each ASIN on one book's pages only**.

The 12 warnings left: 3 header links to `/account/*` (a crawler is sent to sign-in; robots-disallowed, by design) · 2 bonus pages indexable but not in the sitemap (**your call**, §9) · 7 blog and companion titles over 62 characters (a title is cut by the search result, not by us).

What changed: `/about` has its own description (it shared the site-wide one); every book's description is its own, whole sentences, never over 160 characters (two novels had shared the 20-character "A Small Town Romance"); category and author pages say what is on the shelf; 19 titles that the brand suffix pushed over 65 characters keep it only where it fits; the heading outline is clean on all 131 pages; **`/books` and `/ebooks` now put 12 cards and 12 book links in the HTML the server sends** (they sent none — the catalogue appeared only after JavaScript). Rules that stay as regression tests: no `Offer` with a zero price (`price_cents = 0` means *not sold here*), no `aggregateRating` without a review, a `Book` with an author on every book page, a `Person` on every author.

*Note on this build's origin:* the sandbox environment sets `NEXT_PUBLIC_SITE_URL` to a tunnel host, so canonicals and Open Graph URLs in these runs carry that host; production's own value is what ships. **After deploy, check one canonical.**

## 5. Accessibility

axe-core 4.14, WCAG 2.2 AA + best practice, over 15 named pages and 9 read from the sitemap, at a desktop and a phone size, and with the Look Inside viewer open: **0 violations** (it found 2 rules / 12 hits at the start: a note `<aside>` nested in another landmark on book pages and blog posts, and a heading order on card titles). Beyond axe: every control the Tab key reaches in the first thirty stops of four pages shows a focus indicator (mutation-tested: removing the styles fails all four); the catalogue's sort, view toggle and Filters button are 44 px on a phone; modal focus trapping, Escape, and Android Back are tested in `overlays.pw.ts` and on the phone; the drawer moves focus into itself and gives it back (a defect the phone found). Alt text across the sitemap: **1,199 images — 511 decorative (`alt=""`, by design: the title sits next to the cover), 688 described, 129 distinct texts, none a file name or a placeholder.**

## 6. Performance — measured, not guessed

On a throttled mid-range phone profile (4× CPU, 1.6 Mbps, 150 ms) the cost of a page, final build (`scripts/perf/page-weight.mjs`, `AUDIT/data/final-page-weight-2026-10-08.json`):

| Phone profile | Whole page | JavaScript on the wire |
|---|---|---|
| `/` | 2.9 MB | 582 kB |
| `/books` | 2.2 MB | 582 kB |
| `/books/weather-permitting` | 1.6 MB | 582 kB |
| `/about` | 1.9 MB (**4.7 MB before** Phase 12) | 582 kB |
| `/authors` | 2.0 MB | 561 kB |
| `/cart` | 1.4 MB | 594 kB |

- `/books` LCP **5.9 → 3.1 s** (median of 5), CLS 0 — the catalogue is in the server's HTML now. `/about` on a phone: **3.6 MB of images → 0.83 MB** (the browser was told each cover was as wide as its card and fetched 1080 px files for 140 px slots). Images are never delivered at more than 2.3× the pixels the device needs (pinned by `e2e/quality.pw.ts`), and `/images/**` carries a cache lifetime (it had `max-age=0`).
- **On the physical phone** (`mobile:cwv`: cache off, 1.6 Mbps, 70 ms, median of three; lab, one device, **not field data**): LCP **`/` 4.95 s (POOR)**, `/books` 3.23 s (needs work), `/books/<book>` 2.02 s, `/about` 2.14 s, `/authors` 2.15 s — CLS **0** on every page, INP proxy 80–290 ms. Against the earlier mobile program's last run on the same phone and instrument: `/books` 3.33 → 3.23 s, a book page 3.60 → 2.02 s, **but `/` 1.88 → 4.95 s**. The home page got slower *on this instrument* because its largest paint used to be a paragraph and is now the hero photograph of the real covers (127 kB), which shares the lab's HTTP/1.1 link with about 580 kB of scripts; `mobile:trace` shows it, and blocking the twelve below-the-fold shelf images brings it to 4.1 s. The below-the-fold images are now `fetchpriority="low"` (`/books` improved by 0.5 s; the home page by 0.1 s). The rest is the JavaScript below. **The lab's HTTP/1.1 ignores priorities, so production should do better — measured numbers need the deployed site** (`FINAL-RELEASE-REPORT-2026.md` §10).
- **AVIF was measured and not enabled** (3–20 % on art whose sources are already lossy WebP: a second lossy generation for a few kilobytes).
- **The one open item:** every page ships **563 kB of JavaScript over the wire (35 files)** whatever the page — Clerk's two remote bundles (127 kB) and the chunk carrying Sentry's client (77 kB) are the largest, loaded for visitors who never sign in; measured cost on the throttled phone: 300–500 ms of First Contentful Paint and 30–95 ms of Total Blocking Time. Fixing it means mounting `ClerkProvider` only where a session matters and loading Sentry after the page is interactive — an architecture change with auth consequences, so it is **your decision** (§9), not something done here.
- The page-weight tool also lists the home shelf's thumbnails (432 px files in 214 px slots on a 1× screen — exact for a 2× phone) and, for rotated covers, an inflated "drawn" width; neither is a defect.

## 7. Security surface

One admin shell, one gate, asked at the proxy, the page, every query, every action and every route (`ADMIN-CONSOLIDATION-REPORT-2026.md`): 78 signed-out checks pass, 55 signed-in checks pass, `requireAdmin` needs a verified address, side-effecting diagnostic routes refuse cross-site requests, `/admin` is disallowed in `robots.txt`. Unsubscribes reach the contact book. **Open and yours:** `/api/newsletter` has no double opt-in or honeypot and its rate limiter fails open without Upstash; there is no admin audit log (needs a production migration).

## 8. Book identity — the last gate

"No book may ever display another book's cover, preview, author, Amazon link or content." Enforced three ways, all passing: **tests** (`book-media.test.ts` 199 — every panel is the book's own file, every passage is verified verbatim against the manuscript *and* the printed interior, no two books share a quotation; `catalog-identity.test.ts` 13; `book-highlights.test.ts` 39; `catalog.pw.ts`); **the matrix** (`FINAL-BOOK-MATRIX.md`: for each of the 36 published books the page's `<h1>`, JSON-LD, hero cover file, the four preview panels, every Look Inside picture, every Amazon link and the author are compared with the catalogue and with the files on disk); and **the phone** (`books.mjs`: all 36 popups and all 36 pages, with a real finger — every panel's path is under the book's own slug, every alt names its title, every Amazon link is one of its own editions).

## 9. Open items, all non-code or needing a decision

1. **Cloudflare Web Analytics** — turn off automatic setup (Cloudflare → Analytics & Logs → Web Analytics → valicepress.com), or tell me to allow `static.cloudflareinsights.com` in the CSP *and* name it on the privacy page. It costs one console error per page today.
2. **The bonus pages' index status** — `/weather-permitting-bonus` and `/long-way-back-bonus` are indexable and not in the sitemap: add them, or `noindex` them.
3. **Clerk + Sentry JavaScript for anonymous visitors** (§6).
4. **Terms / Privacy / Refund / KVKK** still name `emre30283@gmail.com` as the controller; the About page and footer use `hello@valicepress.com`. Which is the controller is your call. The Terms page still calls the shop "a first-party online store for digital books".
5. **The phone** — the physical QA ran on a Redmi Note 8 (2021), not a Note 11R (`MOBILE-REDMI-NOTE-11R-QA-2026.md`).
6. **Ridge Runner** stays a draft until KDP issues live editions (`BOOK-CATALOG-AUDIT-2026.md` §5).
7. **Two Codex Bestiarium titles on Amazon say 120 creatures; the book has 112** (`AMAZON-LINK-AUDIT-2026.md` §3).
8. **After deploy:** check you can still sign in to `/admin` (the address must be verified in Clerk); check `/cart` in two private windows (the shared empty cart is fixed and tested, the original report of "the plus doesn't add" is a hypothesis until you repeat your steps); check one canonical URL; confirm migration `0013` exists on production.
