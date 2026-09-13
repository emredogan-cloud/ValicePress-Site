import Image from "next/image";

import { coverFit } from "@/lib/asset-map";

/**
 * <CoverArt> — the one way a book's cover is drawn on a cinematic surface.
 *
 * Fills whatever relative, sized frame it is placed in. When `src` is set it
 * renders the real cover through next/image; when it is null it renders the
 * typographic stand-in — dark ground, the title, a spine highlight — which is
 * a deliberate state for a book that genuinely has no cover asset yet, not a
 * decoration to hide one that exists.
 *
 * `src` comes from `bookCoverSrc(slug)` in `@/lib/asset-map`, so every
 * consumer — homepage, catalog, cart, library, related shelves, search, order
 * pages — resolves the same file for the same book. The homepage, cart and
 * library used to draw a gradient regardless of whether the cover existed;
 * that is the defect this component removes.
 *
 * No hooks, no filesystem: safe in Server Components and client islands alike.
 */
export function CoverArt({
  src,
  title,
  eyebrow,
  sizes = "(min-width: 1024px) 20vw, 50vw",
  priority = false,
  alt = "",
  titleClassName = "font-serif text-[15px] font-medium leading-tight text-white",
  eyebrowClassName = "text-[8px] font-semibold uppercase tracking-[0.2em] text-white/50",
}: {
  /** Public path of the cover (`/images/books/<slug>.webp`) or null. */
  src: string | null | undefined;
  title: string;
  /** Small caption printed above the title on the stand-in only. */
  eyebrow?: string | null;
  sizes?: string;
  priority?: boolean;
  /** Empty by default — the title is announced by the heading beside it. */
  alt?: string;
  titleClassName?: string;
  /**
   * The stand-in's imprint line. Defaults to 8px, which is proportionate in
   * the 20vw slot this component was written for and far too small anywhere
   * larger — measured on the Redmi at 300px wide, where it was the only text
   * on a companion page below the 12px floor. Callers that give the stand-in
   * a big frame pass a bigger class, exactly as they already do for the title.
   */
  eyebrowClassName?: string;
}) {
  if (src) {
    // A large-trim cover (8.5 × 11) is squarer than the 2:3 slot; it is
    // letterboxed on the dark ground rather than cropped.
    const fit = coverFit(src);
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={fit === "contain" ? "object-contain" : "object-cover"}
      />
    );
  }

  const palette = PALETTE[hash(title) % PALETTE.length];
  return (
    <div
      data-cover-placeholder=""
      className="absolute inset-0"
      style={{ background: palette.gradient }}
    >
      <div
        aria-hidden
        className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-50"
        style={{
          background: `radial-gradient(circle, ${palette.accent}55 0%, transparent 70%)`,
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-between p-3">
        <span className={eyebrowClassName}>
          {eyebrow || "Valice Press"}
        </span>
        <p className={titleClassName}>{title}</p>
      </div>
      <div
        aria-hidden
        className="absolute right-0 top-[2px] bottom-[2px] w-[2px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.14) 100%)",
        }}
      />
    </div>
  );
}

/** Stable per-title palette, so a stand-in never changes colour between renders. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const PALETTE: ReadonlyArray<{ gradient: string; accent: string }> = [
  { gradient: "linear-gradient(160deg, #1a3326 0%, #0a1f14 100%)", accent: "#33f0aa" },
  { gradient: "linear-gradient(160deg, #1a2c4f 0%, #050a1e 100%)", accent: "#7ab6ff" },
  { gradient: "linear-gradient(160deg, #2c1f1a 0%, #14110a 100%)", accent: "#d1a86a" },
  { gradient: "linear-gradient(160deg, #3a2845 0%, #14081c 100%)", accent: "#b18cff" },
];
