# The private web reader — architecture

Status: **built and security-audited; real-purchase verification BLOCKED.**
See §12 for what is blocked and why.

---

## 1. The chain, end to end

```
  Lemon Squeezy checkout
          │  order_created, HMAC-signed
          ▼
  POST /api/webhooks/lemonsqueezy ──┐ signature first, before any parse
          │                          │ meta.event_name decides, not the header
          ▼                          │ orders.mor_order_ref UNIQUE ⇒ idempotent
  processPaidOrder()                 │
          │                          └─ src/lib/payments/lemonsqueezy/webhook.ts
          ├── users          (JIT upsert by email)
          ├── orders         (UNIQUE mor_order_ref)
          ├── order_items
          └── entitlements   (UNIQUE user_id+book_id, status 'pending')
                    │
                    ▼  Inngest event
          watermarkOneBook()
                    │  master PDF ← R2 MASTERS
                    │  stamp buyer name + short order id
                    │  artifact   → R2 ARTIFACTS
                    ▼
          entitlements.status = 'ready', watermarked_key set
                    │
   ┌────────────────┴─────────────────┐
   ▼                                  ▼
/account/library                 /read/[bookId]
   │                                  │
   │  getUserLibrary(userId)          │  openReaderGate(bookId)
   │  + reading_progress              │       │
   │  "Continue reading"              │       ├─ uuid shape
   └──────────────────────────────────┤       ├─ Clerk session → local user id
                                      │       └─ resolveEntitlementAccess
                                      ▼
                            <BookReader> (client)
                                      │  pdf.js, HTTP Range
                                      ▼
                   GET /api/read/[bookId]/content
                                      │  openReaderGate AGAIN, every request
                                      ▼
                   R2 ARTIFACTS ── server-side signed read ── stream
```

**The rule the whole diagram exists to state:** every arrow that touches book
bytes passes through `openReaderGate`. There is no second path.

---

## 2. Authentication

Clerk, already in the codebase, unchanged by this work (directive §14: do not
invent a parallel system).

**The identity/data split.** Clerk owns *who the user is*. Postgres `users`
owns *what they bought*. The two reconcile on email via `upsertLocalUser`,
called just-in-time. Clerk's production instance serves
`accounts.valicepress.com` with `pk_live_` keys.

Two entry points, deliberately different:

| | `loadAuthenticatedLocalUser()` | `getCurrentLocalUserIdReadOnly()` |
|---|---|---|
| Creates a `users` row | yes (JIT upsert) | **no** |
| Used by | pages that need an account | the reader gate, cart, ownership checks |
| Anonymous | structured notice | `null` |

The reader gate uses the read-only one on purpose: probing `/read/<uuid>` must
not be able to create rows.

**Route protection** (`src/proxy.ts`): `/account`, `/admin`, `/order`, `/read`
are behind `auth.protect()`, which redirects an unauthenticated visitor to
sign-in and returns them to the requested URL afterwards (§73, verified).

`/api/read/*` is deliberately **not** in that matcher. It authenticates inside
the handler instead, so that every refusal is one uniform 404 rather than a
307 to a sign-in page — a redirect would be a distinguishable response shape,
and pdf.js would follow it and receive HTML. Defence in depth is preserved by
the gate being the handler's first statement, before any other work.

---

## 3. Entitlements

One row per `(user, book)`, enforced by `entitlements_user_book_uk`.

| status | library | reader | asset route | meaning |
|---|---|---|---|---|
| `pending` | "Preparing your copy…" | a page saying so | 404 | paid, watermark in flight |
| `ready` + key | Read / Continue | opens | streams | the normal state |
| `ready`, no key | "Preparing…" | as pending | 404 | a state that must not read as ready |
| `revoked` | "Access revoked." | 404 | 404 | refund, chargeback, support action |

**Perpetual by design.** There is no expiry column and no TTL. A purchase is
a perpetual grant, and the only thing that closes it is an explicit commerce
event. Directive §17 asks for this to be stated deliberately rather than
assumed — it is stated here, and §45 covers the events that reverse it.

**`resolveEntitlementAccess` is the one place the rule lives**
(`src/lib/db/queries/ownership.ts`). Ownership is a WHERE clause on a UNIQUE
index, so a caller can only ever resolve an entitlement for the user id it
passes — cross-user access is not guarded against, it is unrepresentable.

---

## 4. Product → book mapping

```
Lemon Squeezy variant id  →  books.provider_price_id  →  books.id
```

Two resolution paths in the webhook, in order of trust:

1. `meta.custom_data.book_ids` — what *we* put into the checkout.
2. Fall back to `first_order_item.variant_id` → `getBookIdByProviderPriceId`.
   This is the path a purchase made straight from the Lemon Squeezy storefront
   takes; it carries no custom data at all.

The client never selects the file. The server resolves
`authenticated user + validated entitlement + book id` and only then reads a
storage key that it looked up itself.

`books.paddle_price_id` is retained but read by nothing that takes money; a
Paddle-era order must stay answerable.

---

## 5. Asset storage and delivery

Two private R2 buckets, no public read on either:

- **MASTERS** — one source PDF (and EPUB where it exists) per book.
- **ARTIFACTS** — one watermarked PDF **per order**, at
  `<orderId>/<uuid>.pdf`.

**Delivery: an authenticated same-origin streaming proxy.**
`GET /api/read/[bookId]/content`:

1. `openReaderGate(bookId)` — uuid shape, session, entitlement, readiness.
2. On refusal: charge the denial throttle, write one audit row, return a bare
   404 with an empty body.
3. On success: `streamObject(ARTIFACTS, key, range)` and relay R2's response,
   including `206` and `Content-Range`.

**What changed, and why it mattered.** The previous implementation minted a
ten-minute presigned R2 URL server-side and put it in the page's HTML for
pdf.js to fetch. Signed URLs are explicitly permitted by §75 as an internal
mechanism — but that one was not internal. It was a bearer credential for the
complete book, sitting in the document, readable by any extension, any
screenshot, any `view-source`, for ten minutes, with no session required.

The URL in the page is now `/api/read/<bookId>/content`, which is not a
credential at all. Copy it, send it to a friend, open it in another browser:
without that account's session it is a 404. The signed URL still exists — it is
minted between the route handler and R2 and never crosses to the client.

**Response headers on that route:**

```
Cache-Control: private, no-store, max-age=0, must-revalidate
Pragma: no-cache
Vary: Cookie
Content-Type: application/pdf          (fixed, never echoed from storage)
Content-Disposition: inline; filename="edition.pdf"   (leaks no slug or key)
Accept-Ranges: bytes
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-Robots-Tag: noindex, nofollow, noarchive
```

**Range requests are the architecture, not an optimisation.** pdf.js fetches
the file's tail, reads the cross-reference table, and then asks only for the
byte ranges backing the pages on screen. Codex Bestiarium's artifact is
**109 MB**; it opens after tens of kilobytes. `disableAutoFetch: true` stops
pdf.js speculatively pulling the rest once idle.

---

## 6. The reader engine

One engine, 27 books (§25). `<BookReader>` receives an id, a title and a cover
path. Everything else — page count, page geometry, table of contents — is read
from the PDF the customer owns. Adding a title requires no code.

```
src/components/reader/
  reader-engine.ts      pure: spreads, progress, motion budget, warm set
  use-pdf-document.ts   pdf.js load, outline, offscreen page render, LRU cache
  book-reader.tsx       state, turn, chrome, drawers, cover gate
  reader.css            stage, leaves, turn, volume, drawers
```

**Spread model.** `[null,1]`, `[2,3]`, `[4,5]`… — the recto rule. In `single`
layout (phones, and any reader who prefers it) each page stands alone. Progress
records the **left** page of an opening: recording the right page would creep
the resume point forward by one on every session.

**Rendering.** Each page renders once into an offscreen canvas held in a
six-entry LRU (`PAGE_CACHE_LIMIT`); the two visible leaves blit from it. The
cache key includes the render width, so a zoom change is a miss rather than a
blurred hit. Eviction zeroes the backing store to release pixels immediately.
Device pixel ratio is capped at 2 — a 3× phone rendering a full-bleed page
costs four times the memory for no visible gain at five inches.

**The turn.** Clone the outgoing leaf's bitmap into a fresh canvas, append the
clone, write the new opening underneath, wait two frames, add the trigger
class, let CSS run `rotateY(±180deg)` over 760ms. `backface-visibility:
hidden` reveals the new page past 90°. `will-change` is held only for the
turn.

Three hardenings the reference does not have, each from an observed failure:

- **A `setTimeout(trigger, 64)` beside the double `rAF`.** In a backgrounded
  tab `requestAnimationFrame` is suspended, the trigger never fires, and the
  clone sits over the new opening until the removal timeout.
- **`transitionend` is filtered on `event.target === clone && propertyName ===
  "transform"`.** The event bubbles, and the curl's opacity transition ends at
  45% of the turn — unfiltered, it tears the leaf away mid-rotation.
- **One render-task slot per leaf.** Both leaves paint concurrently; a shared
  slot means the second overwrites the first and cleanup cancels only one.

**Motion budget.** `choosePerfMode` reads `hardwareConcurrency`, `deviceMemory`,
pointer coarseness and viewport width, with `prefers-reduced-motion` overriding
all of them. Read through `useSyncExternalStore` rather than copied into state
by an effect, so a reader who turns reduced-motion on mid-book gets the change
on their next turn.

---

## 7. Library

`/account/library` lists only rows `getUserLibrary(userId)` returns, and that
query is keyed on the caller's own id. Each tile carries cover, title, status,
a reading-progress bar and **Continue reading** when there is a position.

Reading positions are fetched in **one** query for the whole shelf and matched
in memory — thirty books would otherwise be thirty round trips to a serverless
Postgres.

A position of page 1 with no further movement renders as *no* progress: "opened
and went no further" is not "in progress", and a 0% bar on every tile is noise.

---

## 8. Progress and bookmarks

| | table | key | written by |
|---|---|---|---|
| Progress | `reading_progress` | UNIQUE `(user_id, book_id)` | `syncReadingProgress`, debounced 1.5s |
| Bookmarks | `bookmarks` | UNIQUE `(user_id, book_id, page)` | `toggleBookmarkAction` |

Both are **ownership-gated, not merely authenticated**. A signed-in visitor who
owns nothing cannot accumulate rows against the catalogue. Both are UPSERT or
`ON CONFLICT DO NOTHING`, so the database is the lock: two tabs, a double
click, or two devices converge rather than duplicate.

Bookmarks survive revocation. What a refund closes is the reader; the marks a
customer made are their own record and are governed by retention policy, not
by the refund.

Multi-device progress is last-write-wins, stated plainly rather than
engineered around (§82).

---

## 9. Audit trail

`reader_access_events`, append-only, written only by
`src/lib/db/queries/reader-audit.ts`.

Outcomes: `reader_opened`, `denied_unauthenticated`, `denied_not_owned`,
`denied_not_ready`, `denied_malformed`, `asset_unavailable`.

**Success is logged once per opening, never per byte.** The asset route is hit
dozens of times per reading session; logging those would bury the denials the
table exists to surface.

**It holds no IP address, no user agent, no URL, no email and no storage key.**
A row can tell an operator that one account was refused eleven books in a
minute. It cannot be used to reconstruct what a named person reads.

`entitlements.last_read_at` answers "has this customer ever actually got in" —
a question neither `last_downloaded_at` (null for an online-only reader) nor
`reading_progress.updated_at` (only moves on a page turn) can answer.

Every write here swallows its own errors. A failed audit insert must never
become a customer who cannot open a book they paid for.

---

## 10. Rate limiting

Two layers:

1. **Perimeter** (`src/proxy.ts` → `checkRateLimit`): 100 requests / 10s per IP,
   sliding window, Upstash. Fails open.
2. **Denial throttle** (`src/lib/reader-throttle.ts`): 10 *refusals* per minute,
   keyed on the authenticated account where there is one. Counts refusals only,
   so reading a 400-page book never touches it.

The second exists because the first is the wrong shape for this abuse: at 600
requests a minute an account can walk a 30-book catalogue many times over and
never approach the ceiling. What is anomalous is not volume, it is *refusals* —
an owner is refused zero times.

Upstash when configured, a bounded in-process ring otherwise. Failing open is
the house rule; the cost — an attacker who can take out Upstash also lifts the
throttle — is recorded in the threat model rather than hidden.

---

## 11. Caching and headers

Every private surface is `dynamic = "force-dynamic"`; the asset route adds
`private, no-store` and `Vary: Cookie`. Site-wide headers from
`next.config.ts`: CSP with `frame-ancestors 'none'`, `X-Frame-Options: DENY`,
`nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy`, and HSTS in production. The reader page is
`robots: noindex, nofollow, nocache`.

`worker-src 'self' blob:` is why pdf.js's worker is copied into `public/` at
install time rather than loaded from a CDN.

---

## 12. Failure modes

| Failure | Behaviour | Why |
|---|---|---|
| Watermark still running | reader shows "still being prepared" | the one refusal that is not a 404 — the customer owns it |
| Watermark failed | same page; support view names the job and its error | the customer should not read a stack trace |
| Artifact missing from R2 | `502`, loud server log, audit row | entitlement good, storage bad — an operational fault |
| R2 unreachable | `502` | same |
| Session expires mid-read | next range 404s; reader says "sign in and open it again" | pdf.js reports it as `MissingPDFException` |
| Upstash down | both limiters fail open | never lock a paying reader out of their book |
| Database down | library degrades to empty; reader 404s | `safeQuery` fallbacks |
| Clerk env missing | structured notice, not a 500 | unprovisioned preview environments |
| Backgrounded tab mid-turn | timeout trigger completes the turn | rAF is suspended there |
| **Lemon Squeezy webhook secret unset** | **webhook 503s; no entitlement is ever created** | **see below** |

**The live blocker.** Production has `LEMONSQUEEZY_STORE_ID` but neither
`LEMONSQUEEZY_API_KEY` nor `LEMONSQUEEZY_WEBHOOK_SECRET`. Verified by making
the system do the thing rather than by checking for the variable: an unsigned
POST to `https://valicepress.com/api/webhooks/lemonsqueezy` returns **503**,
which is the code the handler emits when the signing secret is absent (a
configured endpoint returns 401 for a bad signature).

Until those two variables are set, no purchase can create an entitlement, and
the reader has nothing to open. This predates the reader work and is not
caused by it.

---

## 13. Asset versioning

Masters are stored under `books/<slug>/master/v1/master.pdf` — the `v1` is a
real version segment and the schema keeps `books.master_file_key` as a full
key rather than a derived path.

Artifacts are per order (`<orderId>/<uuid>.pdf`) and therefore **immutable**.
Re-cutting a book and uploading `master/v2/` changes nothing for existing
buyers: their artifact was stamped from v1 and is still there, still theirs.
New purchases get the new edition.

That is the deliberate policy: **a customer keeps the edition they bought.**
Upgrading an existing buyer to a new edition means re-running the watermark
worker for their entitlement, which is an explicit operator action and not
something a catalogue load does silently.

A stale resume point is clamped rather than trusted, so a shorter re-cut cannot
resume a returning reader into a page that no longer exists.

---

## 14. Provenance

Nothing in the reader strips provenance. The PDF the customer reads is the same
typeset artifact the press produced, including its title page, copyright page,
source attribution and the public-domain statements its apparatus carries. The
watermark adds one footer line (buyer name and short order id) and removes
nothing.

The distinction the catalogue maintains — original Valice editorial content,
public-domain source material, generated visual assets, licensed assets — lives
in the book itself and in `valice-catalog.mjs`, and the reader displays the
book rather than reinterpreting it.
