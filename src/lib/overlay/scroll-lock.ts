/**
 * The one place the page is allowed to stop scrolling.
 *
 * WHY THIS IS A MODULE AND NOT FIVE `body.style.overflow = "hidden"`s.
 * Five components each wrote the page's overflow on open and wrote back what
 * they had read on close. That is correct for exactly one overlay at a time and
 * wrong for two: open A (reads ""), open B (reads "hidden"), close A (writes
 * ""), close B (writes "hidden") — the page is now locked with nothing open and
 * nothing can unlock it. A phone with a stuck lock is a page that cannot be
 * scrolled until it is reloaded, which is the "tap a book and the site freezes"
 * report this module exists to end.
 *
 * So the lock is a COUNT of holders, not a pair of saved strings:
 *   - the FIRST holder records the page's own inline values and locks;
 *   - the LAST holder to let go restores exactly those values;
 *   - releases may arrive in any order (not just last-in-first-out), and a
 *     holder may release twice without releasing somebody else's hold.
 *
 * `overflow: hidden` on BOTH html and body is deliberate. Which of the two the
 * browser propagates to the viewport depends on the other's value, and on
 * Android Chrome with this app's `html.h-full` / `body.min-h-full` setting only
 * body is not enough to stop touch scrolling reliably; the mobile nav drawer
 * found that out first (see `mobile-nav.tsx`).
 *
 * On a desktop with a classic scrollbar, hiding overflow removes the scrollbar
 * and the whole page jumps sideways by its width. The scrollbar's width is added
 * to body's right padding for the duration, so nothing moves.
 *
 * Nothing here touches `position: fixed` or the scroll offset: the document's
 * scroll position survives `overflow: hidden` untouched, so there is nothing to
 * save or put back except in the bfcache case handled by `pageshow` below.
 */

interface Snapshot {
  htmlOverflow: string;
  bodyOverflow: string;
  htmlOverscroll: string;
  bodyPaddingRight: string;
  scrollY: number;
}

const holders = new Set<symbol>();
let snapshot: Snapshot | null = null;

function lock(): void {
  const html = document.documentElement;
  const { body } = document;

  snapshot = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    htmlOverscroll: html.style.overscrollBehavior,
    bodyPaddingRight: body.style.paddingRight,
    scrollY: window.scrollY,
  };

  // Only meaningful where the browser lays out a scrollbar (not on a phone, and
  // not in jsdom where `clientWidth` is 0). Measured BEFORE overflow is hidden.
  const scrollbar = html.clientWidth > 0 ? window.innerWidth - html.clientWidth : 0;

  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  html.style.overscrollBehavior = "none";
  if (scrollbar > 0) {
    const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${current + scrollbar}px`;
  }
}

function unlock(): void {
  if (!snapshot) return;
  const html = document.documentElement;
  const { body } = document;

  html.style.overflow = snapshot.htmlOverflow;
  body.style.overflow = snapshot.bodyOverflow;
  html.style.overscrollBehavior = snapshot.htmlOverscroll;
  body.style.paddingRight = snapshot.bodyPaddingRight;

  // Defensive: if something moved the document while it was locked, put the
  // reader back where they were. Normally a no-op.
  if (Math.abs(window.scrollY - snapshot.scrollY) > 1) {
    window.scrollTo(0, snapshot.scrollY);
  }
  snapshot = null;
}

/**
 * Stop the page scrolling until the returned function is called.
 *
 * Call it from an effect and return the release as the effect's cleanup:
 *
 *     useEffect(() => (open ? lockScroll() : undefined), [open]);
 *
 * Safe to call from several overlays at once; safe to release more than once;
 * a no-op on the server.
 */
export function lockScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  const token = Symbol("scroll-lock");
  holders.add(token);
  if (holders.size === 1) lock();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders.delete(token);
    if (holders.size === 0) unlock();
  };
}

/** True while at least one holder is keeping the page from scrolling. */
export function isScrollLocked(): boolean {
  return holders.size > 0;
}

/**
 * Coming back from the back/forward cache restores the DOM as it was frozen —
 * including a lock whose owner no longer exists. If the page is revived with no
 * holders but our inline styles still on it, put the page back.
 */
if (typeof window !== "undefined") {
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && holders.size === 0 && snapshot) unlock();
  });
}
