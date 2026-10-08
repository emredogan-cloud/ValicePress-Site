/**
 * The Valice Press mark — the V standing in the open book before the globe — on its own
 * cream tile, and the full lockup (mark, wordmark, tagline) for places with room to read it.
 *
 * Both are DERIVATIVES of the founder's logo file, cut by `scripts/brand/build-logo.mjs`
 * (never the source itself, which is not in the repo). The ground is cream because the V and
 * the wordmark are dark green: on this site's dark pages they sit on a tile, the way a
 * printed mark sits on paper — the artwork is not recoloured.
 *
 * Aspect ratio is fixed: the tile is square and so is the image; `width`/`height` are always
 * equal, so a caller cannot stretch it by passing one.
 */

const MARK = [64, 96, 128, 256, 512] as const;

export function BrandMark({ size = 40, className = "", priority = false }: { size?: number; className?: string; priority?: boolean }) {
  const srcSet = MARK.map((w) => `/images/brand/valice-press-mark-${w}.webp ${w}w`).join(", ");
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 overflow-hidden rounded-[9px] border border-white/25 bg-[#fbf9f1] shadow-[0_6px_18px_-8px_rgba(0,0,0,0.8)] ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a few-KB WebP at the size it renders; the loader hop would cost more than the bytes */}
      <img
        src="/images/brand/valice-press-mark-128.webp"
        srcSet={srcSet}
        sizes={`${size}px`}
        width={size}
        height={size}
        alt=""
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className="block h-full w-full"
      />
    </span>
  );
}

const FULL = [320, 640, 1254] as const;

/** The whole logo. `alt` is the brand name: this is the one place the image itself says it. */
export function BrandLockup({ size = 280, className = "", priority = false }: { size?: number; className?: string; priority?: boolean }) {
  const srcSet = FULL.map((w) => `/images/brand/valice-press-logo-${w}.webp ${w}w`).join(", ");
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-[18px] border border-white/20 bg-[#fbf9f1] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] ${className}`}
      style={{ width: size, height: size, maxWidth: "100%" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- see BrandMark */}
      <img
        src="/images/brand/valice-press-logo-640.webp"
        srcSet={srcSet}
        sizes={`${size}px`}
        width={size}
        height={size}
        alt="Valice Press — Independent ideas, a longer tomorrow"
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className="block h-full w-full"
      />
    </span>
  );
}
