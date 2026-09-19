# Korean Hangul Handwriting Workbook — hardcover — KDP upload package

**Generated:** 2026-09-19 · **ASIN:** B0HHLZ31CV · **KDP state:** live

## HOLD — do not upload yet

In KDP review, and its wrap geometry is not derivable here. This project records the hardcover wrap as a value the Founder read out of KDP's own Cover Calculator (`project_config.json → formats.hardcover.kdp_calculator`), pinned and independent of page count — so re-running the builder at 126 pages reproduces the 124-page wrap rather than a new one. The house standard says a hardcover wrap is read from the calculator and never derived, so this one needs five minutes in the calculator at 126 pp / 8.25 × 11 / white before it can be rebuilt. The paperback has no such dependency and its cover was rebuilt.

The file below is finished and verified. It waits on the calendar, not on work.

## What changed

A dedicated companion page now stands on page **125**: a QR occupying a measured share of the page, the address `valicepress.com/companion/hangul` printed beneath it in display type, and a named list of what is waiting there. It replaces the grey box at the foot of p.122, which was the fourth thing on that page.

- **Pages:** 124 → **126**
- **Spine:** 0.2792 in → **READ IT FROM KDP'S COVER CALCULATOR — a hardcover spine is not derivable here** (white paper, 8.25×11 in)
- **Wrap width:** 17.0292 in → **READ IT FROM KDP'S COVER CALCULATOR — a hardcover wrap is not derivable here**
- **Cover:** REBUILD CORRECT — inside tolerance, but the printed spine no longer matches the block
- **Proof:** recommended — the block changed thickness, so the wrap is new and unproved

## The file

```
/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/01-KOREAN-HANGUL-HANDWRITING-WORKBOOK/09_OUTPUT/FINAL/hardcover/hardcover_interior_8.25x11_126pp.pdf
sha256 849c152c7621bb7ea701ddd58a075d746b4978024345a44d47b17566176b141d
767,181 bytes · 126 pages
```

The build it replaces is kept at `/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/01-KOREAN-HANGUL-HANDWRITING-WORKBOOK/09_OUTPUT/FINAL/hardcover/hardcover_interior_8.25x11_126pp.pre-companion.pdf` and is never deleted.

## In KDP

1. Bookshelf → **Korean Hangul Handwriting Workbook** → hardcover → *Edit print manuscript*.
2. Upload the interior above.
3. **The cover has NOT been rebuilt, and the interior must not be uploaded without it.** this project pins the hardcover wrap to a value the Founder read out of KDP's Cover Calculator, and that value is page-count independent — re-running the builder at 126 pp reproduces the 124 pp wrap. The house standard forbids deriving a hardcover wrap. Founder action: run the calculator at 126 pp / 8.25 × 11 / white, paste the three numbers into project_config.json → formats.hardcover.kdp_calculator, re-run 06_BUILD/build_cover.py --format hardcover.
4. Open the previewer and confirm page 125 shows the code and the address, and that the spine text still sits inside its safe zone.

## How this file was checked

- PASS · **page-count** — 126 pages (expected 126)
- PASS · **printed-url** — valicepress.com/companion/hangul
- PASS · **canonical-host** — no forbidden host on the page
- PASS · **eyebrow** — CONTINUE WITH VÂLIÇE PRESS
- PASS · **fonts-embedded** — 2 faces: AAAAAA+NotoSansKR-Bold, AAAAAA+NotoSansKR-Regular
- PASS · **pdf-metadata** — title="Korean Hangul Handwriting Workbook: Learn to write all 40 letters with correct stroke order, build syllable blocks, and read your first 97 Korean words" author="Emre Doğan"

Regenerate with `node scripts/factory/build-companion-pages.mjs --commit --slug korean-hangul-handwriting-workbook`.
