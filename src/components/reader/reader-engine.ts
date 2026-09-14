/**
 * The reader's arithmetic, with no DOM and no pdf.js in sight.
 *
 * Everything here is a pure function, which is the point: the spread model is
 * the part of a page-turning reader that is easy to get subtly wrong and
 * impossible to eyeball once it is tangled up with canvases and animation
 * frames. A book whose page 12 quietly appears on the wrong leaf is a defect
 * no screenshot review catches, so this file is where that risk is isolated
 * and tested (`reader-engine.test.ts`).
 */

export type LeafSide = "left" | "right";

/**
 * One opening of the book: the two page numbers visible at once.
 *
 * `null` is a real value, not a placeholder for missing data — it is the inside
 * of the cover on the first opening, and the blank that faces the last page of
 * a book with an even page count.
 */
export interface Spread {
  left: number | null;
  right: number | null;
}

export type ReaderLayout = "spread" | "single";

/**
 * Build the openings of a book.
 *
 * THE RECTO RULE. Page 1 of a printed book is a right-hand page. Open any of
 * the twenty-seven editions this reader serves and the title page faces you on
 * the right with the inside of the cover on the left; every subsequent opening
 * is an even page on the left facing an odd page on the right. A reader that
 * pairs (1,2) instead looks wrong to anyone who has held a book, and worse, it
 * puts every later spread out of phase with the printed edition — so a customer
 * comparing the web reader against their paperback finds the two disagree.
 *
 * In `single` layout every page stands alone, which is what a phone wants and
 * what a reader who has zoomed in wants; the same index still addresses it.
 */
export function buildSpreads(
  pageCount: number,
  layout: ReaderLayout,
): Spread[] {
  if (!Number.isFinite(pageCount) || pageCount < 1) return [];
  const total = Math.floor(pageCount);

  if (layout === "single") {
    return Array.from({ length: total }, (_, i) => ({
      left: null,
      right: i + 1,
    }));
  }

  const spreads: Spread[] = [{ left: null, right: 1 }];
  for (let page = 2; page <= total; page += 2) {
    spreads.push({ left: page, right: page + 1 <= total ? page + 1 : null });
  }
  return spreads;
}

/** Which opening shows `page`. Clamped, so a stale resume point is safe. */
export function spreadIndexForPage(
  page: number,
  pageCount: number,
  layout: ReaderLayout,
): number {
  if (pageCount < 1) return 0;
  const clamped = Math.max(1, Math.min(Math.floor(page) || 1, pageCount));
  if (layout === "single") return clamped - 1;
  // Page 1 is spread 0; 2 and 3 are spread 1; 4 and 5 are spread 2; …
  return clamped === 1 ? 0 : Math.floor(clamped / 2);
}

/**
 * The page a spread "is on" for the purpose of progress and bookmarks.
 *
 * The left page, when there is one. A reader who has turned to the opening
 * showing 40–41 has read 40; recording 41 would creep the resume point forward
 * by a page on every session, and after enough sessions a customer would find
 * the book resuming somewhere they had not reached.
 */
export function representativePage(spread: Spread | undefined): number {
  if (!spread) return 1;
  return spread.left ?? spread.right ?? 1;
}

/** Reading position as a percentage, clamped, for the progress bar and the DB. */
export function progressPercent(page: number, pageCount: number): number {
  if (pageCount < 1) return 0;
  return Math.max(0, Math.min(100, (page / pageCount) * 100));
}

// ---------------------------------------------------------------------------
// Motion budget
// ---------------------------------------------------------------------------

export type PerfMode = "rich" | "lite";

export interface DeviceHints {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  coarsePointer?: boolean;
  viewportWidth?: number;
  prefersReducedMotion?: boolean;
}

/**
 * Choose between the 3D page turn and the flat crossfade.
 *
 * A `rotateY` across a full-bleed canvas is a compositor job, but it is a
 * compositor job on a layer the size of half the screen, and on a four-core
 * phone with 4 GB of RAM it drops frames — which reads as cheapness, not as
 * atmosphere. The honest answer on those devices is a fast crossfade that
 * always hits 60fps, not a 3D flip that sometimes does.
 *
 * `prefers-reduced-motion` forces `lite` and is never overridden by the device
 * being fast: it is a statement of preference, not a capability report.
 */
export function choosePerfMode(hints: DeviceHints): PerfMode {
  if (hints.prefersReducedMotion) return "lite";
  const cores = hints.hardwareConcurrency ?? 8;
  const memory = hints.deviceMemory ?? 8;
  if (cores <= 4 || memory <= 4) return "lite";
  if (hints.coarsePointer && (hints.viewportWidth ?? 1024) < 900) return "lite";
  return "rich";
}

/**
 * How many pages may hold a rendered bitmap at once.
 *
 * A page canvas at 2× device pixel ratio on a laptop is roughly 1600×2400×4
 * bytes — about 15 MB. Ten of those is 150 MB and a phone tab gets killed, so
 * the cache is small and deliberately so: the visible opening, the one ahead,
 * and the one behind. Everything else is re-rendered from the parsed document,
 * which pdf.js keeps cheaply and which costs single-digit milliseconds.
 *
 * This is the difference between a reader that survives a 435-page book and one
 * that opens beautifully and is killed at page sixty (§48, §49).
 */
export const PAGE_CACHE_LIMIT = 6;

/** Which page numbers are worth having ready around `spreadIndex`. */
export function pagesToWarm(
  spreads: Spread[],
  spreadIndex: number,
): number[] {
  const wanted: number[] = [];
  for (let i = spreadIndex - 1; i <= spreadIndex + 1; i++) {
    const s = spreads[i];
    if (!s) continue;
    if (s.left !== null) wanted.push(s.left);
    if (s.right !== null) wanted.push(s.right);
  }
  return [...new Set(wanted)];
}
