# Admin consolidation report — 2026-10

Branch `feat/site-update-2026-10` · built in Phase 10 (`8fda5a1`), touch targets finished in Phase 14 (`2d43ec9`). Every number is from a run in this repository or on the physical phone; nothing is estimated.

## 1. What the brief expected, and what was there

The brief expected several competing admin dashboards. The audit (Phase 0, `VALICE-PRESS-SITE-ARCHITECTURE-AUDIT.md` §4) found **one gated admin area made of five unrelated pages** — no shared layout, five hand-rolled copies of the gate, two copies of the error mapper, and a way between the pages only through three links on the dashboard. The real problems were worse than duplication:

| Found | Why it mattered |
|---|---|
| The dashboard wore a **create-book form and per-book edit / publish / hard-delete actions that wrote catalogue rows straight into the database** (`admin/actions.ts`, 528 lines) | They bypassed the catalogue tests and the KDP-Select rule, were overwritten by the next catalogue load, and are exactly what `CLAUDE.md` forbids ("never edit catalog rows in the database") |
| **An unsubscribe never reached the contact book** — the route talked to Resend only | The "Suppressed" and "Mailable" counts the whole email page is built around could not move |
| The email page was **read-only** | The brief asks for email management |
| A failed query came back as zeros (`safeQuery` → "0 orders · 0 users") | An outage read like a quiet day |
| `requireAdmin` — the one door every admin page, query, action and API route passes through — **had no test** | |
| A refusal printed `err.message` ("User a@b.com is not on ADMIN_EMAILS") | Told a stranger how the gate works |

**Admin systems before: 1 area, 5 pages, 5 hand-rolled gates, no shared layout. After: 1 shell, 6 tabs, 1 gate** (the old pages are gone, their addresses redirect).

## 2. What there is now

`/admin` — one layout (`admin/layout.tsx`), six tabs: **Overview · Books · Email · Free books · Reader support · Site data.**

| Address | What | Before |
|---|---|---|
| `/admin` | Overview — every figure is *read*, *unavailable* or *error* (three states, never a silent zero) | revenue/orders table + create-book form |
| `/admin/books` | Books — **read-only** ("Not sold here" instead of `$0.00`); changing a book is a catalogue edit and a loader run | create / edit / publish / hard-delete |
| `/admin/email`, `/admin/email/[id]`, `/admin/email/export` | Email — add, edit, suppress, record an opt-in, mark not-a-marketing-contact, delete; search, filters, sorts, paging, duplicates, CSV export | `/admin/contacts` (read-only, four filters) |
| `/admin/free-books` | the request queue, with a `sending` filter, search and paging; the stale "15-minute link" sentence replaced by what the code does | same page, outside the shell |
| `/admin/support` | reader lookup | same page, outside the shell |
| `/admin/data` | the three tables that record visitors, and nothing else | new |

**Removed:** `/admin/books/[slug]/edit` and every catalogue-writing action, `/admin/contacts/*`, `lib/db/queries/admin.ts`, three components used only by them. **Redirects** (`next.config.ts`, temporary): `/admin/contacts → /admin/email`, `/admin/contacts/export → /admin/email/export`, `/admin/books/:slug/edit → /admin/books`.

**No legacy admin address is publicly reachable.** Probed as a signed-out visitor on the production build: every `/admin*` address answers 307 — the three legacy ones to their new homes, which then answer 307 to the sign-in page — and the diagnostic APIs answer 403. `robots.txt` now disallows `/admin` itself (it had `/admin/`, which does not cover the dashboard's own address).

## 3. The gate

`evaluateAdminCandidate` (`lib/admin/*`, `lib/auth.ts`) is a pure function and every branch is tested (35 tests, 4 mutations caught):

1. an empty allow-list lets nobody in;
2. the **primary** address decides — an allow-listed *secondary* address elevates nobody;
3. new: the address must be **verified by Clerk** (a missing verification record counts as unverified) — asked *after* "is it on the list?", so an unverified stranger learns nothing about the list;
4. a refusal says only that it is a refusal.

It is asked at the proxy, the page, every query, every server action and every route handler. The reader-support queries (a customer's entitlements by address) used to be gated only by their page; they now gate themselves. Four copies of `tokenAccepted` became one tested helper. **A route that does something** (the storage and fulfilment probes that write and delete objects, Sentry `?emit=1`, the email-check send) **refuses a `Sec-Fetch-Site: cross-site` request even with a valid admin cookie** — cookies ride a cross-site GET, so a page on another site could previously have made an admin's browser run them.

**Testing the signed-in half without a bypass in the shipped code.** A test machine cannot sign in to Clerk, and the gate must not contain a way around itself. `npm run test:e2e:admin` builds a **throw-away copy of the repository in `/tmp`** with the identity function replaced by exact-string patches (it fails loudly if a pattern is not found), serves it on **127.0.0.1 only** against the **sandbox database only** with every third-party key blanked, and runs `e2e/admin.pw.ts`. The shipped code has no flag, header or variable that opens the admin area.

## 4. Email management — the part that was asked for

The consent policy is pure rules (`lib/admin/contact-rules.ts`), not form logic:

- a new contact is **not subscribed**; the only way to a mailable one is to state, in words, how and when they agreed (stored as `admin: …`);
- **nobody who unsubscribed can be re-subscribed from here** — only they can, on a form;
- an opt-in cannot be quietly relabelled "not a marketing contact" (that is a suppression);
- deleting a suppressed contact needs an explicit "erase the suppression record too";
- a change is conditional on the row still being unsuppressed, so a person unsubscribing while the page is open is not overwritten.

Duplicates are detected by **mailbox, not spelling** (Gmail dots and `+tags`, `googlemail.com`; `+tags` at Outlook / iCloud / Proton) — as a warning with an "add anyway" and as a report, never a silent merge. The export is whole-view and paged, CSV formulas defused (it used to cap silently at 500). **Unsubscribes now reach the contact book** (an address the book has never seen gets a suppression row; a throw-away mailbox is still honoured).

## 5. No fake data

The Overview shows the catalogue's own counts (published, sold here, ebook / paperback / hardcover / large-print titles), the featured books in pin order with the draft flagged, mailable subscribers and the latest signups *with their evidence*, the free-book queue by status, direct orders recorded by the payment webhook (said to include test-mode orders, which the table cannot tell apart), funnel events, downloads and popup outcomes. Where there is no source it says so in words: **"Sales data unavailable — no connected sales source"** for Amazon / KDP sales and for page views. On the sandbox database, which has no `analytics_events` table, the dashboard says "Not available on this database yet" instead of "0 events".

## 6. Evidence

| Check | Result |
|---|---|
| Unit / component tests (all mutation-tested) | `admin-gate` 35 · `contact-rules` 29 · `email-identity` 11 · `api-auth` 19 · `csv` 12 · `email actions` 26 · `email forms` 15 · `admin shell` 9 — gate 4/4 mutations caught, consent policy 5/5, actions 4/4, form-reset caught |
| Against the sandbox database (opt-in; refuses any other database; cleans up) | `contacts-write.db.test` 21 · `admin-overview.db.test` 7, including the real driver's missing-table error and "a refused admin writes nothing" |
| Signed out, normal build (`e2e/admin-security.pw.ts`) | **78 passed** (26 × 3 projects): 12 page addresses, the CSV, the legacy redirects (query kept), server-action POSTs, 7 API endpoints × junk bearer tokens × cross-site, the email-sending POST, robots/sitemap, no public link to `/admin` |
| Signed in, stub-auth copy of the final tree (`e2e/admin.pw.ts`) | **55 passed · 2 skipped by design** (the phone-only test on the two desktop projects) · 0 failed — shell; non-admin and signed-out refusal; tri-state overview consistent with the public sitemap; read-only books; add / bad input / duplicate / alias / evidence / edit / suppress / opt-in / delete (with the erase tick) / search with `%` / CSV / unsubscribe-reaches-the-book / free books / support / data / phone overflow and 44 px targets |
| **The physical phone** (Redmi Note 8 (2021), a real finger, through the same stub-auth copy — `docs/execution/mobile/phase-14/admin.json`) | **19 / 19** — all six tabs render with no sideways scroll; every button and every stand-alone link on every tab is ≥ 44 px (before the Phase 14 fixes: table links, three pill buttons, the day-range chips and the brand link were not); add a contact → it says it was added → it is in the list and a finger opens it → "Delete this contact…" → "Delete permanently" is a 44 px control a finger reaches → it is gone. Nothing left in the database. |
| `tsc` / `eslint` / `next build` | 0 / 0 / ok — every admin route is `ƒ` dynamic |

## 7. Not done, and needs you

- **An audit log.** Admin writes are recorded nowhere except the server log. A real one needs a table and therefore a production migration; none was added.
- **`/api/newsletter`** still has no double opt-in and no honeypot, and the rate limiter fails open without Upstash (`UPSTASH_REDIS_REST_*` unset locally, and unverified for production). That changes how people subscribe, so it is your call.
- **MailerLite** bonus-scene subscribers are not counted in "Mailable" — they live in MailerLite; counting them needs a read-only API call from the dashboard.
- **Page views and Amazon / KDP sales** have no source here; connecting one is a separate job. The dashboard says so rather than showing a number.
- **After deploy, check you can still get in.** `requireAdmin` now needs your address to be **verified** in Clerk (it was only on the allow-list). Signing in with Google or an email code verifies it, so this should be invisible; if `/admin` says "Not authorized", that address is unverified in the Clerk dashboard. It could not be tested against the real Clerk.
- **The contact book must exist on production** (migration `0013_long_slayback`). If it does not, the Email tab says so and prints the command.
- The proxy still fails open when Clerk's environment is missing (each page and query gates on its own regardless); unchanged and noted.
