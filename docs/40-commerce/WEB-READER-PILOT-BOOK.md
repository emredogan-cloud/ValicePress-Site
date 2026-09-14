# The pilot book

**Chosen: Codex Bestiarium.** 435 pages, $9.99, artifact **109 MB**.

Two supporting titles carry the Phase B spread: **Meditations** (148pp,
text-heavy) and **Mancala** (38pp, the short end).

---

## Why the hardest book, not the easiest

The obvious pilot is a short, clean, text-only title — it would have opened on
the first try and proved very little. §84 asks the pilot to *validate* the
engine before it scales, and a pilot that cannot fail validates nothing.

Codex Bestiarium is the worst case in every dimension the reader has:

| Dimension | Codex Bestiarium | The rest of the catalogue |
|---|---|---|
| Pages | **435** | 38–390 |
| Artifact size | **109 MB** | 0.4–40 MB |
| Illustration density | highest — engraved plates throughout | mostly text |
| Price tier | $9.99 | $4.99–$11.99 |
| Role | the house flagship | — |

If the engine opens a 109 MB book in a phone browser without pulling the file,
without exhausting memory, and without making the reader wait, it will open
every other title in the catalogue. If it cannot, no amount of success on a
38-page book would have told us.

It is also the right book to *show*. It is what the homepage leads with, and a
reader's first impression of the press should be the edition the press is
proudest of.

---

## What the pilot proved

Built and measured 2026-09-14 against the real artifact.

| Property | Result |
|---|---|
| Entitlement → artifact | real order, real watermark job, 109 MB object written to R2 ARTIFACTS |
| Authorization | all 7 authorization cases pass (audit §1) |
| Delivery | HTTP ranges against an authenticated route; the file is never pulled whole |
| Memory | six-page LRU, DPR capped at 2 — peak is a handful of page bitmaps, not 435 |
| Spread model | 435 pages ⇒ 218 openings; every page appears exactly once, in order (tested) |
| Prefetch | at most 6 pages warmed, never more than the cache holds (tested) |
| Contents | read from the PDF's own outline |
| Direct asset | 404, zero bytes, without a session (audit §6) |

The 435-page case also drove two of the engine's design decisions:

- **`disableAutoFetch: true`.** Without it pdf.js speculatively pulls the whole
  file once idle, which on this book means 109 MB down a phone connection for
  a reader who opened it to check one entry.
- **`PAGE_CACHE_LIMIT = 6`.** A page bitmap at 2× DPR is roughly 15 MB. Ten
  would be 150 MB and a phone tab gets killed. Six is the visible opening plus
  its two neighbours.

---

## Phase B — the representative three

§86–87 ask for text-heavy, image-rich and structurally unusual.

| Book | Pages | Why it is in the set |
|---|---:|---|
| **Codex Bestiarium** | 435 | image-rich, long, largest artifact |
| **Meditations** | 148 | text-heavy, classical typesetting, the plainest case |
| **Mancala** | 38 | the short end — a book with fewer openings than a phone screen has scroll |

All three were granted, watermarked and served during the audit.

Two coverage gaps remain, honestly:

- **Unusual page dimensions.** The Great Book of World Games is typeset at
  8.5×11 rather than 6×9, which is the only trim the reader has not been
  exercised against. The engine reads geometry from page 1 of each file, so it
  should be uneventful — but "should be" is not "was".
- **Complex headings.** Codex Enigmatica and the puzzle books carry the
  densest structural apparatus; their outlines are the most likely to be deep
  or to resolve oddly.

Both are one grant and one look each, on the deployed site.

---

## What the pilot found on production

The pilot earned its choice. Deployed and opened with a real session, Codex
Bestiarium exposed the single worst defect in the work — and it was a defect
that presented as success.

| | Before | After |
|---|---:|---:|
| Bytes pulled to open a 109 MB book | **104 MB** | **0.81 MB** |
| Time to first page | still loading at 43 s | **3.98 s** |

The reader issued exactly the range requests it should — 64 KB, then 62 KB —
while a fourth request quietly transferred the whole book over 89 seconds. Both
were happening at once, so nothing looked wrong.

`disableAutoFetch: true` was set and is inert unless `disableStream` is also
true. A short book would never have shown it: at 404 KB, "streams the whole
file" and "fetches what it needs" are the same measurement. **This is the entire
argument for choosing the hardest book as the pilot**, and it paid for itself on
the first run.

## What the pilot did not prove

Stated here rather than left to be discovered.

**A real purchase.** Blocked — see the manifest's blocker table. Production has
no Lemon Squeezy API key, no webhook secret, and no variant ids on any book.
Nothing can be bought, so nothing can be fulfilled.

**A real phone.** The Redmi is attached and reachable, but its browser profile
holds no Valice session, so the device check stops at the sign-in redirect. One
action closes it: sign in on the phone, then re-run
`scripts/reader/device-check.mjs` with a reader URL.

---

## Rollout

| Phase | Scope | State |
|---|---|---|
| A | Codex Bestiarium | **done** |
| B | + Meditations, Mancala | **done** |
| B′ | + World Games (8.5×11), Codex Enigmatica (dense apparatus) | next — one `grant-entitlement.mjs` run each |
| C | all 27 | no code change needed — the engine is title-agnostic |

Phase C is not a build step. Every eligible title already works the moment an
entitlement exists, because nothing in the reader knows which book it is
showing.
