# Post-remediation baseline — 2026-09-19

What was measured, on this machine, before the growth work started. Not a
re-statement of the forensic audit: only the numbers a later session can
re-run and compare against.

**Baseline commit:** `1042119` (`validate-catalog: stop the gate reporting
failures that are not there`)
**Branch:** `main`
**Working tree at baseline:** clean except two untracked design references
(`images/email-pop-up.png`, `images/email-pop-up-assets.png`)

---

## 1. The gates that had to stay green

| Measure | Command | Result |
|---|---|---|
| Test suite | `npm test` | **579 passed / 579**, 34 files |
| TypeScript | `npx tsc --noEmit` | **0 errors** |
| ESLint | `npm run lint` | **0 problems** |
| Production build | `npm run build` | **green** |

All four were re-run after every phase of the growth work and were still
green at the end. See the execution report for the closing numbers.

---

## 2. Catalogue

Read out of `scripts/catalog/valice-catalog.mjs`, which is the source of
truth for what this store sells.

| Measure | Value |
|---|---|
| Books in the catalogue | 32 |
| `websiteStatus: "published"` | 32 |
| Cleared for direct sale (published · direct · available · master in R2 · priced) | 28 |
| Of those, wired to a live checkout (`providerPriceId` non-null) | 27 |
| Distinct Amazon ASINs across all formats | 46 |

**The one gap, and it was not the one the brief named.** The brief said the
missing 28th Lemon Squeezy product was *Words from the Gods*. The catalogue
disagreed: the 28 sellable books included **Puzzles Old and New** with a null
`providerPriceId` — its own blocker line reads "The 28th Lemon Squeezy
product has not been created for this title" — while *Words from the Gods*
sat at `fulfillment: "amazon"` and was therefore not in the sellable set at
all. Two gaps, not one. Both were closed; see §2 of the execution report.

---

## 3. Providers, measured rather than assumed

| Provider | How it was checked | Result |
|---|---|---|
| Lemon Squeezy | Read the live store's own product list through the authenticated dashboard | **27 products, 27 variants, all `status: published`, all `test_mode: false`**, store `473583` |
| Lemon Squeezy product images | Same read, `thumb_url` and `media` on every product | **0 of 27 had any image** |
| Vercel production env | `vercel env ls production` | 31 variables; 27 of them **Sensitive**, i.e. write-only and not readable by anyone |
| Production `DATABASE_URL` | `vercel env pull` | Returned the literal string `[SENSITIVE]` — **not retrievable** |
| Production `LEMONSQUEEZY_API_KEY` | same | **not retrievable** |
| Local `.env.local` LS key | `GET /v1/stores` with it | A **test-mode** key belonging to a different store (`Ehliyet Akademi`), confirming it shadows production |
| Sandbox database | connection string in `.env.local` | `bookstore` — **not** the production `neondb` |

Two consequences follow from that table and shaped everything after it:

1. **Production database writes are Founder-only from this machine.** The
   connection string is deliberately unreadable. Anything requiring
   `load-catalog.mjs --commit` against production is recorded as a Founder
   step with the exact command, never guessed at.
2. **The Lemon Squeezy API could not be reached from a script here**, so the
   store was read and written through the authenticated dashboard instead.
   The catalogue's standing note that "browser automation is refused on
   app.lemonsqueezy.com" was **false** as of this session — the dashboard
   drove normally.

---

## 4. Assets on disk

| Asset class | Count | Note |
|---|---|---|
| Book covers (`public/images/books/*.webp`) | 32 | one per catalogue entry |
| Rendered interior previews (`public/images/previews/`) | 112 across 32 books | 1–4 per book; ranges chosen and read by a person |
| Companion packs (`public/companion/`) | 29 companions | |
| Brand film master | 1.80 GB MOV + 75 MB web MP4 | outside the repo, in `VALICE_VIDEO/17_DELIVER` |
| World Games short | 8.4 MB (16:9) + 9.1 MB (9:16) | outside the repo |

---

## 5. Known-stale artefacts found while measuring

Recorded here because they were true at baseline and a later session should
not rediscover them as if they were new.

- **`public/companion/world-games/game-index.pdf` is a 56-game index** citing
  the 160-page first printing. The book is now 63 games / 45 cultures —
  counted independently from `02_MANUSCRIPT/book.json`, which holds 63
  `games` entries carrying 45 distinct cultures, and matching the printed
  subtitle. The companion pack cannot be rebuilt from this repository: its
  generator (`04_BUILD/companion_pack.py`) aborts because the book project's
  `project_config.json` no longer carries the `publisher` key it reads.
- **The sandbox database is behind production** — it has no
  `analytics_events` table, so client beacons fail locally. This is a
  property of the sandbox, not of the beacon.

---

## 6. How to re-measure

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
node -e 'import("./scripts/catalog/valice-catalog.mjs").then(({BOOKS})=>{
  const pub = BOOKS.filter(b=>b.websiteStatus==="published");
  const sell = pub.filter(b=>{const e=(b.formats||[]).find(f=>f.format==="ebook");
    return e&&e.fulfillment==="direct"&&e.availability==="available"&&e.masterFileKey&&e.priceCents>0;});
  console.log({books:BOOKS.length, published:pub.length, sellable:sell.length,
    wired:sell.filter(b=>b.providerPriceId).length});
});'
```

The provider counts need a live-mode `LEMONSQUEEZY_API_KEY`:

```bash
node scripts/catalog/provision-lemonsqueezy.mjs --audit --env <file with a live key>
```
