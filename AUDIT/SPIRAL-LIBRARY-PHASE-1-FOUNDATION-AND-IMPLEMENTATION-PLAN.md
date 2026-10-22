# Spiral Library — Phase 1: Foundation, and the Phase 2 Implementation Plan

**Date:** 2026-10-22
**Repository:** `/home/emre/Downloads/VALICE-PRESS-SITE`
**Work branch:** `feat/spiral-library`
- Created in the primary checkout from `origin/main` @ `7140f31`, which is the commit production runs.
- Created with `--no-track`, so a bare `git push` can never target `main`.

**State of this work:** nothing committed, pushed, deployed, loaded or migrated. Phase 1 only.

**Evidence tags**

| Tag | Meaning |
|---|---|
| **[V]** | Verified this session: a command was run, a file was read (`path:line`), or a value was measured. |
| **[D]** | From documentation: the Next.js docs bundled in `node_modules/next/dist/docs/`, or Vercel's docs. |
| **[R]** | A recommendation, a decision proposed for Phase 2. |
| **[A]** | An assumption. Believed, not verified. |
| **[U]** | Unknown. Not verified; how to verify it is stated. |

---

## 1. Executive summary

**What Phase 2 builds.** `/books` opens on a monumental cylindrical bookcase:
- Real published covers stand face-out on circular tiers around a central column.
- Each tier is one of the press's real collections.
- Scrolling the page carries the camera down the column, shelf by shelf.
- Hovering a cover shows a short card.
- Clicking it opens the existing Quick View, where **"Buy on Amazon"** is the primary action.
- Amazon is offered only where a verified Amazon edition exists.
- Below the last shelf the page continues into the existing catalogue grid and footer. Nobody is trapped in the experience.

**Recommended architecture [R]: hybrid.**
- **WebGL scene:** three.js with React Three Fiber, loaded lazily as a client island on `/books` only. It draws the column, shelves, covers, light and camera.
- **Conventional HTML:** everything a person reads or operates — the header (existing), the collection rail, hover card, Quick View (existing), purchase links, list fallback, headings and the screen-reader structure.
- **Scrolling:** native page scrolling drives the camera. The wheel is never hijacked.

**The decisions that matter:**

1. **Where.** `/books`. The reference's active nav item is ALL BOOKS. The homepage is left as it is. [R]
2. **Data.** There is no second catalogue and no schema migration.
   - Today's pipeline stays: `valice-catalog.mjs` → loader → Neon → `listPublishedBooks()` → `toCatalogItems()`.
   - Phase 2 adds one optional field: each book's collection slugs.
   - The Phase 1 module `buildLibraryShelves()` turns that into shelves. [V]/[R]
3. **Shelves are real collections.** That gives six shelves today:
   - Romance 4, Myth & Folklore 14, Games & Play 8, Puzzle & Challenge 4, Language & Learning 3, Classics & Philosophy 3.
   - Young Explorers is a *cross-shelf* collection, because both its books list another collection first.
   - The reference's "Adventure & Mystery", "Science & Ideas" and "Fantasy" do not exist in the catalogue and are not invented.
   - No filler or fake books stand on any shelf. [V]
4. **Amazon.** Per-edition `book_formats.amazon_url` already exists, is gated by the loader and tests, and was verified live (55 ASINs, 55/55). It is reused as is. [V]
   - 26 of 36 published books have at least one Amazon edition, 55 editions in all.
   - The other 10 have none. They get an explicit "not on Amazon" state that offers their existing direct digital edition, because all 10 are buyable here.
   - Quick View gains one opt-in prop so that, opened from the library, it starts on the Amazon edition.
5. **Performance.**
   - Textures come from the existing 432 px cover thumbs: 1.58 MB for all 37, about 53 MB of GPU memory, against about 300 MB for the full-size covers. [V]
   - The renderer runs on demand, with pixel-ratio caps and no real-time shadows.
   - The 3D bundle loads only when the device qualifies.
   - The list fallback covers missing WebGL 2, save-data and very-low-memory devices.
   - Reduced motion means shelf-to-shelf steps, not "no library". [R]
6. **Release.** Merging to `main` deploys production through the Vercel Git integration; this was verified for every recent production deployment. [V]
   - Rollback is Vercel Instant Rollback to the preceding production deployment, or `git revert` of the merge. [V]/[D]

**Critical finding — read before Phase 2.** At the start of this session the primary checkout sat on **local `main` @ `d3a7ca9` (2026-10-01).** [V]
- That is **21 commits behind `origin/main` @ `7140f31`**, which is what valicepress.com runs.
- The missing commits are the "site update 2026-10": a 37-book catalogue, a shared overlay layer, a Quick View rebuilt on it, Playwright tests, and more.
- Building or deploying from the old local `main` would roll the live site back by those 21 commits.
- All Phase 1 work was therefore done on `feat/spiral-library` created from `origin/main`. Local `main` was not modified.

**Phase 1 changes.**
- Four new files, all in `src/components/spiral-library/`: two pure modules and their tests (26 tests).
- No existing file modified. No dependency installed. Nothing deployed.
- Checks after the change:
  - `npm run lint`: exit 0.
  - `npx tsc --noEmit`: exit 0.
  - Vitest in CI shape: 80 files / 1,443 tests passed, exit 0.
  - `npm run build`: exit 0.
- Plain `npm test` on this machine exits 1. Those 21 failures are pre-existing, identical before and after, and in an unrelated print-factory test. See §10.

---

## 2. Verified project architecture

### 2.1 Stack

| Layer | Fact | Evidence |
|---|---|---|
| Framework | **Next.js 16.2.6**, App Router, Turbopack builds. `src/proxy.ts` is the proxy (Next 16 name for middleware). `AGENTS.md` warns that APIs differ from older Next.js and that docs live in `node_modules/next/dist/docs/` | [V] `package.json`, `node_modules/next/package.json`, `AGENTS.md` |
| UI runtime | **React 19.2.4**, react-dom 19.2.4 | [V] installed versions |
| Language | **TypeScript 5.9.3**, `strict: true`, `allowJs: true` (tests import the `.mjs` catalogue), alias `@/* → src/*` | [V] `tsconfig.json` |
| Styling | **Tailwind 4.3.0**, configured in CSS (`src/app/globals.css` `@theme inline`). `tailwind.config.ts` still loaded via `@config` for font families. Scoped "cinematic" design system under `.cinematic-root` | [V] `globals.css:1-83`, `tailwind.config.ts` |
| Components | Feature folders in `src/components/*`. Pure UI-shaping modules sit next to their components (`catalog/catalog-item.ts`, `catalog/catalog-sort.ts`). Shared overlay layer `src/lib/overlay/*` + `src/components/ui/dialog.tsx` | [V] file tree |
| 3D / animation libraries | **None installed.** No three, R3F, drei, framer-motion, GSAP or Lenis. The only `<canvas>` use is the PDF reader | [V] `node_modules` probe; survey |
| Package manager | **npm 11.8.0**, `package-lock.json`, Node **v24.13.1** locally. CI uses Node 24; Vercel project `nodeVersion: 24.x` | [V] `npm -v`, `.github/workflows/ci.yml`, Vercel API |
| Database | Neon Postgres via Drizzle 0.45 / drizzle-kit 0.31. Two databases: `neondb` (production) and `bookstore` (sandbox, what `.env.local` points at) | [V] `.env.local` DB name; `AUDIT/VALICE-PRESS-SITE-ARCHITECTURE-AUDIT.md` §1 |
| Auth | Clerk (`@clerk/nextjs` 7.4), applied through `src/proxy.ts`. A cookieless GET on a public page bypasses Clerk | [V] `src/proxy.ts:96-114` |
| Payments (secondary for this work) | Lemon Squeezy (`src/lib/payments/lemonsqueezy/*`). Paddle is retired, though `memory/PAST_DECISIONS.md` still says Paddle (stale) | [V] |
| Observability | Vercel Analytics + Speed Insights, mounted by `AnalyticsGate`. Sentry is DSN-gated (`src/instrumentation-client.ts`, traces 0.1, no Replay). Custom events go to `/api/events`, which drops any name not in the allow-list | [V] survey; `src/lib/analytics.ts` |
| Tests | Vitest 4 (jsdom, no setup files, `e2e/**` excluded). Playwright 1.62.1 (`e2e/*.pw.ts`, **not in CI**, every context `reducedMotion: "reduce"`). axe-core in `e2e/quality.pw.ts`. Lab scripts: `qa:desktop`, `perf:weight`, `mobile:*` (Redmi over adb) | [V] `vitest.config.ts`, `playwright.config.ts:36` |
| CI | GitHub Actions on push/PR to `main`: lint → `tsc --noEmit` → `npm test` → (`db:migrate` on push to `main`) → `next build` | [V] `.github/workflows/ci.yml` |

### 2.2 Routing relevant to this work

| Route | Implementation | Rendering |
|---|---|---|
| `/books` | `src/app/books/page.tsx`: `listPublishedBooks()` → `toCatalogItems()` → `<CatalogHero>` (holds the page's only `<h1>`, `catalog-hero.tsx:85`) → `<CampaignCountdown>` → `<CatalogShell books>` | `○` static + ISR 1 h. Verified in this session's build output [V] |
| `/ebooks` | **Also uses `<CatalogShell>`** (`src/app/ebooks/page.tsx:68`), so the shell must not change behaviour for `/ebooks` | ISR |
| `/books/[slug]` | Book page: hero, editions `FormatTable` (Amazon rows), Look Inside, … | ISR |
| `/categories/[slug]` | Collection pages, M:N membership | ISR |
| `/search` | `force-dynamic`, Postgres FTS (`searchBooks`), noindex | dynamic |
| `/` | `src/app/page.tsx`. Cinematic homepage; **not to be changed** | `○` static + ISR 1 h |

**Header** (`src/components/home/cinematic-header.tsx`):
- Nav order: All books, Ebooks, Authors, Categories, Blog, Library (`/account/library`), About. Shown inline at `xl` (≥ 1280 px); below that, a drawer (`mobile-nav.tsx`). [V]
- Search is a link pill to `/search`, plus ⌘/Ctrl-K. It is not an input. [V]
- The reference's header is this header.

### 2.3 Catalogue architecture

```
scripts/catalog/valice-catalog.mjs      SOURCE OF TRUTH — 37 records (36 published, 1 draft: ridge-runner), 7 collections
        │  scripts/catalog/load-catalog.mjs   dry run by default; production needs explicit flags
        ▼
Neon Postgres  books · book_formats · categories · book_categories · authors · book_authors
        │  src/lib/db/queries/catalog.ts   readPublishedBooks() (:109) → listPublishedBooks() (:194), safeQuery fallback to []
        ▼
BookCardData[] ──► toCatalogItems() (src/components/catalog/catalog-item.ts:200) ──► CatalogItem[]
        ▼
/books: <CatalogShell> (client) ─► <CatalogBookCard> / <CatalogListRow> ─► <QuickView> (shared <Dialog>)
```

- Production's database holds the 36-book catalogue. The live `https://valicepress.com/sitemap.xml` lists exactly the 36 published slugs, and no `ridge-runner`. The live `/books` HTML holds 12 book anchors, page 1 of the grid. [V]
- `src/` never imports the catalogue file; it reads the database. A catalogue change reaches the site only after a catalogue load and the 1-hour ISR window. [V] grep; architecture audit §3.

### 2.4 Assets

| Asset | Location and facts | Evidence |
|---|---|---|
| Covers | `public/images/books/<slug>.webp`: 37 files, 1000–1600 × 1500–2400 px, 46–489 KB, **6.91 MB** total | [V] measured |
| Cover thumbs | `public/images/books/thumb/<slug>.webp`: 37 files, **432 × 648–691 px**, 9–93 KB, **1.58 MB** total. Built by `scripts/assets/build-cover-thumbs.mjs`; required per published book by `validate-catalog.mjs:222-227`; used by the homepage marquee (`book-marquee.tsx:64`) | [V] |
| Manifest | `src/lib/asset-manifest.json` (slots: book-cover 37, book-thumb 37, book-back 27, book-preview 132, book-quote 74, …). Resolved through `src/lib/asset-map.ts` (`bookCoverSrc`, `assetSize`, `assetOrNull`); `npm test` fails if it is stale | [V] |
| Caching | `/images/:path*` → `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` | [V] `next.config.ts:141-142` |
| Proxy | `.webp` and `/_next/*` requests **bypass** the proxy, so no rate limit. `.json` does **not**, so it would hit the Upstash limiter (100 req / 10 s) | [V] `src/proxy.ts` matcher |
| Deploy ignore | `/images/` (repo root) is excluded from CLI uploads; `public/images` is not. Root-anchored on purpose | [V] `.vercelignore` |

### 2.5 Build, deployment, integrations

| Item | Fact | Evidence |
|---|---|---|
| Vercel project | `valicepress-book-site`, framework `nextjs`. Domains: `valicepress.com`, `www.valicepress.com`, plus vercel.app aliases | [V] Vercel API |
| Production deploy method | **Vercel Git integration**. Every production deployment listed (12) has `githubCommitRef: "main"`. The current one reports `source: "git"` | [V] Vercel API |
| Current production | `dpl_EHTSByx5p1uVYRpzYnNwixrQQjSN` = `main@7140f31`. Region `iad1`. Build ≈ 79 s (`buildingAt` → `ready`) | [V] |
| Previous production | `dpl_HKyjr5gdrd78ZoLgVMW1MFjrmR4X` = `main@d3a7ca9`, `isRollbackCandidate: true` | [V] |
| Preview protection | `ssoProtection: all_except_custom_domains`. Preview URLs need Vercel Authentication (`vercel curl` or a logged-in browser) | [V] |
| CSP | Strict `script-src` with **no `'wasm-unsafe-eval'`**, so WASM decoders (Draco, KTX2/Basis) are blocked in production. `worker-src 'self' blob:`, `img-src 'self' data: blob: https:` | [V] `next.config.ts:19-47` |
| Sentry build plugin | Uploads source maps only when `SENTRY_AUTH_TOKEN` is set. It is not set locally | [V] `next.config.ts`; env key names |

**Local environment note.** `.env.production.local` is a `vercel env pull` file in which every secret, including `DATABASE_URL`, is a redaction placeholder. Next.js loads it **ahead of** `.env.local` for `next build`. [V]
- So a plain local `npm run build` compiles correctly but pre-renders catalogue pages from an empty result: 169 `safeQuery` warnings in this session's build.
- To verify a build *with data*, export `.env.local` into the process environment first. Process env beats every file. [R]
- The e2e server (`scripts/e2e/serve.mjs`) refuses to start unless `DATABASE_URL` is the sandbox `bookstore`. [V]

### 2.6 Git state found, and what was done with it

| Fact | Detail |
|---|---|
| Starting point | `main` @ `d3a7ca9`. No tracked modifications. Six untracked user files: `VALICE_PRESS_MASTER_WRITING_CANON.md`, `master_prompt.md`, `docs/KDP_INDEPENDENT_AUTHOR_GROWTH_ECOSYSTEM_2026*.html` (2), `images/book-details-page.png`, `images/yeni-kütüphane-sistemi.png` [V] |
| Divergence | Local `main` is **21 behind, 0 ahead** of `origin/main` (`7140f31`, 2026-10-09). `git fetch` confirmed there is nothing newer on GitHub [V] |
| Worktrees | Five linked worktrees, **all prunable**: their directories (`~/Downloads/valice-*`) no longer exist. The site update was built in one of them [V] |
| Path check | `/home/emre/Downloads/Valice-Press-Site` does **not** exist. `/home/emre/Downloads/VALICE-PRESS-SITE` is the repository [V] |
| Action taken | `git switch --no-track -c feat/spiral-library origin/main`. None of the six untracked files is tracked on `origin/main`, so none could be touched. Local `main` still points at `d3a7ca9`. Nothing was reset, cleaned, stashed or overwritten [V] |
| Environment actions | `npm ci` (to match `origin/main`'s lockfile, which adds `@playwright/test` and `axe-core`); `next typegen` and `next build` (regenerate the ignored `.next/`). Tracked files unchanged afterwards (`git diff --stat` empty) [V] |

---

## 3. Visual reference analysis

**Source.** `images/yeni-kütüphane-sistemi.png`, PNG 1706 × 922, RGBA, SHA-256 `ca370e11…67e5`. Untracked. Byte-identical to the image attached to the brief. [V]
- Examined at full frame and in six zoomed crops: header, Romance tier, middle tiers, base and floor, left environment, label detail.
- Colours and luminance below were sampled from pixels. Geometry figures are read off the 1706 × 922 frame and are approximate. [V]

### A. Composition

- **Central column.** Horizontally centred, roughly **40–42 % of the frame width** (visual estimate: about 670 px at the top visible ring, widening to about 730 px at the floor). Under the header it fills the full height, and it continues above the frame (a partial tier shows behind the header bar). That is what makes it read as monumental.
- **Tiers.** Four complete tiers plus a partial top tier.
  - The gold label lettering sits at y ≈ 120, 335, 547 and 736 px (cap height 11–12 px). **Tier pitch is 189–216 px, mean ≈ 205 px, about 22 % of the frame height.** [V]
  - Each tier is a dark canopy band (the fascia) carrying the collection name, a warm light strip under the band's lip, and a row of books standing on the ring below.
- **Perspective.** The rings read as horizontal circles. Above eye level their near edge arches (∩); below eye level it dips (∪). The third band is almost straight.
  - So the camera's eye level is about 59 % of the way down the frame, pitched slightly downward (the silhouette widens towards the base).
  - Distortion is low, the look of a long lens.
- **Base.** The bottom tier sits in a circular well cut into a polished marble floor ringed by concentric inlay bands.
- **Surroundings.** A circular, multi-gallery rotunda (two or three levels):
  - arched windows showing a blue night sky (the frame's only cool hue);
  - warm sconces and candles, hanging ivy;
  - reading desks with lamps and open books, leather armchairs, potted trees.
  - All of it is softly defocused (shallow depth of field) and symmetric about the column.
- **Balance.** The column is the brightest structure. Mean luminance (0–255) is **64.3** on the column band, **49.7 / 49.3** in the left and right backgrounds, and **24.7** in the header. [V] The environment frames the column and never competes with it.

### B. Book display

- **Front arc.** Each tier's front shows **three large face-out covers** of about 105 × 160 px (≈ 6 % of the frame width each). They are real Valice Press titles, recognisable:
  - Romance: *Weather Permitting*, *The Sweetest Season*, *The Long Way Back*.
  - Then *World Games*, *Codex Bestiarium*, *How the World Began*, *Pencil & Paper*.
- **Flanks.** Spines, plus a few angled face-out covers that follow the curvature. Legibility falls off towards the silhouette, and the back of the ring is never seen.
- **Orientation.** Covers face radially outward, flat against the ring. The central three receive the most light and attention, so the hierarchy is: centre covers, then flank covers, then spines, then the environment.
- **Labels.** Upper-case, widely letter-spaced serif in warm gold, centred on the front of the fascia between two small four-point star ornaments (✦).
- **Discrepancies with the catalogue.** [V]
  - The reference's collections *Adventure & Mystery*, *Science & Ideas* and *Fantasy* **do not exist**; the catalogue has seven others.
  - Author lines painted on the generated covers are unreliable. The image shows "Quinn Gallagher" on *The Long Way Back*; the catalogue says Harper Hayes.
  - The reference's rings are packed with hundreds of books. The catalogue has 36.
  - The implementation must take titles, authors, covers and collections from data, never from the image.

### C. Lighting and materials

- **Key light.** A warm cove light under each fascia lip washes down onto the covers. At its brightest it samples **#FDEFC4** [V], with a bloom-like glow.
- **Fascia and lettering.** The fascia is dark lacquered wood, median **#26190F** [V]. The lettering is warm gold, brightest **#FBF4B5** [V]. Brass accents.
- **Header.** Near-black **#100F0D** (median) [V], opaque, no visible blur.
- **Floor.** Polished stone with soft reflections. Background lamps make bokeh.
- **Readability.** Covers are lit from the front with high contrast. The background is darker and blurred.

### D. Website integration

- The header is the existing `CinematicHeader`: emblem plus wordmark plus tagline, nav with **ALL BOOKS active**, a search pill, cart, Sign in. **The reference is a `/books` design.**
- Below the header, the library fills the whole viewport. No filters, grid or text are visible.
- Phase 2 must therefore add the conventional controls (collection rail, view toggle, rotation buttons) as quiet HTML overlays, and keep the full conventional catalogue *below* the library, not inside it.

### E. Interaction opportunities

| Reliable to implement | Expensive, inaccessible or unnecessary — avoid or fake |
|---|---|
| Camera descending shelf by shelf, bound to native page scroll | Real-time reflections on the marble. Use a pre-blurred or baked floor texture or a gradient |
| Collection labels as navigation targets (mirrored in an HTML rail) | Real-time shadows. Use baked contact-shadow gradients under each fascia |
| Hover emphasis on one cover: light lift plus a small forward move | Depth-of-field post-processing. Use a pre-blurred backdrop |
| Click or tap opens the existing Quick View | A modelled rotunda with thousands of background books |
| Rotating one tier to reveal more books: buttons, drag, arrow keys | 3D text meshes for labels. Use a canvas texture for decoration; the readable name is HTML |
| Step navigation for reduced motion | Volumetric light shafts, particle dust, physics |
| | **Filler books.** Spines with no title are not on the catalogue. A shelf of invented books is the defect this catalogue exists to prevent (`catalog-item.ts:1-19`) |

---

## 4. Current catalogue and book data flow

### 4.1 Fields that reach `/books` today

`readPublishedBooks()` (`catalog.ts:109`) → `BookCardData`, then `toCatalogItems()` (`catalog-item.ts:200`) → `CatalogItem` (`catalog-item.ts:34`):

| Field | Available | Notes |
|---|---|---|
| `id`, `slug`, `title`, `subtitle` | yes | **All 36 books have a subtitle (20–193 characters)** [V], enough for the hover card |
| `author` | yes | First author's name only (multi-author public-domain editions show the original author first) |
| `coverSrc` | yes | `/images/books/<slug>.webp` from the manifest (`catalog-item.ts:225`) |
| `panels` | yes | Quick View gallery (`@/lib/book-media`) |
| `editions[]` | yes | `{format, availability, fulfillment, priceCents, currency, amazonUrl, pageCount}`; `unavailable` rows dropped; direct ebook plus Kindle split (`catalog.ts:95`, `kindle-editions.ts`) |
| `formats` | yes | `FormatKey[]` derived from editions (Digital/PDF/EPUB/Kindle/Paperback/Hardcover/Large Print) |
| `hasEpub`, `pageCount`, `buyableHere`, `deliverableFree` | yes | |
| `category` (primary) | **partial** | Only the **alphabetically first collection *name*** (`catalog.ts:182`). 18 published books belong to two collections, and alphabetical-first files Kwaidan or British Goblins under "Classics & Philosophy" |
| **all collection slugs** | **missing** | Needed for the shelves. See §6 |
| `description` | **not on the list query** | Only `getPublishedBookBySlug` selects it. Not needed: the hover uses the subtitle; the full text stays on the book page |
| `amazonAsin` | not carried to the client | Not needed. `amazonUrl` is the link |
| rating | always 0 | Never invented (`PAST_DECISIONS.md`) |

### 4.2 How Amazon links are represented and protected [V]

- **Storage.** Per edition: `book_formats.amazon_asin` / `amazon_url` (`src/lib/db/schema.ts:361-362`), with `fulfillment: "direct" | "amazon"` and `availability`.
- **Creation.** Only from a verified ASIN: `const amazon = (asin) => \`https://www.amazon.com/dp/${asin}\`` (`valice-catalog.mjs:63`). An Amazon Attribution URL may replace one per edition, pasted whole.
- **Loader gates** (`load-catalog.mjs`). It refuses:
  - a URL without an ASIN (`:160`);
  - an ASIN without `kdp: live/publishing` (`:170`);
  - an available Amazon edition without a URL (`:175`).
- **Test gates.** `scripts/catalog/catalog-identity.test.ts` requires the exact `/dp/<ASIN>` form, unique ASINs, and no direct sale of a KDP Select ebook.
- **World check.** `scripts/catalog/verify-amazon-asins.mjs --catalog` read every live page. Result: **55/55 `ok` on 2026-10-07 and 2026-10-08** (`AUDIT/AMAZON-LINK-AUDIT-2026.md`).
- **Rendering.** Quick View (`quick-view.tsx:386-401`): `target="_blank"`, `rel="noopener noreferrer"`, an accessible name stating the edition and the new tab, and an `amazon_click` analytics event. Also the book page's `FormatTable`.

**Conclusion:** the existing generic per-edition field *is* the verified Amazon destination. **No new field and no migration.** [R]

### 4.3 The library's view of it, computed from the real catalogue [V]

`buildLibraryShelves()` (Phase 1) over the 36 published records, run through the same edition pipeline production uses:

| Shelf (top to bottom) | Books | With an Amazon edition | Without |
|---|---|---|---|
| Romance | 4 | 4 | 0 |
| Myth & Folklore | 14 | 8 | 6 (Kwaidan, The Fairy Mythology I and II, British Goblins, The Book of Were-Wolves, Sea Monsters Unmasked) |
| Games & Play | 8 | 5 | 3 (Traditional Games, Chess and Playing Cards, Mancala) |
| Puzzle & Challenge | 4 | 4 | 0 |
| Language & Learning | 3 | 3 | 0 |
| Classics & Philosophy | 3 | 2 | 1 (Meditations) |
| **Total** | **36** | **26 (55 editions)** | **10** |

- Cross-shelf collection: **Young Explorers**. Unshelved: **0**.
- **55 offered editions = the Amazon audit's 55 verified ASINs**, two independent counts that agree.
- **The 10 without Amazon** are all `directSale: true` with a Lemon Squeezy variant and an available direct ebook. [V] They *can* be bought, here.

**Missing-link state [R].** Never synthesise a URL. Show "Not on Amazon", then:
- **Buy the digital edition** when `buyableHere` (the existing direct flow through `/books/[slug]`);
- **Full details** always.

**Default Amazon edition [R].** Quick View's order, Kindle → Paperback → Hardcover → Large Print.
- The free-book email uses print-first (`selectAmazonEditions`, `src/lib/db/queries/free-books.ts`).
- That is an owner choice; see §13.

---

## 5. Recommended technical architecture

### 5.1 Options, judged on this repository

| Option | Strengths here | Weaknesses here | Verdict |
|---|---|---|---|
| **CSS 3D transforms** (`preserve-3d` ring of `<img>`) | Native lazy images, real anchors, no new dependency | No real lighting, glow or depth. One composited layer per cover; this project already measured large animated layers freezing the renderer (`PAST_DECISIONS.md`, "will-change"). Safari `preserve-3d` quirks. A continuous camera descent through six rings is awkward | Rejected for the main view |
| **three.js + React Three Fiber** | Real perspective and light, one canvas, shared geometry, `frameloop="demand"`, raycast pointer events, React state shared with Quick View and the hover card. R3F 9.8.x peers `react >=19 <19.4` and `three >=0.156`, satisfied by React 19.2.4 [V] | A new dependency (≈ 18 lockfile entries [V]); bundle cost on `/books`; needs WebGL 2 (three r163+) | **Chosen** |
| Vanilla three.js | Fewer abstractions | Imperative glue to keep React state, events and render-on-demand in sync. More hand-written code for the same result | Not chosen |
| **Hybrid** (canvas + HTML) | Text, controls, links and purchase stay accessible, indexable, translatable and testable with the existing Playwright, axe and overlay infrastructure | Two layers to keep aligned (the hover card follows the projected cover) | **Chosen as the overall shape** |
| Something already in the repo | Nothing applicable. No 3D library is installed; motion today is CSS keyframes plus the Web Animations API (`marquee-motion.tsx`) | — | — |

### 5.2 Dependencies [R]

| Package | Version (exact pin) | Published | Why |
|---|---|---|---|
| `three` | `0.186.1` | 2026-09-24 | Renderer, math, materials |
| `@react-three/fiber` | `9.8.1` | 2026-09-24 | React renderer for three. 9.8.2 is newer but only 8 days old |
| `@types/three` (dev) | `0.186.0` | 2026-09-11 | Types |

**Verification so far.** A lockfile-only resolution in a scratch copy (with fiber 9.8.2) succeeded: **18 new entries, 0 existing entries changed, no peer conflicts.** [V]
- The same check with 9.8.1 was not run; the call was declined in this session.
- 9.8.1 declares identical peer ranges. [V]
- Phase 2 step 1 performs and verifies the real install.

**Not adding** [R]:
- `@react-three/drei`: a large helper set. Labels use a `CanvasTexture`, and a frame-time monitor is about 30 lines.
- `@react-three/postprocessing`: glow is emulated with emissive materials and additive planes.
- WASM decoders: blocked by the CSP anyway.

Revisit any of them only when a specific helper earns its weight (`memory/USER_PROFILE.md`: minimal dependencies).

### 5.3 Scroll technique [R]

- **Native scrolling** over a tall section (about one viewport per shelf) with a `position: sticky` stage under the header.
- Progress comes from a passive `scroll` listener feeding a ref. `useFrame` eases the camera towards that target with a critically damped step and a speed clamp.
- **No `preventDefault` on wheel or touch.** Trackpad inertia, the keyboard, the scrollbar, Find-in-page and history restoration keep working. After the last shelf, the document simply continues.
- This is the "must not prevent ordinary scrolling" requirement, met by construction.

### 5.4 Rendering only when needed [R]

- `frameloop="demand"`. `invalidate()` on scroll-progress change, hover change, texture arrival and resize.
- Pause when:
  - the section is off-screen (IntersectionObserver);
  - an overlay is open (`useOverlayOpen()`, `src/lib/overlay/use-overlay.ts:174`). Quick View locks scroll and marks `#app-root` inert;
  - `document.visibilityState === "hidden"`.

### 5.5 Separation between scene and page

```
/books  (server component, ISR 1 h)
├─ <CinematicHeader active="books">                       HTML (existing)
├─ <section id="library">  ← client island <SpiralLibrary>
│   ├─ <h1> + intro + view toggle (Library | List)          HTML
│   ├─ <nav aria-label="Shelves"> collection rail            HTML
│   ├─ sticky stage
│   │   ├─ poster (CSS gradient / still) until the canvas is ready   HTML
│   │   ├─ <LibraryCanvas> (dynamic import, ssr:false)      WebGL: column, rings, covers, light, camera
│   │   └─ hover card (positioned over the projected cover) HTML, aria-hidden duplicate of the list text
│   ├─ shelf controls (◀ ▶ rotate, "5–11 of 14")            HTML buttons
│   └─ accessible shelf list (h2 per shelf, buttons/links per book)   HTML (SSR) — SEO, screen readers, list mode
├─ <CatalogShell books>  "All books" grid/list with filters   HTML (existing, unchanged)
├─ <QuickView>  (existing, shared <Dialog>, portal #overlay-root)
└─ <HomeFooter>
```

---

## 6. Proposed component and data architecture

### 6.1 Existing code to reuse (unchanged unless stated)

| Need | Existing code |
|---|---|
| Catalogue rows | `listPublishedBooks()` `src/lib/db/queries/catalog.ts:194`. One additive change, §6.3 |
| UI shape | `CatalogItem`, `toCatalogItems()` `src/components/catalog/catalog-item.ts` |
| Ordering | `byPinnedRank` (`src/lib/pinned-books.ts`) and `byNewest` (`src/lib/shelf-order.ts`), already applied by the query. The library preserves input order |
| Book detail and purchase | `QuickView` `src/components/catalog/quick-view.tsx`, on `Dialog` `src/components/ui/dialog.tsx`. One opt-in prop, §6.3 |
| Overlay coordination | `useOverlayOpen()`, `lockScroll()` (`src/lib/overlay/*`). Never write `body.style.overflow` directly |
| Assets | `assetSize`, `assetOrNull`, `bookCoverSrc` (`src/lib/asset-map.ts`); thumbs (`public/images/books/thumb/`) |
| Labels | `editionLabel` (`src/lib/format-badges.ts:148`), `formatCatalogPrice` (`src/lib/format.ts`) |
| Reduced motion | `usePrefersReducedMotion()` (`src/components/campaign/use-campaign.ts`). Consider moving it to a shared location when a second feature uses it |
| Slow connection | `connectionIsExpensive()` (`src/components/media/ambient-video.tsx`, not exported). Extract and share; do not copy |
| Analytics | `trackEvent` (`src/lib/analytics.ts`). New names must be added to **both** the union and `ANALYTICS_EVENTS`, or `/api/events` drops them |
| Full catalogue and fallback | `CatalogShell` (grid/list, filters, search-in-catalogue, pagination) |

### 6.2 Added in Phase 1 (done)

| File | Exports | Purpose |
|---|---|---|
| `src/components/spiral-library/library-shelves.ts` | `SHELF_ORDER`, `buildLibraryShelves()`, `shelfFor()`, `amazonEditions()`, `isAmazonProductUrl()`, types `LibraryShelves`, `LibraryShelf`, `LibraryBook`, `LibraryInput`, `ShelfCategory`, `AmazonEdition` | The data adapter: real `CatalogItem`s become shelves (one shelf per book, no empty shelf, no lost book), with the texture source and manifest aspect, and the verified Amazon editions (or an empty list, the missing-link state) |
| `src/components/spiral-library/render-mode.ts` | `chooseRenderMode()`, `canCreateWebGL2()`, types `RenderEnvironment`, `RenderMode` | The fallback contract: WebGL or list; high or low quality; full or reduced motion. Pure, so every branch is tested without a GPU |
| `…/library-shelves.test.ts`, `…/render-mode.test.ts` | 16 + 10 tests | Run against **the real catalogue** (`valice-catalog.mjs`) through the production edition pipeline. Mutation-checked: moving `young-explorers` up the order, and dropping Kindle editions, each fail the intended test [V] |

**Shelf assignment rule.**
- `book_categories` has no order column, so the database cannot say which collection is primary.
- The catalogue lists the primary collection first. `SHELF_ORDER` is written so that "first of its collections in `SHELF_ORDER`" equals "first in its catalogue record" for all 36 published books.
- A test fails the day a new book breaks that, forcing a human decision.

### 6.3 Changes to existing code proposed for Phase 2 [R]

1. **`readPublishedBooks()`.** Select `category: { columns: { slug: true, name: true } }` (today only `name`, `catalog.ts:151`).
   - Return `categorySlugs: string[]`, a new **optional** field on `BookCardData`.
   - Map it through `CatalogRow` and `CatalogItem` (optional).
   - Additive; every other consumer ignores it.
2. **`QuickView`.** Add `prefer?: "amazon"`.
   - Initial `selected` becomes the first `fulfillment === "amazon"` edition when one exists (today it is index 0 in ebook-first order, `quick-view.tsx:107-114`).
   - Default behaviour unchanged, so `/books` grid and `/ebooks` are unaffected. Covered by `quick-view.test.tsx`.
3. **`src/app/books/page.tsx`.**
   - Build `buildLibraryShelves(items, categories)` on the server; categories come from `listAllCategories()` or from the rows.
   - Render `<SpiralLibrary>` above `<CatalogShell>`.
   - Move the page's single `<h1>` into the library section, or keep `CatalogHero`'s, but never two.
4. **`src/lib/analytics.ts`.** Add `library_view`, `library_mode` (`renderer`, `quality`, `motion`), `library_shelf_view`, `library_book_open`. Keep the props non-PII and ≤ 12 (`/api/events` limits).
5. **`e2e/helpers.ts:53`.**
   - `firstBookCard` = the first `ul a[href^="/books/"]` on the page. An accessible library list of book links placed before the grid would silently retarget `catalog.pw.ts` and `overlays.pw.ts`.
   - Scope it to the grid (for example `[data-catalog-grid]`), or give the library list a structure that does not match.

### 6.4 New in Phase 2 [R]

```
src/components/spiral-library/
  library-shelves.ts          (Phase 1)  what stands on the shelves
  render-mode.ts              (Phase 1)  which library a visitor gets
  library-geometry.ts         pure ring and camera math: angle per book, shelf heights, camera stop per shelf, ring capacity — tested
  spiral-library.tsx          "use client" island: mode choice, state (activeShelf, rotation per shelf, hovered, selected), HTML chrome, Quick View
  library-canvas.tsx          R3F <Canvas> (loaded with next/dynamic { ssr:false } from the island — Next 16 allows ssr:false only in Client Components [D] lazy-loading.md:66,94-95)
  scene/column.tsx            column core + pilasters
  scene/shelf-ring.tsx        board, fascia (canvas-texture label), light strip, ornaments, bookends
  scene/book-cover.tsx        one cover: shared box geometry, texture, hover state
  scene/camera-rig.tsx        scroll progress → damped camera
  scene/environment.tsx       backdrop + floor + fog
  scene/use-cover-textures.ts prioritised loading (current shelf first), disposal, aspect from the manifest
  scene/frame-monitor.ts      frame-time percentiles → DPR step-down → quality downgrade → list suggestion
  collection-rail.tsx         <nav> of shelves + cross-shelf collections
  hover-card.tsx              title, author, subtitle, formats, "On Amazon" / "Sold here"
  library-list.tsx            SSR-able accessible list (and the list mode)
```

**Data flow.**
1. The server page calls `listPublishedBooks()`, then `toCatalogItems()`, then `buildLibraryShelves()`.
2. Props go to `<SpiralLibrary>`; the same items go to `<CatalogShell>`.
3. In the client, `chooseRenderMode(env)` runs, and then either `<LibraryCanvas>` (lazy) or list mode.
4. Interactions update island state. Selection renders `<QuickView book={item} prefer="amazon">`.
5. Purchase is the existing Amazon link in a new tab, or the existing direct flow.

**Payload check [U].** Passing the shelves (which contain the `CatalogItem`s) *and* the item list to two client islands may serialise the 36 items twice in the RSC payload.
- Measure with `npm run perf:weight` in Phase 2.
- If it matters, pass the library slugs only, and share the items through one small client provider wrapping both islands.

---

## 7. Interaction specification

### A. Vertical scroll and camera
- The section height is about one `100svh` per shelf, plus a short lead-in and lead-out. The stage is sticky below the header.
- Each shelf has a camera stop: eye height at the shelf's cover centre, slightly above the board, looking a little downward. Progress between stops eases with a critically damped step.
- Clamp camera speed; never overshoot a shelf.
- Full motion allows a gentle yaw of at most about 4° in transit. Nothing moves when the reader is not scrolling.
- **Back up:** scrolling up reverses the path. The rail and Home/End/Page keys work natively.
- **A skip link** before the section: "Skip the library — go to the full catalogue" (`#all-books`).

### B. Shelf transitions
- The active shelf's fascia light rises to full; neighbours dim a little and stay visible.
- A polite live region announces "Myth & Folklore — 14 books" once per arrival, debounced.

### C. Collection navigation
- **The rail** lists the shelves in order (6), then cross-shelf collections (Young Explorers).
- Activating a shelf calls `scrollTo` its stop (instant under reduced motion) and records `?shelf=<slug>` with `history.replaceState`, so the view is shareable.
- A cross-shelf collection dims non-members, scrolls to the first shelf holding one, and offers "See all in Young Explorers" (`/categories/young-explorers`).
- **Big shelves.** The ring's front arc shows a capacity (§8: about 7 desktop, about 3 phone).
  - Myth & Folklore (14) and Games & Play (8) rotate to reveal the rest: ◀ ▶ buttons, Shift+wheel or horizontal drag on desktop, horizontal swipe on touch, ←/→ when a book in that shelf has focus.
  - Indicator: "5–11 of 14".
- **The whole catalogue** is always reachable:
  - the view toggle (Library | List);
  - the existing grid with filters directly below the library;
  - the header's search.

### D. Desktop hover preview
- Raycast on pointer move. The hover target is the whole cover plane plus a small margin, so precision is not required.
- **The hovered cover** gets an emissive lift and moves about 3 % of cover height towards the viewer. Neighbours do not move, so there is no layout shift.
- **The hover card** (HTML) is placed beside the cover's projected rectangle and flips side near edges. It holds:
  - title, author;
  - subtitle (clamped to three lines);
  - format chips (`item.formats`);
  - a line "On Amazon: Kindle · Paperback" or "Sold here as a DRM-free digital edition".
- A 120 ms intent delay on enter, 80 ms on leave. The card is not interactive and contains no links.
- Hover never navigates and never opens Amazon.

### E. Book selection and details
- Click, tap, Enter or Space on a book opens the **existing Quick View** with `prefer="amazon"`. Its contents: gallery, title, subtitle, author, facts, editions with prices, CTAs.
- Close with Escape, the close button, the backdrop or Android Back (existing `Dialog`). Focus returns to the book's HTML control.
- "Full details" links to `/books/[slug]`.
- On desktop, ⌘/Ctrl-click opens the book page in a new tab. The accessible list's real links already allow this.

### F. Amazon purchase actions
- One explicit button, Quick View's existing **"Buy on Amazon"** (label decision in §13), for the selected edition.
- It opens a new tab with `rel="noopener noreferrer"` and an accessible name that states the edition and the new tab, and fires `amazon_click`.
- Edition chips switch the destination.
- **Missing link** (10 books): no Amazon button. "Buy the digital edition" when `buyableHere`, plus "Full details".

### G. Touchscreens
- **Tap** a cover to open Quick View directly. There is no hover card on touch.
- The canvas sets `touch-action: pan-y`, so vertical swipes scroll the page natively.
- A horizontal drag beyond a 12 px threshold rotates the active shelf.
- Controls are at least 44 px, and none sit in the bottom-right 88 px owned by the assistant launcher (`PAST_DECISIONS.md`; `assistant-launcher.tsx:139`).

### H. Keyboard
- The canvas is `aria-hidden` and not focusable.
- The **accessible shelf list** is the keyboard surface: an `<h2>` per shelf and one control per book, in shelf order, styled as a focus ring overlay or kept visually hidden but focusable.
- Focusing a book rotates its ring to bring it to the front and highlights it in 3D. Enter opens Quick View.
- Tab order: skip link → view toggle → rail → current shelf's books → rotation controls → next shelf …

### I. Screen readers
- Structure comes from the HTML list. Each book's name reads like "*Weather Permitting* by Quinn Gallagher — on Amazon: Kindle, Paperback".
- The live region announces shelf changes only.
- The list is server-rendered, so it is present without JavaScript and for crawlers. Today `/books` HTML links only 12 books, because pagination is `<button>`s. The list would link all 36.

### J. Reduced motion
- The library stays 3D unless the reader chooses the list.
- No camera follows the scroll. The section uses one scroll-snap stop per shelf, and the camera *cuts*, or cross-fades in at most 150 ms, to the shelf.
- No idle animation. Hover changes light only, never position.
- `scrollTo` is instant.
- Playwright already runs every context with `reducedMotion: "reduce"` (`playwright.config.ts:36`), so this path gets the existing coverage. The full-motion path needs a new project (§11).

### K. Loading and fallback
1. **Server HTML:** heading, rail, accessible list, a static poster in the stage, and the grid below.
2. **After hydration:** gather the environment and call `chooseRenderMode`.
3. **List mode:** no canvas download. The poster is replaced by the list presentation.
4. **WebGL mode:** a lazy import (with a skeleton: "Opening the library…"). Cover planes appear immediately at their **manifest aspect** with a neutral tint; textures fade in, current shelf first.
5. **Failures** (import error, context creation failure, `webglcontextlost` without restore): switch to list mode, announce it, record `library_mode`.
6. **Slow frames:** step the DPR down, then switch to low quality, then show a "Switch to the list" hint. Never switch silently mid-interaction.

---

## 8. Visual implementation specification

All measurements below are **illustrative starting values**, to be tuned against the reference in Phase 2. They are not verified results. The unit is **1 = one cover height** (covers are 2:3 to 1:1.6, so a cover is about 0.63–0.67 wide).

| Element | Specification |
|---|---|
| Central column | Core cylinder radius ≈ 2.2, 64–96 radial segments. Dark walnut / black-lacquer standard material. Flat vertical pilasters every 30° (subtle). Extends beyond the top and bottom stops (fog fades it), so it reads as endless |
| Shelf ring | Pitch ≈ 1.9 per tier (cover 1.0 + fascia + air), echoing the reference's tier pitch of about 22 % of frame height at the chosen FOV. Board 0.06 thick. Fascia band height ≈ 0.18, standing proud to radius ≈ 2.75. Cove light strip on the fascia's underside: a thin emissive ring at radius ≈ 2.7, colour `#FDEFC4`. Bookends at both ends of the book run |
| Book placement | Covers tangent to the ring, faces outward, radius ≈ 2.4. Step angle = (cover width + gap) / radius ≈ (0.66 + 0.12) / 2.4 ≈ 0.33 rad ≈ 19°. A front arc of ± 65° holds about 7 covers on desktop; mobile shows about 3. A run shorter than capacity is centred on the front; a longer run pages by rotation. Covers past ± 100° are not drawn |
| Empty arc | Never fake books. Carved panels, brass rails, small lamps, the ✦ ornaments — architecture, not merchandise |
| Labels | Canvas texture (Fraunces, the site's serif via `--font-serif`, upper-case, letter-spacing ≈ 0.2 em, gold `#FBF4B5`) wrapped across the fascia's front arc with ✦ either side. Decorative: the HTML rail carries the readable name (the reference's lettering is only 11–12 px tall) |
| Materials | Wood `#2A1A10`, roughness about 0.55. Brass about `#C9A25C`, metalness 0.8 (the site's gold CTA gradient `.valice-cta-gold` already runs `#F7DEA0` → `#E2C074` → `#C9A25C`, `globals.css:1356-1357`). Covers: true-colour artwork. Textures in sRGB; tone mapping chosen so covers are not washed out (compare `MeshBasicMaterial, toneMapped:false` with a lit standard material in Phase 2) |
| Lighting | One hemisphere light (warm sky, dark ground) and one warm key light from upper front. Per-tier glow from emissive strips. At most 2–3 dynamic lights. **No real-time shadows**: soft contact gradients under each fascia are baked into a texture |
| Camera | Perspective, vertical FOV ≈ 30–35° on desktop (long-lens look), ≈ 40–45° on phone portrait. Distance ≈ 9–10. Pitch ≈ −3° to −6°. Eye at the active shelf's cover centre |
| Environment | (a) A **pre-blurred backdrop** on a large cylinder behind the column, plus a floor disc with concentric inlay and a soft reflection gradient, plus exponential fog; or (b) procedural only: radial gradient, a few dozen bokeh sprites, the same floor. **No existing asset fits**: `public/images/library/library_atmosphere.webp` is a green-tinted corridor with a lantern, the wrong perspective and palette [V]. See §13 |
| Desktop composition | The column takes about 40 % of the viewport width, centred. The rail sits as a slim vertical list on the left at `lg+`. The hover card goes beside the cover. **Header opaque** `#100F0D`-like on this page, as in the reference: the header's `backdrop-blur-xl` over a moving canvas costs GPU every frame |
| Mobile composition | The column takes about 85 % of the width; camera closer; about 3 covers visible per shelf. The rail becomes horizontal chips under the header. Tap opens Quick View. DPR cap 1.5. No hover card |

**Palette measured from the reference [V], for tokens in Phase 2:**

| Use | Value |
|---|---|
| Ground / header | `#100F0D` |
| Fascia (label band) | `#26190F` |
| Label gold | `#FBF4B5` |
| Cove light | `#FDEFC4` |
| Night sky (windows) | cool blue accent, the only cool hue |

**Where tokens go [R].** One TypeScript palette consumed by both the materials and the HTML, applied as CSS custom properties on the section. Not added to the global `@theme` until a second feature needs them.

**Stacking [V].**
- `.cinematic-root` sets `isolation: isolate` and paints a fixed film-grain `::before` with `mix-blend-mode: overlay` (`globals.css:289-349`).
- Over an animating canvas, a full-viewport blend layer is recomposited every frame. **Suppress the grain over the library stage**, or measure its cost first. [R]

---

## 9. Performance strategy

| Risk | Grounding in this project | Mitigation [R] |
|---|---|---|
| Texture memory | RGBA8 with a full mip chain (×4/3): one full cover (1000 × 1600) ≈ **8.1 MB** of GPU memory; the 1600 × 2400 one ≈ 19.5 MB; all 36 ≈ **300 MB**. One 432 px thumb ≈ **1.4–1.5 MB**; all 36 ≈ **53 MB** [V calculation] | Use the existing thumbs. On `quality: "low"`, request 256 px variants through `/_next/image` (default `imageSizes` include 256 and 384; verify in Phase 2), about 0.5 MB each, ≈ 18 MB in total. Full-resolution art stays in Quick View's `<img>` |
| Too many images at once | All thumbs together are **1.58 MB** [V] | A priority queue: the current shelf, then its neighbours, then the rest at idle. Static WebP bypasses the proxy and is cached a day plus a week of stale-while-revalidate [V] |
| Shadows and lighting | — | No shadow maps; at most 2–3 lights; emissive glow; baked gradients |
| Polygons and draw calls | About 36 covers + 6 × (board, fascia, strip, label, bookends) + column + environment ≈ **80–120 draw calls** | Shared geometries and materials; instance repeated ornaments; low-segment cylinders |
| Continuous rendering | — | `frameloop="demand"`; pause off-screen, under overlays and in hidden tabs (§5.4) |
| Weak GPUs and phones | Redmi Note 8 (2021) is the project's real test phone [V, architecture audit §0] | `chooseRenderMode` starts low on coarse pointers, narrow screens, < 4 GB or < 4 cores. A frame-time monitor steps DPR down (2 → 1.5 → 1.25 → 1) before lowering quality |
| Initial load | Today's page loads no 3D code | Load the 3D chunk only when the mode is `webgl`, after hydration (idle), from the client island. **Budget [R]:** island ≤ 15 KB gzip on initial load; 3D chunk measured with `perf:weight` and the build's chunk list |
| Layout instability | The `/books` hero holds the LCP today | Fixed-height sticky stage; poster in the HTML; covers sized from the manifest before pixels arrive; the canvas mounts into a reserved box. CLS target ≤ 0.1 |
| Console noise | `qa:desktop` fails on console **warnings** as well as errors (`desktop-sweep.mjs:60-61`) [V] | No deprecated three APIs; handle context loss quietly; never log in production |
| Interaction plus animation | Overlay locks are ref-counted and restore `scrollY` [V `scroll-lock.ts`] | Pause the scene while locked. The camera follows the restored scroll position, so nothing jumps |
| Main-thread decode | — | Consider `ImageBitmapLoader` where supported; measure first |

**Validation targets for Phase 2.** Proposed, not results.

| Target | How measured |
|---|---|
| No console errors or warnings on `/books`, desktop and phone | `npm run qa:desktop -- --strict` (Chromium + Firefox, 1280/1440/1920); the Redmi via `mobile:*` |
| No broken cover image for any published book | Playwright: every texture request answers 200 with an image MIME type; plus fetch one image from production (the `.vercelignore` lesson) |
| No broken book-page or Amazon link | Existing `scripts/qa/book-matrix.mts`, `e2e/catalog.pw.ts`, `scripts/seo/audit.mjs`; new: every library item's book link answers 200, and every Amazon URL equals the catalogue's |
| No new TypeScript, lint, test or build failures | `npx tsc --noEmit`, `npm run lint`, CI-shape Vitest, `npm run build` |
| Responsive | Playwright desktop-chromium, mobile-chromium (393 px), desktop-firefox; no horizontal overflow at 320–412 px |
| Rendering performance | A dev-only frame recorder in `useFrame` collects frame times over a scripted scroll through all shelves; report median and p95. **Proposed thresholds:** desktop (integrated GPU, 1440 × 900) median ≤ 16.7 ms, p95 ≤ 25 ms; Redmi Note 8 (low quality) median ≤ 33 ms, p95 ≤ 50 ms. Cross-check with a DevTools Performance trace |
| Core Web Vitals | `npm run mobile:cwv` on `/books` (1.6 Mbps profile): LCP ≤ 2.5 s, CLS ≤ 0.1, INP proxy ≤ 200 ms. Speed Insights (real users) after release |
| Usable without WebGL | Playwright with WebGL disabled (Chromium `--disable-webgl`, or stub `getContext`): list mode renders all 36 books, Quick View works, axe has 0 violations |

---

## 10. Phase 1 changes

### 10.1 Files

| File | Status | Why |
|---|---|---|
| `src/components/spiral-library/library-shelves.ts` | **created** (261 lines) | Data adapter and types: shelf assignment, Amazon editions with a URL guard, texture source and aspect (§6.2) |
| `src/components/spiral-library/library-shelves.test.ts` | **created** (268 lines, 16 tests) | Holds the adapter to the real catalogue: every book placed once, no empty shelf, order kept, Amazon editions exactly the catalogue's own, Select titles always linked |
| `src/components/spiral-library/render-mode.ts` | **created** (89 lines) | Fallback and quality contract plus WebGL 2 probe (§7K) |
| `src/components/spiral-library/render-mode.test.ts` | **created** (88 lines, 10 tests) | Every branch, including the Redmi profile, and a probe that releases its context |
| `AUDIT/SPIRAL-LIBRARY-PHASE-1-FOUNDATION-AND-IMPLEMENTATION-PLAN.md` | **created** | This report |
| Any other tracked file | **unchanged** | `git diff --stat` empty [V] |

**Not changed on purpose:**
- `package.json` / `package-lock.json`: no dependency installed. A resolution check was done in a scratch copy.
- `.env*`, `next.config.ts`, the database schema, the catalogue, the homepage, `/books`, `CatalogShell`, `QuickView`.

**Environment actions (no tracked changes):**
- branch `feat/spiral-library` created;
- `git fetch origin`;
- `npm ci`;
- `next typegen` and `next build` (rewrite the ignored `.next/`);
- throwaway helpers in the session scratchpad and git-ignored `scripts/tmp/` (deleted).

### 10.2 Deliberately not implemented

Everything visual and interactive:
- no canvas, geometry, cover placement, camera, lighting or environment;
- no hover card, rail, rotation, scroll binding or Quick View change;
- no route change, analytics events, Playwright tests, or dependency install.

The new modules are imported by nothing outside their tests, so **the site's behaviour is unchanged.** [V] The build output still lists `/` and `/books` as `○` static, 1 h.

### 10.3 Validation run in Phase 1 [V]

| Check | Before changes (branch at `origin/main`) | After changes |
|---|---|---|
| `npm run lint` | exit 0 | exit 0. `eslint src/components/spiral-library --max-warnings=0`: exit 0 |
| `npx tsc --noEmit` | exit 1, **3 errors, all in a stale generated `.next/types/validator.ts`** (left by the 2026-10-01 build of old `main`, naming admin routes this branch removed). After `next typegen`: exit 0 | exit 0, 0 errors |
| Vitest, CI shape (`VALICE_BOOKS_ROOT=/nonexistent npx vitest run`) | exit 0: 78 files / **1,417 passed**, 194 skipped | exit 0: 80 files / **1,443 passed** (+26), 194 skipped |
| `npm test` (plain, this machine) | exit 1: **21 failures, all in `scripts/factory/companion-page.test.js`** | exit 1: the **same 21** failures, same file; 1,588 passed |
| `npm run build` | — | **exit 0**. Compiled in 8.2 s, 25 s total. `/` and `/books` `○` (ISR 1 h). 169 `[catalog] … failed` warnings: `safeQuery` fallbacks, because `.env.production.local`'s `DATABASE_URL` is a redaction placeholder (§2.5). Pre-existing environment, not caused by these files |
| New tests, mutation check | — | `young-explorers` moved to the top fails "stands every published book on the collection its catalogue record lists first" (names *The Great Book of World Myths*). Kindle editions dropped fails "offers exactly the book's own available Amazon editions" (*Codex Mythologica*: 3 vs 4). File restored byte-identical (`cmp`) |
| Package manager consistency | `package.json` and `package-lock.json` unchanged vs `HEAD` | unchanged |
| Homepage | `src/app/page.tsx` unchanged | unchanged |
| Catalogue and covers | `valice-catalog.mjs`, `public/images/**` unchanged | unchanged |
| Production | `dpl_EHTSByx5p1uVYRpzYnNwixrQQjSN` (7140f31) | **not deployed to**. Nothing pushed |

**About the 21 local failures.**
- They are the print factory's companion-page checks. They read built PDFs from the external books tree, which now holds *The Great Book of World Games*' 258-page edition, while the factory plan expects 182/186 pages.
- They fail identically without this work. They are skipped in CI, which has no books tree.
- The earlier architecture audit reports the same 21 (`AUDIT/VALICE-PRESS-SITE-ARCHITECTURE-AUDIT.md` §7).

---

## 11. Phase 2 implementation roadmap

Order is by dependency. Data and fallbacks come first, so every later step is built on real books and is never inaccessible. The brief's fourteen topics are all covered; numbers in brackets refer to them.

### Step 0 — Pre-flight

| Item | Detail |
|---|---|
| **Objective** | Start from the code production runs, with the catalogue and Amazon data re-verified |
| **Files** | none |
| **Dependencies** | GitHub and Vercel access (verified this session); founder access for any catalogue load |
| **Risks** | Building from stale local `main` (§1). Amazon listings changed since 2026-10-08 |
| **Tasks** | (1) Work on `feat/spiral-library`, or rebase it on the then-current `origin/main`. Optionally fast-forward local `main` (owner's call). (2) `node scripts/catalog/verify-amazon-asins.mjs --catalog` (≈ 6 min, read-only). (3) Re-run §10.3's baseline |
| **Acceptance** | `git rev-list --count HEAD..origin/main` = 0; verifier 55/55 ok (or differences resolved in the catalogue first); baseline numbers recorded |

### Step 1 — Foundation and dependency validation [1]

| Item | Detail |
|---|---|
| **Objective** | Install the 3D stack and prove it cannot affect any other route |
| **Files** | `package.json`, `package-lock.json` |
| **Dependencies** | Step 0 |
| **Risks** | Peer-range drift; bundle leaking into shared chunks |
| **Tasks** | `npm install --save-exact three@0.186.1 @react-three/fiber@9.8.1 && npm install --save-exact -D @types/three@0.186.0`. Add a trivial dynamic-imported canvas behind a dev-only switch to confirm the build. Inspect the build's chunks |
| **Acceptance** | `npm ls three @react-three/fiber` clean; lockfile diff limited to the new packages (≈ 18 entries); lint, tsc, tests and build pass; no three code in the chunks of `/`, `/books/[slug]` or `/ebooks` (checked in the build output / `perf:weight`) |

### Step 2 — Real-catalogue integration [11]

| Item | Detail |
|---|---|
| **Objective** | `/books` hands the island the real shelves |
| **Files** | `src/lib/db/queries/catalog.ts` (`readPublishedBooks` category slugs), `src/components/book-card.tsx` (`categorySlugs?`), `src/components/catalog/catalog-item.ts` (carry it), `src/app/books/page.tsx` |
| **Dependencies** | Step 1 not required |
| **Risks** | Touching a query used by about 8 surfaces; RSC payload growth |
| **Tasks** | Add `slug` to the category projection and return `categorySlugs`. Build `buildLibraryShelves` on the server. Measure the payload (`perf:weight`). Extend `library-shelves.test.ts` with a test that the query mapping keeps all collections |
| **Acceptance** | On a sandbox build (`.env.local` exported): 6 shelves, 36 books, 0 unshelved, Young Explorers cross-shelf. Every other route's output unchanged (e2e `catalog`, `cards`). Payload growth recorded |

### Step 3 — Library section, modes and fallbacks [10]

| Item | Detail |
|---|---|
| **Objective** | The section exists and is complete *without* WebGL |
| **Files** | `spiral-library.tsx`, `library-list.tsx`, `collection-rail.tsx`, `src/lib/analytics.ts`, `e2e/helpers.ts` |
| **Dependencies** | Step 2 |
| **Risks** | The duplicate-anchor selector issue (§6.3.5); two `<h1>`s |
| **Tasks** | SSR heading, rail and accessible list; poster stage; mode detection from the existing hooks plus `canCreateWebGL2`; list mode; error boundary; `library_mode` event; skip link; scope `firstBookCard` |
| **Acceptance** | With WebGL disabled, all 36 books listed by shelf with working links and Quick View; axe 0 violations on `/books`; one `<h1>`; existing e2e suites pass |

### Step 4 — Central column and ring geometry [2]

| Item | Detail |
|---|---|
| **Objective** | Static column, six rings, fascia labels and light strips |
| **Files** | `library-geometry.ts` (+ test), `library-canvas.tsx`, `scene/column.tsx`, `scene/shelf-ring.tsx` |
| **Dependencies** | Steps 1 and 3 |
| **Risks** | Over-detailed geometry; label legibility |
| **Tasks** | Pure layout math (stop per shelf, angle per slot, capacity per viewport) tested at two disagreeing widths (`PAST_DECISIONS.md`: "test a scaling law at two points that disagree"); canvas-texture labels |
| **Acceptance** | Visual comparison with the reference at 1440 × 900: column ≈ 40 % of width, tier pitch reading as ≈ 1/4–1/5 of the stage height. Geometry tests pass. Fewer than 60 draw calls before covers |

### Step 5 — Book covers [3]

| Item | Detail |
|---|---|
| **Objective** | Real covers on the rings |
| **Files** | `scene/book-cover.tsx`, `scene/use-cover-textures.ts` |
| **Dependencies** | Step 4 |
| **Risks** | Texture memory; colour management; slow decode |
| **Tasks** | Shared geometry; manifest-aspect placeholders; prioritised loading; sRGB; disposal on unmount |
| **Acceptance** | All 36 covers render from `/images/books/thumb/*` (network log: 36 × 200, image MIME type); no CLS; cover colours visually match the `<img>` in Quick View; GPU texture total ≤ 60 MB (renderer info) |

### Step 6 — Environment and lighting [4]

| Item | Detail |
|---|---|
| **Objective** | Warm, dark rotunda atmosphere without stealing frames |
| **Files** | `scene/environment.tsx`, materials |
| **Dependencies** | Step 5; the backdrop decision (§13) |
| **Risks** | Over-lighting washes covers out; backdrop asset rights |
| **Tasks** | Hemisphere + key light; emissive strips; fog; floor disc; backdrop (procedural, or a new plate per the owner's decision); suppress the film grain over the stage |
| **Acceptance** | Column the brightest region (luminance check like §3); covers legible; frame-time targets still met on desktop |

### Step 7 — Scroll-controlled navigation [5]

| Item | Detail |
|---|---|
| **Objective** | Descend with the page's own scroll |
| **Files** | `scene/camera-rig.tsx`, `spiral-library.tsx` |
| **Dependencies** | Steps 4–6 |
| **Risks** | Scroll jank; trapping; overlay interplay |
| **Tasks** | Tall section and sticky stage; passive listener; damped rig; reduced-motion snap variant; pause under overlays |
| **Acceptance** | Wheel, trackpad, keyboard and scrollbar all move through all shelves and then into the grid with no captured events; reload restores position; opening and closing Quick View never moves the camera |

### Step 8 — Collection navigation [6]

| Item | Detail |
|---|---|
| **Objective** | Jump to shelves; reach every book on big shelves |
| **Files** | `collection-rail.tsx`, ring rotation in the island and scene |
| **Dependencies** | Step 7 |
| **Risks** | Horizontal gestures fighting vertical scroll on touch |
| **Tasks** | Rail with `aria-current`; `?shelf=` deep links; rotation (buttons, Shift+wheel, drag, ←/→, swipe); cross-shelf highlight for Young Explorers |
| **Acceptance** | Every shelf reachable in one action; every book reachable without the grid; `?shelf=games-and-play` lands on that shelf; rotation indicator correct |

### Step 9 — Hover previews and book details [7]

| Item | Detail |
|---|---|
| **Objective** | Hover informs; click opens details |
| **Files** | `hover-card.tsx`, `quick-view.tsx` (`prefer` prop) + `quick-view.test.tsx` |
| **Dependencies** | Step 5 |
| **Risks** | Card flicker; occluding the cover; z-order with the header and launcher |
| **Tasks** | Raycast hover with intent delay; projected placement; Quick View opened from the island; focus return to the HTML control |
| **Acceptance** | Hover never navigates; no layout shift; Escape, backdrop and Android Back close Quick View; focus returns; Quick View tests pass for both `prefer` values |

### Step 10 — Amazon purchase links [8]

| Item | Detail |
|---|---|
| **Objective** | Amazon is the primary purchase action, and only where verified |
| **Files** | `quick-view.tsx`, `hover-card.tsx`, analytics |
| **Dependencies** | Step 9 |
| **Risks** | A label change affecting `/books` grid tests; attribution of clicks |
| **Tasks** | `prefer="amazon"` start edition; the missing-link state for the 10 direct-only books; `amazon_click` carries `source: "library"` |
| **Acceptance** | For the 26 books, the first CTA is the first Amazon edition's URL, equal to the catalogue's, opening a new tab with `noopener noreferrer`. For the 10, there is no Amazon button and the direct path is shown. Playwright asserts both sets |

### Step 11 — Mobile adaptation [9]

| Item | Detail |
|---|---|
| **Objective** | Usable and smooth on the Redmi Note 8 |
| **Files** | island, geometry capacity, rail |
| **Dependencies** | Steps 7–10 |
| **Risks** | Memory; heat; touch conflicts |
| **Tasks** | Low quality by default on touch; 3 covers per front arc; chips rail; tap opens Quick View; 256 px textures if needed |
| **Acceptance** | On the physical phone (`mobile:*` harness): no overflow, median frame ≤ 33 ms, Quick View fit and Back checks pass (`mobile:quickview` against the build, not production) |

### Step 12 — Accessibility completion [10]

| Item | Detail |
|---|---|
| **Objective** | WCAG 2.2 AA |
| **Files** | all library components |
| **Dependencies** | Steps 3–11 |
| **Risks** | Hidden-but-focusable controls; contrast over the canvas |
| **Tasks** | Keyboard map (§7H); live region; contrast ≥ 4.5:1 for card and rail text; reduced-motion audit; zoom to 200 % |
| **Acceptance** | axe 0 violations (`quality.pw.ts` extended); a keyboard-only journey reaches and opens every book; a screen reader announces shelves and books; reduced-motion run shows no continuous motion |

### Step 13 — Performance optimisation [12]

| Item | Detail |
|---|---|
| **Objective** | Meet §9's targets with margin |
| **Files** | `scene/frame-monitor.ts`, texture variants |
| **Dependencies** | Steps 4–11 |
| **Risks** | Optimising blind |
| **Tasks** | Instrument (dev-only); DPR steps; idle preloading; dispose on route change; verify no render while idle (CPU flat in a trace) |
| **Acceptance** | §9 targets met and *measured*, with the method recorded; idle trace shows no frames; `perf:weight` delta for `/books` documented |

### Step 14 — Automated and manual testing [13]

| Item | Detail |
|---|---|
| **Objective** | Proof before release |
| **Files** | `e2e/library.pw.ts` (new); a Playwright project with `reducedMotion: "no-preference"` for the library; Vitest for geometry, mode and shelves |
| **Dependencies** | All of the above |
| **Risks** | Headless WebGL differences (SwiftShader); background-tab measurements (`PAST_DECISIONS.md`) |
| **Tasks** | e2e: modes (WebGL, list, reduced), rail, rotation, hover, Quick View, Amazon and direct CTAs, links, console clean. `qa:desktop --strict`, `seo:audit`, axe, `mobile:books`, `mobile:cwv` on a local production build with the sandbox DB (`scripts/e2e/serve.mjs`) |
| **Acceptance** | All green; the CI-shape Vitest baseline grows by only the new tests; screenshots compared to the reference by eye and recorded under `AUDIT/evidence/` |

### Step 15 — Production deployment and smoke tests [14]

| Item | Detail |
|---|---|
| **Objective** | Live on valicepress.com, verified, with a rehearsed rollback |
| **Files** | none |
| **Dependencies** | Step 14; owner go-ahead |
| **Risks** | §12 |
| **Tasks** | §12 procedure |
| **Acceptance** | §12 smoke list all pass on the production domain within 30 min of deploy |

---

## 12. Production test and rollback plan

**Actual production deployment method [V].** A merge or push to `main` on GitHub (`emredogan-cloud/ValicePress-Site`). The Vercel Git integration builds and promotes it to `valicepress.com` (`source: "git"`, `githubCommitRef: "main"`). CI runs in parallel on the same push: lint, tsc, Vitest, `db:migrate`, build.

**Phase 2 needs no database migration**, so `db:migrate` has nothing new to apply and rollback has no data step. [R]

### Release procedure [R]

1. Open a PR `feat/spiral-library` → `main`.
2. CI must be green. Vercel builds a preview for the PR.
   - Previews sit behind Vercel Authentication [V]. Use `vercel curl` or a logged-in browser.
   - **[U]** Whether preview builds read the production or sandbox database. Check `vercel env ls` before trusting preview data.
3. Run Step 14's local production-build suite once more on the final commit.
4. **Record the current production deployment ID** (today `dpl_EHTSByx5p1uVYRpzYnNwixrQQjSN`). It is the rollback target.
5. Merge, using a merge commit so the release can be reverted as one unit. Watch the Vercel build to `READY`.

### Smoke tests on production (within 30 minutes) [R]

| # | Check | Instrument |
|---|---|---|
| 1 | `/books` 200; library renders; console clean | browser and `npm run qa:desktop -- --base https://valicepress.com --strict` |
| 2 | One cover image fetched from production (not just the HTML referencing it) | `curl -I https://valicepress.com/images/books/thumb/weather-permitting.webp` → 200, image/webp |
| 3 | Quick View from the library: three books — a Kindle-split book (Codex Bestiarium), a print-only book (The Great Book of World Games) and a direct-only book (Kwaidan) | manual and Playwright with `--base` |
| 4 | Amazon CTA opens the exact `/dp/<ASIN>` in a new tab | manual on desktop and the Redmi |
| 5 | All 36 `/books/<slug>` answer 200 | `npm run seo:audit -- --base https://valicepress.com` |
| 6 | `/ebooks`, `/`, `/categories/*`, `/search?q=myth` unchanged and 200 | sweep |
| 7 | Sitemap still lists 36 book URLs | `curl` |
| 8 | Mobile journey | `mobile:books -- --url https://valicepress.com`, `mobile:cwv -- --url https://valicepress.com --no-throttle` |
| 9 | Analytics arriving | new `library_*` rows in `analytics_events`; Speed Insights after real traffic |

### Rollback [V]/[D]/[R]

| Situation | Action |
|---|---|
| Anything user-visible broken | **Instant Rollback** in the Vercel dashboard, or `vercel rollback <recorded-deployment-id>` and then `vercel rollback status`. **On the Hobby plan only the immediately preceding production deployment is eligible** [D Vercel CLI docs]. Release the library as its own deployment, with no other production deploy in between, so that target is the pre-library build. The plan tier itself was not exposed by the API **[U]** |
| After an instant rollback | Confirm in the dashboard whether new pushes to `main` are still auto-promoted; Vercel may hold auto-assignment until the rollback is undone **[U — verify on the day]**. Then make the rollback durable |
| Durable revert | `git revert -m 1 <merge-commit>` → PR → merge, which auto-deploys a production build without the library |
| Partial problem (one browser or device) | Ship a fix that forces `renderer: "list"` for that condition (a code change and deploy); everything else keeps the library |

Never deploy from the primary checkout's old local `main`; it is 21 commits behind production (§1).

---

## 13. Blockers and open questions

### 13.1 Blockers

**None prevent Phase 2 from starting.** Steps 0–5 need no owner input. Step 6 (backdrop) and the release (Step 15) do.

### 13.2 Decisions for the owner (each changes the implementation)

1. **Where the library lives.** Recommended: `/books`, with the existing grid below it. Alternative: the homepage hero. The reference marks ALL BOOKS active.
2. **Shelf order.** Default is Romance, Myth & Folklore, Games & Play, Puzzle & Challenge, Language & Learning, Classics & Philosophy, with Young Explorers as a cross-shelf collection.
   - Reordering is a one-line change to `SHELF_ORDER`.
   - Giving Young Explorers its own shelf would move *The Great Book of World Myths* and *The Myth Hunter's Field Book* off the shelves their catalogue records list first. The test makes that an explicit choice.
3. **Default Amazon edition.** Kindle first (Quick View's order; recommended for the KDP Select romance titles) or print first (the free-book email's order).
4. **Button wording.** Keep "Buy on Amazon" (consistent with the book page and existing tests) or use "View on Amazon" (the brief's wording).
5. **The 10 books with no Amazon edition.** Offer the existing direct digital purchase (recommended: it is the only way to buy them), or show the book page only.
6. **Backdrop.** Procedural only, or a new pre-blurred "empty rotunda" plate.
   - A plate should show no legible titles or text, and should not depict a real cover, following the site update's rule for generated imagery.
   - Is a generic, unreadable background of shelves acceptable, as the reference has?
7. **Newsletter popup.** It opens on `/books` after 10 s (`newsletter-popup.tsx:53`), locks scroll and takes focus. Suppress it while the library is in view?
8. **Local `main`.** It is 21 commits behind `origin/main`. Fast-forward it (`git switch main && git merge --ff-only origin/main`)? Not done by this work.

### 13.3 Verified facts — summary

- Repository path; the reference image (examined; SHA-256).
- Stack versions.
- Production is `7140f31`, deployed by the Git integration.
- The 36-book catalogue is live.
- 55 verified Amazon editions on 26 books; 10 direct-only books, all buyable here.
- Thumbs and their sizes; CSP and proxy constraints.
- §10.3's check results.

### 13.4 Recommendations

R3F hybrid; native-scroll camera; thumbs as textures; no filler books; `prefer="amazon"`; shelf rule; fallback rules; validation targets; release and rollback procedure.

### 13.5 Assumptions

- WebGL 2 is available on the large majority of visitors' browsers (three r163+ requires it). The list mode covers the rest.
- The RSC payload duplication is small enough not to matter. To be measured.

### 13.6 Unknowns — and how to resolve them

| Unknown | How to resolve |
|---|---|
| Vercel plan (Hobby or Pro), and so rollback reach | Dashboard → Settings → Billing |
| Whether auto-promotion pauses after a rollback | Vercel dashboard banner / `vercel rollback status` during a rehearsal on a preview-only project, or the docs page "Instant Rollback" |
| Preview environment variables (which database a preview reads) | `vercel env ls` |
| three + R3F chunk size in this build | Step 1 |
| Real frame times on the Redmi Note 8 and on an integrated-GPU laptop | Step 13 |
| `/_next/image` `imageSizes` in Next 16.2.6 (for 256 px textures) | `node_modules/next/dist/docs` images config page, or a request in Step 13 |
