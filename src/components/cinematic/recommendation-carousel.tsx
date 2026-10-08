"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { edgeState, pageTarget, type Direction, type EdgeState } from "@/lib/carousel";

/**
 * <CinematicRecommendationCarousel> — the shared horizontal card carousel.
 *
 * One primitive for every shelf of cards: the cart's "You might like"
 * (`cart/recommendation-shelf`), the library's strip
 * (`library/library-recommendation-shelf`) and the product page's related books
 * (`book-detail/related-books-shelf`). Children = the cards; it does not care
 * what shape they are.
 *
 * THE ARROWS ARE DRIVEN BY THE CARDS, NOT BY A CONSTANT. This used to scroll a
 * fixed 400px and draw both arrows unconditionally, which on /cart meant: at
 * 1920px every card already fitted and the arrows were drawn and did nothing; at
 * 1440px the second press did nothing and said nothing; at 1024px a press moved
 * two cards while four showed. Now (see `@/lib/carousel`, which is tested):
 *
 *   - the arrows are not drawn at all when every card fits;
 *   - NEXT brings the first card that is cut off (or lies beyond) the right edge
 *     to the left edge, PREVIOUS is its exact mirror, so LEFT → RIGHT → LEFT →
 *     RIGHT returns to where it started and never stops between two cards;
 *   - an arrow with nowhere to go is dimmed and `aria-disabled` (not `disabled`:
 *     a button that disables itself under the finger drops keyboard focus);
 *   - the soft edge on a side appears only when there IS more on that side — it
 *     used to sit permanently over the first card, hiding its left edge;
 *   - smooth scrolling is off for readers who ask for reduced motion.
 *
 * Below 640px the arrows are hidden and the strip is swiped (scroll-snap keeps
 * cards aligned); the next card peeks in at the edge to show there is more.
 *
 * The `padX` prop tunes inner padding for shelves that need it (library embeds
 * the carousel inside a glass panel with edge breathing room; cart sits flush in
 * a page section). Pass `0` for flush.
 */
const PAD_PX = { 0: 0, 4: 16, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48 } as const;
const FADE_PX = 32;

export function CinematicRecommendationCarousel({
  children,
  label = "Recommended books",
  prevLabel = "Previous picks",
  nextLabel = "Next picks",
  arrowVariant = "outset",
  padX = 0,
}: {
  /** The card components, already mapped over the items array. */
  children: ReactNode;
  /** Names the region for assistive technology ("Recommended books"). */
  label?: string;
  prevLabel?: string;
  nextLabel?: string;
  /**
   * Arrow positioning:
   *   - "outset"  → arrows sit OUTSIDE the visible track (cart shelf)
   *   - "overlay" → arrows overlay the track edges (library shelf, where
   *                 the carousel is nested inside a glass panel and there
   *                 is no room to the side)
   */
  arrowVariant?: "outset" | "overlay";
  /** Inner horizontal padding of the scroll track. Default 0 (flush). */
  padX?: keyof typeof PAD_PX;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<EdgeState>({ scrollable: false, atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const next = edgeState({ scrollLeft: el.scrollLeft, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth });
    setEdge((prev) => (prev.scrollable === next.scrollable && prev.atStart === next.atStart && prev.atEnd === next.atEnd ? prev : next));
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    // Cards arriving or leaving change the width of the content, not the track.
    const mutation = new MutationObserver(measure);
    mutation.observe(el, { childList: true });
    return () => {
      el.removeEventListener("scroll", measure);
      resize.disconnect();
      mutation.disconnect();
    };
  }, [measure]);

  const go = (direction: Direction) => {
    const el = trackRef.current;
    if (!el) return;
    const origin = el.getBoundingClientRect().left;
    const lefts = Array.from(el.children).map((card) => card.getBoundingClientRect().left - origin + el.scrollLeft);
    const target = pageTarget({
      lefts,
      scrollLeft: el.scrollLeft,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      inset: PAD_PX[padX],
      direction,
    });
    if (target === null) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: target, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const arrowSize = "h-11 w-11";
  const arrowLeftPos = arrowVariant === "outset" ? "-left-2 lg:-left-14" : "left-2";
  const arrowRightPos = arrowVariant === "outset" ? "-right-2 lg:-right-14" : "right-2";
  // Not drawn when there is nothing to scroll to; never drawn below 640px (swipe).
  const arrowShown = edge.scrollable ? "hidden sm:flex" : "hidden";
  const arrowBase =
    "absolute top-1/2 z-20 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.1] bg-[#0a1410]/85 text-fg-mid backdrop-blur-md transition-all hover:border-emerald-bright/40 hover:text-emerald-bright hover:shadow-[0_0_18px_rgba(51,240,170,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/60 aria-disabled:cursor-default aria-disabled:opacity-35 aria-disabled:hover:border-white/[0.1] aria-disabled:hover:text-fg-mid aria-disabled:hover:shadow-none";

  const trackStyle = {
    scrollPaddingInline: PAD_PX[padX],
    "--fade-l": edge.atStart ? "0px" : `${FADE_PX}px`,
    "--fade-r": edge.atEnd ? "0px" : `${FADE_PX}px`,
  } as CSSProperties;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      data-carousel=""
      data-scrollable={edge.scrollable}
      data-at-start={edge.atStart}
      data-at-end={edge.atEnd}
      className="relative"
    >
      {/* Left arrow */}
      <button
        type="button"
        onClick={() => go("prev")}
        aria-label={prevLabel}
        aria-disabled={edge.atStart}
        data-carousel-prev=""
        className={`${arrowBase} ${arrowSize} ${arrowLeftPos} ${arrowShown}`}
      >
        <ChevronLeft aria-hidden className="h-5 w-5" />
      </button>

      {/* Right arrow */}
      <button
        type="button"
        onClick={() => go("next")}
        aria-label={nextLabel}
        aria-disabled={edge.atEnd}
        data-carousel-next=""
        className={`${arrowBase} ${arrowSize} ${arrowRightPos} ${arrowShown}`}
      >
        <ChevronRight aria-hidden className="h-5 w-5" />
      </button>

      {/* Scrolling track. The soft edges are a mask on the track itself (see
          `.cart-shelf-track` in globals.css), so they match whatever surface
          the shelf sits on — the old overlay gradients were a hard-coded colour
          that was not the page's and showed as a band. */}
      <div
        ref={trackRef}
        data-carousel-track=""
        className={`cart-shelf-track flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 pt-1.5 ${padX ? { 4: "px-4", 6: "px-6", 7: "px-7", 8: "px-8", 10: "px-10", 12: "px-12" }[padX] : ""}`}
        style={trackStyle}
      >
        {children}
      </div>
    </div>
  );
}
