import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

/** The phone widths the brief names, plus the real device's 393. */
export const MOBILE_WIDTHS = [320, 360, 375, 390, 393, 412] as const;

export const isMobileProject = (testInfo: TestInfo) => testInfo.project.name === "mobile-chromium";

/** Pixels of horizontal overflow: > 0 means the page is wider than its viewport. */
export function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** A press the way the project's input works: a finger on mobile, a mouse on desktop. */
export async function press(locator: Locator, testInfo: TestInfo): Promise<void> {
  if (isMobileProject(testInfo)) await locator.tap();
  else await locator.click();
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function boxOf(locator: Locator, what: string): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, `${what} has no bounding box (not rendered?)`).not.toBeNull();
  return box as Box;
}

/** The whole element lies inside the visible viewport (1px of rounding allowed). */
export async function expectFullyInViewport(page: Page, locator: Locator, what: string): Promise<void> {
  const vp = page.viewportSize();
  expect(vp).not.toBeNull();
  const b = await boxOf(locator, what);
  const { width, height } = vp as { width: number; height: number };
  expect(b.x, `${what}: left edge off-screen`).toBeGreaterThanOrEqual(-1);
  expect(b.y, `${what}: top edge off-screen`).toBeGreaterThanOrEqual(-1);
  expect(b.x + b.width, `${what}: right edge off-screen (viewport ${width}px)`).toBeLessThanOrEqual(width + 1);
  expect(b.y + b.height, `${what}: bottom edge off-screen (viewport ${height}px)`).toBeLessThanOrEqual(height + 1);
}

/** A comfortable touch target: WCAG 2.2 asks 24px, this site's own rule is 44px. */
export async function expectTouchTarget(locator: Locator, what: string, min = 44): Promise<void> {
  const b = await boxOf(locator, what);
  expect(b.width, `${what} is ${Math.round(b.width)}px wide`).toBeGreaterThanOrEqual(min - 0.5);
  expect(b.height, `${what} is ${Math.round(b.height)}px tall`).toBeGreaterThanOrEqual(min - 0.5);
}

/** The first book card on /books or /ebooks (a real link, intercepted on a plain press). */
export function firstBookCard(page: Page): Locator {
  return page.locator('ul a[href^="/books/"]').first();
}

/** Has the page left the "html/body locked" state? */
export function lockState(page: Page): Promise<{ html: string; body: string; inert: boolean | null; overlayFlag: boolean }> {
  return page.evaluate(() => ({
    html: document.documentElement.style.overflow,
    body: document.body.style.overflow,
    inert: document.getElementById("app-root")?.hasAttribute("inert") ?? null,
    overlayFlag: document.documentElement.hasAttribute("data-overlay-open"),
  }));
}

export const UNLOCKED = { html: "", body: "", inert: false, overlayFlag: false } as const;

/**
 * Content that sits (partly) outside the screen — the thing `horizontalOverflow` cannot see when an ancestor
 * is `overflow: hidden`: the page does not scroll, the text is just cut off. Measures where visible text,
 * links, buttons and pictures inside <main> actually are, and ignores anything decorative (`aria-hidden`),
 * anything inside a real horizontal scroller (`overflow-x: auto | scroll` — a carousel, a tab strip) and
 * anything inside an element marked `data-scroller` (the animated marquee, which is `overflow: hidden` on purpose).
 */
export function clippedContent(page: Page, slack = 1): Promise<string[]> {
  return page.evaluate((slackPx) => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("main h1, main h2, main h3, main p, main li, main a, main button, main img, main dt, main dd"))) {
      const e = el as HTMLElement;
      if (e.closest("[aria-hidden='true'], [data-scroller]")) continue;
      let scrolled = false;
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll") {
          scrolled = true;
          break;
        }
      }
      if (scrolled) continue;
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(e);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
      if (r.right > vw + slackPx || r.left < -slackPx) out.push(`${e.tagName.toLowerCase()} "${(e.textContent || e.getAttribute("alt") || "").trim().slice(0, 40)}" spans ${Math.round(r.left)}–${Math.round(r.right)} of ${vw}`);
    }
    return out.slice(0, 8);
  }, slack);
}
