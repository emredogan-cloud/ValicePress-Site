# Codex Bestiarium — large_print — KDP upload package

**Generated:** 2026-09-19 · **ASIN:** B0HDLT1V3P · **KDP state:** live

## HOLD — do not upload yet

Four live listings whose 'Legendary Creatures' count still reads 120 and must read 112 (handbook O4). That correction needs a KDP visit for every edition anyway; this interior and its rebuilt cover ride along with it, one review cycle instead of two.

The file below is finished and verified. It waits on the calendar, not on work.

## What changed

A dedicated companion page now stands on page **600**: a QR occupying a measured share of the page, the address `valicepress.com/companion/codex-bestiarium` printed beneath it in display type, and a named list of what is waiting there. It is a new leaf; nothing was removed.

- **Pages:** 599 → **600**
- **Spine:** 1.4975 in → **1.5000 in** (cream paper, 6×9 in)
- **Wrap width:** 13.7475 in → **13.7500 in**
- **Cover:** REBUILD CORRECT — inside tolerance, but the printed spine no longer matches the block
- **Proof:** recommended — the block changed thickness, so the wrap is new and unproved

## The file

```
/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/CODEX-BESTIARIUM/04_PRINT/LARGEPRINT/CODEX_BESTIARIUM_INTERIOR_LARGEPRINT.pdf
sha256 4d2d9df878e47c4b910ccae95a5e66ff679e9a5754e50fc434d3df89ff90420b
109,079,410 bytes · 600 pages
```

The build it replaces is kept at `/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/CODEX-BESTIARIUM/04_PRINT/LARGEPRINT/CODEX_BESTIARIUM_INTERIOR_LARGEPRINT.pre-companion.pdf` and is never deleted.

## In KDP

1. Bookshelf → **Codex Bestiarium** → large_print → *Edit print manuscript*.
2. Upload the interior above.
3. Upload the rebuilt cover for **600 pages** — the spine changed, do not reuse the old wrap:

   ```
   /home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/CODEX-BESTIARIUM/03_COVER/LARGEPRINT/exports/
   spine 1.5 in · wrap 13.7500 × 9.2500 (cream)
   cream only, as the large print is printed
   ```

4. Open the previewer and confirm page 600 shows the code and the address, and that the spine text still sits inside its safe zone.

## How this file was checked

- PASS · **page-count** — 600 pages (expected 600)
- PASS · **printed-url** — valicepress.com/companion/codex-bestiarium
- PASS · **canonical-host** — no forbidden host on the page
- PASS · **eyebrow** — CONTINUE WITH VÂLIÇE PRESS
- PASS · **fonts-embedded** — 4 faces: AAAAAA+Cinzel500, AAAAAA+Cinzel400, AAAAAA+Garamonditalic400, AAAAAA+Garamond400
- PASS · **pdf-metadata** — title="Codex Bestiarium: A World Bestiary: 112 Legendary Creatures from 40 Traditions — Large Print Edition" author="Emre Doğan"

Regenerate with `node scripts/factory/build-companion-pages.mjs --commit --slug codex-bestiarium`.
