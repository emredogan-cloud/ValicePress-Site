#!/usr/bin/env python3
"""
Typeset one quotation card.

    python3 scripts/previews/quote-card.py --slug weather-permitting --n 1 \
        --title "Weather Permitting" --author "Quinn Gallagher" \
        --kicker "Bristlecone Emergency · Book 1" \
        --background-from-cover public/images/books/weather-permitting.webp \
        --out /tmp/wp-quote-1.png

then bring it into the site with scripts/covers/ingest-art.mjs --slot quote-1.

THE TEXT IS NEVER TYPED HERE. The quotation and where it is from are read from
`src/content/book-media.json` — the same record `scripts/previews/verify-quotes.mjs`
proved against the manuscript. An image generator can paint a background; it must
never spell the book's words, because it will misspell them (the brief's rule, and
this house's: a fabricated quotation has shipped once). So every glyph on a card is
set here, from font files, from the verified string.

LAYOUT: a 1500 x 2250 canvas (2x the site's 1000 x 1500 portrait panel, so the
card sits in the gallery with the covers, no letterboxing). Top: a kicker between
hairlines. Middle: the passage, EB Garamond, auto-fitted. Foot: where it is from,
the title in Cinzel, the author. Left-aligned for an exchange between speakers,
centred for a single passage.

BACKGROUND: either `--background <image>` (a generated plate; it is cover-fitted,
and only ever behind the type) or `--background-from-cover <the book's own cover>`,
which blurs the cover far past legibility — no title, no face, no object survives,
only the book's own colours and light. It is the honest default: the abstract
atmosphere of the book's real art, never an invented scene.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
W, H = 1500, 2250
FONT_DIR = Path.home() / ".fonts" / "valice"
CINZEL = FONT_DIR / "Cinzel-Variable.ttf"
GARAMOND = FONT_DIR / "EBGaramond-Variable.ttf"
GARAMOND_I = FONT_DIR / "EBGaramond-Italic-Variable.ttf"


def font(path: Path, size: int, wght: int = 400) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(path), size, layout_engine=ImageFont.Layout.RAQM)
    try:
        f.set_variation_by_axes([wght])
    except Exception:  # a static font: nothing to set
        pass
    return f


def hex_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------- background --
def background_from_cover(cover: Path, blur: int, seed: int, zoom: float = 1.0, focus: str = "0.5,0.45", flip: bool = False) -> Image.Image:
    im = fit_plate(cover, zoom, focus, flip)
    # Far past legibility: the cover's title, faces and objects must not survive.
    im = im.filter(ImageFilter.GaussianBlur(radius=blur))
    im = ImageEnhance.Color(im).enhance(1.18)
    return im


def fit_plate(path: Path, zoom: float = 1.0, focus: str = "0.5,0.5", flip: bool = False) -> Image.Image:
    im = Image.open(path).convert("RGB")
    if flip:
        im = ImageOps.mirror(im)
    fx, fy = (float(v) for v in focus.split(","))
    if zoom > 1.0:
        w, h = im.size
        cw, ch = w / zoom, h / zoom
        left = min(max(fx * w - cw / 2, 0), w - cw)
        top = min(max(fy * h - ch / 2, 0), h - ch)
        im = im.crop((int(left), int(top), int(left + cw), int(top + ch)))
    return ImageOps.fit(im, (W, H), method=Image.LANCZOS, centering=(0.5, 0.5))


PARCHMENT = (241, 230, 207)


def text_zone(im: Image.Image, strength: float, blur: int, light: bool = False) -> Image.Image:
    """Where the passage sits, soften and darken the plate behind it (feathered, never a hard box).

    A generated plate is made to be looked at; the type has to be read over it. The
    detail and light stay at the edges and the foot; the middle goes calm. On the
    light theme the middle is softened toward parchment instead of toward dark.
    """
    if strength <= 0:
        return im
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([110, 400, W - 110, 1840], radius=90, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=150))
    soft = im.filter(ImageFilter.GaussianBlur(radius=blur))
    if light:
        calm = Image.blend(soft, Image.new("RGB", (W, H), PARCHMENT), 0.55 * strength)
    else:
        calm = ImageEnhance.Brightness(soft).enhance(1.0 - 0.55 * strength)
    return Image.composite(calm, im, mask)


def finish_background(im: Image.Image, seed: int, darken: float, light: bool = False) -> Image.Image:
    """Grade for legibility: darker toward the edges and under the type, a trace of grain.

    The light theme is paper: the art is mixed toward parchment so dark ink always
    has room, and the edges darken only enough to feel like an aged page.
    """
    if light:
        im = Image.blend(im, Image.new("RGB", (W, H), PARCHMENT), 0.34)
    arr = np.asarray(im).astype(np.float32) / 255.0
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    nx, ny = (xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2)
    r = np.sqrt(nx**2 * 0.9 + ny**2 * 0.7)
    if light:
        vignette = np.clip(1.0 - 0.20 * r**1.7, 0.80, 1.0)
        arr = arr * darken * vignette[..., None]
        rng = np.random.default_rng(seed)
        arr += rng.normal(0, 0.010, size=(H, W, 1)).astype(np.float32)
        return Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))
    vignette = np.clip(1.0 - 0.46 * r**1.7, 0.44, 1.0)
    # a soft darker band where the passage sits
    band = 1.0 - 0.20 * np.exp(-((ny + 0.02) ** 2) / 0.16)
    # the foot (kicker, title, author) sits over whatever the plate has there — often
    # bright snow or light — so shade it
    foot = 1.0 - 0.42 * np.clip((yy - 1640) / 480.0, 0, 1) ** 1.25
    # and so does the kicker at the head — a plate's sky is often its brightest part
    head = 1.0 - 0.50 * np.clip((520 - yy) / 520.0, 0, 1) ** 1.1
    arr = arr * darken * vignette[..., None] * band[..., None] * foot[..., None] * head[..., None]
    rng = np.random.default_rng(seed)
    arr += rng.normal(0, 0.012, size=(H, W, 1)).astype(np.float32)  # film grain
    return Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))


# ---------------------------------------------------------------- typography --
def tracked(draw, xy, text, fnt, fill, tracking, anchor="ls"):
    """Letter-spaced text (Pillow has no tracking). Centred on x when anchor starts with 'm'."""
    x, y = xy
    widths = [fnt.getlength(c) for c in text]
    total = sum(widths) + tracking * (len(text) - 1)
    if anchor[0] == "m":
        x -= total / 2
    for c, w in zip(text, widths):
        draw.text((x, y), c, font=fnt, fill=fill, anchor="ls")
        x += w + tracking


def wrap(text: str, fnt, max_w: float):
    words, lines, cur = text.split(" "), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if fnt.getlength(trial) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def layout_quote(paragraphs, max_w, max_h, start=96, floor=44):
    """Largest size at which the whole passage fits."""
    for size in range(start, floor - 1, -2):
        f = font(GARAMOND, size, 420)
        lh = round(size * 1.38)
        gap = round(size * 0.62)
        blocks = [wrap(p, f, max_w) for p in paragraphs]
        h = sum(len(b) * lh for b in blocks) + gap * (len(blocks) - 1)
        if h <= max_h:
            return f, size, lh, gap, blocks, h
    f = font(GARAMOND, floor, 420)
    lh, gap = round(floor * 1.38), round(floor * 0.62)
    blocks = [wrap(p, f, max_w) for p in paragraphs]
    return f, floor, lh, gap, blocks, sum(len(b) * lh for b in blocks) + gap * (len(blocks) - 1)


def hairline(draw, cx, y, half, accent, diamond=True):
    a = accent + (150,)
    gap = 22
    draw.line([(cx - half, y), (cx - gap, y)], fill=a, width=2)
    draw.line([(cx + gap, y), (cx + half, y)], fill=a, width=2)
    if diamond:
        d = 9
        draw.polygon([(cx, y - d), (cx + d, y), (cx, y + d), (cx - d, y)], fill=accent + (210,))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", required=True)
    ap.add_argument("--n", type=int, required=True, help="which quote (1-based) in book-media.json")
    ap.add_argument("--title", required=True)
    ap.add_argument("--author", required=True)
    ap.add_argument("--kicker", default="")
    ap.add_argument("--background")
    ap.add_argument("--background-from-cover")
    ap.add_argument("--plain", action="store_true", help="no art: bare parchment (light theme) or bare ink (dark) — for a cover that is itself only type")
    ap.add_argument("--blur", type=int, default=70)
    ap.add_argument("--darken", type=float, default=0.92)
    ap.add_argument("--target-luma", type=float, default=0.0, help="dark theme: grade the background to this mean luminance (0..1) instead of using --darken; a bright crop and a dark one then both end up fit to carry light type")
    ap.add_argument("--theme", choices=["dark", "light"], default="dark", help="light = dark ink on parchment (for a reference book)")
    ap.add_argument("--accent", default=None)
    ap.add_argument("--ink", default=None)
    ap.add_argument("--align", choices=["auto", "left", "center"], default="auto")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--zone", type=float, default=0.0, help="0..1: soften+darken the plate behind the passage (use ~0.9 for a generated plate)")
    ap.add_argument("--zone-blur", type=int, default=16)
    ap.add_argument("--zoom", type=float, default=1.0, help=">1 crops in on the plate")
    ap.add_argument("--focus", default="0.5,0.5", help="x,y (0..1) the crop stays centred on when zooming")
    ap.add_argument("--flip", action="store_true", help="mirror the plate (a second card from the same art)")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    media = json.loads((ROOT / "src/content/book-media.json").read_text())
    q = media[a.slug]["quoteVisuals"][a.n - 1]
    paragraphs = [p for p in q["quote"].split("\n") if p.strip()]
    where = q["sourceLocation"]

    if a.plain:
        bg = Image.new("RGB", (W, H), PARCHMENT if a.theme == "light" else (22, 26, 33))
    elif a.background:
        bg = fit_plate(Path(a.background), a.zoom, a.focus, a.flip)
    elif a.background_from_cover:
        bg = background_from_cover(Path(a.background_from_cover), a.blur, a.seed, a.zoom, a.focus, a.flip)
    else:
        sys.exit("give --background, --background-from-cover or --plain")
    light = a.theme == "light"
    prepared = text_zone(bg, a.zone, a.zone_blur, light)
    darken = a.darken
    if a.target_luma > 0 and not light:
        mean = float(np.asarray(prepared.convert("L")).mean()) / 255.0
        darken = min(1.6, max(0.4, a.target_luma / max(mean, 0.03)))
    img = finish_background(prepared, a.seed, darken, light).convert("RGBA")

    ink = hex_rgb(a.ink or ("#2B2118" if light else "#F4EDE0"))
    accent = hex_rgb(a.accent or ("#7A4E1A" if light else "#E1BE7A"))
    over = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)

    # frame
    inset = 62
    d.rounded_rectangle([inset, inset, W - inset, H - inset], radius=26, outline=accent + (95,), width=3)

    # kicker
    cx = W // 2
    if a.kicker:
        kick = a.kicker.upper()
        k_size, k_track = 34, 9
        while k_size > 22:
            kf = font(CINZEL, k_size, 500)
            if sum(kf.getlength(c) for c in kick) + k_track * (len(kick) - 1) <= W - 2 * 190:
                break
            k_size -= 2
            k_track = max(4, k_track - 1)
        tracked(d, (cx, 300), kick, font(CINZEL, k_size, 500), accent + (235,), k_track, anchor="ms")
    hairline(d, cx, 352, 250, accent)

    # the passage
    margin = 200
    max_w, max_h = W - 2 * margin, 1210
    f, size, lh, gap, blocks, h = layout_quote(paragraphs, max_w, max_h)
    centre = a.align == "center" or (a.align == "auto" and len(paragraphs) == 1)
    top = 400 + (max_h - h) / 2 + 40
    y = top
    for block in blocks:
        for line in block:
            if centre:
                d.text((cx, y + size), line, font=f, fill=ink + (255,), anchor="ms")
            else:
                d.text((margin, y + size), line, font=f, fill=ink + (255,), anchor="ls")
            y += lh
        y += gap

    # the foot: where it is from, then whose book
    hairline(d, cx, 1860, 250, accent)
    # a long location ("Editor’s note · What Has Been Established Since 1850") must stay inside the frame
    where_size = 42
    while where_size > 28 and font(GARAMOND_I, where_size, 450).getlength(where) > W - 2 * 190:
        where_size -= 2
    d.text((cx, 1935), where, font=font(GARAMOND_I, where_size, 450), fill=accent + (240,), anchor="ms")
    # a long title (The Great Book of World Games) must stay inside the frame: shrink it, then its tracking
    title = a.title.upper()
    t_size, t_track = 58, 10
    while t_size > 30:
        tf = font(CINZEL, t_size, 600)
        if sum(tf.getlength(c) for c in title) + t_track * (len(title) - 1) <= W - 2 * 170:
            break
        t_size -= 2
        t_track = max(5, round(t_track * 0.94))
    tracked(d, (cx, 2030), title, font(CINZEL, t_size, 600), ink + (255,), t_track, anchor="ms")
    by = a.author.upper()
    b_size, b_track = 30, 8
    while b_size > 22:
        bf = font(CINZEL, b_size, 500)
        if sum(bf.getlength(c) for c in by) + b_track * (len(by) - 1) <= W - 2 * 190:
            break
        b_size -= 2
        b_track = max(4, b_track - 1)
    tracked(d, (cx, 2100), by, font(CINZEL, b_size, 500), accent + (225,), b_track, anchor="ms")

    out = Image.alpha_composite(img, over).convert("RGB")
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    out.save(a.out, format="PNG")
    print(f"wrote {a.out}  {W}x{H}  text {size}px  {len(paragraphs)} paragraph(s)  {h}px tall")


if __name__ == "__main__":
    main()
