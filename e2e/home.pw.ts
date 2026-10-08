import { expect, test, type Page } from "@playwright/test";

import { clippedContent, horizontalOverflow } from "./helpers";

/**
 * PHASE 6 — the homepage's first screen, at the sizes people actually have.
 *
 * What is asserted is geometry, because the defect this guards against is geometric:
 * the hero used to crop its picture with `object-cover`, which slid the three covers
 * under the paragraph at 768px (the text ran across "Quinn Gallagher"), cut the third
 * book off at 1440px, and put the header's wordmark on top of a cover on a phone. And
 * the header row, once it gained the logo tile, was 159px wider than a 1024px screen.
 *
 * The covers' rectangles are not hand-measured per width: they are derived from the
 * scene's own box and the plate's proportions (`scripts/hero/compose-hero.py`, plate
 * 1672x941, covers at the pixels below), so the test follows the layout wherever it goes.
 */

const SIZES: ReadonlyArray<readonly [number, number]> = [
  [320, 640],
  [360, 740],
  [375, 667],
  [390, 844],
  [393, 852],
  [412, 915],
  [640, 900],
  [700, 900],
  [768, 1024],
  [1024, 768],
  [1180, 820],
  [1280, 720],
  [1300, 800],
  [1366, 768],
  [1440, 900],
  [1536, 864],
  [1920, 1080],
  [2560, 1440],
];

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The covers in plate pixels (x0, y0, x1, y1) — spine included, the leaning book's lean included. */
const COVERS: Record<string, Rect> = {
  "world games": { x0: 635, y0: 370, x1: 955, y1: 790 },
  "weather permitting": { x0: 952, y0: 124, x1: 1290, y1: 600 },
  "the sweetest season": { x0: 1334, y0: 399, x1: 1608, y1: 800 },
};

/** Where a plate rectangle lands on screen, given the scene's box and which crop it is showing. */
function onScreen(scene: { x: number; y: number; width: number; height: number }, vw: number, r: Rect): Rect {
  // The three crops of the 3344x1882 master (= the plate at 2x): see scripts/hero/export-hero.mjs.
  const crop = vw < 640 ? { l: 1154, t: 60, w: 2190, h: 1800 } : vw < 1280 ? { l: 0, t: 120, w: 3344, h: 1762 } : { l: 0, t: 0, w: 3344, h: 1882 };
  const sx = scene.width / crop.w;
  const sy = scene.height / crop.h;
  return {
    x0: scene.x + (r.x0 * 2 - crop.l) * sx,
    x1: scene.x + (r.x1 * 2 - crop.l) * sx,
    y0: scene.y + (r.y0 * 2 - crop.t) * sy,
    y1: scene.y + (r.y1 * 2 - crop.t) * sy,
  };
}

const overlaps = (a: Rect, b: Rect, slack = 1) => a.x0 < b.x1 - slack && a.x1 > b.x0 + slack && a.y0 < b.y1 - slack && a.y1 > b.y0 + slack;

/** Every line of text in the element (not the block's full width — the glyphs). Buttons and chips use their own box. */
async function textRects(page: Page, selector: string): Promise<Rect[]> {
  return page.evaluate((sel) => {
    const out: { x0: number; y0: number; x1: number; y1: number }[] = [];
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const he = el as HTMLElement;
      if (he.offsetParent === null && getComputedStyle(he).position !== "fixed") continue; // display:none
      const walker = document.createTreeWalker(he, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of Array.from(range.getClientRects())) if (r.width > 1 && r.height > 1) out.push({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
      }
    }
    return out;
  }, selector);
}

for (const [w, h] of SIZES) {
  test(`homepage hero at ${w}x${h}: nothing wider than the screen, header fits, no text on a cover`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/", { waitUntil: "load" });
    await page.evaluate(() => document.fonts?.ready);

    // 1. the page is not wider than the window
    expect(await horizontalOverflow(page), `overflow at ${w}px`).toBeLessThanOrEqual(0);

    expect(await clippedContent(page), `content cut off by the screen's edge at ${w}px`).toEqual([]);

    // 2. every control in the header is on screen. (The visible header is found by its height: the root layout
    //    used to mount a second, display:none `SiteHeader` that `header` also matched; it was deleted in Phase 12.)
    const header = await page.evaluate(() => {
      const bar = Array.from(document.querySelectorAll("header")).find((h) => h.getBoundingClientRect().height > 0)!;
      const controls = Array.from(bar.querySelectorAll("a, button"))
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => {
          const r = e.getBoundingClientRect();
          return { what: (e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 24), x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
        });
      return { bottom: bar.getBoundingClientRect().bottom, controls };
    });
    expect(header.bottom, "a visible header was found").toBeGreaterThan(40);
    // brand, cart and the menu are always there (search joins from 370px, the account control is a placeholder here)
    expect(header.controls.length).toBeGreaterThanOrEqual(3);
    for (const c of header.controls) {
      expect(c.x0, `header "${c.what}" left edge at ${w}px`).toBeGreaterThanOrEqual(-1);
      expect(c.x1, `header "${c.what}" right edge at ${w}px`).toBeLessThanOrEqual(w + 1);
    }
    // A control that merely fits can still touch the screen's edge (the hamburger ended 3px from it at 393px).
    // The account control is reserved at the width of the production "Sign in" pill, so this is the widest header.
    const rightmost = Math.max(...header.controls.map((c) => c.x1));
    const leftmost = Math.min(...header.controls.map((c) => c.x0));
    expect(w - rightmost, `right gutter of the header at ${w}px`).toBeGreaterThanOrEqual(12);
    expect(leftmost, `left gutter of the header at ${w}px`).toBeGreaterThanOrEqual(12);

    // 3. the three covers are where the plate says, entirely on screen, and under the header
    const scene = await page.locator("[data-hero-scene]").boundingBox();
    expect(scene, "the hero scene is rendered").not.toBeNull();
    const covers = Object.entries(COVERS).map(([name, r]) => [name, onScreen(scene!, w, r)] as const);
    for (const [name, c] of covers) {
      expect(c.x0, `${name}: left edge`).toBeGreaterThanOrEqual(-1);
      expect(c.x1, `${name}: right edge (screen ${w}px)`).toBeLessThanOrEqual(w - 4);
      expect(c.y0, `${name}: top edge is below the header (bottom ${Math.round(header.bottom)}px) at ${w}px`).toBeGreaterThanOrEqual(header.bottom + 8);
    }
    // ...and no header control (the search pill was the one that ended up on a cover) touches a cover.
    for (const ctl of header.controls) {
      for (const [name, c] of covers) {
        expect(overlaps({ x0: ctl.x0, y0: ctl.y0, x1: ctl.x1, y1: ctl.y1 }, c), `header "${ctl.what}" runs onto ${name} at ${w}px`).toBe(false);
      }
    }
    // ...and, in the one-screen desktop layouts, the books are fully above the fold.
    if (w >= 1280) {
      for (const [name, c] of covers) expect(c.y1, `${name}: foot is above the fold (${h}px)`).toBeLessThanOrEqual(h);
    }

    // 4. no line of text, no button and no chip touches a cover
    const text = [
      ...(await textRects(page, "[data-hero] h1")),
      ...(await textRects(page, "[data-hero] h1 ~ p")),
      ...(await textRects(page, "[data-hero] [data-hero-note]")),
    ];
    const boxes = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-hero] a.valice-cta, [data-hero] ul li"))
        .filter((e) => (e as HTMLElement).offsetParent !== null && !e.closest("[data-hero-note]") && !e.closest("[data-hero-scene]"))
        .map((e) => {
          const r = e.getBoundingClientRect();
          return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
        }),
    );
    expect(text.length, "hero text found").toBeGreaterThan(3);
    for (const t of [...text, ...boxes]) {
      for (const [name, c] of covers) {
        expect(overlaps(t, c), `text/button at (${Math.round(t.x0)},${Math.round(t.y0)})-(${Math.round(t.x1)},${Math.round(t.y1)}) runs onto ${name} (${Math.round(c.x0)},${Math.round(c.y0)})-(${Math.round(c.x1)},${Math.round(c.y1)}) at ${w}px`).toBe(false);
      }
    }
  });
}
