# Mythical Monsters — paperback — KDP upload package

**Generated:** 2026-09-19 · **ASIN:** B0HJD2NCR4 · **KDP state:** live

## What changed

A dedicated companion page now stands on page **74**: a QR occupying 28 % of the usable page height, the address `valicepress.com/companion/the-dragon` printed beneath it in display type, and a named list of what is waiting there. It is a new leaf; nothing was removed.

- **Pages:** 73 → **74**
- **Spine:** 0.1644 in → **0.1666 in** (white paper, 6×9 in)
- **Wrap width:** 12.4144 in → **12.4166 in**
- **Cover:** REBUILD CORRECT — inside tolerance, but the printed spine no longer matches the block
- **Proof:** recommended — the block changed thickness, so the wrap is new and unproved

## The file

```
/home/emre/Downloads/MY-DİGİTAL-BOOK/PUBLIC-BOOKS/PUBLİC-PHASE-1-BOOK/05-MYTHICAL-MONSTERS/OUTPUT/interior-main.pdf
sha256 81b0315e1ade384262bfc76bef9e10231fc5f47716bfdfca006512c611d147fc
858,894 bytes · 74 pages
```

The build it replaces is kept at `/home/emre/Downloads/MY-DİGİTAL-BOOK/PUBLIC-BOOKS/PUBLİC-PHASE-1-BOOK/05-MYTHICAL-MONSTERS/OUTPUT/interior-main.pre-companion.pdf` and is never deleted.

## In KDP

1. Bookshelf → **Mythical Monsters** → paperback → *Edit print manuscript*.
2. Upload the interior above.
3. Upload the rebuilt cover for **74 pages** — the spine changed, do not reuse the old wrap:

   ```
   /home/emre/Downloads/MY-DİGİTAL-BOOK/PUBLIC-BOOKS/PUBLİC-PHASE-1-BOOK/05-MYTHICAL-MONSTERS/ASSETS/cover/paperback-wrap-v1.pdf
   spine 0.1666 in · wrap 12.4166 × 9.2500 (white)
   built 2026-09-04 by the project's own BUILD/build_cover.py at the FINAL page count of 74 — after the companion leaf — so its spine agrees with this pipeline's arithmetic.
   ```

4. Open the previewer and confirm page 74 shows the code and the address, and that the spine text still sits inside its safe zone.

## How this file was checked

- PASS · **page-count** — 74 pages (expected 74)
- PASS · **printed-url** — valicepress.com/companion/the-dragon
- PASS · **canonical-host** — no forbidden host on the page
- PASS · **eyebrow** — CONTINUE WITH VALICE PRESS
- PASS · **fonts-embedded** — 3 faces: AAAAAA+LiberationSerif-Bold, AAAAAA+LiberationSerif-Italic, AAAAAA+LiberationSerif
- PASS · **pdf-metadata** — title="Mythical Monsters: Volume One: The Dragon — 3 Chapters Complete in the 1886 Text, Annotated, with a Register Setting Six of the Author's Claims Against What Is Established and His Sources Graded" author="Charles Gould · edited and annotated by Emre Doğan"

Regenerate with `node scripts/factory/build-companion-pages.mjs --commit --slug mythical-monsters`.
