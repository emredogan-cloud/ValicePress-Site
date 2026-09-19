# Codex Mythologica — hardcover — KDP upload package

**Generated:** 2026-09-19 · **ASIN:** B0HDBFZRQ4 · **KDP state:** live

## HOLD — do not upload yet

KDP Select runs to 2026-11-03 (handbook O5). On that date the interiors are reopened anyway so the ebook can be sold here; these files go up in the same pass. Pulling three live editions before then buys nothing.

The file below is finished and verified. It waits on the calendar, not on work.

## What changed

A dedicated companion page now stands on page **330**: a QR occupying a measured share of the page, the address `valicepress.com/companion/codex-mythologica` printed beneath it in display type, and a named list of what is waiting there. It is a new leaf; nothing was removed.

- **Pages:** 329 → **330**
- **Spine:** 0.8225 in → **READ IT FROM KDP'S COVER CALCULATOR — a hardcover spine is not derivable here** (cream paper, 6×9 in)
- **Wrap width:** 13.0725 in → **14.5858 × 10.4167 (cream) · 14.5040 × 10.4167 (white) — READ from KDP's Cover Calculator, not derived**
- **Cover:** REBUILD CORRECT — inside tolerance, but the printed spine no longer matches the block
- **Proof:** recommended — the block changed thickness, so the wrap is new and unproved

## The file

```
/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/CODEX-MYTHOLOGICA/04_PRINT/HARDCOVER/CODEX_MYTHOLOGICA_INTERIOR_HARDCOVER.pdf
sha256 4e9d6b14961610657953dfb509ac47c39a430fbb3d842e32fad439352a1a68d1
964,998 bytes · 330 pages
```

The build it replaces is kept at `/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/CODEX-MYTHOLOGICA/04_PRINT/HARDCOVER/CODEX_MYTHOLOGICA_INTERIOR_HARDCOVER.pre-companion.pdf` and is never deleted.

## In KDP

1. Bookshelf → **Codex Mythologica** → hardcover → *Edit print manuscript*.
2. Upload the interior above.
3. Upload the rebuilt cover for **330 pages** — the spine changed, do not reuse the old wrap:

   ```
   /home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/CODEX-MYTHOLOGICA/03_COVER/HARDCOVER/exports/
   spine see wrap in · wrap 14.5858 × 10.4167 (cream) · 14.5040 × 10.4167 (white)
   calibrated hardcover profile
   ```

4. Open the previewer and confirm page 330 shows the code and the address, and that the spine text still sits inside its safe zone.

## How this file was checked

- PASS · **page-count** — 330 pages (expected 330)
- PASS · **printed-url** — valicepress.com/companion/codex-mythologica
- PASS · **canonical-host** — no forbidden host on the page
- PASS · **eyebrow** — CONTINUE WITH VÂLIÇE PRESS
- PASS · **fonts-embedded** — 4 faces: AAAAAA+Cinzel500, AAAAAA+Cinzel400, AAAAAA+Garamonditalic400, AAAAAA+Garamond400
- PASS · **pdf-metadata** — title="Codex Mythologica: 76 Myths from 19 Civilizations" author="Emre Doğan"

Regenerate with `node scripts/factory/build-companion-pages.mjs --commit --slug codex-mythologica`.
