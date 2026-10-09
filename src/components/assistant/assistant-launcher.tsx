"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The concierge's front door.
 *
 * WHY THIS FILE IS SO SMALL
 * It is the only part of the assistant that every visitor downloads. A chat
 * panel — streaming reader, transcript, autosizing textarea, the lot — has no
 * business in the bundle of someone who came to read about a book on mythology
 * and will never press it. So this ships a button and a `dynamic()` boundary;
 * the panel's chunk is fetched on the first click and never before. The brief
 * asked that the assistant "must not degrade page performance", and the only
 * honest way to satisfy that is not to be there until wanted.
 *
 * WHERE IT DOES NOT APPEAR
 *   - `/admin`: an operator's queue is not a storefront.
 *   - `/read`: the reader is a book, full-bleed, and a floating button over
 *     someone's page is exactly the thing that makes a web reader feel cheap.
 *   - `/order`: a receipt is not the moment for a chat bubble.
 * Everywhere else — home, shelves, product pages, categories, companions,
 * blog, cart, search — it is present, which is what "every public page" means.
 */

const AssistantPanel = dynamic(
  () => import("./assistant-panel").then((m) => m.AssistantPanel),
  {
    ssr: false,
    // No skeleton. The button stays put and the panel appears when its chunk
    // lands — a flashed placeholder for a ~200ms fetch is more distracting
    // than the wait it is trying to cover.
    loading: () => null,
  },
);

const HIDDEN_PREFIXES = ["/admin", "/read", "/order"];

export function AssistantLauncher() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  /**
   * Once true, stays true: the panel is unmounted on close but its chunk is
   * already downloaded, so reopening is instant. Keeping it mounted-but-hidden
   * instead would leave a live stream and a focus target behind a closed door.
   */
  const [everOpened, setEverOpened] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  /**
   * On a phone, out of the way while the page is being read.
   *
   * A 56px round button fixed to the bottom-right corner sits over the right-hand end of whatever line is
   * scrolling past — on the Redmi it covered words of a book's blurb and the end of a subtitle on the first
   * screen. Scrolling DOWN slides it off the right edge; scrolling UP (or being near the top) brings it back,
   * and keyboard focus always does. Below `md` only: with a mouse the corner is not where a thumb rests.
   * It is moved, not removed — it stays in the accessibility tree and in the tab order.
   */
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let run = 0; // pixels scrolled in the current direction
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const dy = y - lastY;
        lastY = y;
        if (y < 160) {
          run = 0;
          setTucked(false);
          return;
        }
        run = Math.sign(dy) === Math.sign(run) ? run + dy : dy;
        if (run > 48) setTucked(true);
        else if (run < -32) setTucked(false);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const hidden = HIDDEN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  /**
   * Closing always hands focus back to the button that opened it.
   *
   * Without this, dismissing the panel drops the keyboard user at the top of
   * the document and they have to tab through the whole page to get back to
   * where they were. It is the same courtesy the gift modal owes, for the same
   * reason.
   */
  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  /**
   * A route change closes it.
   *
   * The panel's answers are about the page they were asked from; carrying a
   * conversation about one book onto another book's page reads as a bug even
   * when the transcript is intact.
   *
   * Done by comparing the previous path during render — React's own recipe for
   * resetting state when a prop changes — rather than in an effect. An effect
   * would close it one paint *after* the new page appeared, and React 19's
   * lint rejects the cascading render besides.
   */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  if (hidden) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setEverOpened(true);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? "Close the reading assistant" : "Ask about our books"}
        className={`assistant-launcher fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border shadow-2xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b266]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1410] print:hidden sm:bottom-6 sm:right-6 ${tucked && !open ? "max-md:pointer-events-none max-md:translate-x-[calc(100%+1.5rem)] max-md:opacity-0 max-md:focus-visible:pointer-events-auto max-md:focus-visible:translate-x-0 max-md:focus-visible:opacity-100" : ""}`}
        style={{
          borderColor: "rgba(214,178,102,0.45)",
          background:
            "linear-gradient(140deg, rgba(24,34,27,0.97) 0%, rgba(10,20,16,0.98) 70%)",
          color: "#e2c074",
        }}
      >
        {open ? <CloseGlyph /> : <ConciergeGlyph />}
      </button>

      {everOpened && open && <AssistantPanel pathname={pathname} onClose={close} />}
    </>
  );
}

/**
 * An open book with a question mark rising off it.
 *
 * Not a speech bubble: every chat widget on the internet is a speech bubble,
 * and this one should read as "ask the bookseller", not "we have a support
 * ticket system". Drawn on the same 24-unit grid and stroke weight as
 * `GiftGlyph` so the two controls in this corner look like siblings.
 */
function ConciergeGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6.2c2.6-1.1 5.1-1.1 7.6 0v11.6c-2.5-1.1-5-1.1-7.6 0V6.2Z" />
        <path d="M21 6.2c-2.6-1.1-5.1-1.1-7.6 0v11.6c2.5-1.1 5-1.1 7.6 0V6.2Z" />
        <path d="M10.9 4.9c.1-1 .9-1.7 1.9-1.6.9 0 1.6.8 1.5 1.7-.1 1.1-1.5 1.2-1.6 2.2" opacity=".95" />
        <circle cx="12.6" cy="9.3" r=".55" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden focusable="false">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
