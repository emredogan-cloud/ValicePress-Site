import { describe, expect, it } from "vitest";

import { EDGE_SLACK, edgeState, pageTarget, type Direction } from "./carousel";

/** `n` cards of `card` px with `gap` between, starting `inset` px in. */
function track(n: number, viewport: number, { card = 180, gap = 20, inset = 0 } = {}) {
  const lefts = Array.from({ length: n }, (_, i) => inset + i * (card + gap));
  const scrollWidth = inset + n * card + (n - 1) * gap + inset;
  return { lefts, scrollWidth, clientWidth: viewport, inset };
}

/** Press once from `at`; return where it ends up (or `at` itself when the press does nothing). */
function press(t: ReturnType<typeof track>, at: number, direction: Direction): number {
  return pageTarget({ ...t, scrollLeft: at, direction }) ?? at;
}

/** The index of the first card that is at least half visible at this scroll position. */
const firstVisible = (t: ReturnType<typeof track>, at: number) => t.lefts.findIndex((l) => l + 90 > at + t.inset);

describe("edgeState", () => {
  it("is not scrollable when every card already fits (the arrows that did nothing at 1920px)", () => {
    // Eight 180px cards with 20px gaps = 1580px of content in a 1776px track.
    expect(edgeState({ scrollLeft: 0, clientWidth: 1776, scrollWidth: 1580 })).toEqual({ scrollable: false, atStart: true, atEnd: true });
  });

  it("is scrollable when the content overflows, and reports each end", () => {
    expect(edgeState({ scrollLeft: 0, clientWidth: 1296, scrollWidth: 1580 })).toEqual({ scrollable: true, atStart: true, atEnd: false });
    expect(edgeState({ scrollLeft: 100, clientWidth: 1296, scrollWidth: 1580 })).toEqual({ scrollable: true, atStart: false, atEnd: false });
    expect(edgeState({ scrollLeft: 284, clientWidth: 1296, scrollWidth: 1580 })).toEqual({ scrollable: true, atStart: false, atEnd: true });
  });

  it("forgives sub-pixel rounding at both ends", () => {
    expect(edgeState({ scrollLeft: EDGE_SLACK, clientWidth: 1000, scrollWidth: 1580 }).atStart).toBe(true);
    expect(edgeState({ scrollLeft: 580 - EDGE_SLACK, clientWidth: 1000, scrollWidth: 1580 }).atEnd).toBe(true);
    expect(edgeState({ scrollLeft: EDGE_SLACK + 1, clientWidth: 1000, scrollWidth: 1580 }).atStart).toBe(false);
    // A fraction of a pixel of overflow is not a reason to draw two arrows.
    expect(edgeState({ scrollLeft: 0, clientWidth: 1000, scrollWidth: 1001 }).scrollable).toBe(false);
  });

  it("an empty or collapsed track is not scrollable and never throws", () => {
    expect(edgeState({ scrollLeft: 0, clientWidth: 0, scrollWidth: 0 }).scrollable).toBe(false);
    expect(edgeState({ scrollLeft: 50, clientWidth: 500, scrollWidth: 400 })).toEqual({ scrollable: false, atStart: true, atEnd: true });
  });
});

describe("pageTarget", () => {
  it("does nothing when everything fits", () => {
    const t = track(8, 1776);
    expect(pageTarget({ ...t, scrollLeft: 0, direction: "next" })).toBeNull();
    expect(pageTarget({ ...t, scrollLeft: 0, direction: "prev" })).toBeNull();
  });

  it("does nothing with no cards", () => {
    expect(pageTarget({ lefts: [], scrollLeft: 0, clientWidth: 500, scrollWidth: 2000, direction: "next" })).toBeNull();
  });

  it("does nothing at an end: previous at the start, next at the end", () => {
    const t = track(8, 1296); // max scroll 284
    expect(pageTarget({ ...t, scrollLeft: 0, direction: "prev" })).toBeNull();
    expect(pageTarget({ ...t, scrollLeft: 284, direction: "next" })).toBeNull();
    expect(pageTarget({ ...t, scrollLeft: 283, direction: "next" })).toBeNull(); // within the slack
  });

  it("moves a page, landing on a card", () => {
    const t = track(12, 880); // 12 cards, 4.4 visible; max = 2380 - 880 = 1500
    // From the start the card cut off at the right edge (index 4, at 800) comes to the left edge.
    expect(press(t, 0, "next")).toBe(800);
    expect(press(t, 800, "next")).toBe(1500); // the end: 1600 would pass the last scrollable position
    expect(press(t, 1500, "prev")).toBe(800);
    expect(press(t, 800, "prev")).toBe(0);
  });

  it("a long track pages through every card with none skipped", () => {
    const t = track(30, 880);
    let at = 0;
    const seen = new Set<number>();
    const mark = () => {
      // Every card that is at least half visible at this position counts as seen.
      t.lefts.forEach((l, i) => {
        if (l + 90 > at && l + 90 < at + t.clientWidth) seen.add(i);
      });
    };
    mark();
    for (let guard = 0; guard < 100; guard++) {
      const next = press(t, at, "next");
      if (next === at) break;
      at = next;
      mark();
    }
    expect(edgeState({ scrollLeft: at, clientWidth: t.clientWidth, scrollWidth: t.scrollWidth }).atEnd).toBe(true);
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => i));
  });

  it("LEFT → RIGHT → LEFT → RIGHT puts the same cards back, everywhere", () => {
    let exercised = 0;
    for (const viewport of [393, 640, 768, 1024, 1296, 1440]) {
      for (const n of [3, 8, 12, 30]) {
        const t = track(n, viewport);
        const max = Math.max(0, t.scrollWidth - viewport);
        for (const start of [0, max]) {
          // Whatever the first press, doing it and then its opposite returns to the start.
          const first: Direction = start === 0 ? "next" : "prev";
          const back: Direction = start === 0 ? "prev" : "next";
          const away = press(t, start, first);
          if (away === start) continue; // nothing to scroll
          exercised++;
          expect(press(t, away, back), `viewport ${viewport}, ${n} cards, from ${start}`).toBe(start);
          // And a second round trip lands in the same two places.
          const again = press(t, press(t, away, back), first);
          expect(again).toBe(away);
        }
      }
    }
    // Guard against the loop quietly skipping everything.
    expect(exercised).toBeGreaterThan(20);
  });

  it("every stop between the ends is a card boundary", () => {
    const t = track(20, 700);
    const max = t.scrollWidth - t.clientWidth;
    let at = 0;
    for (let i = 0; i < 50; i++) {
      const next = press(t, at, "next");
      if (next === at) break;
      at = next;
      if (at < max - EDGE_SLACK) expect(t.lefts, `landed at ${at}`).toContain(at);
    }
  });

  it("always makes progress, even when a card is wider than the track", () => {
    const lefts = [0, 500, 1000];
    const base = { lefts, clientWidth: 300, scrollWidth: 1500 };
    expect(pageTarget({ ...base, scrollLeft: 0, direction: "next" })).toBe(500);
    expect(pageTarget({ ...base, scrollLeft: 500, direction: "next" })).toBe(1000);
    expect(pageTarget({ ...base, scrollLeft: 500, direction: "prev" })).toBe(0);
    expect(pageTarget({ ...base, scrollLeft: 1000, direction: "prev" })).toBe(500);
  });

  it("a track with padding aligns each card at its padding, not flush", () => {
    const t = track(12, 880, { inset: 28 }); // content starts 28px in
    const first = press(t, 0, "next");
    // The target is the card's left minus the padding, so it lands the same distance from the edge as the first card does.
    expect(t.lefts.map((l) => l - 28)).toContain(first);
    expect(press(t, first, "prev")).toBe(0);
  });

  it("never returns a target outside the scrollable range", () => {
    for (const viewport of [320, 393, 700, 1296]) {
      for (const n of [2, 5, 9, 17]) {
        const t = track(n, viewport);
        const max = Math.max(0, t.scrollWidth - viewport);
        for (let at = 0; at <= max; at += 37) {
          for (const d of ["prev", "next"] as const) {
            const r = pageTarget({ ...t, scrollLeft: at, direction: d });
            if (r !== null) {
              expect(r, `${d} from ${at}`).toBeGreaterThanOrEqual(0);
              expect(r, `${d} from ${at}`).toBeLessThanOrEqual(max);
              // "next" goes right and "prev" goes left, never the other way.
              if (d === "next") expect(r).toBeGreaterThan(at);
              else expect(r).toBeLessThan(at);
            }
          }
        }
      }
    }
  });

  it("the old fixed step could not do this: from 1024px, two presses reach different cards each time", () => {
    const t = track(8, 880);
    const a = press(t, 0, "next");
    const b = press(t, a, "next");
    expect(firstVisible(t, a)).toBeGreaterThan(firstVisible(t, 0));
    expect(b).toBe(t.scrollWidth - t.clientWidth); // 700: the end
  });
});
