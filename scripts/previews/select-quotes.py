#!/usr/bin/env python3
"""
Cut every preview quotation out of the book it belongs to.

    python3 scripts/previews/select-quotes.py            # rewrite src/content/book-media.json from quote-picks.json
    python3 scripts/previews/select-quotes.py --check    # only report: does every pick still cut to the text now on record?

`quote-picks.json` says WHERE each passage is — which file, which paragraph(s), the
words it starts and stops at — and NOTHING about what it says. The text is read out
of the book here, so a card cannot differ from the book by a typo of mine, and
`verify-quotes.mjs --write` then proves the cut against the file (and, where a book
has a printed interior, against that too).

Two kinds of source:

  "from": "md"   a markdown manuscript. Paragraphs are the blank-line blocks; the
                 straight quotation marks a markdown file uses are made typographic
                 (the printed books use curly ones). Nothing else is altered.
  "from": "pdf"  a typeset PDF, read as paragraphs by pdf_blocks.py (a ReportLab book
                 draws each paragraph as its own block). Blocks are named
                 `p<page>.b<k>`; consecutive blocks are consecutive paragraphs.

A pick that starts or stops mid-paragraph is an EXCERPT, and is only ever cut at a
sentence boundary by whoever writes the pick; the verifier proves the words are
contiguous in the book, in order, with nothing dropped inside.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pdf_blocks  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PICKS = ROOT / "scripts/previews/quote-picks.json"
OUT = ROOT / "src/content/book-media.json"


def md_paragraphs(path: Path):
    out = []
    for block in re.split(r"\n\s*\n", path.read_text()):
        b = " ".join(block.split())
        if b and not set(b) <= set("*-_ "):
            out.append(b)
    return out


def smarten(s: str) -> str:
    s = re.sub(r'(^|[\s(\[—–-])"', lambda m: m.group(1) + "“", s)
    s = s.replace('"', "”")
    s = re.sub(r"(^|[\s(\[—“])'", lambda m: m.group(1) + "‘", s)
    return s.replace("'", "’")


def cut_md(path: Path, first: str, last: str) -> str:
    P = md_paragraphs(path)
    i = next(k for k, para in enumerate(P) if first in para)
    start = P[i].index(first)
    # the last paragraph is the first one at or after `i` that holds `last`
    # (in the opening paragraph, only the part from `first` on counts)
    j = next(k for k in range(i, len(P)) if last in (P[k][start:] if k == i else P[k]))
    seg = P[i : j + 1]
    seg[0] = seg[0][start:]
    seg[-1] = seg[-1][: seg[-1].index(last) + len(last)]
    text = "\n".join(seg)
    assert "*" not in text and "_" not in text, f"markdown emphasis inside the pick: {text[:80]}"
    return smarten(text)


_docs = {}


def pdf_doc(path: str):
    if path not in _docs:
        _docs[path] = pdf_blocks.open_pdf(path)
    return _docs[path]


def cut_pdf(path: str, blocks, first: str, last: str, join: str = "paragraphs") -> str:
    """`join: "space"` is for a generator that drew each LINE as its own block: the blocks are
    then lines of ONE paragraph and are rejoined with a space, not a paragraph break."""
    doc = pdf_doc(path)
    parts = [pdf_blocks.block_text(doc, b) for b in blocks]
    a = parts[0].index(first)
    parts[0] = parts[0][a:]
    z = parts[-1].index(last) + len(last)
    parts[-1] = parts[-1][:z]
    text = (" " if join == "space" else "\n").join(parts)
    if '"' in text or "'" in text:
        text = smarten(text)  # the PG-derived texts are set with straight marks; the cards are typeset
    # a footnote marker such as "[143]" is printed in the book but means nothing on a card
    assert not re.search(r"\[\d+\]", text), f"footnote marker inside the pick: {text[:80]}"
    return text


def main():
    picks = json.loads(PICKS.read_text())
    media = {}
    for slug, spec in picks.items():
        if slug.startswith("_"):
            continue
        entry = {}
        if spec.get("interior"):
            entry["interior"] = spec["interior"]
        entry["quoteVisuals"] = []
        for n, p in enumerate(spec["quotes"], 1):
            try:
                if p["from"] == "md":
                    text = cut_md(Path(p["file"]), p["first"], p["last"])
                    source = p["file"]
                else:
                    source = p.get("pdf") or spec["interior"]
                    text = cut_pdf(source, p["blocks"], p["first"], p["last"], p.get("join", "paragraphs"))
            except (ValueError, StopIteration, KeyError, AssertionError) as e:
                sys.exit(f"✗ {slug} quote {n} ({p['where']}): cannot cut — {type(e).__name__}: {e}\n    first = {p['first'][:70]!r}\n    last  = {p['last'][:70]!r}")
            entry["quoteVisuals"].append(
                {
                    "quote": text,
                    "sourceLocation": p["where"],
                    "image": f"/images/previews/{slug}/quote-{n}.webp",
                    "verification": {"source": source},
                }
            )
        media[slug] = entry

    if "--check" in sys.argv:
        have = json.loads(OUT.read_text())
        bad = 0
        for slug, e in media.items():
            for n, q in enumerate(e["quoteVisuals"], 1):
                cur = have.get(slug, {}).get("quoteVisuals", [])
                if n > len(cur) or cur[n - 1]["quote"] != q["quote"]:
                    print(f"✗ {slug} quote {n} differs from book-media.json")
                    bad += 1
        print("every pick cuts to the text on record" if not bad else f"{bad} differ")
        sys.exit(1 if bad else 0)

    OUT.write_text(json.dumps(media, ensure_ascii=False, indent=2) + "\n")
    for slug, e in media.items():
        for n, v in enumerate(e["quoteVisuals"], 1):
            print(f"{slug:36s} #{n}  {v['sourceLocation']:34s} {len(v['quote'].split()):3d} words")
    print("\nnow run: node scripts/previews/verify-quotes.mjs --write")


if __name__ == "__main__":
    main()
