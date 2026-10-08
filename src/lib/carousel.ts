/**
 * The arithmetic behind a horizontal card carousel's arrows — pure, so it can be
 * tested without a browser and read without one.
 *
 * What the old carousel did: every press scrolled by a constant 400px, whatever
 * the cards, the screen or the position. Measured on /cart:
 *   - at 1920px all eight cards already fit; both arrows were drawn and did
 *     nothing, ever;
 *   - at 1440px the track overflowed by 284px, so "next" moved 284px and then
 *     did nothing, with no sign that the end had been reached;
 *   - at 1024px a press moved two cards while four were showing, and from some
 *     positions "previous" and "next" were not inverses of each other.
 * So the arrows now work from the cards' real positions:
 *
 *   - NEXT brings the first card that is cut off by (or lies beyond) the right
 *     edge to the left edge — a page forward, with nothing skipped;
 *   - PREVIOUS is its mirror, so LEFT → RIGHT → LEFT → RIGHT returns to where it
 *     started and never lands between cards;
 *   - an arrow with nowhere to go is reported as such, and the whole control is
 *     reported as not scrollable when every card already fits.
 */

export interface ScrollMetrics {
  scrollLeft: number;
  /** Visible width of the track. */
  clientWidth: number;
  /** Full width of the content. */
  scrollWidth: number;
}

export interface EdgeState {
  /** More content than room: there is somewhere to scroll to. */
  scrollable: boolean;
  atStart: boolean;
  atEnd: boolean;
}

/**
 * Sub-pixel slack. Browser zoom and fractional device pixels leave `scrollLeft`
 * a fraction short of the true maximum; without slack "at the end" would be
 * unreachable on some screens.
 */
export const EDGE_SLACK = 2;

export function edgeState({ scrollLeft, clientWidth, scrollWidth }: ScrollMetrics): EdgeState {
  const max = Math.max(0, scrollWidth - clientWidth);
  const scrollable = max > EDGE_SLACK;
  return {
    scrollable,
    atStart: !scrollable || scrollLeft <= EDGE_SLACK,
    atEnd: !scrollable || scrollLeft >= max - EDGE_SLACK,
  };
}

export type Direction = "prev" | "next";

export interface PageInput extends ScrollMetrics {
  /**
   * Where each card starts, measured from the start of the scrolled content
   * (not from the viewport), in order.
   */
  lefts: readonly number[];
  /** Padding before the first card; a card "aligned" to the left edge sits this far in. */
  inset?: number;
  direction: Direction;
}

/**
 * The `scrollLeft` a press should scroll to, or `null` when there is nowhere to
 * go. Always lands on a card boundary, except at the very end where the track
 * cannot scroll further.
 */
export function pageTarget({ lefts, scrollLeft, clientWidth, scrollWidth, inset = 0, direction }: PageInput): number | null {
  const max = Math.max(0, scrollWidth - clientWidth);
  if (max <= EDGE_SLACK || lefts.length === 0) return null;

  // Where a card has to be scrolled to so that it sits at the left edge.
  const stops = lefts.map((left) => Math.min(max, Math.max(0, left - inset)));

  let target: number;
  if (direction === "next") {
    if (scrollLeft >= max - EDGE_SLACK) return null;
    const limit = scrollLeft + clientWidth + EDGE_SLACK;
    // The last card that starts within a page's reach of here...
    const farthest = stops.filter((s) => s <= limit).pop() ?? scrollLeft;
    // ...but always make progress, even past a card wider than the track.
    target = farthest > scrollLeft + EDGE_SLACK ? farthest : (stops.find((s) => s > scrollLeft + EDGE_SLACK) ?? max);
    // Whatever is left over after that last card is only worth a page of its own at the end.
    if (target > max) target = max;
  } else {
    if (scrollLeft <= EDGE_SLACK) return null;
    const limit = scrollLeft - clientWidth - EDGE_SLACK;
    // The first card that starts within a page's reach of here, going back...
    const earliest = stops.find((s) => s >= limit);
    // ...or the very start when that reaches past it; and always make progress.
    target = earliest !== undefined && earliest < scrollLeft - EDGE_SLACK ? earliest : (stops.filter((s) => s < scrollLeft - EDGE_SLACK).pop() ?? 0);
    if (target < 0) target = 0;
  }
  return target;
}
