"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { ActiveNavSection } from "@/components/home/cinematic-header";
import { useOverlay } from "@/lib/overlay/use-overlay";

/**
 * <MobileNav> — the phone-width navigation for the cinematic header.
 *
 * WHY THIS EXISTS
 * The header's primary nav was `hidden … md:flex` (Phase 9 moved it to
 * `lg:flex`), and no drawer, hamburger or overflow menu existed anywhere in
 * the codebase. Below 768px that left four controls — wordmark, search,
 * cart, account — and **no browse destination at all**: All books, Ebooks,
 * Authors, Categories, Blog and About were unreachable from the header on a
 * phone. Measured on the Redmi at 392px:
 * `headerLinks: ["/", "/search", "/cart", "/account/library"]`,
 * `hasMenuButton: false`. That was the roadmap's only P0.
 *
 * SCOPE
 * Strictly `lg:hidden`. At 1024px and above the existing horizontal nav remains
 * the authority and this component renders nothing — the desktop composition is
 * untouched by design, not by luck.
 *
 * The boundary was `md:` (768px) until Phase 9 measured the band it covers.
 * The desktop header needs 987px; between 768 and 1023 it appeared, did not
 * fit, and pushed every route 219px wider than the viewport. The drawer now
 * carries navigation up to 1023px.
 *
 * ACCESSIBILITY CONTRACT
 *   - trigger is >= 44x44 CSS px, labelled, with aria-expanded/aria-controls
 *   - panel is role="dialog" aria-modal, labelled by its own heading
 *   - focus moves into the panel on open and returns to the trigger on close
 *   - Tab and Shift+Tab are trapped inside the panel
 *   - Escape closes; so does a backdrop tap; so does navigating
 *   - the page behind cannot scroll while the panel is open
 *   - aria-current="page" marks the active destination
 *   - honours prefers-reduced-motion (no slide, no fade)
 *
 * A hand-rolled dialog rather than <dialog>: the focus and scroll behaviour is
 * fully under our control and verifiable on the one device we actually have.
 * There is no iOS device in this project's matrix, so relying on <dialog>'s
 * platform behaviour would be an untested assumption.
 *
 * THE OVERLAY IS PORTALLED TO <body>, AND MUST STAY THAT WAY.
 * The header carries `backdrop-blur-xl`. A `backdrop-filter` establishes a
 * containing block for `position: fixed` descendants, so an overlay rendered
 * inside the header is positioned and sized against the 64px header rather
 * than the viewport. Measured on the Redmi before the portal: the panel came
 * out 338x64 at the header's origin, and `elementFromPoint` over every drawer
 * link returned the hero text behind it — the drawer looked right in a DOM
 * dump and was completely untappable. Only the real-device interaction test
 * caught it.
 */

type NavEntry = { key: ActiveNavSection; label: string; href: string; prefetch?: false };

export function MobileNav({
  items,
  active,
}: {
  items: readonly NavEntry[];
  active?: ActiveNavSection;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  const close = useCallback(() => setOpen(false), []);

  // Close on navigation. The header persists across route changes, so without
  // this the panel would still be open on the page the reader just chose —
  // including on a browser back/forward, which no onClick would catch.
  // Adjusting state during render (React's documented pattern) rather than in
  // an effect: it closes a frame earlier and avoids setState-in-effect.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    if (open) setOpen(false);
  }

  // Scroll lock, focus in / trap / return, Escape (top overlay only) and
  // Android Back all come from the shared overlay hook — the same one the
  // `Dialog` uses — instead of a private copy of each.
  //
  // What this component learned first and the hook now encodes for everyone:
  // `overflow: hidden` on <body> alone is not enough, because `html` carries
  // `h-full` and IS the scrolling element (measured on the Redmi:
  // window.scrollBy(0,400) moved the page from 0 to 400 with body locked), so
  // html is locked too; and `position: fixed` on body is avoided because it
  // jumps the reader's scroll position to the top.
  //
  // `returnFocusRef`: a tap often does not focus the hamburger, so
  // `document.activeElement` at open time is <body> and "return to where you
  // were" would return nowhere.
  useOverlay({ open, onClose: close, panelRef, returnFocusRef: triggerRef });

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-haspopup="dialog"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-fg-mid transition-colors hover:text-fg-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/60"
      >
        <Menu aria-hidden className="h-5 w-5" />
      </button>

      {/* `open` can only become true from a click, i.e. after hydration, so the
          portal never renders during SSR and there is no hydration mismatch. */}
      {open && createPortal(
        <>
          {/* Backdrop. Sits above the sticky header (z-50) so nothing behind
              the panel is reachable by touch. */}
          <div
            aria-hidden
            onClick={close}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          />

          <div
            ref={panelRef}
            id="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-nav-heading"
            className="fixed inset-y-0 right-0 z-[70] flex w-[86%] max-w-sm flex-col border-l border-white/[0.08] bg-[#0a1410] shadow-[0_0_60px_-10px_rgba(0,0,0,0.9)] motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-300"
            style={{
              // Phase 2 turned on `viewport-fit=cover`, so these are live.
              // The panel is flush to the right edge, hence the right inset;
              // the bottom one clears the gesture bar.
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
              paddingRight: "env(safe-area-inset-right)",
            }}
          >
            {/* Emerald hairline, matching the house card treatment */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#33f0aa]/40 to-transparent"
            />

            <div className="flex h-16 shrink-0 items-center justify-between px-5">
              <h2
                id="mobile-nav-heading"
                className="font-serif text-[15px] font-medium text-fg-hi"
              >
                Browse
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-fg-mid transition-colors hover:text-fg-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/60"
              >
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>

            <nav
              aria-label="Primary"
              className="flex-1 overflow-y-auto overscroll-contain px-3 pb-6"
            >
              <ul className="flex flex-col gap-1">
                {items.map((item) => {
                  const isActive = item.key === active;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        prefetch={item.prefetch}
                        aria-current={isActive ? "page" : undefined}
                        /* Deliberately NO onClick={close} here. Next's <Link>
                           runs the caller's onClick first and navigates after;
                           closing mid-handler unmounts the anchor and the
                           navigation was measured to be lost (tap landed, panel
                           closed, route never changed). The pathname-change
                           check above closes the drawer on arrival instead. */
                        className={`relative flex min-h-12 items-center rounded-xl px-4 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/60 ${
                          isActive
                            ? "bg-white/[0.05] text-fg-hi"
                            : "text-fg-mid hover:bg-white/[0.03] hover:text-fg-hi"
                        }`}
                      >
                        {isActive && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-[#33f0aa] shadow-[0_0_10px_#33f0aa]"
                          />
                        )}
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
