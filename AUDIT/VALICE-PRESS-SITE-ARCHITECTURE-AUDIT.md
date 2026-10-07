# Valice Press — Site Architecture Audit

**Date:** 2026-10-07 · **Repo:** `main` @ `d3a7ca9` · **Work branch:** `feat/site-update-2026-10` (own git worktree `~/Downloads/valice-siteupdate`; the primary checkout is untouched)
**Scope:** Phase 0 of the production update in `master_prompt.md`. Nothing in the product was changed to produce this document.

Evidence tags: **[M]** measured or verified by me this session · **[A]** read from code in a read-only audit (file:line cited; not re-verified) · **[S]** read from a book source project outside the repo · **[U]** unverified.

---

## 0. Premises in the brief that did not match the repository

These change what gets built. Each was checked, not assumed.

| Brief says | What is actually true | Consequence |
|---|---|---|
| "Redmi Note 11R" on USB | ADB reports **Redmi Note 8 (2021)**, `M1908C3JGG`, Android 11, 1080×2340 @ 440 dpi, Chrome installed **[M]**. Earlier sessions' notes also say Note 8. | QA is run on that device and **reported under its real name**. |
| Tapping a **bonus** card opens a popup that locks the page | The three bonus pages have **no card and no popup** **[A]**. The bug is `QuickView` opened from **/books and /ebooks**. The bonus pages' only overlay risk is the newsletter popup (10 s timer, locks body, steals focus) | Fix the shared overlay layer; bonus pages get the popup suppressed. |
| "Multiple `/admin` dashboards" | **One** gated admin, five hand-rolled pages with no shared layout **[A]**. Real problem: UI book writes bypass the catalog rules; email admin is read-only | Consolidate into one shell; make Books read-only; build email CRUD. |
| Cart "plus/minus/quantity" | The cart is a cookie of book ids; **quantity is implicitly 1 by design** (digital licences) **[A]**. The "+" is the related-shelf add button | Fix add/carousel/ownership; no fake quantity stepper. |
| Ridge Runner has Amazon formats | Source docs: **nothing uploaded**, no ASIN, no ISBN **[S]**. A session is still rebuilding its files today | Cannot be published without inventing links; staged, not live (see §5.3). |
| World Games has Kindle | Catalog holds Kindle `B0HG44FH1B`; Amazon answers **"Page Not Found"** **[M]** | Kindle removed; paperback/hardcover/large print only. |
| `/ebooks` should show the new books | `/ebooks` lists only **directly sold** ebooks; the new romances are KDP Select (Amazon-only) **[A]** | `/ebooks` must also list Kindle editions, labelled as Amazon. |
| Hero "three cover positions" | They are **pixels inside one AI photograph** (1672×941), and the depicted covers are not the real ones **[A, visual]** | A new hero is needed, not a config change (§5.6). |

---

## 1. Current stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.2.6**, App Router, Turbopack | `AGENTS.md`: APIs differ from older versions — docs are in `node_modules/next/dist/docs/`. `src/proxy.ts` replaces middleware. |
| UI | React 19.2.4, TypeScript 5, **Tailwind 4**, shadcn config (only `ui/button.tsx` exists), lucide-react | Site-wide "cinematic" design system (`.cinematic-root`, dark `#050705` ground, emerald accent, Fraunces/Geist) |
| Data | Neon Postgres via **Drizzle** 0.45 / drizzle-kit | **Two databases**: `neondb` (production) and `bookstore` (sandbox; what `.env.local` points at). `drizzle migrate` is a silent no-op on both — verify the live schema |
| Auth | **Clerk** 7.4; admin = Clerk session **and** `ADMIN_EMAILS` allow-list | Production instance on `accounts.valicepress.com` |
| Payments | **Lemon Squeezy** (Paddle retired 2026-09-13; `@paddle/paddle-node-sdk` still a dependency) | One book per checkout; webhook is the only order writer |
| Storage | Cloudflare R2 (S3 SDK) — production uses the `-dev` buckets | Signed URLs; `/download/<token>` first-party link |
| Email | Resend (transactional + contacts), MailerLite (lead magnets, `/api/subscribe`), BookFunnel hand-off | |
| Jobs / limits | Inngest 4.5; Upstash ratelimit (fails open) | |
| Observability | Sentry, Vercel Analytics + Speed Insights (behind `AnalyticsGate`) | Cloudflare Web Analytics beacon is injected at the edge but **blocked by the site's own CSP** (§6) |
| AI | Vercel AI SDK 7 storefront assistant (`/api/assistant`) | |
| Reader | pdf.js 5.7 private web reader | |
| Package manager / runtime | npm, Node 24 | |
| Tests | Vitest 4 + jsdom + Testing Library (37 files); on-device CDP harness `scripts/mobile/*`; **Playwright 1.62.1 added in this work** | |
| CI | GitHub Actions: lint → tsc → `npm test` → (migrate on main) → build; Vercel native deploys | Browser tests are not in CI |

**Baseline on `main` in my worktree [M]:** `tsc` exit 0 · `eslint` exit 0 · `VALICE_BOOKS_ROOT=/nonexistent vitest run` = **37 files, 464 passed, 166 skipped, 0 failed** (the skips need the external books tree; this is the CI shape).

---

## 2. Route map (58 pages + route handlers) [M — from the file tree]

- **Catalog & content:** `/`, `/books`, `/books/[slug]`, `/ebooks`, `/categories`, `/categories/[slug]`, `/authors`, `/authors/[slug]`, `/search`, `/about`, `/blog` (+ `/[slug]`, `/category/[slug]`, `/tag/[slug]`), `/companion`, `/companion/[slug]` (+ `/sheets/[sheet]` route), `/codex-enigmatica/verify`
- **Lead magnets:** `/bonus`, `/long-way-back-bonus`, `/weather-permitting-bonus`
- **Commerce / account:** `/cart`, `/order/[id]`, `/account/{library,orders,settings}`, `/read/[bookId]`, `/download/[token]` (route)
- **Legal:** `/terms`, `/privacy`, `/refund`, `/kvkk`, `/unsubscribe`
- **Admin (all Clerk + ADMIN_EMAILS):** `/admin`, `/admin/books/[slug]/edit`, `/admin/contacts` (+ `/export` CSV), `/admin/free-books`, `/admin/support`
- **API:** `/api/admin/{email-check,events,fulfillment-check,sentry-check,storage-check}`, `/api/assistant`, `/api/campaign`, `/api/cart/count`, `/api/codex-enigmatica/verify`, `/api/entitlement`, `/api/events`, `/api/free-book`, `/api/inngest`, `/api/newsletter` (+ `/unsubscribe`), `/api/popup`, `/api/read/[bookId]/content`, `/api/subscribe`, `/api/webhooks/lemonsqueezy`
- **Redirects (`next.config.ts`):** `/genres → /categories` (308), `/review-long-way-back → Amazon review form for B0HL6S3V5C` (307). No admin redirects exist.
- **Live status [M, 2026-10-07]:** every public route above answers 200. `/admin*` answers 404 to an unauthenticated `curl` — that is Clerk's behaviour, not a dead route (check in a browser before calling it broken). `sitemap.xml` serves 98 URLs [A].

---

## 3. Content / data architecture

```
scripts/catalog/valice-catalog.mjs   (source of truth, 3,390 lines: 33 books, 7 categories, 10 authors, 48 unique ASINs)
        │  load-catalog.mjs  (dry-run default; production needs --i-know-this-is-production)
        ▼
Neon Postgres  (neondb = production, bookstore = sandbox)      ← CLAUDE.md: never edit catalog rows in the DB
        │  src/lib/db/queries/catalog.ts   (unstable_cache + revalidate 3600; nothing calls revalidateTag)
        ▼
pages  (/books, /ebooks, /books/[slug], home shelf, search, categories, authors, companion)
```

- `src/` **never imports the catalog file**; it reads the DB **[A]**. A catalog change reaches production only after a production catalog load (founder-only: the production `DATABASE_URL` is write-only in Vercel) and the 1 h ISR window. Covers and manifests additionally need a deploy.
- Book record fields **[A]**: `slug, title, subtitle, language, pageCount, categories, authors, bisac, series, websiteStatus, kdpSelect, directSale, directSaleBlockedBy, providerPriceId, onelinePromise, description, idealReader, formats[], blockers[], linkageDecision`. Format fields: `format, availability, fulfillment, priceCents, pageCount, isbn13, amazonAsin, amazonUrl, kdp, masterFileKey, epubFileKey, priceBasis, listingDefects`. **There is no back-cover, quote-visual, A+ or "featured order" field.**
- **Rules enforced in tests/loader [A]:** Select ebooks are never direct-sold (`valice-catalog.test.ts:124-145`); an ASIN requires `kdp: live` (`:384-441`); "published" means obtainable (`:493-505`); every published book has a preview (`:456-469`); previews ≤ 5 % of page count (`:471-483`). `validate-catalog.mjs:152` only checks that `/dp/<ASIN>` answers 200 — **it does not check whose page it is** (hence the new `scripts/catalog/verify-amazon-asins.mjs`, §8).
- **Ordering [A, and read by me]:** `src/lib/pinned-books.ts` — `PINNED_BOOK_SLUGS = [world-games, codex-bestiarium, the-sweetest-season]`, applied as the last stable sort in `catalog.ts` (lines 157, 250, 340, 606, 915, 1008, 1157). Unpinned books keep `desc(publishedAt), asc(id)`. A pin never *adds* a book to a shelf. `pinned-books.test.ts` hard-codes the list.
- **Amazon links [A]:** only per-format `amazonAsin`/`amazonUrl` is canonical. Other copies: `next.config.ts:153` (review redirect), test fixtures `kindle-editions.test.ts:18-77`, docs. Rendered in `format-table.tsx:67`, `quick-view.tsx:396`, JSON-LD `seo.ts:220`.
- **Covers/images [A]:** `/images/books/<slug>.webp` by convention (`asset-map.ts:51,93`) checked against a committed manifest; 33 covers, 33 thumbs, 116 preview pages; **no back-cover slot**. Two parallel preview lists exist (`previews/index.ts:13-38` for the detail page, `asset-manifest.json` for QuickView) — identical today, nothing enforces it.
- **Preview pipeline [A]:** `scripts/catalog/preview-pages.mjs` (`{slug, source, pages:[from,to]}`) → `build-previews.mjs` (pdftoppm 150 dpi → WebP ≤1100 px) → `public/images/previews/<slug>/pN.webp` + `src/lib/previews/manifest.json`. Sources live outside the repo (`VALICE_BOOKS_ROOT`, `VALICE_RAPID_ROOT`).
- **Authors [A]:** DB `authors` = `id, slug, name, bio` (10 rows from `valice-catalog.mjs:115-191`). `/authors` lists authors who have books; detail pages exist. Only Dudeney and Marcus Aurelius have portraits. A fake roster was removed on purpose (`author-card-data.ts:4-18`).

### 3.1 Catalog contents today vs the brief

| Book | In catalog? | Notes |
|---|---|---|
| The Sweetest Season (Harper Hayes) | yes, Select, Amazon-only | **Site cover is the superseded 09-23 art** **[S]**; current is `…/BOOK-01-PUBLICATION/cover/final-ebook-cover.jpg` (1600×2560, 09-29) |
| The Great Book of World Games | yes, direct + print | Catalog still has the **old** paperback `B0HG3KMK9L`, old hardcover `B0HG41F21F`, dead Kindle `B0HG44FH1B`, old subtitle (4,600 yrs / 45 cultures) and page counts 182/186/232; site cover is the old 56-game cover **[A,S]** |
| Codex Bestiarium | yes, direct + print | ASINs correct **[M]**. Live print titles still say **120** creatures; the book has **112** (listing defect, owner action). Catalog `pageCount` 436 vs 435 actual |
| Weather Permitting (Quinn Gallagher) | **no** | Live: Kindle `B0HLPPCVT3`, paperback `B0HLXPRMRD` **[M]** |
| Ridge Runner (Quinn Gallagher) | **no** | **Not on Amazon** **[S]** |
| The Long Way Back (Harper Hayes #2) | **no** | Live: Kindle `B0HL6S3V5C`, paperback `B0HL74PNCZ`, hardcover `B0HLXLDNPS` **[M]** |
| All the Quiet Places (Harper Hayes #3) | **no** | Live Kindle `B0HC4KYYPM` **[M]**; print IDs undocumented |

---

## 4. Admin architecture [A unless noted]

**One** gated admin; every page needs a Clerk session **and** a primary email in `ADMIN_EMAILS` (`auth.ts:148-192`). The gate is repeated at proxy, page, query and server action. There is **no `admin/layout.tsx`**: five pages rebuild their own gate and chrome; two copies of the admin-error mapper (`actions.ts:33`, `free-books/actions.ts:18`).

| Surface | Purpose | Disposition |
|---|---|---|
| `/admin` | revenue/orders, book table, **create-book form** | → Overview; drop the create form |
| `/admin/books/[slug]/edit` + `actions.ts` | edit / publish / **hard-delete** books | **remove** — writes catalog rows in the DB, bypassing the catalog tests and the KDP-Select rule (`actions.ts:225,357,482,429,504`); contradicts CLAUDE.md |
| `/admin/contacts` (+ `/export`) | read-only contact book, 4 filters, search, CSV | → Email tab; add write actions |
| `/admin/free-books` | request queue, send PDF, dismiss, re-queue | → Free-books tab, as is (+ `sending` filter, search, paging; stale "15-minute link" copy) |
| `/admin/support` | customer lookup | keep as a tab |
| `/api/admin/events` | event counts, no consumer | fold into Analytics tab |
| `/api/admin/{email,storage,fulfillment,sentry}-check` | provider diagnostics; **POST email-check sends a real book**; storage/fulfillment write and delete R2 probes | keep; share one auth helper (`tokenAccepted` is copy-pasted 4×) |

**Security gaps, ranked:** (1) **HIGH** unsubscribe never reaches the DB — the route only calls Resend, `recordUnsubscribe` has no callers (`newsletter/unsubscribe/route.ts:58`, `contacts.ts:209`), so "Suppressed/Mailable" counts are wrong; (2) **HIGH** `/api/newsletter` has no double opt-in and no honeypot and mails a welcome to any typed address (`route.ts:130-311`); the global rate limiter fails open (`rate-limit.ts:32,136`); (3) MED `requireAdmin` never checks email `verification.status` (`auth.ts:165-180`); (4) MED UI catalog writes (above); (5) MED no admin audit log; export silently caps at 500; (6) MED per-IP free-book caps off without `FREE_BOOK_IP_SALT`; (7) LOW non-admins see notices naming `ADMIN_EMAILS` and raw `err.message`; (8) LOW diagnostic GETs have side effects under cookie auth and sit outside the proxy matcher; (9) LOW proxy fails open when Clerk env is missing (`proxy.ts:63`; each page still gates).
Strengths: gate repeated at four layers; CSV is formula-neutralised and `no-store`; CSP `frame-ancestors 'none'`.

### 4.1 Email architecture
- Table `contacts` (migration 0013): normalised `email` with **unique** index, `email_raw`, `name`, `source` (NOT NULL), `source_detail`, `first_seen/last_seen`, purchase fields, `marketing_consent` enum (`opted_in | opted_out | unknown | not_marketing_contact`) + `consent_source/at`, `unsubscribed(_at)`, `notes`. **No active flag, no soft delete, no audit.** `free_book_requests` (email not unique), `popup_impressions`, `analytics_events` are separate.
- Writers: only `/api/newsletter` (`recordOptIn`) and the CRM import script. **Admin has no write path.** Policy: `opted_in` requires evidence (`contacts.ts:17-22`).
- Validation: three validators, six email regexes, `normalizeEmail` duplicated; Gmail dot/plus aliases are not detected as duplicates.
- **External side effects to stub in any test:** `/api/newsletter` → Resend contacts + welcome send; `/api/newsletter/unsubscribe` → Resend; **`/api/subscribe` → MailerLite — `.env.local` holds a real Weather Permitting token and group id, so a local call would hit the live MailerLite account** unless `MAILERLITE_API_BASE` points at loopback (`subscribe/route.ts:64-80`); admin fulfil → R2 read + real Resend send.
- Real data available to an Overview: book/format counts, pinned books, contacts, free-book queue, `download_logs` (paid downloads). **Not available:** page views (Vercel Analytics only; no `page_view` event), Amazon/KDP sales, and any real direct sale (no real purchase recorded as of 2026-09-19; `testMode` is parsed but never stored). `safeQuery` turns a DB failure into zeros — a fabrication hazard to fix.

---

## 5. Book-facing UI architecture

### 5.1 Cards [A]
`/books` and `/ebooks` render `CatalogShell → CatalogBookCard` (2 cols, `sm:3`, `xl:4`, 300 px sidebar from `lg`). Cards go uneven because the `<li>` has no class and the `<article>` has no `h-full`, so `flex-1`/`mt-auto` do nothing; height then follows 1- vs 2-line titles, an **unclamped author line**, and 0–3 wrapping format pills. **Measured in the live capture [M]:** row-1 cards differ by ~65 px, and `object-cover` **crops** the 8.5×11 World Games and World Myths covers (title cut mid-word). The wishlist heart has no handler; `/books` and `/ebooks` server HTML contains **zero book anchors** (client-side-render bailout, `books/page.tsx:64`) — a crawlability issue.

### 5.2 QuickView and every overlay [A; mechanism measured by the audit in headless Chromium]
There is **no shared dialog**. Nine hand-rolled overlays, **five independent scroll-lock writers**, four copy-pasted focus traps, no `dvh` anywhere, no Android-Back handling, no ref-counting. Ranked root causes of "tap a book → page locks":
1. `QuickView` is `grid overflow-hidden` with only `maxHeight: min(92vh,760px)` (`quick-view.tsx:207-214`). On a phone the two auto rows exceed it, **nothing scrolls**, and the offer panel (Buy, Close) is clipped (CTA clipped by ≈290–400 px at 320–412 wide).
2. The Close button is 36 px in the *second* row, partly off-screen; auto-focus scrolls the overflow-hidden dialog (+16 … +421 px) so it cannot be scrolled back; the body is locked behind it. Android Back leaves the page.
3. Stacking inversion: not portaled; `.cinematic-root{isolation:isolate}` traps z-110 under the sticky header (z-50) and the AI launcher (z-40) wins taps.
4. Newsletter popup fires after 10 s on the bonus routes, locks the body and steals focus from `#bonus-email`.
5. `FreeBookModal` panel top (incl. Close) lands above the screen (`items-end` + `overflow-y-auto`); dormant (campaign closed 2026-09-19).
6. Locks are not ref-counted (`quick-view.tsx:119/155`, `free-book-modal.tsx:164/168`, `newsletter-popup.tsx:168/203`, `catalog-shell.tsx:315-325`, `mobile-nav.tsx:102-109`).
`MobileNav` is the one good implementation (portal, 44 px close, `overscroll-contain`). No unit test touches any overlay; only the nav and filter sheet have on-device checks (`journeys.mjs:123-260, 455-526`).

### 5.3 Detail page `/books/[slug]` [A]
Hero → companion → FormatTable → DirectEditionPanel → Look inside (scroller) → reviews → 6 related → explore strip; `revalidate 3600`. Gaps vs the reference: Amazon CTA not in the hero; no tab bar; Editions not a card; Look inside is a scroller, not a 4-up card; the description is **one `<p>`** (paragraph breaks lost — measured on the live Sweetest Season page [M]); no About-the-author (bio not queried); **no A+ content is used anywhere**; `generateMetadata` uses the **subtitle** as the description (12 books > 160 chars, 6 < 70); JSON-LD hard-codes `bookFormat: EBook` and emits no Offer for Amazon-only titles (correct). `/books` and `/ebooks` have no JSON-LD.

### 5.4 Reference design (`images/book-details-page.png`, viewed by me [M])
Header → hero (cover ≈332×483 left; right: author eyebrow, ≈48 px serif H1, italic subtitle, ★ rating, blurb, four trope chips, **Buy on Amazon** + **Read a Preview**, pages · language) → tab bar (Overview · Preview · About the book · About the author · Editions) → Editions card (rows with price + Amazon button; side note that print is fulfilled by Amazon) → Look-inside card (copy left, four pages right) → About the book + "What you'll find inside" chips + About the author. ~18–25 px panel gaps. **Omit:** the 5.0 stars, invented trope chips, the mockup bio and the AI avatar (the fictional "Digital Bookstore" mockup — layout reference only, per project notes).

### 5.5 Cart [A]
No client store. One httpOnly cookie `dbs_cart` `{items:[{bookId,addedAt}]}` (30 d; `cart.ts:20`); Server Actions `addToCart/removeFromCart/clearCart/createCheckoutSession` (`cart/actions.ts`); `/cart` is `force-dynamic`; count badge via `/api/cart/count` + `cart-changed` event, fetched by **two** header copies. Defects: "+" (`recommendation-card.tsx`) silently returns on `!result.ok` (:40), has no try/catch (a rejected action blanks the page via `error.tsx`), is a `<button>` nested in an `<a>`, and the re-render removes the added card before its confirmation can show (`actions.ts:53`, `page.tsx:79-84`); the shelf gate (`priceCents>0`) is weaker than the server's (`priceCents>0 && providerPriceId`) and ignores `buyableHere`. Carousel arrows (`recommendation-carousel.tsx`) never disable and use a fixed `scrollBy(±400)` on a `snap-mandatory` track — with 6–8 cards the track barely overflows above ≈1724 px so the arrows are dead on desktops; hidden < 640 px. Also: owned filter is a no-op (`page.tsx:67-73`), totals include owned/unbuyable lines, one non-UUID id makes the `inArray` throw, demoted books show "Buy $0.00" (`formatPrice` instead of `formatCatalogPrice`), checkout `onBuy` has no try/catch. No component, action or browser tests exist.

### 5.6 Home hero [A, plus my own visual check of the live capture and the source files [M]]
`src/components/home/hero.tsx` is one `<picture>` (AVIF/WebP at 640/960/1280/**1672** + a 900×1200 portrait) of a still life; the **books in it are pixels** and differ from the real covers. Source `images/assets/Pasted image.png` is **1672×941** — no larger original exists in ~16.7 k scanned images. Upscale at 1440 wide: 0.9× / 1.8× / 2.7× at DPR 1/2/3; at 1920: 1.15×/2.3×/3.4×; AVIF is 0.37 bpp (grain smoothed). **`images/assets/Pasted image (3).png` (1672×941) is the same still life with the books removed (marble plinth, olive branch, armillary sphere, velvet) [M]** — the natural plate for a new hero. Hero copy ("Buy once, download a watermark-free PDF… Secure payments") is **untrue for the Amazon-only titles that will now be featured**, and contradicts `belief-grid.tsx:37` ("watermarked"); `src/app/page.tsx:44` has the typo "watermarked-free".

### 5.7 Brand [A, plus viewed [M]]
The current "logo" is **live text** (serif "Valice Press" + emerald dot + 7.5 px imprint) in header, footer, email and OG image; `favicon.ico` is the **Next scaffold icon**; no manifest/apple icon/JSON-LD logo. The supplied `/home/emre/Pictures/ValicePress-main-logo.png` is **1254×1254 RGBA with alpha 255 everywhere**: an opaque cream (#FCFAF3) stacked lockup — dark-green "V" over an open book, gold star/laurel, faint globe, "VALICE PRESS", rule, tagline. Dark ink on the site's `#050705` is ~1.2:1, at 32–40 px only the V reads, the wordmark needs ≈90 px, the tagline ≈350 px. The art spells **VALICE**, while the printed covers spell **VÂLİÇE** (owner call; not changed by me).

### 5.8 Social links [A]
Wrong X (`x.com/emredogancloud`) at `home-footer.tsx:138` (footer is on ≈35 pages), `founder-card.tsx:183`, `next-steps-grid.tsx:61-62`. GitHub `emredogan-cloud` at `home-footer:147`, `founder-card:192`, `next-steps-grid:69` (not in the required set — treated as obsolete personal link; flagged). Instagram/Facebook/TikTok exist nowhere; `brand-icons.tsx` has only X and GitHub. JSON-LD omits `sameAs`/`logo` and **a test asserts that** (`seo.test.ts:178-182`). No central config exists.

### 5.9 About / Authors [A]
About = hero, beliefs, founder (initials only — correct per house rule), manifesto, next steps. Stale: "bookshop for digital books" (`about-hero.tsx:60`); no romance, print, bonus, authors or logo content; unsupported claims "every Tuesday" (`newsletter-section.tsx:65`), "sold without DRM" (`brand-film-section.tsx:78`); "Bestsellers" sorts by rating though every rating is 0 (`home-footer.tsx:39`). Authors: see §3.

---

## 6. Responsive strategy, and defects measured today

Tailwind mobile-first; header nav `hidden < lg` with a drawer (`MobileNav`); `viewport-fit=cover` and safe-area gutters in the header; tap targets 44 px; an on-device harness (`scripts/mobile/*`) encodes earlier lessons (probe from scroll 0, never `captureBeyondViewport`, test scaling laws at two disagreeing points).

**Measured on the live site with headless Chromium, `isMobile`, DPR 2 [M]** (`QA/visual-regression/before/manifest.json`):

| Width | Horizontal overflow | Source |
|---|---|---|
| 320 | **93 px** | header right cluster (`cinematic-header.tsx:218`, `div.ml-auto.flex.items-center`) is 252 px wide and starts at x=161 |
| 360 | **53 px** | same |
| 375 | **38 px** | same |
| 390 | **23 px** | same — the hamburger ends at x=413; "Sign in" wraps to two lines |
| 412 | 1 px | |
| 768 | 0 | |

It appears on **every** mobile route (shared chrome). Also measured on every desktop route: 3 console errors / 2 failed requests, in three classes — (a) **CSP blocks `static.cloudflareinsights.com/beacon.min.js`** (`script-src` in `next.config.ts:39` has no such host; Cloudflare Web Analytics was enabled on 2026-09-02 and has therefore never worked); (b) **CORS failures on prefetch of auth-gated links** (`/account/library|orders|settings?_rsc=…` → 307 to `accounts.valicepress.com/sign-in`); (c) an aborted `/cart?_rsc` prefetch (benign).

---

## 7. Test strategy today
Vitest unit/lib tests (37 files); **no component tests, no browser tests, none for admin, cart actions, overlays or proxy**; the on-device CDP harness (`mobile:audit/journeys/e2e/cwv`) is the only behavioural coverage and runs by hand against a phone; CI never runs a browser. CI-shaped local run: `VALICE_BOOKS_ROOT=/nonexistent npx vitest run`. Known local-only failures on plain `main` (not regressions): 21 companion-page fails when `CODEX-BESTIARIUM` exists in two places in the books tree; one lint-linkage failure in a fresh worktree without `.venv-factory` (symlinked here).

---

## 8. Duplicate systems and technical debt

| Item | Evidence |
|---|---|
| Nine overlay implementations, five scroll-lock writers, four focus traps | §5.2 |
| Legacy `<SiteHeader>` mounted in the root layout on every page, hidden by CSS (`globals.css:265`) next to the per-page `CinematicHeader`; two cart-count fetchers | `layout.tsx:148`, `site-header.tsx` |
| Two preview manifests (detail page vs QuickView) | §3 |
| Five hand-rolled admin gates; two admin-error mappers; `tokenAccepted` ×4; six email regexes | §4 |
| Dead code: `reader-shell.tsx`, `hero-book.tsx`, `recordContact`, wishlist button, `/api/admin/events` consumer | audit |
| Stale docs: `memory/PAST_DECISIONS.md` still says Paddle; `KURULUM_VE_ENV_REHBERI.md:1176,1214,1542`; admin page copy for removed features | audit |
| `@paddle/paddle-node-sdk` dependency; `.env.production.local` holds `[SENSITIVE]` redactions (Next loads it **before** `.env.local` for production builds — deliberately not copied into my worktree) | [M] |
| Contradicting hero/beliefs/about claims (watermark-free vs watermarked, DRM, Tuesday) | §5.9 |

---

## 9. Proposed architecture (decisions made before implementation)

1. **Overlay layer (Phase 1).** `src/lib/overlay/scroll-lock.ts` — ref-counted singleton that records and restores inline html/body overflow and `scrollY`, idempotent release. `src/components/ui/dialog.tsx` — portal into `#overlay-root` (outside `.cinematic-root`), flex-column panel with `max-height: calc(100dvh − gap)` and a `vh` fallback, **one** internal scroller (`min-h-0`, `overscroll-behavior: contain`), safe-area padding, 44 px close in a non-scrolling header, focus trap/return, Escape on the top dialog only, `inert` on the app root, **Android Back via same-URL `pushState` that preserves `history.state`** (Next 16 integrates native `pushState`, per its docs), z-scale tokens (header 50 · floating 55 · drawer 70 · dialog 100 · nested 110 · toast 130). Migrate QuickView, newsletter popup, FreeBookModal, filter sheet; `MobileNav` moves to the shared lock only; assistant launcher hides while a modal is open; suppress the newsletter popup on bonus routes; delete dead `reader-shell.tsx`; a test forbids `body.style.overflow` outside the lock module. Header: icon-only account button below `sm`, search icon hidden only below 340 px with a **Search entry added to the drawer**.
2. **One registry (Phase 2).** Keep `valice-catalog.mjs` + loader as *the* registry. Add one typed, tested media module (`src/lib/book-media.ts` + data file) holding `frontCover`, `backCover`, `quoteVisuals[{quote, sourceLocation, image, verifiedAgainst}]`, `lookInside[]` per slug — replacing the two parallel preview lists. No DB schema change (avoids a production migration).
3. **Catalog, links, ordering (Phase 3).** Add authors `quinn-gallagher`; series *Bristlecone Emergency*; books Weather Permitting, The Long Way Back, All the Quiet Places; correct World Games; replace stale covers; pins = Weather Permitting, Ridge Runner (when published), The Sweetest Season, World Games, Codex Bestiarium, then The Long Way Back, All the Quiet Places. `/ebooks` also lists Kindle editions (labelled "Kindle · on Amazon"). **Ridge Runner is staged, not published**: no Amazon edition exists, and "published means obtainable" is a tested house rule; flipping it is a one-record edit once KDP issues ASINs. `verify-amazon-asins.mjs` checks title/format/ISBN/pages per ASIN against the catalog.
4. **Previews (Phase 4)** — four panels per book: front cover, back cover (cropped from the real wrap proof; where none exists, the best legitimate alternative), two quote visuals whose text is **exactly** a passage in the manuscript. Typography is always set locally (Pillow/SVG); a generative background is optional, never carries text, never depicts a book cover or a real person. Priority books get ChatGPT-generated backgrounds; the long tail gets deterministic book-specific treatments built from each book's own cover palette. Quote verification script records source file, hash and match location.
5. **Detail pages (Phase 5)** follow the reference structure with data-backed content only.
6. **Home, brand (Phase 6).** New hero built on the empty plate: the three real covers set into the scene by deterministic compositing (never regenerated by AI), a ≥2× enhanced plate (Real-ESRGAN is on this machine), served AVIF/WebP at proper `sizes`; hero copy rewritten to be true for Amazon-only titles. Logo: full lockup on a cream plate (footer, About, OG, email), emblem crop + live wordmark in the header, favicon/apple-icon/manifest derived from the emblem; the source PNG is never modified. `src/lib/social.ts` is the single source for social URLs (footer, founder card, next steps, drawer, `sameAs`, `twitter.site`) with a test pinning the four URLs.
7. **Authors (Phase 7)** — a **separate static reference registry** (group, relationship, dates, works, sources, image licence + credit), *not* rows in `authors` (they would render "No titles published yet"); Person JSON-LD; copy that never implies a Valice relationship unless one exists in the catalog.
8. **Admin (Phase 10)** — `admin/layout.tsx` with tabs: Overview (tri-state cards: value / unavailable / error — "Sales data unavailable — no connected sales source"), Books (read-only), Email (add/edit/suppress/delete, search, filters, duplicate report, paged export, active state; **DB only, no provider sync**), Free books, Support, Analytics. Remove the catalog-writing actions. Mirror unsubscribes into `contacts`. No new tables → no production migration.
9. **Cart (Phase 9)** — fix the existing architecture: pure `addItem/removeItem/pruneItems`, UUID check + dedupe, ownership guard, try/catch, visible confirmation, `buyableHere` gating, measured-step carousel with disabled/hidden arrows, one `useCartCount`, `formatCatalogPrice`.
10. **Tests** — Vitest: lock, dialog, catalog identity (§below), cart helpers, social/pins/media. Playwright (`e2e/`, excluded from Vitest, **not** part of `npm test`) against a local **production build on a sandbox database**, with MailerLite/Resend/R2-writes neutralised. On-device journeys added for QuickView/Back/newsletter.

**Identity-safety assertions (Phase 2/3):** unique slug/id; unique ASIN per book and a deny-list of superseded ASINs (`B0HG3KMK9L`, `B0HG41F21F`, `B0HG44FH1B`, `B0FSDB21Q9`, `B0FS6L2ZQG` …); cover/preview/back/quote paths sit under the book's own slug; unique cover content-hashes; every `quoteVisual.quote` appears verbatim in its recorded source (locally, where the books tree exists); ISBN-13 check digits; Amazon title/format/ISBN match from the recorded verification file.

---

## 10. Operating constraints observed while auditing

- Another Claude session is active in the books tree (it regenerated Weather Permitting's hardcover and is rebuilding Ridge Runner today): source assets are moving. Assets are copied with recorded SHA-256 and mtime; re-sync is a deliberate step.
- Production writes (catalog load, deploy, merge) are **not** performed by this work without an explicit go-ahead; `.env.production.local` was deliberately not copied; `.env.local` points at the sandbox DB.
- **Incident:** one audit sub-agent ran `process_kdp_aplus.py --help` in `…/BOOK-1-WEATHER-PERMITTING/PUBLICATION/A-CONTENT/`; the script has no argument parser and regenerated its 48 derived A+ files at 15:03–15:04 today. Byte sizes and the 12 root-file SHA-256s are unchanged and `original-masters-backup/` is untouched; only mtimes changed.
