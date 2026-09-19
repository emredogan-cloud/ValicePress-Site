# Korean Hangul Handwriting Workbook — paperback — KDP upload package

**Generated:** 2026-09-19 · **ASIN:** B0HHHWXGG4 · **KDP state:** live

## What changed

A dedicated companion page now stands on page **125**: a QR occupying a measured share of the page, the address `valicepress.com/companion/hangul` printed beneath it in display type, and a named list of what is waiting there. It replaces the grey box at the foot of p.122, which was the fourth thing on that page.

- **Pages:** 124 → **126**
- **Spine:** 0.2792 in → **0.2838 in** (white paper, 8.5×11 in)
- **Wrap width:** 17.5292 in → **17.5338 in**
- **Cover:** REBUILD CORRECT — inside tolerance, but the printed spine no longer matches the block
- **Proof:** recommended — the block changed thickness, so the wrap is new and unproved

## The file

```
/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/01-KOREAN-HANGUL-HANDWRITING-WORKBOOK/09_OUTPUT/FINAL/paperback/paperback_interior_8.5x11_126pp.pdf
sha256 791ef3bdbc4cbf8d20d65f257ea768c96990bbb993ca65d8ddc11b4752b9e35b
767,355 bytes · 126 pages
```

The build it replaces is kept at `/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/01-KOREAN-HANGUL-HANDWRITING-WORKBOOK/09_OUTPUT/FINAL/paperback/paperback_interior_8.5x11_126pp.pre-companion.pdf` and is never deleted.

## In KDP

1. Bookshelf → **Korean Hangul Handwriting Workbook** → paperback → *Edit print manuscript*.
2. Upload the interior above.
3. Upload the rebuilt cover for **126 pages** — the spine changed, do not reuse the old wrap:

   ```
   /home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/01-KOREAN-HANGUL-HANDWRITING-WORKBOOK/05_APLUS_COVER/exports/paperback_cover.pdf
   spine 0.283752 in · wrap 17.5338 × 11.2500
   internal KDP formula, white paper — the same arithmetic spine-check.mjs runs, and the two agree
   ```

4. Open the previewer and confirm page 125 shows the code and the address, and that the spine text still sits inside its safe zone.

## How this file was checked

- PASS · **page-count** — 126 pages (expected 126)
- PASS · **printed-url** — valicepress.com/companion/hangul
- PASS · **canonical-host** — no forbidden host on the page
- PASS · **eyebrow** — CONTINUE WITH VÂLIÇE PRESS
- PASS · **fonts-embedded** — 2 faces: AAAAAA+NotoSansKR-Bold, AAAAAA+NotoSansKR-Regular
- PASS · **pdf-metadata** — title="Korean Hangul Handwriting Workbook: Learn to write all 40 letters with correct stroke order, build syllable blocks, and read your first 97 Korean words" author="Emre Doğan"

Regenerate with `node scripts/factory/build-companion-pages.mjs --commit --slug korean-hangul-handwriting-workbook`.
