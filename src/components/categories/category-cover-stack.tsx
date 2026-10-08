import Image from "next/image";

import { scaleSizes } from "@/lib/image-sizes";

/**
 * The widest a cover may be, as a fraction of the stack that holds it: the `57cqw` in the class below is this
 * times 1.5, a cover's height for that width. A cover is sized by the frame's height, so in practice it is
 * narrower (see `coverFraction`); this is the ceiling, and the default for `sizes`, which must never promise
 * less than the cover is drawn at.
 */
const COVER_FRACTION = 0.38;

/**
 * <CategoryCoverStack> — a category's artwork, made of the books in it.
 *
 * Up to three real covers, fanned on the category's tinted ground. A
 * category card therefore shows exactly what a reader will find behind it,
 * and updates itself when a book is published into the category. A bespoke
 * image can still take over the whole frame: drop one at
 * `/images/categories/<slug>.webp` and `<CategoryCard>` prefers it.
 *
 * The ten "genre worlds" this replaces — a castle for anything containing
 * "myth", a neon city for science fiction, a foggy street for mystery — were
 * painted for a fictional catalogue of fiction genres and matched none of the
 * six real categories, so every real card fell through to the same castle.
 *
 * A cover keeps its own shape, 2:3, in whatever frame it is fanned. It is sized by the frame's HEIGHT, not
 * its width: with `h-[68%] w-[38%]` every cover was cut to the frame's own proportions, which in the 16:9 frame
 * on /about is a square, so each cover lost a third of its height and the title was sliced through the middle.
 *
 * Fills its relative parent. Server-safe; no hooks.
 */
export function CategoryCoverStack({
  coverSrcs,
  name,
  tint = "rgba(51, 240, 170, 0.14)",
  sizes = "(min-width: 1024px) 20vw, 50vw",
  coverFraction = COVER_FRACTION,
}: {
  coverSrcs: readonly string[];
  name: string;
  /** Radial tint behind the fan; keeps adjacent cards distinguishable. */
  tint?: string;
  /** How wide the WHOLE stack is drawn; each cover is a fraction of that, and says so to the browser. */
  sizes?: string;
  /**
   * How wide a cover is, as a fraction of the stack's width: 0.68 of the height, times 2/3, so 0.453 × (height ÷
   * width). That is 0.255 in the 16:9 frame on /about and 0.363 in a category card's 5:4. Over-stating it sends a
   * file bigger than the slot needs; under-stating it sends a blurry one — so when unsure, pass the larger.
   */
  coverFraction?: number;
}) {
  const covers = coverSrcs.slice(0, 3);
  const coverSizes = scaleSizes(sizes, coverFraction);
  // Fan geometry for 1, 2 or 3 covers — the front cover is always the newest. `center` is where the cover's
  // middle sits, as a fraction of the frame's width (the box is pulled back by half its own width).
  const layout =
    covers.length === 3
      ? [
          { center: "27%", rotate: -14, z: 1, scale: 0.86, opacity: 0.85 },
          { center: "73%", rotate: 14, z: 1, scale: 0.86, opacity: 0.85 },
          { center: "50%", rotate: 0, z: 2, scale: 1, opacity: 1 },
        ]
      : covers.length === 2
        ? [
            { center: "71%", rotate: 10, z: 1, scale: 0.9, opacity: 0.9 },
            { center: "37%", rotate: -6, z: 2, scale: 1, opacity: 1 },
          ]
        : [{ center: "50%", rotate: 0, z: 2, scale: 1, opacity: 1 }];
  // Draw back covers first so the newest sits on top.
  const ordered = covers.length === 3 ? [covers[1], covers[2], covers[0]] : [...covers].reverse();

  return (
    <div className="@container absolute inset-0 overflow-hidden" data-category-stack="">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${tint} 0%, transparent 65%), linear-gradient(170deg, #0f1c16 0%, #07110b 100%)`,
        }}
      />
      {ordered.map((src, i) => {
        const pos = layout[i];
        return (
          <div
            key={src}
            className="absolute top-[12%] aspect-[2/3] h-[min(68%,57cqw)] overflow-hidden rounded-[6px] border border-white/[0.14] shadow-[0_18px_36px_-12px_rgba(0,0,0,0.85)]"
            style={{
              left: pos.center,
              zIndex: pos.z,
              opacity: pos.opacity,
              transform: `translateX(-50%) rotate(${pos.rotate}deg) scale(${pos.scale})`,
              transformOrigin: "50% 100%",
            }}
          >
            <Image src={src} alt="" fill sizes={coverSizes} className="object-cover" />
          </div>
        );
      })}
      {covers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-serif text-2xl text-white/25">{name}</span>
        </div>
      )}
    </div>
  );
}
