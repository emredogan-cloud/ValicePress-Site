# Mobile QA on the physical phone — 2026-10

> ## The device is not the one the brief names
>
> ADB reports exactly **one** attached device: **Xiaomi Redmi Note 8 (2021)** — model `M1908C3JGG` (codename `biloba`), **Android 11** (SDK 30), MIUI 12.5.9, 1080 × 2340 at 440 dpi (2.75×), **Chrome 154.0.8037.126**. The brief says **Redmi Note 11R** and names this report accordingly (`MOBILE-REDMI-NOTE-11R-QA-2026.md`). **Nothing here was run on a Note 11R**, none of it should be quoted as if it was, and no other device was touched. The scripts are device-agnostic: plug a Note 11R in and run `npm run mobile:final`, `mobile:books`, `mobile:admin` (about forty minutes in all) to repeat everything below on it. Whether the Note 8 (2021) is acceptable "as the Redmi" is **your decision** (`FINAL-RELEASE-REPORT-2026.md` §10).

The phone's visible page is **392 × 718 CSS px** with Chrome's toolbar showing and 392 × 845 with it collapsed. Every interaction is a real finger: `Input.dispatchTouchEvent` through Chrome's DevTools socket over USB, the real Android Back key (`adb shell input keyevent KEYCODE_BACK`), the real soft keyboard (typed with `Input.insertText`). The build under test is the final production build (`next build` + `next start`, sandbox database) served to the phone over `adb reverse`; the admin area through the throw-away stub-auth copy on loopback (`adb reverse` again) — the phone cannot sign in to the production Clerk, and the shipped code has no way around its own gate.

## 1. The original bug, reproduced, and fixed

The brief: reproduce the original popup-locking bug, then show `OPEN POPUP → SCROLL POPUP → CLOSE POPUP → SCROLL PAGE` and `OPEN BOOK → VIEW PREVIEW → CLOSE / BACK` without freezing.

**On the live site today, on this phone** (`docs/execution/mobile/phase-14/quickview-live.json`, and the original Phase 1 capture in `AUDIT/evidence/phase1/`): **9 of 18 checks fail** —

| Failing on https://valicepress.com | What the phone measured |
|---|---|
| Close is a finger-sized target | 36 × 36 px |
| the primary action ("Full details") is on screen without scrolling, and reachable | at y = 1015 on a 744 px screen: below the fold, and it cannot be scrolled to |
| the page behind is locked (`html` **and** `body`) | `html` visible, only `body` hidden |
| Android Back closes the popup and the reader stays on `/books` | Back leaves the reader on `/books/weather-permitting` with the popup still open |
| tapping Close closes it | the popup is still there |
| the page is unlocked afterwards | `html` visible, `body` hidden — still locked |
| **a finger scrolls the PAGE again** | `scrollY` **365 → 365**: the page does not move. *The freeze.* |
| no horizontal overflow on `/books` | 15 px |

**On this branch's build, same phone, same script** (`quickview-local.json`): **18 / 18.** The cause (Phase 1): the quick view was a CSS grid with `overflow: hidden` and only a `max-height`, so on a phone its two rows did not fit and nothing scrolled; Buy and Close sat in the clipped second row; only `body` was locked; Back left the site. It is now the shared `Dialog` (`src/components/ui/dialog.tsx`): a flex column bounded by `dvh`, one scroller, a pinned footer, a 44 px Close outside the scroller, one reference-counted scroll lock that every overlay shares, Escape and Android Back close the top overlay only, focus goes in and comes back. A unit guard fails if anything but `scroll-lock.ts` writes `body|html.style.overflow`.

| The brief's two sequences | Evidence on the phone |
|---|---|
| **OPEN POPUP → SCROLL POPUP → CLOSE POPUP → SCROLL PAGE** | `quickview`: tapping a card opens a dialog · it fits the visible viewport · Close is on screen, 44 px and reachable · the primary action is on screen and reachable · `html` and `body` are locked · **a finger drag scrolls the dialog's own content and the page behind does not move** · Close is still reachable after scrolling · Android Back closes it and the reader stays on `/books` · it opens again · tapping Close closes it · `html` and `body` are unlocked · **a finger scrolls the page again** (18 / 18). **And for every book:** `mobile:books` opens all **36** popups from the catalogue and closes each (36 / 36), checking the page is unlocked and still on `/books` after each. |
| **OPEN BOOK → VIEW PREVIEW → CLOSE / BACK** | `final`, on *a romance* (Weather Permitting) and *a reference book* (World Games): the book page renders, a finger scrolls it · "Read a preview" is a finger-sized control · the viewer opens and fits · Close is 44 px and nothing covers it · the page behind is locked · **a swipe left shows the next picture, a swipe right goes back** · the Next arrow works · Close closes it · the page is unlocked and a finger scrolls it again · it opens again · **the Android Back key closes the viewer and stays on the book** · the page is unlocked and scrolls after Back · a tile in the strip opens the viewer, and Back closes it (19 checks each). |

## 2. What was walked

| Brief §41 route | Result |
|---|---|
| `/` | the contract grid (no overflow, 44 px header controls, landmarks, one `<h1>`, safe-area gutter, the home shelf's **next card peeks**), the Core Web Vitals runs (§4), screenshots read |
| `/books`, `/ebooks` | `/books`: the popup of every one of the 36 books, across its three pages (36 / 36); no sideways scroll (`quickview`); both routes in the contract grid; screenshots read |
| `/books/<every book>` | **36 / 36** pages: the heading is the title, no sideways scroll, the cover decoded and is that book's own file, **the way to buy is inside the first screen**, every Amazon link is one of that book's editions, every Look Inside picture is that book's own, a row that scrolls shows a piece of its next tile, the author is the catalogue's, no console error |
| `/authors`, `/authors/<someone>` | author cards reachable and open the right page; Back returns to the list; **the arrow on all 31 cards is a circle; the author's name is on the first screen** (an author with a photograph and one with the initials mark) |
| `/about` | renders, no sideways scroll; **every shelf cover is a cover's 2:3 and the fan stays in its frame** |
| `/cart` | the shelf scrolls sideways, a finger swipe moves it, "+" is a finger-sized control that adds (the server's cart says so), Remove empties it again. **There is no quantity stepper, by design** (a digital licence is one per title): "cart plus" is the shelf's `+`, "cart minus" is Remove — both exercised; checkout was deliberately not completed (a real payment is not faked) |
| all `/bonus` routes | `/bonus`, `/weather-permitting-bonus`, `/long-way-back-bonus`: render, no sideways scroll, nothing locked on arrival, a finger scrolls, the email field is a finger-sized control |
| `/admin` + subviews | signed out: sent to sign in, nothing of the admin area on the page. Signed in (stub-auth copy): **all six tabs**, add → open → delete a contact, 44 px everywhere — **19 / 19** |
| also (the contract grid) | categories, a category, companion pages, blog, an article: no overflow, focus, landmarks, safe area, reduced motion |

## 3. The brief's §42 list, interaction by interaction

| Interaction | Where it is exercised, and what happened |
|---|---|
| tapping book cards | `quickview`, `final`, `books` (all 36) |
| opening / closing / scrolling the popup | `quickview` 18/18; `books` 36/36 |
| swiping the preview gallery | `final` ×2 books (swipe left, swipe right, the arrow); `books` steps the popup's "Next view" for every book |
| clicking Amazon buttons | `final`: opens amazon.com in a **new tab**, the opener is not handed over, the link is the edition's own, **this site's tab is where it was** |
| opening detail pages, returning with Back | `final`: card → popup → Full details → book page scrolls → Android Back returns to the catalogue, nothing locked, no popup left open |
| the mobile menu | the drawer opens, offers every destination, **moves focus into itself and gives it back** (a defect the phone found and `mobile-nav.test.tsx` now pins) |
| social links | `final`: all four networks, each a **48 px** target; X, Facebook and TikTok open a new tab or the installed app; **Instagram on a phone with the app raises Android's app chooser** — the harness presses Back and confirms Chrome has the focus again |
| cart plus / minus / arrows | above |
| author cards | above |
| detail-page Look Inside | the viewer (above); the row on the page |
| admin interactions | above |

**Attention list:** *touch targets* — the contract grid, `final` and `admin` fail any control under 44 px (the phone found and fixed five admin ones, the drawer's social icons at 44 where its rows are 48, and the catalogue toolbar earlier); *sticky elements* — the tab bar of a book page, the header, and the assistant button, which used to cover the words being read and now slides away on scrolling down; *body scroll lock* — measured on `html` and `body` after every close; *modal overflow* — the dialog must fit the visible viewport (392 × 718); *fixed headers* — the sticky header and the book page's sticky tab bar were read in screenshots at several scroll positions and the contract grid checks the search field clears the header; *viewport height* — 718 vs 845 with the toolbar, which is why every "first screen" assertion uses `innerHeight`; *safe area* — the header's safe-area gutter and the readable insets, checked on every route kind in the contract grid; *keyboard* — typed with the real soft keyboard in the admin form and the bonus pages' email field (the real IME cannot be raised over the first search result's position by script: modelled, flagged); *back navigation* — Android Back closes the top overlay only, returns from a book to the list, and from the Instagram chooser to the site.

## 4. Results

| Run (the final build unless said) | Result |
|---|---|
| popup lock, live site today | **9 / 18** — the original bug (§1) |
| popup lock, this build | **18 / 18** |
| `mobile:final` — the physical checklist | **89 / 89** |
| `mobile:books` — every published book, popup and page | popups **36 / 36**, pages **36 / 36** |
| `mobile:e2e` — journeys A discovery, B purchase, C Amazon + companion, E search | **44 / 44**, 3 deliberately not exercised (quantity — none exists; checkout — a real payment is not faked; the soft keyboard over the first result — modelled) |
| `mobile:journeys` — the contract grid over every route kind | **206 / 206**, 9 not testable on a phone |
| `mobile:admin` — the six tabs and the write path | **19 / 19** |

### Core Web Vitals on the phone — lab numbers, and one regression

`mobile:cwv`, the physical phone, **cache off, 1.6 Mbps down, 70 ms round trip**, median of three, the final build served over USB by `next start` (HTTP/1.1). **These are lab measurements on one device over an emulated link — not field data, not a 75th percentile; INP is the worst latency across a few scripted taps, a lab proxy.** The comparison column is the last run of the earlier mobile program on the same phone with the same instrument (`docs/execution/mobile/baseline/phase-9/cwv.json`).

| Page | LCP now | Earlier program | CLS | INP (proxy) | LCP element |
|---|---|---|---|---|---|
| `/` | **4,948 ms — POOR** | 1,880 ms | 0 | 80 ms | **the hero photograph** (127 kB AVIF) |
| `/books` | 3,228 ms — needs work | 3,328 ms | 0 | 216 ms | the first card's cover |
| `/books/weather-permitting` | 2,024 ms — good | 3,596 ms (`/books/meditations`) | 0 | 288 ms | the blurb's first paragraph |
| `/about` | 2,140 ms — good | — | 0 | 200 ms | a paragraph |
| `/authors` | 2,152 ms — good | — | 0 | 272 ms | an image |

**The home page regressed on this instrument, and the cause is known.** Before this update the home page's largest paint was *text* (a paragraph at 1.9 s); the new hero is a photograph of the real covers, and that photograph is now the LCP element. The trace (`paint` 1,956 ms for the first text, then the photograph at 4,900 ms) shows why it takes so long: it is 127 kB, but it shares a 1.6 Mbps link with about 580 kB of scripts and fonts, all requested within the first 150 ms over six HTTP/1.1 sockets — a link share, not a decode. Experiments on the phone (`npm run mobile:trace`): with the twelve below-the-fold shelf thumbnails and the film poster **blocked outright** the photograph lands at **4.1 s**; with them merely marked `fetchpriority="low"` (shipped — it does help `/books`, 3.78 → 3.23 s) **4.9 s**. So roughly 0.8 s is the images below the fold and **the rest is the JavaScript every page ships** — Clerk's two bundles and Sentry's chunk, loaded for visitors who never sign in (`FULL-SITE-AUDIT` §6, a decision for you). Two caveats that cut in opposite directions: the lab's HTTP/1.1 shares bandwidth between sockets regardless of priority, so **production (HTTP/2, where the browser's `fetchpriority="high"` on the hero is honoured) should do better than this** — I cannot show that before deploy; and on a really slow phone it is still the heaviest page. **After deploy, measure the real edge** (`npm run mobile:cwv -- --url https://valicepress.com --no-throttle --paths /,/books`, throttling stacked on a live link is misleading) and decide with real numbers. Options if the home page needs to be faster, in order of effect: defer Clerk and Sentry for signed-out visitors (≈ 200 kB less before the photograph), serve phones the 960 px hero (90 kB instead of 127 kB, at some softness), neither.


## 5. What the phone found that nothing else had

Ten defects, each of which passed an automated suite first (the checklist was 82 / 82 and the journeys 44 / 44 while the last five stood). Each is fixed, pinned by a measurement, and the measurement was run against a build of the code from before the fix to see it fail (`PHASE-LOG.md`, Phase 14):

1. A book's price and buy button sat **1,070 px down a 718 px screen** → a compact two-column header; the buttons are the full width of the column.
2. Opening the menu left **focus on the page behind it**.
3. The drawer's social icons were 44 px where its rows are 48.
4. The assistant button **covered the words being read**.
5. Admin table links, pill buttons, day-range chips and the brand link were under 44 px.
6. **`/about`: every cover on a shelf card was cut to a square**, its title sliced through the middle — at every width.
7. **An author card's arrow was squeezed into an oval** when its label wrapped.
8. A book's **Look Inside row showed one picture and nothing to say there were more**, with a hole under the banner.
9. An author's page opened on a 453 px portrait; **the name began at the bottom edge** of the screen.
10. `/about` asked for images sized for a full-width card at tablet widths.

## 6. Harness facts that changed what the phone reported

- **A rect is not a finger.** `getBoundingClientRect()` is in layout-viewport coordinates, `Input.dispatchTouchEvent` in visual-viewport coordinates. They agree until Chrome's toolbar collapses and `visualViewport.offsetTop` is no longer 0 (127 on a contact's page), and then a tap at the rect's centre lands that far below the control. The admin delete flow failed twice for this reason; `final.mjs`, `admin.mjs` and `books.mjs` subtract the offset.
- `mobile:e2e` and `mobile:journeys` default to port 3100, not 3210 — run them with `MOBILE_BASE_URL=http://localhost:3210`.
- `adb forward` / `adb reverse` can be lost after a long run (a CDP timeout is the symptom); re-create them with `adb forward tcp:9222 localabstract:chrome_devtools_remote`, `adb reverse tcp:3210 tcp:3210`, `adb reverse tcp:3211 tcp:3211`.
- With the soft keyboard up the first tap only dismisses it: blur, then tap.
- A screenshot of the phone is taller than the page's viewport (the black band at its foot is the capture frame, not the page).

## 7. Not done

- **Checkout.** Completing a purchase means a real payment-provider transaction, which the brief forbids faking, and the payment provider is not configured in this environment.
- **The production Clerk sign-in** (a phone cannot sign in to it from `localhost`). The signed-out gate was exercised on the phone; the signed-in admin through the stub copy.
- **A Note 11R.** See the top of this document.
- **The live deployment.** The build under test is local; after the deploy the same scripts take `--url https://valicepress.com` for a read-only pass.
