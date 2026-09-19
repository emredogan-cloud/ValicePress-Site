# Codex Enigmatica — hardcover — KDP upload package

**Generated:** 2026-09-19 · **ASIN:** B0HH3B4HQ7 · **KDP state:** live

## What changed

A dedicated companion page now stands on page **276**: a QR occupying 28 % of the usable page height, the address `valicepress.com/codex-enigmatica/verify` printed beneath it in display type, and a named list of what is waiting there. It replaces an empty final leaf; the hardcover's verification page is p.275 and stays as it is.

- **Pages:** 276 → **276**
- **Spine:** 0.6900 in → **READ IT FROM KDP'S COVER CALCULATOR — a hardcover spine is not derivable here** (cream paper, 6×9 in)
- **Wrap width:** 12.9400 in → **READ IT FROM KDP'S COVER CALCULATOR — a hardcover wrap is not derivable here**
- **Cover:** NONE — page count unchanged; the cover at KDP stays valid
- **Proof:** not required — the interior is a swap into an edition already in print

## The file

```
/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/CODEX-ENIGMATICA/08_OUTPUT/HARDCOVER/interior.pdf
sha256 c0141c71a49fe497521e0aacb1a8eb13bf1f8452c1bff6ceb574ded35a791471
67,722,613 bytes · 276 pages
```

The build it replaces is kept at `/home/emre/Downloads/MY-DİGİTAL-BOOK/ROADMAP-BOOKS/CODEX-ENIGMATICA/08_OUTPUT/HARDCOVER/interior.pre-companion.pdf` and is never deleted.

## In KDP

1. Bookshelf → **Codex Enigmatica** → hardcover → *Edit print manuscript*.
2. Upload the interior above.
3. **Do not touch the cover.** The page count did not move, so the wrap at KDP is still exactly right.
4. Open the previewer and confirm page 276 shows the code and the address.

## How this file was checked

- PASS · **page-count** — 276 pages (expected 276)
- PASS · **printed-url** — valicepress.com/codex-enigmatica/verify
- PASS · **canonical-host** — no forbidden host on the page
- PASS · **no-email-wall** — the page asks for nothing
- PASS · **headline** — headline present
- PASS · **eyebrow** — CONTINUE WITH VÂLIÇE PRESS
- PASS · **fonts-embedded** — 3 faces: AAAAAA+DejaVuSerif-Bold, AAAAAA+DejaVuSerif-Italic, AAAAAA+DejaVuSerif
- PASS · **qr-floor** — 28.1% of usable height
- PASS · **qr-module-size** — 1.60 mm per module
- PASS · **pdf-metadata** — title="Codex Enigmatica: One Hundred Engraved Enigmas and a Single Unbroken Mystery — A Puzzle Book Bound as a Grimoire" author="Emre Doğan"
- PASS · **qr-matches-url** — 33×33 modules read off the printed page at 300 dpi and matched the code for https://valicepress.com/codex-enigmatica/verify

Regenerate with `node scripts/factory/build-companion-pages.mjs --commit --slug codex-enigmatica`.
