# Reader — what was measured, and where

**2026-09-14.** Everything below is a measurement, not an expectation. Where
something could not be measured it says so and says why.

Three environments, and the distinction matters:

| | What it is | What it can prove |
|---|---|---|
| **sandbox** | `bookstore` DB + a local production build | the authorization matrix, with two adversarial accounts |
| **harness** | a static page loading `reader.css` and a real artifact | how the reader looks and what its CSS resolves to |
| **production** | `valicepress.com`, `neondb`, real Clerk session | everything else |

---

## 1. Security — 42 of 42, sandbox

`node scripts/reader/security-audit.mjs --base http://localhost:3456`

Against two real accounts, two real orders, two real watermarked artifacts
(1.6 MB and **109 MB**) and the real schema. Full table in
`VALICE-WEB-READER-SECURITY-AUDIT.md`.

---

## 2. Security — production, no session

`https://valicepress.com`, real book ids that a real account really owns.

| Request | Status | Body | PDF? |
|---|---|---|---|
| a real book the Founder owns | 404 | **0 bytes** | no |
| a second real owned book | 404 | 0 bytes | no |
| a fictional uuid | 404 | 0 bytes | no |
| a storefront slug (`kwaidan`) | 404 | 0 bytes | no |
| path traversal, encoded | 404 | 0 bytes | no |
| SQL, encoded | 404 | 0 bytes | no |
| a **range** request for a real owned book | 404 | 0 bytes | no |
| the reader page itself | 404 | — | — |

Every refusal is the same. A book that exists and is owned by somebody is
indistinguishable from one that was never published.

Response headers on the refusal, read off the wire:

```
cache-control: private, no-store, max-age=0, must-revalidate
vary: Cookie
content-security-policy: default-src 'none'; frame-ancestors 'none'
x-robots-tag: noindex, nofollow, noarchive
x-content-type-options: nosniff
x-frame-options: DENY
content-length: 0
```

---

## 3. The owner path — production, real Clerk session

| Step | Result |
|---|---|
| `/account/library` | 3 books, correct covers, EPUB offered only where one exists |
| Reader opens | closed volume with the book's own cover, spine, thickness, ribbon |
| Page 1 renders | half-title, correct |
| Watermark | `Licensed to Emre · Order daa90b19 · Valice Press`, on the page |
| Folio | `1 / 436` |
| Turn ×6 | `1` → `2–3` → `4–5` → `6–7` → `8–9` → `10–11` → `12–13` |
| Progress → DB | `reading_progress`: page 4, 2.7% |
| Bookmark → DB | `bookmarks`: page 4 |
| `last_read_at` → DB | stamped on both books opened |
| Audit trail → DB | 2 × `reader_opened`, 4 × `denied_unauthenticated` |
| Reopen | resumed at `4–5 / 148` |
| Library after | **Continue reading · 3% · page 4** |

The recto rule holds on production: page 1 alone on the right, then even-left /
odd-right, exactly as the printed edition falls.

---

## 4. The 435-page, 109 MB book

This is the measurement that found the worst defect in the work.

| | Before the fix | After |
|---|---:|---:|
| Bytes pulled to open | **104 MB** | **0.81 MB** |
| Time to first page | still loading at 43s | **3.98 s** |
| Requests | 4, one of them 104 MB | 5, largest 256 KB |
| Book on disk | 109 MB | 109 MB |

A **128× reduction**, and the reader looked correct the whole time it was
wrong: it issued exactly the range requests it should — 64 KB, 62 KB — while a
fourth request quietly transferred the entire book over 89 seconds.

Cause: `disableAutoFetch: true` does nothing unless `disableStream` is also
true. With streaming left on, pdf.js opens a read from byte 0 and pulls to the
end alongside the ranges.

**No local harness could have found this.** The local test artifact is 404 KB,
where "streams the whole file" and "fetches what it needs" are the same
measurement.

---

## 5. Page-turn CSS

rAF is suspended in a backgrounded tab, so the transition itself cannot be
watched under automation. What was verified is that the CSS resolves to the
right target in all four states, with the hinge on the correct edge:

| perf | direction | transform | origin |
|---|---|---|---|
| rich | forward | `matrix3d(-1,0,0,0, 0,1,0,0, 0,0,-1,0, 0,0,0,1)` — rotateY 180° | left edge |
| rich | backward | same matrix | right edge |
| lite | forward | `translate(-14px)`, opacity 0 | left edge |
| lite | backward | `translate(+14px)`, opacity 0 | right edge |

The suspension also exposed a real gap and its fix: a turn triggered on rAF
alone never fires in a hidden tab, leaving a stale leaf over the new opening.
A `setTimeout` co-trigger now completes it. Verified: after six turns on
production, no leaf was stuck.

---

## 6. Layout

| Layout | Book width | Left leaf | Folio | Horizontal overflow |
|---|---:|---|---|---:|
| spread | 1028 px | present | `4–5 / 148` | 0 |
| single | 514 px | absent | `4 / 148` | 0 |
| auto (wide) | 1028 px | present | `4–5 / 148` | 0 |

No tap target under 40 px in either layout.

**A defect found and fixed here.** Switching to one page at a time landed the
reader on page **3** when they had been looking at 4–5. The effect that carries
the reading position across a layout change was reading the page *after* the
spread model had been rebuilt under it — index 2 means 4–5 in a spread and
page 3 alone. Now recovered from the previous layout's model, and pinned by two
tests, including a sweep of all 148 pages.

---

## 7. Automated tests

`npx vitest run src/components/reader src/lib/reader-access.test.ts src/lib/reader-throttle.test.ts`

**41 passed**, in three files:

- `reader-engine.test.ts` — 26. The spread model (every page appears exactly
  once, in order, for 1/2/3/38/142/435-page books), resume clamping, the
  progress-creep property over 25 cycles, the layout round trip, the motion
  budget, the warm set against the cache limit.
- `reader-access.test.ts` — 7. The uuid guard against traversal, encoded
  traversal, storage keys, slugs, SQL, markup, the nil uuid, near-miss uuids,
  a megabyte of junk, and non-strings.
- `reader-throttle.test.ts` — 8. The denial budget, per-identity isolation, and
  that no header value can be forged into an account bucket.

---

## 8. What the books themselves turned out not to carry

Checked against seven editions — Meditations plus the six shortest masters,
pulled from R2 and read with pdf.js:

| Book | Pages | Outline | Page labels |
|---|---:|---|---|
| mancala | 38 | none | none |
| mythical-monsters | 74 | none | none |
| games-ancient-and-oriental | 78 | none | none |
| indian-myth-and-legend | 94 | none | none |
| greek-alphabet-handwriting-workbook | 100 | none | none |
| myths-and-legends-of-china | 108 | none | none |
| meditations | 148 | none | none |

**Seven of seven.** Two consequences, both now reflected in the product rather
than papered over:

1. **The contents drawer is empty for every title.** The button no longer says
   "Contents" when there is nothing to list — it says "Go to a page", which is
   what the drawer will actually give you. The outline code stays, because the
   day the pipeline emits bookmarks every title gains a working contents drawer
   with no change to the reader.
2. **The folio counts file pages, not printed ones.** Front matter is counted,
   so file page 30 prints as 26 in Meditations. Inventing a mapping would be
   the fabrication §24 forbids.

Both would be fixed for all 27 titles at once if the typesetting pipeline wrote
a PDF outline and a page-label dictionary. That is the single highest-value
thing it could add for this reader.

This also corrected two claims that had been written into the documentation on
the assumption that the pipeline already did this. It does not.

## 9. Not measured

- **Authenticated non-owner, in a browser.** Proved at the authorization
  primitive against two real accounts in the sandbox (§1), but not driven with
  two live Clerk sessions. Creating a second real account on the production
  Clerk instance was out of scope.
- **A real purchase.** Blocked — see the manifest's blocker table. Production
  has no Lemon Squeezy API key, no webhook secret, and no variant ids.
- **The reader on the physical phone.** The Redmi is attached and reachable
  over ADB, and `scripts/reader/device-check.mjs` drives it — but that browser
  profile carries no Valice session, so it reaches the sign-in redirect and
  stops. What it *did* confirm on real hardware is that the redirect preserves
  the return URL. Closing this is one action: sign in to valicepress.com on the
  phone, then re-run the script with a reader URL.
- **The ≤640px CSS rules.** The automation window could not be resized below
  the desktop breakpoint, so the phone-specific rules (hidden imprint, tighter
  bars, wider edge zones) are unexercised. They are simple and scoped, but
  unexercised is unexercised.
- **Core Web Vitals.** `npm run mobile:cwv` against production, once a session
  exists on the phone.
