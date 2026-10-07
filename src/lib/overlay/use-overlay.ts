"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { RefObject } from "react";

import { isTopOverlay, overlayCount, registerOverlay, requestAppInert, subscribeOverlays } from "./overlay-stack";
import { lockScroll } from "./scroll-lock";

/** Elements a Tab press can land on. */
const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("inert") && el.getClientRects().length > 0,
  );
}

export interface UseOverlayOptions {
  /** Whether the overlay is open. Everything below is set up on open, undone on close. */
  open: boolean;
  /** Close it. Held by reference, so passing a fresh function each render is fine. */
  onClose: () => void;
  /** The overlay's panel: where focus goes, and what Tab is trapped inside. */
  panelRef: RefObject<HTMLElement | null>;
  /**
   * Make the rest of the app inert. True for portaled dialogs. FALSE for a sheet
   * that lives inside the app tree (inerting the app would inert the sheet).
   */
  inertBackground?: boolean;
  /**
   * Add a same-URL history entry so Android Back / browser Back closes the
   * overlay instead of leaving the page behind it. On by default.
   */
  history?: boolean;
  /**
   * Where focus goes when the overlay closes. Defaults to whatever was focused
   * when it opened — which a TAP does not set: touch browsers often do not focus
   * a button that was tapped, so `document.activeElement` is then `<body>`.
   * Pass the trigger's ref and it is focused regardless.
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * The behaviour every overlay in the app shares, separated from how it looks:
 *
 *   scroll lock (counted)  ·  Escape on the top overlay only  ·  focus moved in,
 *   trapped, and returned  ·  background inert  ·  Back closes it.
 *
 * `Dialog` is this plus a portal and a panel. A bespoke sheet that has to live
 * in the page's own DOM (the catalogue's filter sheet is the sidebar itself)
 * calls this directly with `inertBackground: false`.
 */
export function useOverlay({
  open,
  onClose,
  panelRef,
  inertBackground = true,
  history: useHistory = true,
  returnFocusRef,
}: UseOverlayOptions): void {
  // Held in a ref so a parent that passes `() => setX(null)` does not re-run the
  // effect on every render — which used to re-capture focus mid-interaction.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const releaseScroll = lockScroll();
    const releaseInert = inertBackground ? requestAppInert() : () => {};
    const { id, unregister } = registerOverlay(() => onCloseRef.current());

    // ---- focus: in on open, back to the trigger on close -------------------
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Captured now, not read in cleanup: by then the ref may point elsewhere.
    const returnTo = returnFocusRef?.current ?? null;
    const panel = panelRef.current;
    if (panel) {
      // The panel itself, not the first control: a long dialog should be read
      // from its top, and a first-control focus can scroll the panel.
      const target = panel.querySelector<HTMLElement>("[data-autofocus]") ?? panel;
      target.focus({ preventScroll: true });
    }

    // ---- keyboard: Escape closes the top overlay; Tab stays inside it ------
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopOverlay(id)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const items = focusablesIn(root);
      if (items.length === 0) {
        event.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!root.contains(active) || active === root) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    // ---- history: Back closes the overlay ----------------------------------
    //
    // A same-URL entry, pushed on a timer rather than synchronously. React
    // Strict Mode (and any fast open-then-close) runs this effect's cleanup
    // straight after setup; a synchronous push would be followed by an async
    // `history.back()` that lands AFTER the second push and pops the wrong
    // entry. Cancelling the timer in cleanup means a setup that is undone
    // immediately never touches history at all.
    let pushedId: string | null = null;
    let poppedByBack = false;
    let pushTimer: ReturnType<typeof setTimeout> | undefined;
    const onPopState = () => {
      if (pushedId !== null && window.history.state?.__vpOverlay !== pushedId) {
        poppedByBack = true;
        onCloseRef.current();
      }
    };
    if (useHistory) {
      pushTimer = setTimeout(() => {
        pushedId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        // Spread the existing state: Next.js keeps its own router state there.
        window.history.pushState({ ...(window.history.state ?? {}), __vpOverlay: pushedId }, "");
        window.addEventListener("popstate", onPopState);
      }, 0);
    }

    return () => {
      clearTimeout(pushTimer);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
      // Closed some way other than Back (Escape, the close button, a link inside
      // the overlay): take our own entry off the stack so Back is not "dead".
      // If a navigation already pushed a newer entry, ours is no longer on top
      // and is left alone.
      if (pushedId !== null && !poppedByBack && window.history.state?.__vpOverlay === pushedId) {
        window.history.back();
      }
      unregister();
      releaseInert();
      releaseScroll();
      const back = [returnTo, trigger].find((el) => el?.isConnected && el !== document.body);
      back?.focus({ preventScroll: true });
    };
    // The refs and the two booleans are stable for an overlay's life.
  }, [open, panelRef, inertBackground, useHistory, returnFocusRef]);
}

/**
 * True while any overlay is open. For floating UI that should stand aside, and
 * for timer-driven popups that must not open on top of something the reader is
 * already doing.
 */
export function useOverlayOpen(): boolean {
  return useSyncExternalStore(
    subscribeOverlays,
    () => overlayCount() > 0,
    () => false,
  );
}
