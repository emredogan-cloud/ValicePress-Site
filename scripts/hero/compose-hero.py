#!/usr/bin/env python3
"""
The homepage hero, rebuilt from its empty plate and the three REAL covers.

    python3 scripts/hero/compose-hero.py --plate-x4 <realesrgan-x4plus output> --out scripts/tmp/hero/master.png
    node scripts/hero/export-hero.mjs                       # AVIF + WebP at every width into public/images/homepage/

WHY. The old hero was a generated photograph of three books that do not exist: cream,
green and navy "covers" that match nothing the press has published. The brief asks for
the real current covers — Weather Permitting, The Sweetest Season, The Great Book of
World Games — and for a sharper background.

THE SOURCE. `source/hero-plate-1672x941.png` is the actual source of the old hero: the
same plate (marble ledge, olive branch, armillary sphere, column), before the three
mock books were painted on. There is no larger original. So the plate is ENLARGED, and
the way it is enlarged is the point of this script:

  1. Real-ESRGAN x4plus (the official ncnn-vulkan release, run on the GPU) to 6688x3764;
  2. a Lanczos reduction of that to the working size, 3344x1882 (2x the source) — the
     reduction averages away most of what a learned upscaler invents;
  3. only a FRACTION of what the learned model added is kept: the result is the plain
     Lanczos 2x of the original plus 45% of the enhancer's high-frequency detail. At full
     strength Real-ESRGAN turns marble into cracked mud; at 45% edges are crisp and the
     stone is still stone;
  4. a trace of film grain at the final size, which is what stops a smooth enlargement
     looking like a smooth enlargement.

THE COVERS are not part of the plate, so they are not enlarged at all: they are the
catalogue's own cover files at their native resolution, set on the ledge with a spine,
a lit edge, a contact shadow and a faint reflection on the polished marble.

Nothing is typeset into the picture. The headline is live HTML over it.
"""
import argparse
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
PLATE = ROOT / "scripts/hero/source/hero-plate-1672x941.png"
COVERS = ROOT / "public/images/books"
S = 2  # working scale: plate pixels -> master pixels
W, H = 1672 * S, 941 * S

# Where each book stands, in PLATE pixels (1672x941). `x` is the left edge of the cover face,
# `base` the y of the surface it stands on, `w` the width of the cover face. Heights follow
# the cover's own 2:3.
BOOKS = [
    # slug,                          x,    base, w,   lean(deg), z, glossy surface?
    ("the-great-book-of-world-games", 652, 784, 276, 3.2, 0, True),    # left, on the table, leaning on the slab
    ("weather-permitting",            972, 598, 316, 0.0, 1, False),   # centre, on the top slab (honed stone: no reflection)
    ("the-sweetest-season",          1340, 798, 266, 0.0, 2, True),    # right, on the table
]
SPINE = 0.062  # spine width as a fraction of the cover width


def grain(im: Image.Image, sigma: float, seed: int) -> Image.Image:
    arr = np.asarray(im).astype(np.float32)
    rng = np.random.default_rng(seed)
    arr += rng.normal(0, sigma * 255, size=arr.shape[:2] + (1,)).astype(np.float32)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


DETAIL = 0.45  # how much of the enhancer's added high-frequency detail is kept


def prepare_plate(x4: Path | None) -> Image.Image:
    src = Image.open(PLATE).convert("RGB")
    lan2 = src.resize((W, H), Image.LANCZOS)
    if x4 is None:
        return lan2
    big = Image.open(x4).convert("RGB").resize((W, H), Image.LANCZOS)
    low = big.filter(ImageFilter.GaussianBlur(2.2 * S))
    detail = np.asarray(big).astype(np.float32) - np.asarray(low).astype(np.float32)
    out = np.asarray(lan2).astype(np.float32) + DETAIL * detail
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def book_object(slug: str, w: int, lean: float) -> tuple[Image.Image, int]:
    """A hardcover seen from the front and a little from the left: face, spine, lit top edge."""
    cover = Image.open(COVERS / f"{slug}.webp").convert("RGB")
    h = round(w * cover.height / cover.width)
    face = cover.resize((w, h), Image.LANCZOS)

    # Light: the plate is lit from the right and above. The face is a touch darker at the left, a touch
    # brighter at the right, and falls off toward the foot where the ledge is in shadow.
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    lit = 0.74 + 0.15 * (xx / w) - 0.16 * (yy / h) ** 2.0
    arr = np.asarray(face).astype(np.float32) * lit[..., None]
    face = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    face = ImageEnhance.Color(face).enhance(0.92)  # the room is lit warm and low; a cover straight off the file is brighter than anything on this ledge

    sw = max(6, round(w * SPINE))
    # the spine: the cover's own left edge, stretched and darkened, with a lit rim
    edge = np.asarray(cover.resize((w, h), Image.LANCZOS))[:, : max(2, w // 40), :].astype(np.float32).mean(axis=1)  # (h,3)
    spine = np.repeat(edge[:, None, :], sw, axis=1)
    fall = np.linspace(0.46, 0.80, sw)[None, :, None]  # darker away from the face? no: darker at the far (left) edge
    spine = spine * fall
    rim = np.zeros((h, sw, 1), np.float32)
    rim[:, :2] = 22
    spine = np.clip(spine + rim, 0, 255)
    spine_im = Image.fromarray(spine.astype(np.uint8))

    pad = 3
    canvas = Image.new("RGBA", (sw + w + pad, h + pad), (0, 0, 0, 0))
    canvas.paste(spine_im, (0, pad))
    canvas.paste(face, (sw, pad))
    d = ImageDraw.Draw(canvas)
    # the top edge of the boards, catching the light; the right edge a hairline lighter than the face
    d.rectangle([0, 0, sw + w - 1, 1], fill=(235, 226, 205, 200))
    d.line([(sw + w - 1, pad), (sw + w - 1, h + pad)], fill=(255, 245, 220, 90), width=1)
    d.line([(sw, pad), (sw, h + pad)], fill=(0, 0, 0, 120), width=1)  # the hinge groove
    # a soft sheen across the face
    sheen = Image.new("L", canvas.size, 0)
    sd = ImageDraw.Draw(sheen)
    sd.polygon([(sw + w * 0.55, 0), (sw + w * 0.85, 0), (sw + w * 0.55, h), (sw + w * 0.25, h)], fill=26)
    sheen = sheen.filter(ImageFilter.GaussianBlur(w * 0.08))
    white = Image.new("RGBA", canvas.size, (255, 250, 235, 0))
    white.putalpha(sheen)
    canvas = Image.alpha_composite(canvas, white)
    # barely-rounded corners
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, canvas.width - 1, canvas.height - 1], radius=max(2, S * 2), fill=255)
    canvas.putalpha(ImageChops.multiply(canvas.getchannel("A"), mask))
    return canvas, sw


def place(plate: Image.Image, slug: str, x: int, base: int, w: int, lean: float, glossy: bool) -> Image.Image:
    obj, sw = book_object(slug, w * S, lean)
    ox = x * S - sw  # the spine sticks out to the left of the face's x
    oy = base * S - obj.height
    if lean:
        # A book leaning on its neighbour turns about the bottom corner it rests on — the right one.
        import math

        rot = obj.rotate(-lean, resample=Image.BICUBIC, expand=True)  # PIL turns about the centre
        th = math.radians(-lean)
        vx, vy = obj.width / 2, obj.height / 2  # the bottom-right corner, relative to the centre
        nx = vx * math.cos(th) + vy * math.sin(th)
        ny = -vx * math.sin(th) + vy * math.cos(th)
        corner = (rot.width / 2 + nx, rot.height / 2 + ny)
        target = (x * S + w * S, base * S)
        obj = rot
        ox, oy = round(target[0] - corner[0]), round(target[1] - corner[1])

    out = plate.convert("RGBA")

    # contact shadow on the surface, and a longer soft one to the left (the key light is from the right)
    sh = Image.new("RGBA", out.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    bw = obj.width
    sd.ellipse([ox - bw * 0.04, base * S - 14 * S, ox + bw * 1.06, base * S + 16 * S], fill=(0, 0, 0, 170))
    sh = sh.filter(ImageFilter.GaussianBlur(9 * S))
    out = Image.alpha_composite(out, sh)
    side = Image.new("RGBA", out.size, (0, 0, 0, 0))
    ImageDraw.Draw(side).polygon(
        [(ox, oy + 10 * S), (ox - bw * 0.16, base * S - 2 * S), (ox, base * S), (ox + bw * 0.1, base * S)], fill=(0, 0, 0, 90)
    )
    side = side.filter(ImageFilter.GaussianBlur(14 * S))
    out = Image.alpha_composite(out, side)

    # reflection on the polished marble (only where the book stands on the ledge's glossy top)
    if glossy:
        refl = obj.transpose(Image.FLIP_TOP_BOTTOM)
        fade_h = round(obj.height * 0.30)
        refl = refl.crop((0, 0, refl.width, fade_h))
        ra = np.asarray(refl.getchannel("A")).astype(np.float32)
        ramp = np.linspace(0.34, 0.0, fade_h)[:, None]
        refl.putalpha(Image.fromarray((ra * ramp).astype(np.uint8)))
        refl = refl.filter(ImageFilter.GaussianBlur(1.6 * S))
        out.alpha_composite(refl, (ox, base * S + 2 * S))

    out.alpha_composite(obj, (ox, oy))
    return out.convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plate-x4", help="Real-ESRGAN x4plus output of the plate (omit for a plain Lanczos 2x)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--no-books", action="store_true", help="write the enhanced plate alone (for inspection)")
    a = ap.parse_args()

    random.seed(7)
    plate = prepare_plate(Path(a.plate_x4) if a.plate_x4 else None)
    img = plate
    if not a.no_books:
        for slug, x, base, w, lean, _z, glossy in sorted(BOOKS, key=lambda b: b[5]):
            img = place(img, slug, x, base, w, lean, glossy)
    img = grain(img, 0.0075, 11)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    img.save(a.out, format="PNG")
    print(f"wrote {a.out} {img.size}")


if __name__ == "__main__":
    main()
