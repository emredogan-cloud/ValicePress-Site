import { describe, expect, it } from "vitest";

import {
  buildSpreads,
  choosePerfMode,
  pagesToWarm,
  progressPercent,
  representativePage,
  spreadIndexForPage,
} from "./reader-engine";

/**
 * The spread model is the reader's one piece of arithmetic that is invisible
 * when wrong. A page on the wrong leaf still renders, still turns, still looks
 * like a book — it is simply not the book the customer bought. These cases pin
 * the recto rule and the round trip through it.
 */
describe("buildSpreads", () => {
  it("opens on page 1 alone at the right, as a printed book does", () => {
    expect(buildSpreads(10, "spread")[0]).toEqual({ left: null, right: 1 });
  });

  it("pairs every later opening as even-left, odd-right", () => {
    const spreads = buildSpreads(10, "spread");
    expect(spreads[1]).toEqual({ left: 2, right: 3 });
    expect(spreads[2]).toEqual({ left: 4, right: 5 });
    expect(spreads[5]).toEqual({ left: 10, right: null });
  });

  it("faces the last page with a blank when the count is even", () => {
    const spreads = buildSpreads(8, "spread");
    expect(spreads.at(-1)).toEqual({ left: 8, right: null });
  });

  it("ends flush when the count is odd", () => {
    const spreads = buildSpreads(9, "spread");
    expect(spreads.at(-1)).toEqual({ left: 8, right: 9 });
  });

  it("shows every page in every opening exactly once", () => {
    // The property that actually matters: a reader who turns from the first
    // opening to the last has seen the whole book, in order, with nothing
    // repeated and nothing skipped.
    for (const count of [1, 2, 3, 38, 142, 435]) {
      const seen = buildSpreads(count, "spread")
        .flatMap((s) => [s.left, s.right])
        .filter((p): p is number => p !== null);
      expect(seen, `pageCount=${count}`).toEqual(
        Array.from({ length: count }, (_, i) => i + 1),
      );
    }
  });

  it("gives each page its own view in single layout", () => {
    const spreads = buildSpreads(3, "single");
    expect(spreads).toEqual([
      { left: null, right: 1 },
      { left: null, right: 2 },
      { left: null, right: 3 },
    ]);
  });

  it("returns nothing for a book with no pages rather than a phantom opening", () => {
    expect(buildSpreads(0, "spread")).toEqual([]);
    expect(buildSpreads(-4, "spread")).toEqual([]);
    expect(buildSpreads(Number.NaN, "spread")).toEqual([]);
  });
});

describe("spreadIndexForPage", () => {
  it("round-trips every page back to an opening that contains it", () => {
    for (const count of [1, 2, 38, 143, 435]) {
      const spreads = buildSpreads(count, "spread");
      for (let page = 1; page <= count; page++) {
        const index = spreadIndexForPage(page, count, "spread");
        const spread = spreads[index];
        expect(
          spread.left === page || spread.right === page,
          `page ${page} of ${count} landed on ${JSON.stringify(spread)}`,
        ).toBe(true);
      }
    }
  });

  it("round-trips in single layout too", () => {
    for (let page = 1; page <= 40; page++) {
      const index = spreadIndexForPage(page, 40, "single");
      expect(buildSpreads(40, "single")[index].right).toBe(page);
    }
  });

  it("clamps a stale resume point instead of pointing past the end", () => {
    // A book re-cut shorter must not resume a returning customer into nothing.
    expect(spreadIndexForPage(9999, 10, "spread")).toBe(5);
    expect(spreadIndexForPage(0, 10, "spread")).toBe(0);
    expect(spreadIndexForPage(-3, 10, "spread")).toBe(0);
  });
});

describe("representativePage", () => {
  it("reports the left page, so progress never creeps forward", () => {
    expect(representativePage({ left: 40, right: 41 })).toBe(40);
  });

  it("falls back to the right page on the opening spread", () => {
    expect(representativePage({ left: null, right: 1 })).toBe(1);
  });

  it("never returns a page for a book that has none", () => {
    expect(representativePage(undefined)).toBe(1);
    expect(representativePage({ left: null, right: null })).toBe(1);
  });

  it("is stable across repeated open-and-close cycles", () => {
    // The creep bug: resume at N, record the spread's page, resume again.
    // If the recorded page were the RIGHT leaf, each cycle would advance one
    // opening and a customer would eventually resume past where they stopped.
    let page = 40;
    for (let i = 0; i < 25; i++) {
      const spreads = buildSpreads(200, "spread");
      page = representativePage(spreads[spreadIndexForPage(page, 200, "spread")]);
    }
    expect(page).toBe(40);
  });
});

describe("progressPercent", () => {
  it("clamps to a real percentage", () => {
    expect(progressPercent(1, 100)).toBeCloseTo(1);
    expect(progressPercent(100, 100)).toBe(100);
    expect(progressPercent(9999, 100)).toBe(100);
    expect(progressPercent(-5, 100)).toBe(0);
  });

  it("returns zero rather than dividing by zero", () => {
    expect(progressPercent(5, 0)).toBe(0);
  });
});

describe("choosePerfMode", () => {
  it("honours a stated motion preference over any hardware", () => {
    expect(
      choosePerfMode({
        prefersReducedMotion: true,
        hardwareConcurrency: 32,
        deviceMemory: 64,
      }),
    ).toBe("lite");
  });

  it("steps down on a weak device", () => {
    expect(choosePerfMode({ hardwareConcurrency: 4 })).toBe("lite");
    expect(choosePerfMode({ deviceMemory: 4 })).toBe("lite");
  });

  it("steps down on a small touch screen", () => {
    expect(
      choosePerfMode({
        hardwareConcurrency: 8,
        deviceMemory: 8,
        coarsePointer: true,
        viewportWidth: 390,
      }),
    ).toBe("lite");
  });

  it("keeps the full treatment on a capable machine", () => {
    expect(
      choosePerfMode({ hardwareConcurrency: 8, deviceMemory: 8 }),
    ).toBe("rich");
  });

  it("assumes capable when the browser reports nothing", () => {
    // Safari exposes neither hint. Guessing `lite` there would give every
    // Mac and iPad the reduced treatment for no reason.
    expect(choosePerfMode({})).toBe("rich");
  });
});

describe("pagesToWarm", () => {
  it("warms the opening either side and never more", () => {
    const spreads = buildSpreads(20, "spread");
    // Spread 3 is 6–7; its neighbours are 4–5 and 8–9.
    expect(pagesToWarm(spreads, 3).sort((a, b) => a - b)).toEqual([
      4, 5, 6, 7, 8, 9,
    ]);
  });

  it("stays inside the book at either end", () => {
    const spreads = buildSpreads(6, "spread");
    expect(pagesToWarm(spreads, 0).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(pagesToWarm(spreads, spreads.length - 1).sort((a, b) => a - b)).toEqual(
      [4, 5, 6],
    );
  });

  it("never asks for more pages than the cache can hold", () => {
    // The warm set and the cache limit have to stay in step; if warming asked
    // for more than the cache holds, every prefetch would evict the pages on
    // screen and the reader would re-render on every turn.
    const spreads = buildSpreads(435, "spread");
    for (const i of [0, 1, 100, 216, spreads.length - 1]) {
      expect(pagesToWarm(spreads, i).length).toBeLessThanOrEqual(6);
    }
  });
});
