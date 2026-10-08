# Past Decisions — Locked Architectural Constitution

> Source of truth: `WEB_SITE_ROADMAP.md` (§2 facts, §8–§12 ADRs). **Consult this file before proposing or changing any architectural direction.** These decisions are **locked**; reopen only if a listed assumption is invalidated (see roadmap §2.2 and §19 "what would change the plan").

## Complexity tier
Tier 2 — mid-complexity transactional content platform. Build a **modular monolith** on managed/serverless infrastructure. Do not over-engineer.

## Locked product decisions (Phase-0 gate)
- **Supply model:** First-party catalog — we own/license the titles. No multi-vendor marketplace.
- **Monetization:** One-time purchase per book (à la carte, perpetual ownership). No subscription.
- **Content protection:** Social DRM — per-buyer PDF watermarking. No hard DRM.
- **Market:** B2C, global (English-first, i18n-ready).
- **Delivery:** Downloadable PDF **and** online reading.

## Locked architectural decisions
- **Frontend — Next.js (App Router), SSG/ISR-first.** Catalog pages are statically rendered for SEO (the growth engine); account/reader surfaces are dynamic and auth-gated. (ADR-1)
- **Database — PostgreSQL on Neon (serverless) via Drizzle ORM + drizzle-kit.** Relational + ACID for fulfillment correctness; schema per the §10 ERD. *(Committed in SUB-PR 0.3.)* (§10)
- **Authentication — Clerk via `@clerk/nextjs`.** Hosted identity (social + email/magic-link) and route protection via `clerkMiddleware`. The Postgres `users` table holds the commercial relationships; a future Clerk-webhook syncer reconciles identity into the local row. *(Committed in SUB-PR 0.5.)* (ADR-8)
- **File storage — Cloudflare R2 (zero egress).** Selling downloads = sustained egress; R2's $0 egress makes cost near-fixed. S3-compatible, so portable. (ADR-6)
- **Payments — Paddle as Merchant of Record (MoR).** Offloads global VAT/sales-tax, PCI scope, and much fraud/chargeback liability. **Not** raw Stripe; Paddle chosen over Lemon Squeezy for broader tax-jurisdiction coverage. *(Committed in SUB-PR 1.5.)* (ADR-2)
- **Content-protection pipeline — async Social DRM.** On the MoR purchase webhook, an idempotent worker (Inngest / Vercel Queues) stamps a per-order watermarked PDF, stores it privately in R2, and serves it via short-lived signed URLs. (ADR-3)

## Explicit rejections
- **Microservices** — rejected at this tier. Enforce module boundaries inside one deployable app to preserve the option to extract a service later. (ADR-7)
- **Hard DRM** (Readium LCP/Adobe), **self-hosted infrastructure**, **custom tax/payments stack**, and **multi-region active-active DB** — out of scope (see roadmap right-sizing).

## Re-open triggers
A publisher hard-DRM mandate (→ Readium LCP), a funded team / high volume (→ revisit Stripe-direct), or a shift to subscription/marketplace would reopen these. Until then, treat as fixed.

---

## Phase 4 — catalog and channel decisions (2026-08-31)

These are commercial and data decisions, not architectural ones, but they
constrain code and were being re-derived (and re-got-wrong) each phase.

- **Publication is data, not an action.** A book reaches `published` only
  because `websiteStatus: "published"` sits next to its blockers in
  `scripts/catalog/valice-catalog.mjs`, where the decision is reviewable in a
  diff. The loader applies that decision and demotes as well as promotes.
  Never publish or unpublish by editing the database directly.

- **Three statuses, never conflated.** `websiteStatus` (do we list it),
  `format.kdp` (what Amazon holds), `directSale` (may we sell the digital
  edition ourselves). They move independently. A book can be live on Amazon
  and unsellable here.

- **KDP Select is exclusivity and is enforced in code.** *Codex Mythologica*'s
  Kindle edition is enrolled. Its digital edition may not be sold anywhere but
  Amazon while that stands. A test fails if a Select-enrolled book is ever
  flagged for direct sale — do not "fix" that test.

- **A price of 0 means "not sold here", never "free".** Amazon-only titles
  carry `price_cents = 0`. Use `formatCatalogPrice`, and emit **no** JSON-LD
  Offer. Rendering it as `$0.00` advertised a free download of a $4.99 book.

- **An Amazon link requires a verified ASIN, and an ASIN requires
  `kdp: "live"`.** Amazon issues an ASIN at publication, so an ASIN on a title
  in review or never created is by definition invented. Gated in the loader
  and in tests.

- **The digital edition is a separate artifact from the print interior.**
  Print interiors are 40–121 MB; the fulfillment worker reads the whole file
  into memory in a serverless function. `build-digital-editions.mjs` cuts a
  150 DPI edition (108 MB → 4.6 MB). Never point `master_file_key` at a print
  interior.

- **`books.master_file_key`, not just `book_formats.master_file_key`.** The
  watermark worker is handed a bookId and has no format in scope. Writing only
  the format row leaves the book unfulfillable — purchase completes,
  entitlement sticks at `pending` forever.

- **Public-domain editions are direct-first.** KDP caps public-domain content
  at the 35% royalty tier; this store nets ~90% after Paddle. A PD edition
  earns more than double here. The original-contribution work is still what
  makes the edition worth buying — see `PUBLIC_DOMAIN_BATCH_1_PLAN.md`.

- **Never invent a rating.** Zero reviews renders as no stars at all — not
  `0.0`, and not a "decorative" constant. `rating: 0` means absent everywhere.

- **Provider credentials are verified by use, never by presence.** Four of the
  five integrations were configured with a wrong-but-plausible value that a
  presence check passed: a docs placeholder, a notification-setting id in
  place of a signing secret, an invalid signing key, and stale R2 keys. Assert
  behaviour, not `process.env.X !== undefined`.

- **A Project Gutenberg transcription has two authors, and the file says which
  is which.** Kwaidan shipped with thirty-six notes printed under a heading
  reading *Hearn's Notes* that PG's volunteers had written, plus thirty-six of
  their call-marks inside his sentences. An author's footnote carries an anchor
  and a back-link to the sentence that calls it; a note nobody's sentence calls
  carries neither. `COMMON-AREA/checks/source_layers.py` does the split, and the
  factory-wide sweep of 2026-09-08 found Kwaidan is the only book affected.

- **Run a new instrument over every book that predates it.**
  `check_source_claims.py` was written for British Goblins, after Kwaidan was
  built, and nobody went back. Running it on Kwaidan found five P0s including
  twenty glossary cross-references pointing at the wrong tale. A checker only
  protects the books it has been run on.

- **A count printed on a cover must be read from the data that produced it.**
  The Kwaidan back cover said "the ten old provinces" while the gazetteer inside
  the same book had twelve, because the blurb was a string in the cover script.
  Cover, companion-leaf and companion-sheet counts now read `len(...)`.

- **A refused source is a decision, not a failure.** `rights-lint` reported a RED
  row as an error, which made a book that had looked at an uncleared layer and
  declined indistinguishable from one that shipped it. `used: false` on the
  project's source row earns a PASS; a source marked unused against a GREEN row
  earns a warning, because that is bookkeeping rather than a refusal.

- **A skipped check reads like a passing one.** `compliance-lint` reported "no
  built interior registered for kwaidan" as a *skip* for two days. Registering
  the interior in `print-interiors.mjs` surfaced two real errors immediately.

## Web front end — animation, measurement and delivery

- **Changing a CSS `animation-duration` moves the clock, it does not change the
  speed.** A CSS animation's progress is `currentTime ÷ duration`. The shelf's
  hover slowdown was `animation-duration: calc(var(--d) * 2.6)` on `:hover`,
  which keeps `currentTime` and multiplies the denominator — so progress is
  divided by 2.6 and the track teleports. Measured a quarter of the way through
  the cycle: a -623px jump, 4.2 card positions, on every hover in and out. It
  read as "the book jumps four places when I touch it", and it was blamed on
  reordering, which never happened. **Change speed with the Web Animations API
  `playbackRate`**, which by specification updates the start time so
  `currentTime` is preserved: the pace changes and the position cannot. Ramp it
  over a few hundred ms with one short-lived rAF if you want deceleration rather
  than a gear change. Never `animation-play-state: paused` on a looping marquee —
  a shelf that stops dead reads as broken, and parking on it is how a visitor
  finds the duplicated seam.

- **`will-change: transform` on a very large animated element is the trap it
  warns about.** On a 10,131px marquee track it pinned a permanently rasterised
  compositor layer and made the renderer unresponsive — screenshots timed out and
  an unrelated hero painted black. Leave it off and let the browser promote and
  tile the layer for the duration of the animation.

- **`overflow-x: auto` cannot constrain a box its own content is allowed to
  widen.** A grid item's `min-width` is `auto`, i.e. content-based, so a
  horizontally scrolling rail inside an implicit (auto-sized) grid column sizes
  the *column* instead of scrolling. On a phone the document went 1848px wide
  against a 393px screen and Chrome zoomed the whole page out — `innerWidth`
  read 1571 on a 1080px device. Give the track an explicit column and `min-w-0`.

- **A fixed corner control owns the bottom of every screen.** The AI launcher is
  `fixed bottom-4` and 56px tall, so nothing interactive may sit in the bottom
  ~88px at rest. On a phone the hero's bottom-anchored CTAs landed there. Budget
  for it in the section's own spacing.

- **Visual QA in a background tab measures nothing.**
  `document.visibilityState === "hidden"` throttles animation, rAF and
  compositing: screenshots come back stale, correctly-painted sections look
  black, and a pending rAF never fires (which also masks event handlers that
  guard on `if (!raf)`). Force a repaint before judging a screenshot, and verify
  motion through the Web Animations API and pixel sampling rather than images.
  Better: attach the Redmi over `adb` — it found two mobile defects in one
  session that no desktop measurement could have.

- **A gift email cannot carry a big book, and must not carry a storage URL.**
  Three masters are past every provider's ceiling (104MB, 93MB, 67MB; Gmail
  itself stops at 25MB). The old fallback pasted ~700 characters of signed R2 URL
  into the body, exposing the account id, bucket name and object path, and it
  expired in fifteen minutes. Deliver a first-party `/download/<token>` instead:
  the token names a *request row*, never a file, so editing the URL cannot select
  another book and `..` cannot escape anything. Store it rather than signing it
  so it can be expired, counted and audited. Stream the object — reading 104MB
  into a Buffer inside a serverless function finds its memory ceiling.

- **"The provider accepted it" and "the reader got it" are different claims.**
  Record the provider's message id on the row; without it an empty mailbox leaves
  nothing to pull on. And a provider that says `delivered` still is not a
  mailbox: the only proof that the right bytes reached the right person is
  opening the inbox and reading the message. Two of four test sends this session
  could be read; the other two are reported as provider-confirmed only, because
  that is what was actually established.

- **A formula that is its own reciprocal at 1 will pass every test written at
  1.** The shelf's speed calibration was `(lane / PX_PER_SECOND) * 1000 /
  duration` where the answer is `PX_PER_SECOND * duration / (lane * 1000)` — the
  reciprocal. The two agree at exactly one point, and the desktop lane sits there
  (6534px over 192s is 34.03 px/s), so every desktop measurement read 34.06 px/s
  and the line looked right for as long as nobody measured anything else. A real
  Redmi Note 8 read 16.07 px/s, and the error ran the wrong way: the narrower the
  screen, the slower the shelf, when a narrower lane should ask for a *faster*
  rate. **Test a scaling law at two points that disagree**, and prefer a real
  second device over a second synthetic width — this is [[agreement-does-not-identify]]
  applied to arithmetic.

- **A link that expires is not yet a link that is private.** A 72-hour download
  URL is, for three days, a public mirror of whatever it points at; the reader who
  pastes it into a group chat never finds out. Cap the *opens* as well as the
  clock. But do not make it single-use: an endpoint that answers Range requests
  is asked for byte 0 by a resuming download, seven more times by a download
  manager, and once more by a mail client generating a preview. Count only a
  fresh start — no `Range`, or a `Range` from byte 0 — and set the ceiling where
  no real reader reaches it and a posted link stops paying out.

- **A broken instrument reports a defect that is not there, and that costs more
  than silence.** A background tab measured "11 covers inside the viewport have
  not loaded", which would have meant an empty shelf in production. On the phone,
  genuinely visible and focused, the same measurement returned 0 — Chrome
  suspends `loading="lazy"` fetches in a hidden tab. Before reporting a defect
  found by a measurement, check that the measurement itself was taken in a state
  where the answer can be true. See [[measuring-instruments-fail-safe]].

## Site update 2026-10, Phase 9 — three rules the cart paid for

- **Nothing that belongs to one visitor may live at module scope.** `cart.ts`
  kept one `EMPTY_CART = { items: [] }`, returned it whenever the cookie was
  missing, and `addToCart` pushed into it — so the first cookie-less add put a
  book into every other cookie-less visitor's cart on that server instance, and
  "+" on that title said "already in your cart" while writing no cookie. A server
  process outlives every request. Defaults are factories (`emptyCart()`),
  operations are pure and copy (`addItem` / `removeItem` / `pruneItems`), and the
  regression test takes a fresh cookie jar per visitor and a fresh browser
  context per visitor (`e2e/cart.pw.ts`, "a visitor with no cart cookie…"). It
  was found because a fixture changed with no data change; chase those. See
  [[shared-module-object-leaked-the-cart]].

- **A control shows what the server says, not what was pressed.** The cart is an
  httpOnly cookie the page cannot read, so the browser asks `/api/cart/count`
  (`{ count, ids }`, books that still exist) once per change (`cart-store.ts`):
  newest answer wins, a failed read changes nothing, one request per page. The
  "+" becomes a tick only when that answer contains the book; the product page's
  button becomes "In your cart — view cart" and stays. That store *reads* the
  cart; it is not a second cart.

- **A shelf offers only what its button can do.** The cart's "You might like"
  was the first eight published books, five of them Amazon-only with no "+" —
  and a reader who finds no "+" where one belongs concludes it is broken.
  `isAddable` (`src/lib/sellable.ts`: price > 0 AND a live checkout) is now the
  single rule — `addToCart` on the server, the cart page's payable lines, every
  "+" and both recommendation shelves call it, so a button cannot promise what
  the server will refuse. (The product page keeps its richer `sellsHere`, which
  also asks whether a direct ebook edition exists.)

## Site update 2026-10, Phase 10 — seven rules the admin area paid for

- **The admin area reads the catalogue; it never writes it.** The old dashboard
  carried a create-book form and per-book publish / edit / hard-delete actions
  that wrote catalogue rows straight into the database — around the catalogue
  tests, around the KDP-Select rule, and undone by the next loader run. A book
  changes in `valice-catalog.mjs` and `load-catalog.mjs` applies it; `/admin/books`
  is read-only by design, and there is no form to bring back.

- **Admin access is one decision, asked at every door.** `evaluateAdminCandidate`
  (pure, `lib/auth.ts`) is the decision: a non-empty allow-list, the *primary*
  address on it, and verified by Clerk. It is asked by the proxy, by each page
  (`loadAdminContext`), each query (`requireAdmin()` first), each server action
  (`adminActionDenial`) and each route (`adminRouteDenial`) — an action is a
  public POST endpoint, so a hidden button is not access control. A refusal says
  only that it is one; it never prints the allow-list or the address. A route
  that *does* something refuses `Sec-Fetch-Site: cross-site` even with a valid
  admin cookie, because cookies ride a cross-site GET.

- **No gate has a way around itself, so the signed-in tests run on a copy.** There
  is no flag, header or environment variable that opens `/admin`. `npm run
  test:e2e:admin` builds a throw-away copy in /tmp with the identity function
  replaced by exact-string patches (it fails loudly when a pattern is missing),
  on loopback only, against the sandbox database only, third-party keys blanked.
  When `requireAdmin` changes, update the patch in `scripts/e2e/admin-harness.mjs`:
  it replaces from `export const requireAdmin = cache(` to the end of the file,
  so keep that export last.

- **A number that cannot be read is not zero.** Every overview figure is *read*,
  *unavailable* or *error* (`Stat<T>`, `readStat`) and is said in words —
  "Sales data unavailable — no connected sales source". A failed query used to
  come back as "0 orders · 0 users", which turned an outage into a quiet day.
  Drizzle wraps the driver's error, so a missing table is recognised by walking
  `cause`.

- **Consent changes follow written rules, and the rules live below the form.**
  `lib/admin/contact-rules.ts` (pure, tested, each rule mutation-checked): a new
  contact is not subscribed; the only way to a mailable one is evidence, in words;
  nobody who unsubscribed can be re-subscribed from the admin area; a duplicate
  mailbox (Gmail dots, `+tags`) is a warning with "add anyway", never a silent
  merge. Change a rule there, not in a component.

- **A form that can answer "not yet" must not rely on `<form action>`.** React 19
  clears the uncontrolled fields after every submission, so a validation error or
  an alias warning wiped what had been typed and "add anyway" sent an empty
  address. `useAdminForm` submits through `onSubmit` + `startTransition`. See
  [[react19-resets-uncontrolled-action-forms]].

- **A client effect that keeps the address bar in step writes only when the
  address would change.** `catalog-shell.tsx` replaced `/books` with `/books`
  ~300 ms after every mount; on a cold or slow router that was a needless server
  round trip, and when the visitor left meanwhile Next fell back to a browser
  navigation to the page they were leaving (Firefox: a hard navigation to /cart
  ended on /books, 8 of 8). Found because one test of 582 failed once. See
  [[trace-before-flake-verdict]].
