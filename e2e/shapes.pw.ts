import { expect, test } from "@playwright/test";

import { isMobileProject, MOBILE_WIDTHS } from "./helpers";

/**
 * PHASE 14 — what the screen of a physical phone showed that no automated check had asked about: pictures
 * and controls drawn in the wrong SHAPE, and pages whose first screen said the wrong thing.
 *
 * All four were found by looking at a Redmi Note 8:
 *   - the covers fanned on a shelf card on /about were cut to squares, so every title was sliced through the
 *     middle: the box was sized by the frame's width, and the frame there is 16:9 (wrong at every width);
 *   - the arrow at the foot of an author card was squeezed into an oval whenever its label wrapped onto two
 *     lines ("REFERENCE / AUTHOR"): a flex item shrinks unless it is told not to (wrong at every width);
 *   - the Look Inside row on a book's page showed its first picture and nothing to say there were more: the
 *     picture and the gap filled the row exactly, so no piece of the next one showed;
 *   - an author's page opened on a portrait 453px tall, and the name began at the bottom edge of the screen.
 *
 * Measured, not styled: the assertions read the boxes the browser laid out, so a different set of classes that
 * draws the same wrong shape fails here too.
 */

/** A cover is 2:3. The tolerance is what rounding a 56px-wide box to whole pixels can do (about 0.012). */
const COVER = 2 / 3;
const COVER_TOLERANCE = 0.03;

test.describe("shape — a cover is drawn as a cover", () => {
  for (const route of ["/about", "/categories"]) {
    test(`${route}: every cover fanned on a shelf card keeps the shape of a cover and stays inside its frame`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      const widths = isMobileProject(testInfo) ? [320, 360, 393, 412] : [1024, 1440];
      await page.goto(route, { waitUntil: "load" });
      for (const w of widths) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.waitForTimeout(150);
        const covers = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>("[data-category-stack]")].flatMap((stack, s) => {
            const frame = stack.getBoundingClientRect();
            return [...stack.querySelectorAll<HTMLImageElement>("img")].map((img, i) => {
              const box = img.parentElement as HTMLElement;
              const r = box.getBoundingClientRect(); // after the fan's rotation: what the eye sees
              return {
                at: `stack ${s}, cover ${i}`,
                // the laid-out box, before the transform
                width: box.offsetWidth,
                height: box.offsetHeight,
                spill: Math.max(frame.left - r.left, r.right - frame.right, frame.top - r.top, r.bottom - frame.bottom),
              };
            });
          }),
        );
        expect(covers.length, `${route} at ${w}px: covers in the stacks`).toBeGreaterThan(0);
        for (const c of covers) {
          expect(Math.abs(c.width / c.height - COVER), `${route} at ${w}px, ${c.at}: ${c.width}×${c.height} is not a cover's 2:3`).toBeLessThanOrEqual(COVER_TOLERANCE);
          expect(c.spill, `${route} at ${w}px, ${c.at}: the fan spills ${Math.round(c.spill)}px past its frame and is cut`).toBeLessThanOrEqual(1);
        }
      }
    });
  }
});

test.describe("shape — a round control is round", () => {
  test("the arrow at the foot of an author card is a circle at every width, whatever its label does", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const widths = isMobileProject(testInfo) ? MOBILE_WIDTHS : ([1024, 1440] as const);
    await page.goto("/authors", { waitUntil: "load" });
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(150);
      const arrows = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("article span[aria-hidden]")]
          .filter((s) => s.querySelector(":scope > svg"))
          .map((s) => {
            const r = s.getBoundingClientRect();
            const label = s.previousElementSibling?.textContent?.trim() ?? "";
            return { label, width: r.width, height: r.height };
          }),
      );
      expect(arrows.length, `arrows on /authors at ${w}px`).toBeGreaterThanOrEqual(25);
      const squeezed = arrows.filter((a) => Math.abs(a.width - a.height) > 1);
      expect(squeezed, `/authors at ${w}px: arrows that are not circles`).toEqual([]);
    }
  });
});

test.describe("shape — what a phone's first look at a page says", () => {
  test("a row that scrolls sideways shows a piece of its next tile, so it says it goes on", async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo), "the strip is a sideways row only below 640px");
    test.setTimeout(90_000);
    await page.goto("/books/weather-permitting", { waitUntil: "load" });
    for (const w of [320, 360, 393, 412]) {
      await page.setViewportSize({ width: w, height: 718 });
      await page.waitForTimeout(150);
      const m = await page.evaluate(() => {
        const ul = document.querySelector<HTMLElement>('ul[aria-label^="Pictures from"]');
        if (!ul) return null;
        const row = ul.getBoundingClientRect();
        const tiles = [...ul.querySelectorAll<HTMLElement>(":scope > li > button")].map((b) => b.getBoundingClientRect());
        return { right: row.right, first: tiles[0] ?? null, second: tiles[1] ?? null, scrolls: ul.scrollWidth > ul.clientWidth + 4 };
      });
      expect(m, `${w}px: the Look Inside row`).not.toBeNull();
      expect(m!.scrolls, `${w}px: the row has more than fits`).toBe(true);
      expect(m!.second, `${w}px: a second tile`).not.toBeNull();
      expect(m!.first!.right, `${w}px: the first tile is whole`).toBeLessThanOrEqual(m!.right + 1);
      const showing = m!.right - m!.second!.left;
      expect(showing, `${w}px: ${Math.round(showing)}px of the next tile shows`).toBeGreaterThanOrEqual(24);
    }
  });

  test("an author's name is on the first screen of their page, not below a portrait that fills it", async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo), "the portrait is a full-height card only on a phone");
    test.setTimeout(90_000);
    // 392×718 is what the physical Redmi's browser gives a page; one author with a photograph, one with the monogram
    await page.setViewportSize({ width: 392, height: 718 });
    for (const slug of ["emre-dogan", "hans-christian-andersen"]) {
      await page.goto(`/authors/${slug}`, { waitUntil: "load" });
      const h1 = await page.locator("h1").first().evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, line: parseFloat(getComputedStyle(el).lineHeight) || 40 };
      });
      expect(h1.top + h1.line, `/authors/${slug}: the first line of the name ends at ${Math.round(h1.top + h1.line)}px of a 718px screen`).toBeLessThanOrEqual(718);
    }
  });
});
