/**
 * Where everything in the spiral library stands, as arithmetic.
 *
 * The scene (`scene/*`) draws what these functions say and the page
 * (`spiral-library.tsx`) scrolls by them, so the two cannot disagree about which
 * shelf is in front of the reader. Nothing here touches a DOM or a GPU.
 *
 * UNITS. 1 = one cover's height. Proportions come from the reference picture
 * (`AUDIT/SPIRAL-LIBRARY-PHASE-1-FOUNDATION-AND-IMPLEMENTATION-PLAN.md` §3): its
 * column is about 4.4 cover heights across and its tiers about 1.3 cover
 * heights apart.
 *
 * THE SPIRAL. Each shelf's books are centred a little further round the column
 * than the shelf above's, and the camera turns with them as it descends — so a
 * reader at any shelf sees that shelf's books in front, and the runs above and
 * below wind away round the column.
 */

/** Gap between a shelf's cover tops and the band that carries its name. */
const GAP_ABOVE_BOOKS = 0.08;
/** The band above each shelf (dark wood, the collection's name in gold). */
export const BAND_HEIGHT = 0.24;
/** One shelf to the next, book centre to book centre: a cover, the gap above it, the band. */
export const TIER_PITCH = 1 + GAP_ABOVE_BOOKS + BAND_HEIGHT;

export const RADIUS = {
  /** The column's core, behind the books. */
  core: 1.78,
  /** The front face of a cover. */
  books: 2.0,
  /** The shelf board's outer edge. */
  board: 2.14,
  /** The name band, standing proud of everything below it. */
  band: 2.25,
} as const;

/** A book's depth: the page block behind the cover. */
export const BOOK_DEPTH = 0.13;
/** The widest cover in the catalogue is 2:3. Every slot is that wide, so a ring turns by whole books. */
export const SLOT_WIDTH = 2 / 3;
const BOOK_GAP = 0.075;
/** Angle between neighbouring books on a ring. */
export const BOOK_STEP = (SLOT_WIDTH + BOOK_GAP) / RADIUS.books;
/** How much further round the column each shelf's books are centred than the shelf above's. */
export const SPIRAL_STEP = (12 * Math.PI) / 180;

/** Height of shelf `index`'s cover centres. Shelf 0 is the top. */
export function shelfY(index: number): number {
  return -index * TIER_PITCH;
}

/** Where shelf `index` faces the reader, round the column (radians). */
export function shelfAzimuth(index: number): number {
  return index * SPIRAL_STEP;
}

/**
 * The centre height of band `index`. Band i hangs above shelf i and carries its
 * name; band `shelfCount` is the last shelf's floor. Each band's top is the
 * board the shelf below it stands on.
 */
export function bandY(index: number): number {
  return shelfY(index) + 0.5 + GAP_ABOVE_BOOKS + BAND_HEIGHT / 2;
}

/**
 * Where book `j` of a shelf stands round the column, when the book at index
 * `centre` is in front. `centre` may be fractional while the ring is turning.
 */
export function bookAzimuth(shelf: number, j: number, centre: number): number {
  return shelfAzimuth(shelf) + (j - centre) * BOOK_STEP;
}

/* ------------------------------------------------------------- the camera */

/** Where the reader stands for a given stage size. */
export interface CameraFrame {
  /** Vertical field of view, degrees. */
  fov: number;
  /** From the column's axis to the camera. */
  distance: number;
  /** Share of the stage's width the column takes (above 1: it runs past both edges). */
  columnShare: number;
  /** Height of the slice of column in view, at the column's front. */
  visibleHeight: number;
  /** Half the width in view at the books' front face. */
  halfWidthAtBooks: number;
  /** How far down the stage (0 = top, 1 = bottom) the shelf in front stands. */
  shelfAt: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Wide stages (the reference is 1.85:1) and phone portrait (about 0.5:1). Between them, it blends. */
const WIDE_ASPECT = 1.6;
const TALL_ASPECT = 0.6;

/**
 * How far away the camera stands, and how wide its lens is, for a stage of
 * `width` × `height` CSS pixels.
 *
 * On a wide screen the column takes 40 % of the width, as in the reference: a
 * monument with the room round it. On a phone held upright that would make a
 * cover 30 px wide, so the camera comes in until the column runs past both
 * edges and the three covers in front are big enough to read and to tap.
 */
export function frameFor(width: number, height: number): CameraFrame {
  const aspect = width / Math.max(1, height);
  const t = clamp((WIDE_ASPECT - aspect) / (WIDE_ASPECT - TALL_ASPECT), 0, 1);
  const columnShare = lerp(0.4, 1.25, t);
  const fov = lerp(30, 38, t);
  // A wide screen keeps its headings in a corner, so the shelf can stand high,
  // with the tiers below it in view; a phone's heading spans the top.
  const shelfAt = lerp(0.4, 0.46, t);
  const tanHalfV = Math.tan((fov * Math.PI) / 360);
  const tanHalfH = tanHalfV * aspect;
  // A cylinder's outline is where a line of sight grazes it — at half-angle
  // asin(R / D) from the axis, BEHIND its front face. Measuring the width at the
  // front face instead draws a "40 %" column at 34 %.
  const distance = RADIUS.band / Math.sin(Math.atan(columnShare * tanHalfH));
  return {
    fov,
    distance,
    columnShare,
    visibleHeight: 2 * (distance - RADIUS.band) * tanHalfV,
    halfWidthAtBooks: (distance - RADIUS.books) * tanHalfH,
    shelfAt,
  };
}

/** The camera's eye stands this far above the cover centres of the shelf it is at: a reader's eye, a little above the books. */
export const EYE_ABOVE_SHELF = 0.22;

/**
 * The camera at scroll progress `p` (0 = the top shelf, n − 1 = the last). It
 * tilts down just enough to put the shelf's cover centres at `frame.shelfAt` of
 * the stage's height.
 */
export function cameraAt(p: number, frame: CameraFrame): { x: number; y: number; z: number; lookY: number } {
  const azimuth = p * SPIRAL_STEP;
  const y = shelfY(p) + EYE_ABOVE_SHELF;
  const tanHalfV = Math.tan((frame.fov * Math.PI) / 360);
  const below = Math.atan(-EYE_ABOVE_SHELF / (frame.distance - RADIUS.books));
  const pitch = below - Math.atan(2 * (0.5 - frame.shelfAt) * tanHalfV);
  return {
    x: frame.distance * Math.sin(azimuth),
    y,
    z: frame.distance * Math.cos(azimuth),
    lookY: y + frame.distance * Math.tan(pitch),
  };
}

/* ------------------------------------------------------- turning a shelf */

/** The steepest angle at which a cover still reads as a cover rather than a sliver. */
const LEGIBLE_ANGLE = (48 * Math.PI) / 180;
/** A book counts as in front while its centre is within this share of the half-width in view. */
const FRONT_SHARE = 0.62;

/**
 * How many books a shelf shows in front at once: always odd, so one is centred.
 * 5 on a wide screen, 3 on a phone. The rest of a longer shelf is reached by
 * turning the ring.
 */
export function shelfCapacity(frame: CameraFrame): number {
  const byWidth = Math.asin(clamp((FRONT_SHARE * frame.halfWidthAtBooks) / RADIUS.books, 0, 1));
  const half = Math.min(LEGIBLE_ANGLE, byWidth);
  return 1 + 2 * Math.floor(half / BOOK_STEP + 1e-9);
}

/** The range `centre` may take on a shelf of `count` books showing `capacity` at once. */
export function centreRange(count: number, capacity: number): [number, number] {
  if (count <= capacity) return [(count - 1) / 2, (count - 1) / 2];
  const half = (capacity - 1) / 2;
  return [half, count - 1 - half];
}

export function clampCentre(count: number, capacity: number, centre: number): number {
  const [lo, hi] = centreRange(count, capacity);
  return clamp(centre, lo, hi);
}

/** A shelf starts with its middle book in front, so its run is balanced round the column. */
export function initialCentre(count: number, capacity: number): number {
  return clampCentre(count, capacity, Math.floor((count - 1) / 2));
}

/** The books (0-based, inclusive) in front when the book at `centre` is. */
export function frontWindow(count: number, capacity: number, centre: number): { first: number; last: number } {
  const half = (capacity - 1) / 2;
  return {
    first: Math.max(0, Math.ceil(centre - half - 1e-6)),
    last: Math.min(count - 1, Math.floor(centre + half + 1e-6)),
  };
}

/** Turn a shelf by a frontful of books, less one so the reader keeps their place. */
export function turnedCentre(count: number, capacity: number, centre: number, direction: 1 | -1): number {
  return clampCentre(count, capacity, Math.round(centre) + direction * Math.max(1, capacity - 1));
}

/** The smallest turn that brings book `j` into the front window. */
export function centreShowing(count: number, capacity: number, centre: number, j: number): number {
  const { first, last } = frontWindow(count, capacity, centre);
  const half = (capacity - 1) / 2;
  if (j < first) return clampCentre(count, capacity, j + half);
  if (j > last) return clampCentre(count, capacity, j - half);
  return centre;
}

/* ---------------------------------------------------------------- scroll */

/**
 * Scroll progress through the shelves: 0 while the top shelf is in front, 1 at
 * the next, up to `shelfCount − 1`. `scrollTop` is how far the stage's track
 * has scrolled under the sticky top (CSS px); `segment` is the scroll a reader
 * spends per shelf.
 */
export function progressAt(scrollTop: number, segment: number, shelfCount: number): number {
  if (shelfCount <= 1 || segment <= 0) return 0;
  return clamp(scrollTop / segment, 0, shelfCount - 1);
}

/** The scroll offset into the track at which shelf `index` is in front. */
export function stopFor(index: number, segment: number): number {
  return Math.max(0, index) * segment;
}
