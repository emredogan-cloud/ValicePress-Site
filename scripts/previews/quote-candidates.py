#!/usr/bin/env python3
"""
Shortlist passages worth putting on a book's preview card.

    python3 scripts/previews/quote-candidates.py --dir <manuscript dir of chapter-*.md> [--top 8]
    python3 scripts/previews/quote-candidates.py --pdf <interior.pdf> --first-page 9 --last-page 240

This only PROPOSES. It reads a manuscript and ranks two kinds of passage —
a short exchange between speakers (consecutive paragraphs, verbatim) and a single
descriptive paragraph — by a crude "quotability" score. A person (or an agent
acting as one) reads the shortlist and decides; `verify-quotes.mjs` then proves the
chosen text is in the book. Nothing here writes to the site.

Filters, so the shortlist is fit to show in public: nothing explicit, nothing that
needs the rest of the scene to make sense (a line that opens with a pronoun and no
antecedent, a fragment), nothing with a chapter number or a URL in it.
"""
import argparse
import re
import subprocess
from pathlib import Path

LEX = set(
    """love loved stay stayed home afraid choose chose promise never always enough sorry forgive wait waited need
    needed want wanted hands hand quiet light lake snow water morning night sky wind storm fire warm cold dark
    heart breath whole alone together brave ready first last again still maybe because if wish remember""".split()
)
BAD = re.compile(
    r"\b(fuck|shit|damn|bitch|ass|sex|naked|nipple|thigh|moan|orgasm|erect|breast|crotch|lust|bleeding|blood|corpse|dead|died|dies|"
    r"suicid|gun|rifle|pistol|kill|murder|rape|http|www\.|chapter \d)\b",
    re.I,
)


def words(t):
    return re.findall(r"[A-Za-z’']+", t)


def good_start(p):
    return bool(re.match(r"^[“\"A-Z]", p.strip()))


def score(p):
    w = words(p.lower())
    if not w:
        return 0
    hits = sum(1 for x in w if x in LEX)
    s = hits / len(w) * 10
    s += 0.4 * min(p.count("—"), 3)
    s += 0.3 * (p.count(". ") >= 1)
    s -= 2.5 * bool(BAD.search(p))
    return s


def paragraphs_md(path: Path):
    out = []
    for block in re.split(r"\n\s*\n", path.read_text()):
        b = " ".join(block.split())
        if b and not b.startswith("#") and not set(b) <= set("*-_ "):
            out.append(b)
    return out


def paragraphs_pdf(pdf: Path, a: int, z: int):
    txt = subprocess.run(["pdftotext", "-f", str(a), "-l", str(z), "-raw", str(pdf), "-"], capture_output=True, text=True).stdout
    out = []
    for block in re.split(r"\n\s*\n", txt):
        b = " ".join(block.split())
        if len(b) > 40:
            out.append(b)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir")
    ap.add_argument("--pdf")
    ap.add_argument("--first-page", type=int, default=1)
    ap.add_argument("--last-page", type=int, default=999)
    ap.add_argument("--top", type=int, default=8)
    a = ap.parse_args()

    sources = []
    if a.dir:
        for f in sorted(Path(a.dir).glob("chapter-*.md")):
            sources.append((f.stem.replace("chapter-", "Chapter ").replace("-0", " ").lstrip("0"), paragraphs_md(f)))
    elif a.pdf:
        sources.append((f"pp. {a.first_page}–{a.last_page}", paragraphs_pdf(Path(a.pdf), a.first_page, a.last_page)))

    exchanges, passages = [], []
    for label, paras in sources:
        # exchanges: 2–4 consecutive short paragraphs, mostly quoted speech
        for i in range(len(paras) - 1):
            for n in (2, 3, 4):
                run = paras[i : i + n]
                if len(run) < n:
                    continue
                quoted = sum(1 for p in run if "“" in p or '"' in p)
                nw = [len(words(p)) for p in run]
                total = sum(nw)
                if quoted >= n - 1 and max(nw) <= 30 and 16 <= total <= 62 and all(good_start(p) for p in run):
                    sc = sum(score(p) for p in run) / n
                    exchanges.append((sc, label, run))
        for p in paras:
            nw = len(words(p))
            if 32 <= nw <= 78 and "“" not in p and '"' not in p and good_start(p) and p.endswith((".", "!", "?", "”")):
                passages.append((score(p), label, [p]))

    def show(title, items):
        print(f"\n===== {title} =====")
        seen = set()
        k = 0
        for sc, label, run in sorted(items, key=lambda t: -t[0]):
            key = run[0][:40]
            if key in seen or BAD.search(" ".join(run)):
                continue
            seen.add(key)
            k += 1
            print(f"\n[{k}] {label}  score {sc:.2f}  ({sum(len(words(p)) for p in run)} words)")
            for p in run:
                print("   " + p)
            if k >= a.top:
                break

    show("EXCHANGES (verbatim, consecutive paragraphs)", exchanges)
    show("PASSAGES (single paragraph)", passages)


if __name__ == "__main__":
    main()
