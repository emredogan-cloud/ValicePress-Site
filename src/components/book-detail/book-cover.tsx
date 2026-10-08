import Image from "next/image";

import { coverFit } from "@/lib/asset-map";
import { getCoverImageUrl } from "@/lib/seo";

/**
 * Cinematic book-cover renderer for `/books/[slug]`.
 *
 * Phase 1.C — drop-in for the warm `<CoverImage>` on this surface only.
 * Two render paths, same as the warm version:
 *
 *   1. **Next/Image** — when `coverKey` is set AND `R2_PUBLIC_BASE_URL`
 *      is provisioned. Wrapped in a 2:3 frame with emerald rim glow +
 *      dark gradient floor shadow + thin top edge line (matches the
 *      `home-hero-frame` family).
 *   2. **Typographic placeholder** — fallback when either piece of state
 *      is missing. Uses the cinematic palette + serif initial.
 *
 * `priority` flows through to `next/image` so this stays the LCP candidate.
 * Pure Server Component.
 */
export function BookCover({
  title,
  coverKey,
  coverSrc,
  priority = false,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 72vw",
  widthClass = "mx-auto w-[72%] sm:mx-0 sm:w-full",
}: {
  title: string;
  coverKey?: string | null;
  /**
   * Pre-resolved cover source. The server page resolves it with the priority
   * R2 `coverKey` URL → local public asset (`/images/books/{slug}.webp`); when
   * provided it wins. Callers that don't resolve a public-asset fallback
   * (order panel, library tiles) omit it and we derive the R2 URL from
   * `coverKey` directly. Either way, a missing source → typographic placeholder.
   */
  coverSrc?: string | null;
  priority?: boolean;
  /**
   * Responsive size hint. Defaults to the book-detail hero, which is what this
   * component was written for. Small consumers — the shelf tiles in
   * <CinematicBookTile>, which render a 103-211px cover — must pass their own,
   * or the hero's hint over-fetches them by ~2.7x.
   */
  sizes?: string;
  /**
   * The wrapper's width classes. The default is the stacked phone layout's cap (72% of the column, full width
   * from `sm`); a parent that has already given the cover a narrow column of its own (the book page's compact
   * phone header) passes `w-full` so the cap is not applied twice.
   */
  widthClass?: string;
}) {
  const src = coverSrc ?? getCoverImageUrl(coverKey);

  return (
    /*
     * Below `sm:` the cover is capped at 72% of the column.
     *
     * At full width on the Redmi it rendered 359x540 — 75% of a 718px viewport
     * — which pushed the price to 695px and the "Add to cart" button to 743px,
     * below the fold on every book measured. A reader landing on a product page
     * could not see the buy control without scrolling. Capped, the cover is
     * still the dominant object on the first screen and both the price and the
     * CTA clear the fold. `sm:w-full` restores the original at 640px and up, so
     * the desktop composition is untouched.
     */
    <div className={`relative ${widthClass}`}>
      {/* Subtle floor shadow under the cover */}
      <div
        aria-hidden
        className="absolute -bottom-6 left-1/2 h-12 w-[80%] -translate-x-1/2 rounded-full opacity-60 blur-xl"
        style={{
          background:
            "radial-gradient(ellipse, rgba(22,199,132,0.35) 0%, transparent 65%)",
        }}
      />

      <div
        data-cover-key={coverKey || undefined}
        className="relative aspect-[2/3] w-full overflow-hidden rounded-[20px] border border-white/[0.08]"
        style={{
          boxShadow:
            "0 28px 60px -22px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(51,240,170,0.06), 0 0 36px -14px rgba(22,199,132,0.4)",
        }}
      >
        {/* Top emerald edge — same accent every cinematic frame uses */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-[#33f0aa]/40 to-transparent"
        />

        {src ? (
          <Image
            src={src}
            alt={`Cover of ${title}`}
            fill
            /* Default is the hero: 72vw below `sm:` because Phase 6 capped the
               cover at w-[72%]. While this said 100vw, Next's preload picked
               w=1200 for a slot needing 710 device pixels — the LCP asset on
               this route, fetched ~1.7x larger than required. */
            sizes={sizes}
            priority={priority}
            className={coverFit(src) === "contain" ? "object-contain bg-[#0a1410]" : "object-cover"}
          />
        ) : (
          <CinematicCoverPlaceholder title={title} />
        )}
      </div>
    </div>
  );
}

/**
 * Typographic placeholder — dark gradient + serif initial. Same palette
 * family as the library tile placeholders (see `library-books-grid`).
 */
function CinematicCoverPlaceholder({ title }: { title: string }) {
  const initial = (title.charAt(0) || "?").toUpperCase();
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(160deg, #14241a 0%, #07110b 60%, #050a08 100%)",
      }}
    >
      {/* Soft top-right emerald bloom */}
      <div
        aria-hidden
        className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-50"
        style={{
          background:
            "radial-gradient(circle, rgba(51,240,170,0.4) 0%, transparent 70%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-between p-6">
        <span className="text-[12px] lg:text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
          Valice Press
        </span>
        <span
          aria-hidden
          className="select-none font-serif text-[140px] leading-none text-white/15"
        >
          {initial}
        </span>
      </div>
      {/* Right-edge book "spine" highlight */}
      <div
        aria-hidden
        className="absolute right-0 top-[2px] bottom-[2px] w-[3px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.18) 100%)",
        }}
      />
    </div>
  );
}
