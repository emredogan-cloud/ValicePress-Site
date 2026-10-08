import Image from "next/image";

import { scaleSizes } from "@/lib/image-sizes";

/** Each cover is this fraction of the width of the stack that holds it (`w-[38%]` below). */
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
 * Fills its relative parent. Server-safe; no hooks.
 */
export function CategoryCoverStack({
  coverSrcs,
  name,
  tint = "rgba(51, 240, 170, 0.14)",
  sizes = "(min-width: 1024px) 20vw, 50vw",
}: {
  coverSrcs: readonly string[];
  name: string;
  /** Radial tint behind the fan; keeps adjacent cards distinguishable. */
  tint?: string;
  /** How wide the WHOLE stack is drawn; each cover is a fraction of that, and says so to the browser. */
  sizes?: string;
}) {
  const covers = coverSrcs.slice(0, 3);
  const coverSizes = scaleSizes(sizes, COVER_FRACTION);
  // Fan geometry for 1, 2 or 3 covers — the front cover is always the newest.
  const layout =
    covers.length === 3
      ? [
          { left: "8%", rotate: -14, z: 1, scale: 0.86, opacity: 0.85 },
          { left: "58%", rotate: 14, z: 1, scale: 0.86, opacity: 0.85 },
          { left: "31%", rotate: 0, z: 2, scale: 1, opacity: 1 },
        ]
      : covers.length === 2
        ? [
            { left: "52%", rotate: 10, z: 1, scale: 0.9, opacity: 0.9 },
            { left: "18%", rotate: -6, z: 2, scale: 1, opacity: 1 },
          ]
        : [{ left: "31%", rotate: 0, z: 2, scale: 1, opacity: 1 }];
  // Draw back covers first so the newest sits on top.
  const ordered = covers.length === 3 ? [covers[1], covers[2], covers[0]] : [...covers].reverse();

  return (
    <div className="absolute inset-0 overflow-hidden" data-category-stack="">
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
            className="absolute top-[12%] h-[68%] w-[38%] overflow-hidden rounded-[6px] border border-white/[0.14] shadow-[0_18px_36px_-12px_rgba(0,0,0,0.85)]"
            style={{
              left: pos.left,
              zIndex: pos.z,
              opacity: pos.opacity,
              transform: `rotate(${pos.rotate}deg) scale(${pos.scale})`,
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
