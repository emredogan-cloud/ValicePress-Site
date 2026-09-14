# Private reader — threat model

Written 2026-09-14, alongside the implementation.

---

## The honest opening (§30)

**This system does not provide DRM, and no browser-delivered book can.**

A determined person who has legitimately bought a Valice Press book can keep
its contents. They can screenshot every page. They can screen-record the
reader. They can photograph the monitor. They can open DevTools and pull the
bytes their own session is entitled to. None of that is preventable by any
web reader, and pretending otherwise would mean shipping controls that annoy
honest customers while stopping nobody.

What this system does provide:

- **Only entitled accounts can obtain the file at all.** Not "only accounts
  that know the URL" — only accounts the database says bought the book.
- **Sharing a link shares nothing.** The URL is not a credential.
- **A leaked copy carries a name.** Every artifact is watermarked with the
  buyer's name and a short order id, so an uploaded PDF is traceable to the
  order that produced it.
- **Casual sharing has no low-effort path.** No public URL, no guessable
  filename, no bucket listing, no long-lived token.

The gap between those two lists is the residual risk, and it is accepted
deliberately. The business model rests on people preferring to buy a
well-made edition over stealing one — which is the same bet every publisher
makes.

---

## Assets, in order of value

1. **Master PDFs** (R2 MASTERS) — unwatermarked, one per book. The complete
   catalogue in one bucket. Compromise here is the worst case.
2. **Watermarked artifacts** (R2 ARTIFACTS) — one per order. Individually
   traceable; collectively equivalent to the catalogue.
3. **Entitlement rows** — the grant itself. Write access here is free books.
4. **Customer identity** — emails, names, purchase history.
5. **Reading behaviour** — progress, bookmarks. Low value, high sensitivity:
   what someone reads is nobody else's business.
6. **Credentials** — Clerk keys, R2 keys, webhook secrets, database URL.

---

## Adversaries

| | Capability | Motive |
|---|---|---|
| **Casual sharer** | A customer with a session. Copies a URL to a friend. | Generosity |
| **Freeloader** | No purchase. Guesses URLs, edits ids, replays requests. | A free book |
| **Scraper** | Scripted. May hold one real account. | The catalogue |
| **Forger** | Can POST to public endpoints. | An entitlement without paying |
| **Session thief** | Has obtained a cookie (shared device, XSS, malware) | Someone else's library |
| **Insider** | Admin allowlist, or repository access | Anything |

---

## The matrix

| # | Threat | Likelihood | Impact | Mitigation | Residual |
|---|---|---|---|---|---|
| 1 | **Asset theft — direct URL** | High (it will be tried) | High | Both buckets private, no public read. The only path to bytes is `/api/read/[id]/content`, which re-runs the gate per request. Verified: the artifact is not served by the public asset host. | **Low.** Depends on R2 bucket policy staying private; re-checked by the audit harness. |
| 2 | **Asset theft — link sharing** | High | Low | The reader URL is not a bearer token. Without the owner's session it is a 404. | **Very low.** The sharer can still send the *file*. |
| 3 | **Asset theft — an owner keeps the file** | Certain | Accepted | Per-order watermark makes an uploaded copy traceable. | **Accepted.** Unpreventable. See the opening. |
| 4 | **IDOR — read another user's book** | Medium | High | Ownership is a WHERE clause on a UNIQUE `(user_id, book_id)` index. A caller can only resolve an entitlement for the id it passes. | **Very low.** Structural, not procedural. |
| 5 | **Cross-book — own A, read B** | Medium | High | Same gate; tested directly. | **Very low.** |
| 6 | **Entitlement spoofing — client claims ownership** | Medium | High | No client input selects a file. The server resolves user + entitlement + book, then looks up a key it owns. | **Very low.** |
| 7 | **Webhook forgery** | Medium | **Critical** — free books at will | HMAC-SHA256 over the raw body, timing-safe, **before any parse**. Dispatch on the signed `meta.event_name`, never the header. No secret ⇒ 503, refuse. | **Low**, conditional on the secret being set and secret. |
| 8 | **Webhook replay** | High (providers retry) | Medium | `orders.mor_order_ref` UNIQUE; `commerce_events.provider_event_id` UNIQUE. A redelivery finds the row, writes nothing, returns 200. | **Very low.** |
| 9 | **Duplicate entitlement from a race** | Medium | Low | `entitlements_user_book_uk`. The database is the lock. | **Very low.** |
| 10 | **Enumeration — walk the catalogue** | Medium | Low | Non-existent and unowned are the *same* 404. Denial throttle: 10 refusals/min per identity. | **Low.** Book ids are visible in the owner's own library markup; that is by design. |
| 11 | **Cache leak — one reader's page served to another** | Low | **Critical** | Every private surface `force-dynamic`; asset route `private, no-store` + `Vary: Cookie`. Verified on the wire. | **Low.** A CDN misconfiguration would reintroduce it; the header check is in the harness. |
| 12 | **Client-cache leak — shared device** | Medium | Medium | `no-store` keeps the artifact out of the disk cache. No service worker, no IndexedDB, no offline copy. `localStorage` holds only page tone and layout. | **Low.** A determined local user with the device can still recover a decrypted page from memory; out of scope. |
| 13 | **Session theft** | Low | High | Clerk sessions: HttpOnly, Secure, SameSite. HSTS. The gate is per request, so a revoked session loses access immediately. | **Medium.** A stolen live cookie *is* the user. Mitigation is Clerk's, not ours. |
| 14 | **XSS → session or book theft** | Low | High | React escapes by default. No `dangerouslySetInnerHTML` in the reader. The only attacker-influenced strings rendered are PDF outline titles, sliced to 160 chars and rendered as text. CSP forbids external script hosts. | **Low.** CSP still carries `'unsafe-inline'` for scripts — a nonce-based policy is the remaining hardening. |
| 15 | **CSRF** | Low | Medium | Mutations are Server Actions (framework origin checks). The asset route is GET-only with no side effects. | **Low.** Not separately exercised — recorded in the audit's §9. |
| 16 | **Clickjacking** | Low | Low | `frame-ancestors 'none'` + `X-Frame-Options: DENY`, site-wide and repeated on the asset route. | **Very low.** |
| 17 | **Hotlinking** | Low | Low | Nothing to hotlink: no public asset URL exists. | **Very low.** |
| 18 | **Rate abuse / scraping a long book** | Medium | Low | Perimeter 100/10s per IP. A legitimate 435-page read is well inside it; so is a scripted one, deliberately — a paying reader must not be throttled. | **Medium, accepted.** An owner can pull their own book quickly. They are entitled to it. |
| 19 | **Revoked access still readable** | Low | Medium | `revoked` ⇒ `not-ready` at the single gate, checked per request. No cached grant anywhere. | **Very low.** A tab already open keeps the pages it has rendered until the next range request. |
| 20 | **Privacy — reading history** | Low | Medium | The audit table holds no IP, user agent, URL or email. Progress and bookmarks are per-user rows the customer can export and delete. | **Low.** Progress is inherently a record of reading; that is the feature. |
| 21 | **Credential exposure** | Low | **Critical** | No secret reaches a client bundle. R2 keys are server-only and Sensitive in Vercel. Signed URLs are minted and consumed server-side. Logs carry no secrets. | **Medium — see below.** |
| 22 | **Insider / repository compromise** | Low | Critical | Admin is an email allowlist. The support view returns state, never access — there is no "open this customer's book" control anywhere in it. | **Medium.** Anyone with the repository's env has everything. Inherent. |
| 23 | **Supply chain — pdf.js** | Low | High | Pinned version, worker served same-origin from `public/` (no CDN), `worker-src 'self' blob:`. | **Low.** |
| 24 | **Denial of service on the throttle itself** | Low | Low | Both limiters fail **open** by house rule. | **Accepted.** An attacker who takes out Upstash lifts the throttle; the alternative is paying readers locked out of their books during an outage, which is worse. |

---

## Finding 21, stated plainly

Two credential facts found while auditing, neither introduced by this work:

**A Resend API key is present in a local `.env.local` in plain text**, and the
project's own memory already records that this key was once exposed and should
be rotated. It is not in git and not in any bundle, but it has been readable on
disk for some time. **It should be rotated**, and the value is not reproduced
anywhere in this repository's documentation.

**Production is missing `LEMONSQUEEZY_API_KEY` and
`LEMONSQUEEZY_WEBHOOK_SECRET`.** Verified by probing the live endpoint, which
returns 503. The security consequence is the inverse of the usual one: with no
secret configured the webhook refuses *everything*, so there is no forgery
window — but there is also no commerce. It is a blocker, not a vulnerability.

---

## What would change this model

- **Offline / PWA support.** Would mean a decrypted copy at rest on the device
  and a cached grant. §83 says online-only is the safer first version, and this
  model assumes it.
- **A public preview reader.** Must remain a genuinely separate system serving
  genuinely separate sample assets. Sharing the engine is fine; sharing the
  artifact path is not.
- **Moving to a nonce-based CSP.** Would close the residual in #14.
- **A CDN in front of the asset route.** Would make #11 live again and require
  an explicit no-cache rule at the edge.
- **Any "support can view a customer's book" feature.** Would create the only
  impersonation path in the system. It is deliberately absent.
