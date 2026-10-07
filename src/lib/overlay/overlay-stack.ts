/**
 * Which overlays are open, in the order they opened.
 *
 * Three things need to know, and none of them should have to ask each overlay:
 *
 *   - Escape closes the TOPMOST overlay only. Four copies of a document-level
 *     keydown handler used to close every open overlay at once, which is how a
 *     lock got left behind (see `scroll-lock.ts`).
 *   - The app behind a modal is made `inert` (unfocusable, unclickable, hidden
 *     from assistive technology) for as long as ANY modal is open, not just the
 *     latest one.
 *   - Floating UI (the assistant launcher, the campaign ribbon, timer-driven
 *     popups) needs to know a modal is open so it can stay out of the way. The
 *     count is published as `data-overlay-open` on <html> for CSS, and as an
 *     external store for React.
 *
 * Plain module state: there is one page and one stack. Everything here is a
 * no-op on the server.
 */

interface Entry {
  readonly id: symbol;
  readonly close: () => void;
}

const stack: Entry[] = [];
const listeners = new Set<() => void>();
let inertHolders = 0;

/** The element whose subtree is made inert behind a modal (see `app/layout.tsx`). */
export const APP_ROOT_ID = "app-root";
/** The element dialogs are portaled into, outside the app root (see `app/layout.tsx`). */
export const OVERLAY_ROOT_ID = "overlay-root";

function publish(): void {
  if (typeof document !== "undefined") {
    document.documentElement.toggleAttribute("data-overlay-open", stack.length > 0);
  }
  listeners.forEach((notify) => notify());
}

/** Register an open overlay. Returns the function that removes it. */
export function registerOverlay(close: () => void): { id: symbol; unregister: () => void } {
  const entry: Entry = { id: Symbol("overlay"), close };
  stack.push(entry);
  publish();
  return {
    id: entry.id,
    unregister: () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      publish();
    },
  };
}

/** True when `id` is the overlay opened most recently and still open. */
export function isTopOverlay(id: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1].id === id;
}

/** How many overlays are open right now. */
export function overlayCount(): number {
  return stack.length;
}

/** `useSyncExternalStore` plumbing — see `useOverlayOpen`. */
export function subscribeOverlays(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/**
 * Make everything outside the portal root inert until the returned function is
 * called. Counted, so two modals do not un-inert the app when the first closes.
 */
export function requestAppInert(): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.getElementById(APP_ROOT_ID);
  inertHolders += 1;
  root?.toggleAttribute("inert", true);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    inertHolders = Math.max(0, inertHolders - 1);
    if (inertHolders === 0) document.getElementById(APP_ROOT_ID)?.toggleAttribute("inert", false);
  };
}
