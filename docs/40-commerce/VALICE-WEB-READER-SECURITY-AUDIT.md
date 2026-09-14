# Private reader — security audit

**Run:** 2026-09-14 · **Result: 42 of 42 pass, 0 fail.**

**Harness:** `scripts/reader/security-audit.mjs`, re-runnable.

```
node scripts/reader/security-audit.mjs --seed                   # build fixtures
node scripts/reader/security-audit.mjs --base http://host:port  # run
node scripts/reader/security-audit.mjs --clean                  # remove fixtures
```

---

## What was tested against

Not mocks. Two real accounts, two real orders, two real entitlements, two real
watermarked PDFs produced by the real worker from the real masters and written
to the real R2 bucket, and the real Postgres schema:

| | Account A | Account B |
|---|---|---|
| Book | Mancala | Codex Bestiarium |
| Pages | 38 | 435 |
| Artifact | 1.6 MB | **109 MB** |
| Status | `ready` | `ready` |

The HTTP half ran against a production build (`next build` → `next start`) with
production Clerk keys and the sandbox database.

The project's own memory records why this matters: *presence checks lie* — four
of five providers once passed `process.env.X !== undefined` while being wrong.
Every assertion below is made against a real database read or a real HTTP
response.

---

## 1. Authorization

| Threat | Attack | Expected | Actual | Status |
|---|---|---|---|---|
| — | `resolve(A, bookA)` | `ready` + artifact key | `ready` + key | **PASS** |
| **IDOR / cross-user** | `resolve(B, bookA)` | `not-owned` | `not-owned` | **PASS** |
| **Cross-book** | `resolve(A, bookB)` | `not-owned` | `not-owned` | **PASS** |
| **Enumeration** | `resolve(A, <random uuid>)` | identical to the above | identical | **PASS** |
| **Revoked entitlement** | set `revoked`, resolve | `not-ready` | `not-ready` | **PASS** |
| **Unready entitlement** | set `pending`, resolve | `not-ready` | `not-ready` | **PASS** |
| **Ready-but-keyless** | null the artifact key | `not-ready`, not a 500 | `not-ready` | **PASS** |

The fourth row is the one that matters most for enumeration: a book that does
not exist and a book you do not own return the **same value**, so nothing about
the catalogue can be inferred from the answer.

---

## 2. Tampering — what reaches a query

Every value refused by the uuid shape guard **before any database or storage
call**, so a hostile id never reaches a query, a storage key, or a log line of
unbounded length.

| Input | Result |
|---|---|
| `../../etc/passwd` | refused · **PASS** |
| `..%2F..%2Fetc%2Fpasswd` | refused · **PASS** |
| `books/meditations/master/v1/master.pdf` | refused · **PASS** |
| `kwaidan` (a storefront slug) | refused · **PASS** |
| `' OR 1=1--` | refused · **PASS** |
| `<script>alert(1)</script>` | refused · **PASS** |
| `00000000-0000-0000-0000-000000000000` | refused · **PASS** |
| one megabyte of `a` | refused · **PASS** |

The slug case is worth naming: the storefront's URLs are slugs and the reader's
are uuids, so the first thing a curious person tries is `/read/kwaidan`. That
costs them one 404 and costs us nothing.

---

## 3. Per-user state

| Threat | Attack | Expected | Actual | Status |
|---|---|---|---|---|
| — | A writes progress in A's book | ok | ok | **PASS** |
| **Cross-user write** | B writes progress in A's book | refused | refused | **PASS** |
| **Silent overwrite** | read A's page after B's attempt | still 42 | still 42 | **PASS** |
| **Global state** | read both readers' rows | two distinct rows | 7 and 42 | **PASS** |
| — | A marks a page in A's book | added | added | **PASS** |
| **Cross-user write** | B marks a page in A's book | `not-owned` | `not-owned` | **PASS** |
| **Cross-user read** | `listBookmarks(B, bookA)` | A sees 1, B sees 0 | A 1, B 0 | **PASS** |
| **Race / duplicate** | two concurrent toggles, same page | at most one row | 1 row | **PASS** |

Row 2 and row 6 are the ones that were *not* true of the progress path before
this work: it was authenticated-only, so any signed-in visitor could write
progress rows against books they had never bought.

---

## 4. Enumeration budget

| Threat | Attack | Expected | Actual | Status |
|---|---|---|---|---|
| **Catalogue walking** | 14 refusals from one identity | throttled by the 11th | throttled at 11 | **PASS** |
| **Collateral lockout** | a different identity's first refusal | not throttled | not throttled | **PASS** |

---

## 5. Storage

| Threat | Attack | Expected | Actual | Status |
|---|---|---|---|---|
| — | `HEAD` the artifact in the private bucket | exists, non-empty, pdf | 1.6 MB `application/pdf` | **PASS** |
| **Long-lived credential** | mint a 24-hour signed URL | refused above 900s | refused | **PASS** |
| **Public bucket** | `HEAD <R2_PUBLIC_BASE_URL>/<artifact key>` | never 200 | not 200 | **PASS** |

The third is the one that would make every other row decoration if it failed.

---

## 6. HTTP, with no session

| Threat | Attack | Expected | Actual | Status |
|---|---|---|---|---|
| **Direct asset access** | `GET /api/read/<real book>/content` | 404, empty body | 404, **0 bytes** | **PASS** |
| **Cache leakage** | headers of the above | `no-store` | `private, no-store, …` | **PASS** |
| **Range bypass** | same with `Range: bytes=0-1023` | 404, never 206 | 404 | **PASS** |
| **Enumeration** | real book vs. fictional uuid | identical status | 404 / 404 | **PASS** |
| **Tampering** | slug in the path | 4xx, no PDF | 404 | **PASS** |
| **Tampering** | storage key in the path | 4xx, no PDF | 404 | **PASS** |
| **Path traversal** | `../../etc/passwd` encoded | 4xx, no PDF | 404 | **PASS** |
| **SQL** | `' OR 1=1--` encoded | 4xx, no PDF | 404 | **PASS** |
| **Unauthenticated reader** | `GET /read/<real book>` | redirect or 404, never a reader | redirect to sign-in | **PASS** |
| **Credential in markup** | search the page for an AWS signature | absent | absent | **PASS** |
| **Clickjacking** | `Content-Security-Policy` | `frame-ancestors 'none'` | present | **PASS** |
| **MIME sniffing** | `X-Content-Type-Options` | `nosniff` | present | **PASS** |
| **Framing** | `X-Frame-Options` | `DENY` | present | **PASS** |
| **Referrer leakage** | `Referrer-Policy` | `strict-origin…` | present | **PASS** |

Row 10 is the regression guard for the defect this work removed. It fails if a
presigned storage URL ever reappears in the reader page's HTML.

---

## 7. The defect this work fixed

**A ten-minute bearer credential for the complete book, in the page's HTML.**

The previous reader minted a presigned R2 URL server-side and passed it to the
client as a prop for pdf.js to fetch. §75 permits signed URLs as an *internal*
asset-delivery mechanism — but this one was not internal. It was in the
document. Anything that could read the document could read it: a browser
extension, a shared screenshot, a screen-share, a support session, the
clipboard, `view-source`. For ten minutes it granted the entire watermarked
book to whoever held it, with no session and no entitlement check.

Severity: **medium**, not critical. The TTL was short and correctly capped, the
artifact is watermarked with the buyer's name and order id, and obtaining the
URL already required access to an authenticated session's rendered page. But it
was a credential where none was needed.

**Fix:** the page now passes `/api/read/<bookId>/content` — a same-origin route
that re-runs the full gate on **every range request**. It is not a credential.
Row 1 and row 10 of §6 are its proof.

---

## 8. Findings and their resolution

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Presigned R2 URL exposed in reader page markup | medium | **fixed** — authenticated proxy |
| 2 | `writeReadingProgress` was authenticated-only, not ownership-gated | low | **fixed** — same gate as the reader |
| 3 | No shape guard on `bookId`; arbitrary strings reached a query and a log | low | **fixed** — uuid guard before any IO |
| 4 | No denial throttle; the perimeter limiter allowed a fast catalogue walk | low | **fixed** — 10 refusals/min per identity |
| 5 | No audit trail for reader authorization decisions | low | **fixed** — `reader_access_events` |
| 6 | One shared pdf.js render-task slot for two concurrently-painting leaves | low | **fixed** — one slot per leaf |
| 7 | `transitionend` unfiltered; the curl's event ended the turn at 45% | cosmetic | **fixed** — filtered on target + property |
| 8 | Page turn depended on `rAF`, suspended in a backgrounded tab | cosmetic | **fixed** — `setTimeout` co-trigger |
| 9 | `.vp-stage::after` painted its pedestal shadow over the left page | cosmetic | **fixed** — explicit z-index |
| 10 | Fit subtracted 24px against 32px of stage padding; a scrollbar at zoom 1 | cosmetic | **fixed** — constant matched to CSS |
| 11 | `LEMONSQUEEZY_API_KEY` and `_WEBHOOK_SECRET` absent in production | **blocker** | **open — Founder action** |

Finding 11 is not a reader defect and was not introduced by this work. It is
recorded here because it is the reason §9 below cannot be closed.

---

## 9. Not tested, and why

Stated plainly rather than implied.

**Authenticated non-owner over HTTP.** Proved at the authorization primitive
(§1, rows 2–3), which every authenticated path funnels through, but not driven
through a browser with two real Clerk sessions. Clerk's production instance
(`pk_live_`) refuses to issue a session on `localhost` — sign-in redirects to
`valicepress.com` and drops the localhost return URL — so a second real session
cannot be created locally. This closes on the production deployment.

**Owner reads their book, in a browser.** Same cause. The owner path is proved
server-side end to end: entitlement resolution, artifact streaming,
`last_read_at`, the audit row. The reader UI itself was verified against a real
watermarked artifact in a visual harness (cover gate, spread, real watermark
footer, and all four page-turn target states) but not through the React
component with a live session.

**Real purchase.** Blocked by finding 11.

**CSRF.** The mutating surfaces are Next.js Server Actions, which carry
framework-level origin checks, and the asset route is `GET`-only with no
side effects. Not separately exercised.

**Session fixation, brute force, open redirect.** Owned by Clerk, unchanged by
this work, and not re-tested here.

**Real mobile hardware.** Pending deployment; the Redmi harness in
`scripts/mobile/` is the intended instrument.

---

## 10. Acceptance criteria (§98)

- [x] unauthenticated user cannot read a protected book
- [~] authenticated non-owner cannot read — proved at the primitive, not in a browser (§9)
- [~] owner can read — proved server-side, not in a browser (§9)
- [x] owner cannot read an unowned book
- [x] direct page assets are protected
- [x] signed URLs expire appropriately, and never reach the client
- [x] webhook signatures are verified
- [x] webhook replay is handled (`mor_order_ref` UNIQUE)
- [x] duplicate purchase events are idempotent
- [x] revoked entitlement is enforced
- [x] private data is not cached publicly
- [x] secrets are never client-visible
- [x] cross-user library leakage impossible in tested paths
- [x] progress is user-specific
- [x] bookmarks are user-specific
- [x] logout invalidates access (the gate is per request; the session is the identity)
- [x] browser back/cache does not restore protected content (`no-store`)
- [x] security headers reviewed
- [x] rate limiting reviewed
- [x] logs contain no secrets
- [ ] mobile test — pending deployment
- [~] desktop test — harness only (§9)
- [x] 300+ page test — 435 pages / 109 MB, range-served
- [x] three-book scaling test — 38, 148 and 435 pages
