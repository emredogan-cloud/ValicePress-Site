"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { createPortal } from "react-dom";

import { OVERLAY_ROOT_ID } from "@/lib/overlay/overlay-stack";
import { useOverlay } from "@/lib/overlay/use-overlay";

/**
 * The dialog every modal in the app is built on.
 *
 * WHAT WENT WRONG BEFORE THIS EXISTED
 * Nine hand-rolled overlays, no shared parts. The quick view was a CSS grid with
 * `overflow: hidden` and only a `max-height`: on a phone its two rows did not
 * fit, nothing inside could scroll, the Buy button and the Close button sat in
 * the clipped second row, and the page behind it was locked. The reader could
 * neither act nor leave. The fix is structural, so it lives here once:
 *
 *   PANEL    a flex column no taller than the DYNAMIC viewport (`dvh`, so the
 *            phone's collapsing address bar cannot hide the bottom edge).
 *   BODY     the ONE scroller (`min-height: 0` is what lets a flex child shrink
 *            and scroll instead of overflowing); `overscroll-behavior: contain`
 *            so the end of the dialog does not scroll the page behind it.
 *   FOOTER   never scrolls away, so the primary action is always reachable.
 *   CLOSE    a 44px target, in a part of the panel that cannot be clipped.
 *
 * AND ITS BEHAVIOUR (`useOverlay`): counted scroll lock, Escape on the top
 * overlay only, focus moved in / trapped / returned, the app inert behind it,
 * and Android Back closes it instead of leaving the page.
 *
 * It is portaled into `#overlay-root`, a sibling of the app root, so no
 * ancestor's stacking context (the header's z-50, the cinematic root's
 * `isolation`) can paint over it.
 *
 *   <Dialog open={open} onOpenChange={setOpen} labelledBy="t" size="lg">
 *     <DialogBody> … <h2 id="t">Title</h2> … </DialogBody>
 *     <DialogFooter> … primary action … </DialogFooter>
 *   </Dialog>
 */

const SIZE = {
  sm: "sm:max-w-[420px]",
  md: "sm:max-w-[560px]",
  lg: "sm:max-w-[760px]",
  xl: "sm:max-w-[1020px]",
} as const;

interface DialogContextValue {
  close: () => void;
}
const DialogContext = createContext<DialogContextValue | null>(null);

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `id` of the heading that names the dialog. Prefer this over `label`. */
  labelledBy?: string;
  /** Accessible name when there is no visible heading. */
  label?: string;
  /** `id` of the element that describes the dialog (its lede), if any. */
  describedBy?: string;
  size?: keyof typeof SIZE;
  /** Extra classes for the panel (background, border, rounding overrides). */
  panelClassName?: string;
  /** Close when the dimmed area outside the panel is clicked. Default true. */
  dismissOnBackdrop?: boolean;
  /** Same-URL history entry so Back closes it. Default true. */
  history?: boolean;
  children: ReactNode;
}

const subscribeNever = () => () => {};

export function Dialog(props: DialogProps) {
  // `document` does not exist while rendering on the server or while hydrating;
  // a dialog is only ever opened by an interaction or an effect, so rendering
  // nothing until the client has mounted is exact, not a workaround.
  const isClient = useSyncExternalStore(subscribeNever, () => true, () => false);
  if (!props.open || !isClient) return null;
  const root = document.getElementById(OVERLAY_ROOT_ID) ?? document.body;
  return createPortal(<DialogSurface {...props} />, root);
}

function DialogSurface({
  onOpenChange,
  labelledBy,
  label,
  describedBy,
  size = "lg",
  panelClassName = "",
  dismissOnBackdrop = true,
  history = true,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pressStartedOnBackdrop = useRef(false);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useOverlay({ open: true, onClose: close, panelRef, history });

  return (
    <div
      className="vp-dialog-root"
      // A drag that starts inside the panel (selecting text) and ends on the
      // backdrop must not close it: only a press that BEGAN on the backdrop.
      onPointerDown={(e) => {
        pressStartedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (dismissOnBackdrop && pressStartedOnBackdrop.current && e.target === e.currentTarget) close();
        pressStartedOnBackdrop.current = false;
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        aria-describedby={describedBy}
        tabIndex={-1}
        data-vp-dialog=""
        className={`vp-dialog-panel valice-glass ${SIZE[size]} ${panelClassName}`}
      >
        <DialogContext.Provider value={{ close }}>{children}</DialogContext.Provider>
      </div>
    </div>
  );
}

/** The one scroll container. Everything that can be long goes in here. */
export function DialogBody({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`vp-dialog-body ${className}`}>{children}</div>;
}

/** Pinned to the bottom of the panel; never scrolls away. Carries the safe-area inset. */
export function DialogFooter({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`vp-dialog-footer ${className}`}>{children}</div>;
}

/** A 44×44 close control wired to the dialog it sits in. */
export function DialogClose({
  className = "",
  "aria-label": ariaLabel = "Close",
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">) {
  const ctx = useContext(DialogContext);
  return (
    <button
      type="button"
      onClick={ctx?.close}
      aria-label={ariaLabel}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-soft transition-colors hover:bg-white/[0.07] hover:text-fg-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-bright ${className}`}
      {...rest}
    >
      <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.6} />
    </button>
  );
}

/** For content that needs to close the dialog itself (e.g. after a successful submit). */
export function useDialogClose(): () => void {
  const ctx = useContext(DialogContext);
  return ctx?.close ?? (() => {});
}
