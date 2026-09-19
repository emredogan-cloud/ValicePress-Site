# Codex Mythologica — large_print — KDP upload package

**Generated:** 2026-09-19 · **ASIN:** B0HDDR84MF · **KDP state:** live

## HOLD — do not upload yet

KDP Select runs to 2026-11-03 (handbook O5). On that date the interiors are reopened anyway so the ebook can be sold here; these files go up in the same pass. Pulling three live editions before then buys nothing.

The file below is finished and verified. It waits on the calendar, not on work.

## What changed

A dedicated companion page now stands on page **579**: a QR occupying a measured share of the page, the address `valicepress.com/companion/codex-mythologica` printed beneath it in display type, and a named list of what is waiting there. It is a new leaf; nothing was removed.

- **Pages:** 578 → **579**
- **Spine:** 1.4450 in → **1.4475 in** (cream paper, 6×9 in)
- **Wrap width:** 13.6950 in → **13.6975 in**
- **Cover:** REBUILD CORRECT — inside tolerance, but the printed spine no longer matches the block
- **Proof:** recommended — the block changed thickness, so the wrap is new and unproved

## The file

```
/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/CODEX-MYTHOLOGICA/04_PRINT/LARGEPRINT/CODEX_MYTHOLOGICA_INTERIOR_LARGEPRINT.pdf
sha256 bf6c8f9a34875bc99574d037bd08727f5aac5cadd8e5877447b8a9346e7f05b6
1,114,694 bytes · 579 pages
```

The build it replaces is kept at `/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/CODEX-MYTHOLOGICA/04_PRINT/LARGEPRINT/CODEX_MYTHOLOGICA_INTERIOR_LARGEPRINT.pre-companion.pdf` and is never deleted.

## In KDP

1. Bookshelf → **Codex Mythologica** → large_print → *Edit print manuscript*.
2. Upload the interior above.
3. Upload the rebuilt cover for **579 pages** — the spine changed, do not reuse the old wrap:

   ```
   /home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/CODEX-MYTHOLOGICA/03_COVER/LARGEPRINT/exports/
   spine 1.4475 in · wrap 13.6975 × 9.2500 (cream)
   cream only
   ```

4. Open the previewer and confirm page 579 shows the code and the address, and that the spine text still sits inside its safe zone.

## How this file was checked

- PASS · **page-count** — 579 pages (expected 579)
- PASS · **printed-url** — valicepress.com/companion/codex-mythologica
- PASS · **canonical-host** — no forbidden host on the page
- PASS · **eyebrow** — CONTINUE WITH VÂLIÇE PRESS
- PASS · **fonts-embedded** — 4 faces: AAAAAA+Cinzel500, AAAAAA+Cinzel400, AAAAAA+Garamonditalic400, AAAAAA+Garamond400
- PASS · **pdf-metadata** — title="Codex Mythologica: 76 Myths from 19 Civilizations" author="Emre Doğan"

Regenerate with `node scripts/factory/build-companion-pages.mjs --commit --slug codex-mythologica`.
