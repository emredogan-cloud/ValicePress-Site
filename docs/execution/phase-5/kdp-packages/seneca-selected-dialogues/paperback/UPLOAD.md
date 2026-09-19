# Seneca: Selected Dialogues — paperback — KDP upload package

**Generated:** 2026-09-19 · **ASIN:** B0HJDMFV1R · **KDP state:** live

## What changed

A dedicated companion page now stands on page **156**: a QR occupying 29 % of the usable page height, the address `valicepress.com/companion/seneca` printed beneath it in display type, and a named list of what is waiting there. It is a new leaf; nothing was removed.

- **Pages:** 155 → **156**
- **Spine:** 0.3491 in → **0.3513 in** (white paper, 6×9 in)
- **Wrap width:** 12.5991 in → **12.6013 in**
- **Cover:** REBUILD CORRECT — inside tolerance, but the printed spine no longer matches the block
- **Proof:** recommended — the block changed thickness, so the wrap is new and unproved

## The file

```
/home/emre/Downloads/MY-DİGİTAL-BOOK/PUBLIC-BOOKS/PUBLİC-PHASE-1-BOOK/02-SENECA-SELECTED-DIALOGUES/OUTPUT/interior-main.pdf
sha256 b504a558646f4cbdeb302595662427d30730509004ef3462ea53af3c54c3d3db
577,932 bytes · 156 pages
```

The build it replaces is kept at `/home/emre/Downloads/MY-DİGİTAL-BOOK/PUBLIC-BOOKS/PUBLİC-PHASE-1-BOOK/02-SENECA-SELECTED-DIALOGUES/OUTPUT/interior-main.pre-companion.pdf` and is never deleted.

## In KDP

1. Bookshelf → **Seneca: Selected Dialogues** → paperback → *Edit print manuscript*.
2. Upload the interior above.
3. Upload the rebuilt cover for **156 pages** — the spine changed, do not reuse the old wrap:

   ```
   /home/emre/Downloads/MY-DİGİTAL-BOOK/PUBLIC-BOOKS/PUBLİC-PHASE-1-BOOK/02-SENECA-SELECTED-DIALOGUES/ASSETS/cover/paperback-wrap-v1.pdf
   spine 0.3468 in · wrap 12.5968 × 9.2500 (white)
   rebuilt 2026-09-04 at the final page count of 154, after the companion leaf. The count moved 156 -> 154 when a markdown-bold rendering defect was fixed and the text reflowed; the cover was rebuilt rather than reused.
   ```

4. Open the previewer and confirm page 156 shows the code and the address, and that the spine text still sits inside its safe zone.

## How this file was checked

- PASS · **page-count** — 156 pages (expected 156)
- PASS · **printed-url** — valicepress.com/companion/seneca
- PASS · **canonical-host** — no forbidden host on the page
- PASS · **eyebrow** — CONTINUE WITH VALICE PRESS
- PASS · **fonts-embedded** — 3 faces: AAAAAA+LiberationSerif-Bold, AAAAAA+LiberationSerif-Italic, AAAAAA+LiberationSerif
- PASS · **pdf-metadata** — title="Seneca: Selected Dialogues: Five Dialogues Complete in Aubrey Stewart's Translation, Annotated — with an Argument Map of All 79 Chapters, a Glossary, a Biographical Index and a Chronology" author="Seneca · translated by Aubrey Stewart · edited and annotated by Emre Doğan"

Regenerate with `node scripts/factory/build-companion-pages.mjs --commit --slug seneca-selected-dialogues`.
