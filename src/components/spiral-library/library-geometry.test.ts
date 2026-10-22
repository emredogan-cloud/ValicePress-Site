import { describe, expect, it } from "vitest";

import {
  BAND_HEIGHT,
  BOOK_STEP,
  RADIUS,
  SLOT_WIDTH,
  TIER_PITCH,
  bandY,
  bookAzimuth,
  cameraAt,
  centreRange,
  centreShowing,
  frameFor,
  frontWindow,
  initialCentre,
  progressAt,
  shelfCapacity,
  shelfY,
  stopFor,
  turnedCentre,
} from "./library-geometry";

/** A wide desktop stage (1440 × 900 less the 64 px header) and a phone held upright (the Redmi's 393 × 851 less it). */
const DESKTOP = { width: 1440, height: 836 };
const PHONE = { width: 393, height: 787 };

/**
 * The share of the stage's width the column's outline takes, found the long
 * way: project points round the band through a pinhole camera and take the
 * widest. Independent of the closed form in `frameFor`.
 */
function measuredShare(width: number, height: number): number {
  const f = frameFor(width, height);
  const tanHalfH = Math.tan((f.fov * Math.PI) / 360) * (width / height);
  let widest = 0;
  for (let k = 0; k < 20000; k++) {
    const a = (k / 20000) * 2 * Math.PI;
    const x = RADIUS.band * Math.sin(a);
    const depth = f.distance - RADIUS.band * Math.cos(a);
    widest = Math.max(widest, Math.abs(x) / (depth * tanHalfH));
  }
  return widest;
}

describe("frameFor — a scaling law, so it is tested where its two ends disagree", () => {
  it("draws the column at 40 % of a wide desktop stage, as in the reference", () => {
    expect(measuredShare(DESKTOP.width, DESKTOP.height)).toBeCloseTo(0.4, 3);
  });

  it("brings a phone's camera in until the column runs past both edges", () => {
    expect(measuredShare(PHONE.width, PHONE.height)).toBeCloseTo(1.25, 3);
  });

  it("draws a cover bigger on the phone than the desktop's share would, and readable on both", () => {
    // Pixels per cover height at the books' front face.
    const coverPx = ({ width, height }: { width: number; height: number }) => {
      const f = frameFor(width, height);
      const visible = 2 * (f.distance - RADIUS.books) * Math.tan((f.fov * Math.PI) / 360);
      return height / visible;
    };
    const desktop = coverPx(DESKTOP);
    const phone = coverPx(PHONE);
    // The reference's covers are about 17 % of its frame's height; a cover narrower than 60 px is not a tap target.
    expect(desktop / DESKTOP.height).toBeGreaterThan(0.13);
    expect(desktop / DESKTOP.height).toBeLessThan(0.2);
    expect(phone * SLOT_WIDTH).toBeGreaterThan(60);
  });

  it("shows about four to five tiers at a time on a wide screen", () => {
    const f = frameFor(DESKTOP.width, DESKTOP.height);
    expect(f.visibleHeight / TIER_PITCH).toBeGreaterThan(3.5);
    expect(f.visibleHeight / TIER_PITCH).toBeLessThan(5.5);
  });
});

describe("shelfCapacity", () => {
  it("fronts five books on a wide screen and three on a phone", () => {
    expect(shelfCapacity(frameFor(DESKTOP.width, DESKTOP.height))).toBe(5);
    expect(shelfCapacity(frameFor(PHONE.width, PHONE.height))).toBe(3);
  });

  it("is always odd, so one book is centred", () => {
    for (const w of [320, 393, 600, 768, 1024, 1280, 1440, 1920, 2560]) {
      expect(shelfCapacity(frameFor(w, 800)) % 2, String(w)).toBe(1);
    }
  });
});

describe("the tiers", () => {
  it("stands each shelf's books on the top of the band below them", () => {
    for (let i = 0; i < 6; i++) {
      const booksBottom = shelfY(i) - 0.5;
      const bandBelowTop = bandY(i + 1) + BAND_HEIGHT / 2;
      expect(bandBelowTop).toBeCloseTo(booksBottom, 9);
    }
  });

  it("hangs each shelf's name band above its own books, clear of them", () => {
    for (let i = 0; i < 6; i++) {
      expect(bandY(i) - BAND_HEIGHT / 2).toBeGreaterThan(shelfY(i) + 0.5);
      expect(shelfY(i) - shelfY(i + 1)).toBeCloseTo(TIER_PITCH, 9);
    }
  });

  it("leaves room between neighbouring covers for the widest cover", () => {
    expect(BOOK_STEP * RADIUS.books).toBeGreaterThan(SLOT_WIDTH);
  });
});

describe("turning a shelf", () => {
  it("centres a shelf that fits, and never turns it", () => {
    expect(centreRange(4, 5)).toEqual([1.5, 1.5]);
    expect(initialCentre(4, 5)).toBe(1.5);
    expect(turnedCentre(4, 5, 1.5, 1)).toBe(1.5);
    expect(frontWindow(4, 5, 1.5)).toEqual({ first: 0, last: 3 });
  });

  it("starts a long shelf on its middle books and turns it a frontful at a time, to both ends", () => {
    // Myth & Folklore: fourteen books, five in front.
    expect(initialCentre(14, 5)).toBe(6);
    expect(frontWindow(14, 5, 6)).toEqual({ first: 4, last: 8 });
    expect(turnedCentre(14, 5, 6, 1)).toBe(10);
    expect(turnedCentre(14, 5, 10, 1)).toBe(11);
    expect(frontWindow(14, 5, 11)).toEqual({ first: 9, last: 13 });
    expect(turnedCentre(14, 5, 6, -1)).toBe(2);
    expect(frontWindow(14, 5, 2)).toEqual({ first: 0, last: 4 });
  });

  it("turns only as far as it must to bring a focused book to the front", () => {
    expect(centreShowing(14, 5, 6, 7)).toBe(6);
    expect(centreShowing(14, 5, 6, 12)).toBe(10);
    expect(centreShowing(14, 5, 6, 0)).toBe(2);
  });

  it("puts the centred book in front of the shelf, and its neighbours a book's step either side", () => {
    expect(bookAzimuth(0, 6, 6)).toBeCloseTo(0, 9);
    expect(bookAzimuth(0, 7, 6) - bookAzimuth(0, 6, 6)).toBeCloseTo(BOOK_STEP, 9);
    // The camera at a shelf looks at that shelf's front.
    const at = cameraAt(3, frameFor(DESKTOP.width, DESKTOP.height));
    expect(Math.atan2(at.x, at.z)).toBeCloseTo(bookAzimuth(3, 0, 0), 9);
  });
});

describe("cameraAt — where the shelf in front stands on the stage", () => {
  /** Project a point through a pinhole camera at `eye` looking at `target`: its height on the stage, 0 = top, 1 = bottom. */
  function stageY(eye: number[], target: number[], fov: number, point: number[]): number {
    const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
    const dot = (a: number[], b: number[]) => a.reduce((acc, v, i) => acc + v * b[i], 0);
    const norm = (a: number[]) => a.map((v) => v / Math.hypot(...a));
    const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const forward = norm(sub(target, eye));
    const right = norm(cross(forward, [0, 1, 0]));
    const up = cross(right, forward);
    const v = sub(point, eye);
    const ndc = dot(v, up) / (dot(v, forward) * Math.tan((fov * Math.PI) / 360));
    return (1 - ndc) / 2;
  }

  for (const [label, size] of [["wide desktop", DESKTOP], ["phone", PHONE]] as const) {
    it(`puts the shelf's cover centres where the frame says, on a ${label}, at every shelf`, () => {
      const f = frameFor(size.width, size.height);
      for (const p of [0, 2, 5]) {
        const at = cameraAt(p, f);
        const a = bookAzimuth(p, 0, 0);
        const cover = [RADIUS.books * Math.sin(a), shelfY(p), RADIUS.books * Math.cos(a)];
        expect(stageY([at.x, at.y, at.z], [0, at.lookY, 0], f.fov, cover)).toBeCloseTo(f.shelfAt, 2);
      }
    });
  }

  it("stands the shelf higher on a wide screen than on a phone, whose heading spans the top", () => {
    expect(frameFor(DESKTOP.width, DESKTOP.height).shelfAt).toBeLessThan(frameFor(PHONE.width, PHONE.height).shelfAt);
  });
});

describe("scroll", () => {
  it("reads progress back from a stop, and clamps past both ends", () => {
    for (let i = 0; i < 6; i++) expect(progressAt(stopFor(i, 610), 610, 6)).toBe(i);
    expect(progressAt(-200, 610, 6)).toBe(0);
    expect(progressAt(99999, 610, 6)).toBe(5);
    expect(progressAt(300, 610, 1)).toBe(0);
  });
});
