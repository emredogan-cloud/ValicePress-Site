#!/usr/bin/env python3
"""
Make every book's quotation cards from one declaration.

    python3 scripts/previews/build-cards.py                       # render all to scripts/tmp/cards/
    python3 scripts/previews/build-cards.py --slug the-sweetest-season
    python3 scripts/previews/build-cards.py --ingest              # …and write public/images/previews/<slug>/quote-N.webp + provenance

The words come from `src/content/book-media.json`; the setting (title, byline, kicker,
background art) from `scripts/previews/card-styles.json`. Refuses to render a quote that
has no recorded proof, so an unverified passage can never reach a card:

    node scripts/previews/verify-quotes.mjs --write   # first
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "scripts/tmp/cards"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug")
    ap.add_argument("--ingest", action="store_true", help="write the webp into public/images/previews and record provenance")
    a = ap.parse_args()

    media = json.loads((ROOT / "src/content/book-media.json").read_text())
    styles = json.loads((ROOT / "scripts/previews/card-styles.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)

    failed = 0
    for slug, style in styles.items():
        if slug.startswith("_") or (a.slug and slug != a.slug):
            continue
        quotes = media.get(slug, {}).get("quoteVisuals", [])
        for n, card in enumerate(style["cards"], 1):
            if n > len(quotes):
                print(f"✗ {slug} card {n}: no quote {n} in book-media.json")
                failed += 1
                continue
            if not quotes[n - 1].get("verification", {}).get("sourceSha256"):
                print(f"✗ {slug} card {n}: the quote has no recorded proof — run verify-quotes.mjs --write")
                failed += 1
                continue
            png = OUT / f"{slug}-{n}.png"
            cmd = [
                sys.executable, str(ROOT / "scripts/previews/quote-card.py"),
                "--slug", slug, "--n", str(n),
                "--title", style["title"], "--author", style["author"], "--kicker", style.get("kicker", ""),
                "--accent", style.get("accent", "#E1BE7A"),
                "--out", str(png),
            ]
            if card.get("plain"):
                cmd.append("--plain")
            elif "background" in card:
                cmd += ["--background", str(ROOT / card["background"])]
            else:
                cmd += ["--background-from-cover", str(ROOT / card["backgroundFromCover"])]
            for key in ("blur", "darken", "zone", "zoom", "focus", "target-luma"):
                if key in card:
                    cmd += [f"--{key}", str(card[key])]
            if card.get("flip"):
                cmd.append("--flip")
            if style.get("theme"):
                cmd += ["--theme", style["theme"]]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)
            print(f"✓ {slug} card {n} → {png.relative_to(ROOT)}")

            if a.ingest:
                art = card.get("background") or card.get("backgroundFromCover")
                if card.get("plain"):
                    how = "is bare " + ("parchment" if style.get("theme") == "light" else "ink") + " (the book's cover is itself only type)"
                elif "background" in card:
                    how = f"is a generated plate ({art}), cropped"
                else:
                    how = f"is a soft-focus crop of the book's own cover ({art}) — no lettering is kept"
                note = (
                    f"typeset quotation card {n}: the passage is read from book-media.json (verified against the book); "
                    f"type set locally in EB Garamond and Cinzel; background {how}"
                )
                subprocess.run(
                    ["node", str(ROOT / "scripts/covers/ingest-art.mjs"), "--slug", slug, "--slot", f"quote-{n}", "--source", str(png), "--width", "1000", "--note", note, "--commit"],
                    check=True, stdout=subprocess.DEVNULL,
                )
                print(f"  ingested → public/images/previews/{slug}/quote-{n}.webp")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
