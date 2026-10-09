#!/usr/bin/env python3
"""
Read a typeset book PDF as PARAGRAPHS, not as lines.

    python3 scripts/previews/pdf_blocks.py list  <pdf> <first-page> <last-page> [--min 25] [--max 95] [--top 12] [--main]
    python3 scripts/previews/pdf_blocks.py show  <pdf> <page>
    python3 scripts/previews/pdf_blocks.py find  <pdf> "<phrase>"
    python3 scripts/previews/pdf_blocks.py context <pdf> <block-id> [<block-id> ...]

`pdftotext` flattens a page to lines, so a paragraph cannot be told from the one
after it, and a "quotation" cut from it can silently join two. A book built with
ReportLab draws each paragraph as its own text object, which PyMuPDF reports as
its own block — so here a block IS a paragraph, with the line-break hyphens joined
and the running head and folio dropped.

`list` ranks the paragraphs of a page range that read well on their own (a full
sentence start, a full sentence end, no figure or table debris, nothing that points
at "above" or "below"); with `--main` it keeps only paragraphs set in the book's
running-text face, so an editor's notes and head-notes (set smaller, in italic) do not
outrank the author's own words; `show` prints every block of one page with its id
(`p<page>.b<k>`); `find` says where a phrase is. The ids are what
`select-quotes.py` uses to cut a passage. Nothing here writes to the site.
"""
import collections
import re
import sys
from pathlib import Path

import pymupdf  # PyMuPDF

_OPEN = re.compile(r"^[“\"‘'(A-Z0-9]")
_END = re.compile(r"[.!?”\"’')]$")
# a paragraph that cannot stand alone
_DEPENDENT = re.compile(
    r"\b(above|below|following page|next page|see page|see p\.|figure \d|fig\. \d|table \d|chapter \d+\)|opposite|overleaf|"
    r"as noted|as shown|the diagram|the board shown|http|www\.|©|isbn)\b",
    re.I,
)
_BAD = re.compile(r"\b(fuck|shit|bitch|sex|naked|orgasm|rape|suicid)\b", re.I)


def clean(text: str) -> str:
    # NUL and other control characters are glyphs the PDF could not map to Unicode (a leader, a hair space):
    # they carry no word and must not reach a card. A soft hyphen is the typesetter's, not the author's.
    t = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\u00ad]", "", text)
    t = re.sub(r"-\n(?=[a-z])", "", t)  # the typesetter's hyphen at a line end
    return " ".join(t.split())


def _raw_blocks(page):
    """(k, text, bbox) for every text block of a page, in the order the PDF draws them."""
    out = []
    for k, b in enumerate(page.get_text("blocks", sort=False)):
        x0, y0, x1, y1, txt, _no, kind = b
        if kind == 0:
            out.append((k, clean(txt), (x0, y0, x1, y1)))
    return out


def _is_line_stream(blocks) -> bool:
    """True when the generator drew every LINE as its own block (no paragraph objects)."""
    body = [b for b in blocks if len(b[1].split()) > 3]
    if len(body) < 15:
        return False
    return sorted(len(b[1].split()) for b in body)[len(body) // 2] <= 14


def _paragraphs_from_lines(blocks):
    """Group line-blocks into paragraphs: a first line indented past the left margin starts one."""
    body = [b for b in blocks if len(b[1].split()) > 3]
    margin = collections.Counter(round(b[2][0]) for b in body).most_common(1)[0][0]
    paras, cur = [], None
    for k, t, bb in blocks:
        indented = bb[0] - margin > 8
        if cur is None or indented:
            cur = [k, [t], list(bb)]
            paras.append(cur)
        else:
            cur[1].append(t)
            cur[2][1] = min(cur[2][1], bb[1])
            cur[2][2] = max(cur[2][2], bb[2])
            cur[2][3] = max(cur[2][3], bb[3])
    return [(k, clean(" ".join(ts).replace("-\n", "")), tuple(bb)) for k, ts, bb in paras]


def page_blocks(doc, pno: int):
    """The paragraph blocks of a 1-based page, in reading order, as (id, text, bbox)."""
    page = doc[pno - 1]
    h = page.rect.height
    raw = _raw_blocks(page)
    # a PDF that drew each line as its own object: rebuild paragraphs from the indentation
    if _is_line_stream([b for b in raw if 0.09 * h < b[2][1] < 0.93 * h]):
        head = [b for b in raw if b[2][1] <= 0.09 * h or b[2][3] >= 0.93 * h]
        mid = [b for b in raw if not (b[2][1] <= 0.09 * h or b[2][3] >= 0.93 * h)]
        raw = head + _paragraphs_from_lines(mid)
    out = []
    for k, t, bb in raw:
        if not t:
            continue
        x0, y0, x1, y1 = bb
        # running head and folio sit in the top / bottom margin and are short
        if len(t.split()) <= 6 and (y0 < 0.09 * h or y1 > 0.93 * h):
            continue
        out.append((f"p{pno}.b{k}", t, bb))
    return out


def open_pdf(path: str):
    return pymupdf.open(path)


def block_face(page, bbox):
    """The (font, size) that most of the characters inside `bbox` are set in."""
    x0, y0, x1, y1 = bbox
    faces = collections.Counter()
    for b in page.get_text("dict", clip=pymupdf.Rect(x0 - 1, y0 - 1, x1 + 1, y1 + 1))["blocks"]:
        if b["type"] != 0:
            continue
        for ln in b["lines"]:
            for sp in ln["spans"]:
                faces[(sp["font"], round(sp["size"], 1))] += len(sp["text"])
    return faces.most_common(1)[0][0] if faces else None


def body_face(doc, a, z):
    """The face the book's running text is set in: the commonest (font, size) by characters."""
    faces = collections.Counter()
    for pno in range(a, min(z, len(doc)) + 1):
        for b in doc[pno - 1].get_text("dict")["blocks"]:
            if b["type"] != 0:
                continue
            for ln in b["lines"]:
                for sp in ln["spans"]:
                    faces[(sp["font"], round(sp["size"], 1))] += len(sp["text"])
    return faces.most_common(1)[0][0]


def block_text(doc, ident: str) -> str:
    m = re.fullmatch(r"p(\d+)\.b(\d+)", ident)
    if not m:
        raise ValueError(f"bad block id {ident!r}")
    pno, k = int(m.group(1)), int(m.group(2))
    for bid, t, _ in page_blocks(doc, pno):
        if bid == f"p{pno}.b{k}":
            return t
    raise KeyError(f"{ident}: no such block")


def cut(doc, blocks, first: str, last: str) -> str:
    """The passage that begins at `first` in the first block and ends after `last` in the last one."""
    parts = [block_text(doc, b) for b in blocks]
    a = parts[0].index(first)
    parts[0] = parts[0][a:]
    z = parts[-1].index(last, 0 if len(parts) > 1 else 0) + len(last)
    parts[-1] = parts[-1][:z]
    return "\n".join(parts)


def sentences(t: str):
    return re.split(r"(?<=[.!?”\"’])\s+(?=[“\"‘A-Z0-9])", t)


def score(t: str) -> float:
    w = t.split()
    n = len(w)
    s = 0.0
    s += 1.0 if 40 <= n <= 80 else 0.0
    s += 0.5 * min(t.count("—"), 2)
    s += 0.3 * min(len(sentences(t)), 5)
    s -= 2.0 * bool(_DEPENDENT.search(t))
    s -= 3.0 * bool(_BAD.search(t))
    # prose, not a list or index: mostly lowercase words, few digits
    digits = sum(c.isdigit() for c in t)
    s -= 0.15 * digits
    return s


def cmd_list(pdf, a, z, lo, hi, top, main_only=False):
    doc = open_pdf(pdf)
    face = body_face(doc, a, z) if main_only else None
    if face:
        print(f"(running text is {face[0]} {face[1]}pt — editorial and apparatus blocks are skipped)")
    cands = []
    for pno in range(a, min(z, len(doc)) + 1):
        for bid, t, bb in page_blocks(doc, pno):
            n = len(t.split())
            if lo <= n <= hi and _OPEN.match(t) and _END.search(t):
                if face and block_face(doc[pno - 1], bb) != face:
                    continue
                cands.append((score(t), bid, n, t))
    cands.sort(key=lambda c: -c[0])
    for sc, bid, n, t in cands[:top]:
        print(f"\n[{bid}]  {n} words  score {sc:.1f}\n   {t}")


def running_head(doc, pno):
    """The page's running head (the short line in the top margin), or ''."""
    page = doc[pno - 1]
    h = page.rect.height
    heads = [clean(b[4]) for b in page.get_text("blocks") if b[6] == 0 and b[1] < 0.09 * h and len(clean(b[4]).split()) <= 8]
    return " | ".join(x for x in heads if not x.isdigit())


def cmd_show(pdf, pno):
    doc = open_pdf(pdf)
    print(f"(running head: {running_head(doc, pno) or '—'})\n")
    for bid, t, bb in page_blocks(doc, pno):
        print(f"[{bid}]  y {bb[1]:.0f}-{bb[3]:.0f}  {len(t.split())}w\n   {t}\n")


def cmd_context(pdf, ident):
    """Where a block sits: the page's running head and every short (heading-like) block above it."""
    doc = open_pdf(pdf)
    pno = int(re.fullmatch(r"p(\d+)\.b\d+", ident).group(1))
    above = []
    for bid, t, _ in page_blocks(doc, pno):
        if bid == ident:
            break
        if len(t.split()) <= 9:
            above.append(t)
    print(f"{ident}: head = {running_head(doc, pno) or '—'}  |  headings above on the page: {above or '—'}")


def cmd_find(pdf, phrase):
    doc = open_pdf(pdf)
    needle = " ".join(phrase.split())
    for pno in range(1, len(doc) + 1):
        for bid, t, _ in page_blocks(doc, pno):
            if needle in t:
                print(f"{bid}: …{t[max(0, t.index(needle) - 40): t.index(needle) + len(needle) + 40]}…")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    cmd, rest = args[0], args[1:]
    opt = lambda name, d: int(rest[rest.index(name) + 1]) if name in rest else d
    if cmd == "list":
        cmd_list(rest[0], int(rest[1]), int(rest[2]), opt("--min", 25), opt("--max", 95), opt("--top", 12), "--main" in rest)
    elif cmd == "show":
        cmd_show(rest[0], int(rest[1]))
    elif cmd == "find":
        cmd_find(rest[0], rest[1])
    elif cmd == "context":
        for ident in rest[1:]:
            cmd_context(rest[0], ident)
    else:
        sys.exit(__doc__)
