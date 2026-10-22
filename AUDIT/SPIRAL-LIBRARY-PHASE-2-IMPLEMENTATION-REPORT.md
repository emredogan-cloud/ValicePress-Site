# Spiral Library — Phase 2: Implementation, Validation and Release

**Date:** 2026-10-22
**Branch:** `feat/spiral-library`, from `origin/main` @ `7140f31` (the commit production ran at the start of this phase)
**Source of truth followed:** `AUDIT/SPIRAL-LIBRARY-PHASE-1-FOUNDATION-AND-IMPLEMENTATION-PLAN.md` §11 (roadmap) and the owner's eight Phase 2 decisions.

**Evidence tags:** **[V]** verified by a command run or a file read in this session · **[M]** a measurement, with its instrument and conditions · **[U]** not verified, and how to verify it. Raw measurements are in `AUDIT/data/spiral-library-phase-2/`, screenshots in `AUDIT/evidence/spiral-library-phase-2/`.

---

## 1. Summary

`/books` now opens on the spiral library: a monumental column of six shelves, one per real collection, carrying the catalogue's own covers. The reader descends it with the page's own scroll; a press on a cover opens the existing Quick View on the book's first Amazon edition, with **Buy on Amazon** as the first action; past the last shelf the page continues into the full catalogue grid, unchanged.

- **The 3D scene** (three.js 0.186.1 + React Three Fiber 9.8.1) is a lazily loaded chunk, imported only by `/books`'s island, and only after the page is interactive and the device qualifies. **[V]**
- **Everything a person reads or operates is HTML:** the `<h1>`, the shelf rail, one real link per book (36, server-rendered), the hover card, the shelf controls, Quick View. Without WebGL, saving data, or on a reader's choice, the same shelves render as a list. **[V]**
- **Amazon:** only the catalogue's own verified `amazon_url`s are ever shown; the 10 books with no Amazon edition get no Amazon button and say so, keeping their existing direct path. No checkout was added. **[V]**
- **No database migration, no change to the catalogue, the homepage, the header, the Vercel or Next configuration.** **[V]**

**Validation (all run, all on the final code unless stated):**

| Check | Result |
|---|---|
| Lint / typecheck | `npm run lint` exit 0 · `npx tsc --noEmit` exit 0 **[V]** |
| Unit tests (CI shape) | 82 files · **1,471 passed**, 0 failed (Phase 1 end: 1,443; before Phase 1: 1,417) **[V]** |
| Unit tests (plain `npm test`) | 1,616 passed · 21 failed — the **same 21 pre-existing** print-factory failures as before this work (external books tree), skipped in CI **[V]** |
| Browser e2e (Chromium desktop, Chromium phone, Firefox) | **584 passed · 190 skipped · 0 failed**, against a baseline of 549 / 189 / 0 before any change **[V]** (final-code run: §4.2) |
| Accessibility | axe WCAG 2.2 AA + best practice: 0 violations on `/books` (library) and in list mode; keyboard: every book reachable and opened from its link, focus returns; first 30 Tab stops all show focus **[V]** |
| Real catalogue | sandbox = catalogue file (36 published, same slugs); **book matrix: all 36 rows pass** every column; every Quick View's Amazon link equals the catalogue's, in 3 browsers **[V]** |
| Desktop sweep | **786 page loads** (131 pages × 3 widths × Chromium + Firefox): **0 page problems**, worst CLS 0.001 **[V]** |
| Physical Android (Redmi Note 8 2021, Mali-G52) | scene median frame **16.8 ms**, p95 **48.4 ms**, 0 frames while still; Quick View lock check **18/18**; every book's popup and page **36/36 + 36/36** **[M]** |
| Live Amazon re-read | **55/55 ASINs re-identified on their live pages today** (title, format, ISBN), 0 mismatches (§2.2) **[V]** |

**Not done, and why:** no real screen-reader session (NVDA/VoiceOver/TalkBack) — structure verified by tests only; no iOS/Safari device; no integrated-GPU laptop (desktop GPU numbers are a GTX 1660 Ti). See §7.

---

## 2. Pre-flight (roadmap Step 0 and Step 1)

### 2.1 Branch

`git fetch`: `HEAD` = `origin/main` = `7140f31b3b1e`, 0 behind, 0 ahead. Nothing newer on GitHub. Production (`dpl_EHTSByx5p1uVYRpzYnNwixrQQjSN`) runs that commit. **[V]**

### 2.2 Amazon ASIN verification

`node scripts/catalog/verify-amazon-asins.mjs --catalog` — read-only, one request per 6–60 s, re-asking only what was not yet verified (`--resume`). **[M]**

| Pass | Delay | Re-identified (`ok`) | Throttled (Amazon's ~3.8 kB robot-check stub) | Mismatches |
|---|---|---|---|---|
| 1 | 6 s | 8 | 47 | 0 |
| 2 | 15 s | +6 → 14 | 41 | 0 |
| 3 | 45 s | +14 → 28 | 27 | 0 |
| 4 | 60 s | +27 → **55** | **0** | **0** |

- An `ok` row is a live page whose **title, format and ISBN match the catalogue** row that claims the ASIN. **All 55 are `ok`: no ASIN points at the wrong book, and none has gone.**
- A throttled row is not a verdict (the script's own rule), which is why the passes continued until none was left.
- **The library adds no Amazon link.** It renders exactly the `book_formats.amazon_url`s production already shows in Quick View and on book pages; the e2e suite holds each one equal to the catalogue's (§4.2).
- Today's file: `AUDIT/data/amazon-asins-2026-10-22.json`.

### 2.3 Dependencies — the exact recommended versions

`npm install --save-exact three@0.186.1 @react-three/fiber@9.8.1` and `npm install --save-exact -D @types/three@0.186.0`. **[V]**

- `package-lock.json`: **18 entries added, 0 removed, 0 version changes**; 3 existing entries lost their `dev` flag (`@babel/runtime`, `@types/react`, `csstype`, now needed at run time by fiber).
- `npm audit`: none of the 18 new packages is in the report.
- Exact pins, like `next` and `react`: three makes breaking changes in minor releases.

### 2.4 The 3D code loads only on `/books` [V]

From the final production build's chunk graph:

| Chunk | Size | Who loads it |
|---|---|---|
| 3D chunk (three + fiber + scene) | 937 kB raw · **248.8 kB gzip** | dynamically imported by the island chunk only; named by **no** page's HTML |
| Library island | **15.4 kB gzip** | named by **`/books.html` only** |

- `/`, `/ebooks`, `/books/<slug>` load no 3D code. Measured with `scripts/perf/page-weight.mjs`: their JS grew by 15–16 kB each — Next's `<Link>` prefetch of the `/books` route (every header links "All books"), which brings the island chunk, never the 3D chunk.
- The island is 0.4 kB over the plan's proposed ≤ 15 kB budget.

### 2.5 A valid local test environment with the sandbox catalogue

- **Problem found:** `.env.production.local` (a `vercel env pull`, secrets redacted) outranks `.env.local` for `next build`/`next start`, so a plain local build pre-rendered an empty catalogue (169 `safeQuery` fallbacks) and `scripts/e2e/serve.mjs` refused to start. **[V]**
- **Fix, no env file touched:** `scripts/e2e/sandbox-env.mjs` runs a command with `.env.local` in the process environment (which outranks every file), refuses any database but the sandbox `bookstore`, and blanks the same third-party keys `serve.mjs` blanks — at build time too, where `NEXT_PUBLIC_` values are inlined.
  - `node scripts/e2e/sandbox-env.mjs npm run build` → 0 catalogue fallbacks.
  - `node scripts/e2e/sandbox-env.mjs node scripts/e2e/serve.mjs` → the e2e server on :3210.
- **Sandbox = catalogue:** 37 rows, 36 published, the same 36 slugs as `valice-catalog.mjs`, `ridge-runner` a draft. **[V]**
- Noted, not changed: the sandbox has no `analytics_events` table, so beacons are discarded locally.

### 2.6 Baseline before any change [M]

Same build commands, same server, same instruments as the after-numbers below.

| Instrument | `/books` before |
|---|---|
| e2e (3 projects) | 549 passed · 189 skipped · 0 failed |
| Phone CWV (`mobile:cwv`, Redmi, cache off, 1.6 Mbps / 70 ms, median of 3) | LCP **3,264 ms** (a grid cover `IMG`; samples 3,268 / 3,264 / 3,216) · CLS 0 · INP proxy 232 ms · 1,646 kB |
| Page weight (`perf:weight`) | phone 2,051 kB (JS 507) · desktop 1,464 kB (JS 507) |
| Server HTML | 12 book links; 205 kB raw / 36.8 kB gzip; RSC 111 kB / 26.1 kB gzip |

---

## 3. What was built

### 3.1 Shape

```
/books (server, ISR 1 h)
  listPublishedBooks() ─┬─ toCatalogItems() ─┬─────────────────────────────► <CatalogShell> (unchanged grid, below)
  listPublishedCollections() ─ withCollections() ─ buildLibraryShelves() ─► <SpiralLibrary> (client island)
                                                                              ├─ HTML: h1 · rail · view switch · 36 links · live region
                                                                              ├─ sticky stage: CSS rotunda backdrop + <LibraryCanvas> (lazy, WebGL)
                                                                              └─ <QuickView prefer="amazon" source="library">
```

- **Scroll:** a tall track (one stage plus ~0.72 stage per shelf) with a sticky stage; a passive `scroll` listener turns the track's scroll into a shelf; the camera follows. No wheel, touch or key event is cancelled.
- **Render on demand:** a frame only when the scroll moves, a shelf turns, a cover arrives, or what is lit changes. Measured: **0 frames** in two still seconds, on the phone and the desktop GPU (§5).
- **The spiral:** each shelf's books are centred 12° further round the column than the shelf above's, and the camera turns with them as it descends.
- **Geometry from the reference:** the column takes **40 %** of a wide stage (the outline solved exactly — a front-face approximation drew 34 %); a phone's camera comes in until the column runs past both edges, so a cover is ~87 × 131 px; the shelf in front stands 40 % down a wide stage and 46 % on a phone, under its header. Tested by projection at two widths that disagree.

### 3.2 Owner decisions → implementation

| # | Decision | Implemented as |
|---|---|---|
| 1 | Library on `/books`, homepage unchanged | `src/app/books/page.tsx` only. `src/app/page.tsx` untouched. **[V]** |
| 2 | Six real collections as tiers; Young Explorers cross-collection | `buildLibraryShelves()` over the real collection memberships: Romance 4 · Myth & Folklore 14 · Games & Play 8 · Puzzle & Challenge 4 · Language & Learning 3 · Classics & Philosophy 3 (36). Young Explorers is a rail toggle that picks its 2 books out on their shelves, with a link to `/categories/young-explorers`. No filler books. **[V]** |
| 3 | Existing Quick View, Amazon primary | `QuickView` gains `prefer="amazon"` (opens on the first Amazon edition, Kindle → Paperback → Hardcover → Large Print) and `source="library"` (tags its events). Without them it behaves exactly as before — covered by unit tests. **[V]** |
| 4 | "Buy on Amazon" | Quick View's existing button and label; new tab, `noopener noreferrer`, accessible name naming the edition. **[V]** |
| 5 | Never fabricate; no Amazon button without a verified edition | Only `book_formats.amazon_url` is rendered; the hover card's "On Amazon" line also requires an `https://www.amazon.com` URL. The 10 direct-only books: no Amazon button, "Not sold on Amazon — it is sold here, as a DRM-free digital edition", and their existing "Buy the digital edition". e2e checks all 36 in three browsers. **[V]** |
| 6 | No new checkout | None. The direct path is the existing link to `/books/<slug>`. **[V]** |
| 7 | Dark, softly blurred rotunda; no titles or merchandise | `library-backdrop.tsx`: CSS only — two galleries of arched night windows, sconces, balustrades, floor glow, vignette. No image file, no text, no books. **[V]** |
| 8 | The popup must not interrupt the library | The popup's quiet-moment check now also waits while any `[data-holds-popup]` section is on screen (the library is the only one). Once the reader is past it, it may appear as anywhere else. Proven: with the hold removed, the e2e test fails ("the popup opened over the library"); restored byte-identical, it passes. **[V]** |

### 3.3 Files

**New** (`src/components/spiral-library/`, alongside Phase 1's `library-shelves.ts` and `render-mode.ts`):

| File | What it is |
|---|---|
| `spiral-library.tsx` | The island: mode choice (`useSyncExternalStore`, no setState-in-effect), scroll → shelf, rail, shelf turning, hover card placement, keyboard focus → scene, hash deep links (`#shelf-<slug>`), live region, analytics, Quick View, error boundary → list |
| `library-canvas.tsx` | The fiber `<Canvas>` (memoised): shared resources, drag-to-turn, context-loss → list after 2.5 s, three's console filter (§3.5) |
| `library-geometry.ts` (+ test) | Pure layout: tiers, radii, camera frame per stage size, capacity (5 desktop / 3 phone), turning, scroll stops |
| `scene/structure.tsx` | Column core, name bands (one texture atlas → one draw call), boards, cove light, plinth, floor — merged geometries |
| `scene/shelf-books.tsx` | Covers (unlit, true colour, shaded by angle and height), page blocks (instanced), hover box projection |
| `scene/camera-rig.tsx` | Damped, speed-capped camera; cuts between shelves under reduced motion; key light rides with it |
| `scene/textures.ts` | Canvas-drawn textures; cover loader (priority queue, 4 at a time, decoded off the main thread) |
| `scene/frame-monitor.tsx` | Steps the pixel ratio down on slow frames; `?library-stats` records frame intervals for the measurement scripts |
| `scene/scene-context.ts`, `palette.ts`, `library-backdrop.tsx`, `library-list.tsx`, `collection-rail.tsx`, `hover-card.tsx` | Shared scene refs; the measured palette; the rotunda; the HTML list (index and list presentations); the rail; the hover card |
| `spiral-library.test.tsx` | Server HTML (one h1, 36 links, rail, popup hold, no canvas) and the no-WebGL list, over the real catalogue |
| `src/lib/connection.ts` | `connectionIsExpensive()`, moved out of `ambient-video.tsx` unchanged and shared |
| `e2e/library.pw.ts` | 12 browser tests × 3 projects (§4.2) |
| `scripts/e2e/sandbox-env.mjs` | §2.5 |
| `scripts/mobile/library.mjs` (`npm run mobile:library`) | Phone: arrival, frames over real touch scrolls, tap → Quick View, Android Back |
| `scripts/perf/library-frames.mjs` | Desktop GPU frames over real wheel input |

**Changed:**

| File | Change |
|---|---|
| `src/lib/db/queries/catalog.ts` | `listPublishedCollections()` — a separate read, so the other surfaces that read `readPublishedBooks()` send nothing extra to the browser |
| `src/app/books/page.tsx` | Builds the shelves; library above, `#all-books` section with the grid below; one `<h1>` |
| `src/components/catalog/catalog-hero.tsx` | Heading level / title / subtitle props (an `<h2>` "The full catalogue" under the library; unchanged defaults) |
| `src/components/catalog/catalog-shell.tsx` | `data-catalog-grid` on its lists (test selectors); `priorityCovers` (false on `/books`: the grid is no longer the first screen) |
| `src/components/catalog/quick-view.tsx` (+ test) | `prefer` and `source` props; the "Not sold on Amazon" line when asked for Amazon; 4 new tests, mutation-checked |
| `src/components/newsletter/newsletter-popup.tsx` | The section hold (decision 8) |
| `src/lib/analytics.ts` | `library_mode`, `library_shelf_view`, `library_book_open` in the union and the allow-list |
| `src/components/media/ambient-video.tsx` | Imports `connectionIsExpensive` from `@/lib/connection` |
| `e2e/helpers.ts`, `e2e/catalog.pw.ts`, `scripts/mobile/{books,quickview}.mjs`, `scripts/qa/book-matrix.mts` | Grid selectors scoped to `[data-catalog-grid]` — the library's links would otherwise have been "the first book card" |
| `e2e/overlays.pw.ts` | One setup line: the card is scrolled into view before the page position is noted (it now sits below the library); the assertion is unchanged and gained one |
| `scripts/qa/desktop-sweep.mjs` | Skips SwiftShader's "GPU stall due to ReadPixels" remark (the instrument, not the page — absent on a real GPU), like its Firefox `entryTypes` skip |
| `package.json` / `package-lock.json` | §2.3, plus the `mobile:library` script |

### 3.4 Deviations from the Phase 1 plan, and why

- **`#shelf-<slug>`, not `?shelf=`** — an anchor works without JavaScript and does not vary the cached page; the rail writes it with `replaceState`, and arrival and `hashchange` both land on the shelf.
- **No Shift+wheel turning** — buttons, horizontal drag/swipe and ←/→ cover it with no wheel listener at all.
- **No backdrop parallax** — Firefox warns about any element moved from a scroll handler; the camera's descent carries the depth.
- **The WebGL probe no longer loses its context** — Firefox logs a lost context as a warning; a one-pixel context left to the garbage collector costs nothing.
- **Cover textures:** 256 px copies from the site's image optimiser on phones and on screens ≤ 1.25 dppx (21.5 kB vs 53.3 kB for the same cover; GPU memory 52.6 → 18.5 MB); the 432 px thumb only on high-density desktops. Each texture is uploaded to the GPU on arrival, not on first sight mid-scroll (§5.2).
- **Reduced motion:** the camera cuts to the nearest shelf; no scroll snapping was needed.

### 3.5 A third-party warning, handled at its source

three r183 deprecated `Clock`; every React Three Fiber 9 release up to 9.8.2 still constructs one, so every canvas printed `THREE.Clock: This module has been deprecated`. A newer fiber does not help (9.8.2 inspected: same code). three's own documented hook, `setConsoleFunction`, drops exactly that line; every other three.js message passes through. **[V]**

---

## 4. Validation

### 4.1 Unit, lint, types, build [V]

- `npm run lint`: exit 0. `npx tsc --noEmit`: exit 0.
- Vitest, CI shape (`VALICE_BOOKS_ROOT=/nonexistent npx vitest run`): 82 files, 1,471 passed, 194 skipped, 0 failed.
- New tests: geometry 17 (scaling law at two disagreeing widths, by independent projection), shelves +2 (the two reads joined), island 5, Quick View 4, render mode (probe rewritten).
- Mutation checks: Quick View with `prefer` ignored → the two intended tests fail; popup without the hold → the e2e hold test fails. Both restored byte-identical (`cmp`).
- `npm run build` and the sandbox build: exit 0; `/books` stays `○` static, ISR 1 h.

### 4.2 Browser e2e [V]

`npx playwright test` — desktop Chromium 1440 × 900, phone Chromium 393 × 851, desktop Firefox; every context `reducedMotion: "reduce"` except the full-motion block.

| | Passed | Skipped | Failed |
|---|---|---|---|
| Baseline (before any change) | 549 | 189 | 0 |
| Final code | 584 | 190 | 0 |

`e2e/library.pw.ts` (expectations from the catalogue file, never literals):
1. every published book on its shelf, in shelf order, linked once; one `<h1>`; the draft absent;
2. **every book's Quick View opened from its link: the first Amazon edition's URL equal to the catalogue's, new tab, `noopener` — or, with none, no Amazon link, "Not sold on Amazon" and the direct path; focus back on the link** (36 books × 3 browsers);
3. a press on a cover opens that book; Android Back closes it, the page unlocked;
4. the page's own scroll walks every shelf, a wheel over the scene scrolls the page, and the full catalogue follows; no horizontal overflow;
5. the rail reaches a shelf and writes the address; a `#shelf-` typed or arrived with lands there;
6. a long shelf turns a frontful at a time to both ends, with a correct "5–9 of 14";
7. every cover fetched once, 200, `image/webp`;
8. without WebGL: the list, the same links and Quick View, **no 3D code downloaded**; axe 0 violations;
9. the List view is remembered; the Library comes back;
10. the newsletter popup waits while the library is on screen;
11. full motion: the camera travels, comes to rest, and then draws nothing.

### 4.3 Accessibility [V]

- axe-core (WCAG 2.0/2.1/2.2 A–AA + best practice): `/books` in library mode at desktop and phone (`quality.pw.ts`), and in list mode (`library.pw.ts`): **0 violations**.
- Keyboard: Tab order skip link → view switch → rail → each book's link; a focused book's link shows as a caption at the foot of the stage, the scene turns its shelf to bring it to the front and lights it; Enter opens Quick View; Escape returns focus to the link; ←/→ move along a shelf. `quality.pw.ts` "first thirty Tab stops show a focus indicator" passes on `/books`.
- Screen readers: the canvas is `aria-hidden`; each shelf is an `<h2>` with its count; each book link's name is "Title, by Author. On Amazon: Kindle, Paperback" (or the direct line); a polite live region names a shelf on arrival. **Not tested with a real screen reader** [U].
- Reduced motion: no camera travel, cuts only; no lift on hover; e2e runs in this mode.
- Touch targets ≥ 44 px; nothing interactive in the phone's bottom 88 px (the assistant launcher's).

### 4.4 Real catalogue [V]

- Sandbox database = catalogue file (§2.5).
- `scripts/qa/book-matrix.mts` with the phone sweep: **all 36 rows pass** — listing, page (200, `<h1>`, Book JSON-LD), cover, back cover, preview panels, Amazon links (each the catalogue's, ASINs read off live pages), author, phone. (`AUDIT/data/spiral-library-phase-2/book-matrix.md`)
- Server HTML: exactly 36 book links (production's `/books` HTML had 12), the draft absent.

### 4.5 Desktop [V]

`scripts/qa/desktop-sweep.mjs`: 131 pages × 1280/1440/1920 × Chromium + Firefox = 786 loads, **0 page problems**, worst CLS 0.001. Environment-only messages, as before: Vercel's beacons and Clerk's production keys on localhost.

### 4.6 Physical Android [M]

Redmi Note 8 (2021), Android 11, 4 GB, Chrome 155, Mali-G52; 392 × 718 CSS px at 2.75 dppx; full motion (the phone's own setting).

| Check | Result |
|---|---|
| `mobile:books` — every book's Quick View from the grid, and its page, with a real finger | **36/36 popups, 36/36 pages** |
| `mobile:quickview` — the Quick View lock (the old "freeze") | **18/18** |
| `mobile:library` — tap a cover → that book's Quick View, on an Amazon edition; Android Back closes it, stays on `/books`, unlocked | all checks pass (every run after the first; tap → dialog 364 ms on the final build) |

---

## 5. Performance — measured

### 5.1 Frames during the descent [M]

| Device | Median | p95 | p99 | > 33 ms | Still (2 s) |
|---|---|---|---|---|---|
| Redmi Note 8 (low quality, DPR 1.5), real touch scrolls, final build | **16.8 ms** | **48.4 ms** | 61.9 ms | 11.3 % | 0 frames |
| Desktop GTX 1660 Ti, 1440 × 900, wheel | 16.7 ms | 17.6 ms | 18.0 ms | 0.7 % | 0 frames |
| Desktop GTX 1660 Ti, 1920 × 1080, wheel | 16.7 ms | 17.6 ms | 18.1 ms | 0.7 % | 0 frames |

- **Plan's proposed thresholds:** phone median ≤ 33 ms — **met**; phone p95 ≤ 50 ms — **met on the final build (48.4 ms), but close** (the four runs before it measured 52.7, 51.5, 50.1 and 49.7 ms); desktop median ≤ 16.7 ms, p95 ≤ 25 ms — **met**, but on a discrete GPU, not the integrated laptop GPU the plan named.
- The phone's slow frames come in short bursts at the start of each touch gesture and at shelf crossings, not at random.
- Scene: 37 draw calls (phone) / 41 (desktop), ~10–17 k triangles, 8 shader programs, 18.5 MB of cover textures.

### 5.2 What the phone measurements changed

| | Run 1 | Final |
|---|---|---|
| p99 frame | 212 ms | 62 ms |
| Scene's first frame (1.6 Mbps) | 9.4–11.8 s | 7.7 s (median) |
| All covers (1.6 Mbps) | 17.7–19.0 s | 11.8 s (median) |
| Cover bytes / GPU memory | 1,573 kB / 52.6 MB | 612 kB / 18.5 MB |

Causes found and fixed:
- textures were uploaded on first sight, mid-scroll — now on arrival;
- the grid's four preloaded covers (345 kB) competed with the scene on a page where the grid is no longer the first screen;
- textures were larger than a phone draws them;
- the scene re-rendered as the reader crossed shelves — now memoised, with fiber no longer re-measuring on scroll.

Run 1 also fell back to the list once; the reason was not captured then. It now is (`data-library-reason`, and in the `library_mode` event), and it did not recur in the four later runs or the two full phone sweeps.

### 5.3 Arrival and Core Web Vitals [M]

`mobile:cwv`, Redmi, cache off, 1.6 Mbps / 70 ms, median of 3:

| | Before | After |
|---|---|---|
| LCP | 3,264 ms — a grid cover `IMG` | **2,048 ms — the `<h1>` text** (5 samples, 2,020–2,200) |
| CLS | 0 | 0 |
| INP proxy | 232 ms | ~80 ms |
| Bytes | 1,646 kB | 2,209 kB |

- **The LCP element changed kind**, so the two LCPs are not comparable. A canvas is never an LCP candidate: the covers the reader waits for are timed directly. On this link the scene's **first frame arrives at ~7.7 s and the last cover at ~11.8 s**, while the heading, rail and full catalogue are usable from ~2.1 s. Chrome classes a 1.6 Mbps / 70 ms link as `4g`, so such a reader gets the scene, not the list.
- **A regression found and fixed on the phone:** in about one load in three, the "Opening the library…" line — drawn after hydration and, on a phone, larger than the heading — became the LCP at ~4.1 s. It is now smaller than the heading at every size; 5 of 5 and 3 of 3 later loads reported the `<h1>`.
- **Biggest shareable cost found, outside this work:** `/icon.png` is **476 kB** and downloads during the same window on every page (`mobile:trace`). An optimised icon would help every page.
- The INP proxies tap whatever controls are on screen (now the view switch, before a `<select>`), so they are not like for like.

### 5.4 Page weight (`perf:weight`) [M]

| `/books` | Before | After |
|---|---|---|
| Phone | 2,051 kB (JS 507) | 2,618 kB (JS 689) |
| Desktop 1× | 1,464 kB (JS 507) | 2,153 kB (JS 752) |

Other pages: +15–16 kB (the prefetched island, §2.4). RSC payload: +1.1 kB gzip (React deduplicates the shared items); HTML: +5.3 kB gzip.

---

## 6. Release and rollback

**Method (unchanged):** a merge to `main` on GitHub (`emredogan-cloud/ValicePress-Site`) is built and promoted to valicepress.com by the Vercel Git integration; CI (lint, typecheck, tests, migrations on push to `main`, build) runs on the same push. **No migration is part of this release.**

1. PR `feat/spiral-library` → `main`; CI green; Vercel preview READY. Previews are behind Vercel Authentication; which database a preview reads was not determined (a preview `DATABASE_URL` exists; its value is sensitive) [U].
2. **Rollback target: the production deployment before the merge — `dpl_EHTSByx5p1uVYRpzYnNwixrQQjSN` (`main@7140f31`).** Keep the library's release as its own production deployment, with nothing deployed after it until it is judged, so that target stays the immediately preceding one for Instant Rollback.
3. Merge with a merge commit (revertible as one unit).
4. Smoke tests on production:
   - `/books` 200, library renders, console clean;
   - covers and the 3D chunk fetched from production;
   - Quick View from the library for a Kindle-split book, a print-only book and a direct-only book;
   - the Amazon link is the exact `/dp/<ASIN>`;
   - all book pages 200, the sitemap still 36;
   - the Redmi journey against production.

**Rollback:** Vercel Instant Rollback to the target above (dashboard, or `vercel rollback dpl_EHTSByx5p1uVYRpzYnNwixrQQjSN`), then make it durable with `git revert -m 1 <merge commit>` → PR → merge. A problem limited to some devices can be answered by forcing the list for that condition (`chooseRenderMode`), without removing the library.

---

## 7. Known limitations and open items

1. **Phone p95 frame close to the 50 ms line** (48.4–52.7 ms across runs), in bursts at gesture starts. If real-user data agrees, the next step is a 1.25 starting pixel ratio on low quality (the monitor already steps there when a run is slow).
2. **Slow links:** on 1.6 Mbps the scene takes ~7.7 s to appear (the page is usable at ~2 s). The pre-existing 476 kB `/icon.png` is the largest avoidable cost in that window.
3. **Not tested:** a real screen reader; iOS Safari; an integrated-GPU laptop. **[U]**
4. **Image optimiser:** phones and 1× screens request 36 `w=256` cover variants from Vercel's image optimiser — a small addition to the grid's existing use; worth a look at the usage page after release.
5. **Analytics:** the `library_*` events need production's `analytics_events` table (the sandbox lacks it).
6. **Reference vs. catalogue:** the reference's "Adventure & Mystery", "Science & Ideas" and "Fantasy" shelves do not exist and were not invented; with 3–14 books a shelf, rings show architecture where the reference shows packed books.
7. **Local `main`** is still 21 commits behind `origin/main` (unchanged; the owner's call).
