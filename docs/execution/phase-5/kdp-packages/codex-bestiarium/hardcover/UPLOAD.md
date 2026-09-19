# Codex Bestiarium — hardcover — KDP upload package

**Generated:** 2026-09-19 · **ASIN:** B0HDLLPG5M · **KDP state:** live

## HOLD — do not upload yet

Four live listings whose 'Legendary Creatures' count still reads 120 and must read 112 (handbook O4). That correction needs a KDP visit for every edition anyway; this interior and its rebuilt cover ride along with it, one review cycle instead of two.

The file below is finished and verified. It waits on the calendar, not on work.

## What changed

A dedicated companion page now stands on page **436**: a QR occupying a measured share of the page, the address `valicepress.com/companion/codex-bestiarium` printed beneath it in display type, and a named list of what is waiting there. It is a new leaf; nothing was removed.

- **Pages:** 435 → **436**
- **Spine:** 1.0875 in → **READ IT FROM KDP'S COVER CALCULATOR — a hardcover spine is not derivable here** (cream paper, 6×9 in)
- **Wrap width:** 13.3375 in → **14.8508 × 10.4167 (cream) · 14.7427 × 10.4167 (white) — READ from KDP's Cover Calculator, not derived**
- **Cover:** REBUILD CORRECT — inside tolerance, but the printed spine no longer matches the block
- **Proof:** recommended — the block changed thickness, so the wrap is new and unproved

## The file

```
/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/CODEX-BESTIARIUM/04_PRINT/HARDCOVER/CODEX_BESTIARIUM_INTERIOR_HARDCOVER.pdf
sha256 32f5b5a8ea4f46977aa634aa641f25bebb2a646998e2f1fbdf291f3e8d2207b5
108,961,076 bytes · 436 pages
```

The build it replaces is kept at `/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/CODEX-BESTIARIUM/04_PRINT/HARDCOVER/CODEX_BESTIARIUM_INTERIOR_HARDCOVER.pre-companion.pdf` and is never deleted.

## In KDP

1. Bookshelf → **Codex Bestiarium** → hardcover → *Edit print manuscript*.
2. Upload the interior above.
3. Upload the rebuilt cover for **436 pages** — the spine changed, do not reuse the old wrap:

   ```
   /home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/CODEX-BESTIARIUM/03_COVER/HARDCOVER/exports/
   spine see wrap in · wrap 14.8508 × 10.4167 (cream) · 14.7427 × 10.4167 (white)
   this project carries a calibrated hardcover profile with a measured board allowance, so its wrap IS derivable and was rebuilt
   ```

4. Open the previewer and confirm page 436 shows the code and the address, and that the spine text still sits inside its safe zone.

## How this file was checked

- PASS · **page-count** — 436 pages (expected 436)
- PASS · **printed-url** — valicepress.com/companion/codex-bestiarium
- PASS · **canonical-host** — no forbidden host on the page
- PASS · **eyebrow** — CONTINUE WITH VÂLIÇE PRESS
- PASS · **fonts-embedded** — 4 faces: AAAAAA+Cinzel500, AAAAAA+Cinzel400, AAAAAA+Garamonditalic400, AAAAAA+Garamond400
- PASS · **pdf-metadata** — title="Codex Bestiarium: A World Bestiary: 112 Legendary Creatures from 40 Traditions — Beasts, Spirits, and Guardians of World Folklore" author="Emre Doğan"

Regenerate with `node scripts/factory/build-companion-pages.mjs --commit --slug codex-bestiarium`.
