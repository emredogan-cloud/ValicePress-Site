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
