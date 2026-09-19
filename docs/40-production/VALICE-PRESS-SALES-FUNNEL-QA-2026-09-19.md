# Sales funnel QA — 2026-09-19

Every step a reader walks from arrival to purchase, checked against the
running system rather than against the code that was written for it. Where a
step could not be exercised, it says so and why.

Checked against: production `valicepress.com` (deployment Ready 2026-09-19),
and a local production build on `:3517`/`:3518` with migration 0013 applied to
the sandbox — which is the only place the popup and contact book can be
exercised until the Founder applies 0013 to production.

---

## The funnel, step by step

### 1 · Arrival → the press

| Check | Method | Result |
|---|---|---|
| Homepage 200 | `curl` | **200** |
| Hero is still the LCP element | The brand film sits one band below it, by design | **unchanged** |
| Brand film section renders | Browser, production | **yes**, full-bleed, no frame |
| Film fetches nothing until scrolled toward | IntersectionObserver with 300 px runway | **yes** |
| Correct rendition chosen | `video.currentSrc` at a 2060 px viewport | **`valice-brand-film-1080.mp4`** |
| Film actually plays | `video.paused` after the observer fires | **false** (was `true` before the `load()`/`play()` fix) |
| Bytes served from production | `curl -r 0-2048` | **206**, `video/mp4`, all six assets |
| CSP allows it | `media-src 'self'`, same origin | **yes** |

**One defect found and fixed here.** `preload="none"` is a hint; a browser
that honours it strictly never loads a frame, so `canplay` never fires and the
film sat at `readyState: 0`, paused, forever. Measured on production, fixed,
re-measured.

### 2 · Discovery → the shelf

| Check | Method | Result |
|---|---|---|
| `/books` 200 | `curl` + browser | **200** |
| No price on any card | Visual, production | **confirmed — none** |
| Badges come from real `book_formats` | Compared card badges to catalogue rows | **confirmed** |
| Filter facets are real | Read off the live sidebar | Digital 28 · PDF 28 · EPUB 23 · Kindle 2 · Paperback 22 · Hardcover 9 · Large Print 6 |
| Price slider gone | Visual | **gone** |
| Themes filter populated from real categories | Live sidebar | 5 themes with real counts |
| A card is still a crawlable link | `a[href="/books/<slug>"]` present | **yes** |

### 3 · Interest → Quick View (where the price first appears)

Exercised on production against **Puzzles Old and New**:

```
heading   Puzzles Old and New
facts     PAGES 102 · EDITIONS 2 · DIGITAL PDF + EPUB
editions  PDF + EPUB  $9.99      Paperback  $13.99
price     $9.99 · download here, DRM-free
previews  2 real pages from the book, rendered from the file you would receive
```

| Check | Result |
|---|---|
| Modal opens on a plain left click | **yes** |
| ⌘-click / middle-click still opens the page | **yes** — the link is untouched |
| Price is read from the format row, never hard-coded | **verified — no price literal in the file** |
| Interior previews are the book's own pages | **yes**, 2 shown because 2 exist |
| Panel fits without clipping the thumbnail strip | **fixed** — the strip was cut in half before the image was capped |
| Escape / backdrop / close button all dismiss | **yes** |
| Focus trapped, returned on close, scroll locked | **yes** |

### 4 · Intent → checkout

| Route | State | Note |
|---|---|---|
| Amazon editions | **live** | Each button points at that format row's own `amazon_url` |
| Direct editions, 27 of 29 | **live** | Wired to real Lemon Squeezy variants |
| Puzzles Old and New | **honest placeholder** | Quick View says *"This edition isn't on sale through this site at the moment"* — true until the catalogue load |
| Words from the Gods | **honest placeholder** | Same |

**No dead CTA anywhere.** A direct buy route renders only when
`provider_price_id` is non-null. Between retiring one payment provider and
provisioning the next, a book can be priced, deliverable and unbuyable all at
once — and a button that cannot take money is the defect this catalogue exists
to prevent.

### 5 · Purchase → fulfilment

**Not exercised, and deliberately.** Completing a real Lemon Squeezy checkout
charges a real card. The standing rule is that a real charge needs the
Founder's own in-the-moment action, so no purchase was made.

What *was* checked without transacting:

| Check | Result |
|---|---|
| Both new variants live-mode | `test_mode: false` on both, read from the store |
| Both products published | `status: "published"` |
| Variant ids read back, never typed | **yes** — from the store's own product list |
| Checkout URLs exist for both | `…/checkout/buy/<uuid>` present on both |
| Webhook endpoint is signature-gated | Unchanged from the remediation: unsigned POST → 401 |

---

## The lead funnel

### 6 · The newsletter popup

Exercised against a local production build with 0013 applied:

| Check | Result |
|---|---|
| Fires 10 s after arrival | **yes** |
| Records `shown` with its source path | **yes** — `{popup: newsletter, outcome: shown, source_path: "/"}` |
| Does **not** reappear on another page after dismissal | **yes** — navigated `/` → `/companion/world-games`, waited past 10 s, no popup |
| Dismissal writes back to the same row | **yes** — `outcome: dismissed` |
| Malformed address refused | `invalid-email`, 400 |
| Disposable address refused with its own code | `disposable-email`, 400 |
| Analytics fire | `email_popup_triggered`, `email_popup_closed` observed |
| Silent on `/cart`, `/read`, `/account`, `/admin` | **yes** |
| Consent sentence shown = sentence stored | **yes** — one constant, both places |

**Production state: dormant.** `/api/popup` returns `eligible: false` because
`popup_impressions` does not exist there yet. That is the fail-safe direction
on purpose — the cost of being wrong that way is one missed signup, not a
visitor shown the same modal on every page.

**A correction to this QA itself.** Two early attempts to click the popup's
close control appeared to do nothing and were briefly taken for a bug. They
were not: the automation's screenshot frame is 1568 px wide while the page's
CSS viewport is 2060 px, so the clicks landed elsewhere. A real DOM click
closes it and writes `dismissed`. The product was never broken; the instrument
was mis-scaled.

### 7 · The contact book

| Check | Result |
|---|---|
| Import is dry-run by default | **yes** |
| Refuses to write an `opted_in` row | **yes** — checks and exits non-zero |
| 93 source rows → unique contacts | **90**, case-insensitive dedupe |
| Consent breakdown | `not_marketing_contact` 81 · `opted_out` 4 · `unknown` 5 · **`opted_in` 0** |
| **Mailable** | **0** |
| Suppressions carried across | **3**, from `DO_NOT_CONTACT` and `BOUNCED` |
| Admin page gated | unauthenticated → redirect to `accounts.valicepress.com` |
| Export gated twice | proxy **plus** its own `requireAdmin()` → 403 |
| Export never written to disk | streamed attachment, `no-store, private` |
| Backup permissions | **0600**, `/CRM/` gitignored (`git check-ignore` confirms) |

---

## Open items that affect the funnel

| Item | Effect on the funnel | Owner |
|---|---|---|
| Migration 0013 not applied to production | Popup dormant; contact book dormant | Founder |
| Catalogue not loaded to production | 2 of 29 books unbuyable on site | Founder |
| 29 product images not uploaded | Checkout and receipt emails show no cover | Founder |
| No real purchase ever transacted | Order → webhook → entitlement → delivery is verified by construction and by the preflight, not by a completed payment | Founder |

---

## What was NOT checked, and why

- **A completed purchase.** See §5.
- **Real-device measurement.** The phone harness was not run this session;
  every browser check above is desktop Chrome at 2060 × 1012.
- **Core Web Vitals on production.** Not measured. The changes that bear on it
  are directional and argued rather than measured: the films are below the
  fold and fetch nothing until scrolled toward, and the hero's LCP image was
  not touched.
- **The 19/19 forensic remediation gate.** No gate script for it exists in
  this tree; the four standing gates (579 tests, tsc, eslint, build) were run
  instead and are all green.
