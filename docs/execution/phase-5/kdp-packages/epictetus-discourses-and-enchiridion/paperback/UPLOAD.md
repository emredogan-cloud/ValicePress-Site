# Epictetus: The Discourses and Enchiridion — paperback — KDP upload package

**Generated:** 2026-09-19 · **ASIN:** B0HJ6G2B4L · **KDP state:** live

## What changed

A dedicated companion page now stands on page **176**: a QR occupying 28 % of the usable page height, the address `valicepress.com/companion/epictetus` printed beneath it in display type, and a named list of what is waiting there. It is a new leaf; nothing was removed.

- **Pages:** 175 → **176**
- **Spine:** 0.3941 in → **0.3964 in** (white paper, 6×9 in)
- **Wrap width:** 12.6441 in → **12.6464 in**
- **Cover:** REBUILD CORRECT — inside tolerance, but the printed spine no longer matches the block
- **Proof:** recommended — the block changed thickness, so the wrap is new and unproved

## The file

```
/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/05-EPICTETUS-DISCOURSES-AND-ENCHIRIDION/OUTPUT/interior-main.pdf
sha256 cfe8e1fe2c558a11e960ad5fbc469ec68e5278b1ea48c8ecc4e8b0281e4262b8
615,814 bytes · 176 pages
```

The build it replaces is kept at `/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/05-EPICTETUS-DISCOURSES-AND-ENCHIRIDION/OUTPUT/interior-main.pre-companion.pdf` and is never deleted.

## In KDP

1. Bookshelf → **Epictetus: The Discourses and Enchiridion** → paperback → *Edit print manuscript*.
2. Upload the interior above.
3. Upload the rebuilt cover for **176 pages** — the spine changed, do not reuse the old wrap:

   ```
   /home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/05-EPICTETUS-DISCOURSES-AND-ENCHIRIDION/ASSETS/cover/paperback-wrap-v1.pdf
   spine 0.3964 in · wrap 12.6464 × 9.2500 (white)
   built 2026-09-04 by the project's own BUILD/build_cover.py at the FINAL page count of 176 — that is, after the companion leaf. Its spine and wrap agree with this pipeline's own arithmetic to four decimal places (0.396352 / 12.646352), so nothing had to be rebuilt after the splice.
   ```

4. Open the previewer and confirm page 176 shows the code and the address, and that the spine text still sits inside its safe zone.

## How this file was checked

- PASS · **page-count** — 176 pages (expected 176)
- PASS · **printed-url** — valicepress.com/companion/epictetus
- PASS · **canonical-host** — no forbidden host on the page
- PASS · **eyebrow** — CONTINUE WITH VALICE PRESS
- PASS · **fonts-embedded** — 3 faces: AAAAAA+LiberationSerif-Bold, AAAAAA+LiberationSerif-Italic, AAAAAA+LiberationSerif
- PASS · **pdf-metadata** — title="Epictetus: The Discourses and Enchiridion: The George Long Translation, Annotated — the Complete Enchiridion, 68 Discourses in Seven Thematic Parts, 120 Head-Notes, a Stoic Glossary and a Concordance to the Meditations" author="Epictetus · translated by George Long · edited by Emre Dogan"

Regenerate with `node scripts/factory/build-companion-pages.mjs --commit --slug epictetus-discourses-and-enchiridion`.
