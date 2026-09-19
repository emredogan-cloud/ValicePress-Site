"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { GiftGlyph } from "./gift-box";
import { useCampaign, useHydrated, usePrefersReducedMotion } from "./use-campaign";

/**
 * The first-visit promotional card.
 *
 * A single, quiet introduction to the promotion for someone who has just
 * arrived: bottom-right, one sentence, one link, a close button, and then it
 * leaves on its own after a few seconds and does not come back.
 *
 * THE RULE IT IS BUILT AROUND: DO NOT ANNOY THE SECOND VISIT.
 * A floating advert that reappears on every pageview is the thing everyone
 * hates about promotional bars, and the brief says so explicitly. So the card
 * marks itself seen the moment it is shown — not when it is dismissed — and
 * that mark is keyed to the campaign's end timestamp, so it expires with the
 * promotion it advertises and the next campaign starts clean without anyone
 * having to remember to clear a key.
 *
 * WHERE IT DOES NOT GO
 *   - `/books` and `/ebooks`: a visitor there is already looking at the full
 *     countdown banner and a gold FREE box on every card. A card repeating it
 *     is noise, not information.
 *   - `/admin`, `/cart`, `/order`, `/read`, `/account`: an advert over
 *     somebody's payment, their book or an operator's queue is simply rude.
 *
 * IT IS NOT A DIALOG. It never takes focus, never traps it, and never covers
 * navigation — it is announced politely to assistive tech and otherwise stays
 * out of the way. Focus-trapping something a visitor did not ask for would be
 * a worse bug than the one this session was opened to fix.
 */

const SEEN_KEY = "valice.campaign.promo.seen";

/** How long the card stays before retiring itself. */
const AUTO_CLOSE_MS = 3800;

const SILENT_PREFIXES = ["/admin", "/cart", "/order", "/read", "/account"];

function isSilent(pathname: string): boolean {
  if (pathname === "/books" || pathname === "/ebooks") return true;
  return SILENT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * "Has this browser already been shown the card for this campaign?"
 *
 * An external store rather than `useState` + an effect: `localStorage` does not
 * exist on the server and reading it into state inside an effect is the
 * cascading-render pattern React 19 warns about. The server snapshot is the
 * campaign key, i.e. "already seen", so nothing is ever server-rendered and
 * there is no flash of an advert before we know whether to show it.
 */
let cached: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function readSeen(): string | null {
  if (!loaded) {
    try {
      cached = window.localStorage.getItem(SEEN_KEY);
    } catch {
      // Private mode or blocked storage. Treated as "already seen": the cost
      // of a missed advert is nothing; the cost of one that returns on every
      // single pageview forever is a visitor who leaves.
      cached = "blocked";
    }
    loaded = true;
  }
  return cached;
}

function subscribeSeen(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function markSeen(value: string): void {
  cached = value;
  loaded = true;
  try {
    window.localStorage.setItem(SEEN_KEY, value);
  } catch {
    // Nothing to do — the in-memory cache still suppresses it for this page.
  }
  for (const l of listeners) l();
}

export function WelcomePromoCard() {
  const pathname = usePathname() ?? "/";
  const { ready, open, endsAtMs } = useCampaign();
  const reduced = usePrefersReducedMotion();
  const hydrated = useHydrated();
  const seen = useSyncExternalStore(subscribeSeen, readSeen, () => "ssr");

  const campaignKey = String(endsAtMs);
  const alreadySeen = seen === campaignKey || seen === "blocked" || seen === "ssr";
  const eligible = hydrated && ready && open && !isSilent(pathname) && !alreadySeen;

  /**
   * THE DECISION LATCHES. It is not re-derived once made.
   *
   * Without this the card destroys itself the instant it appears: the effect
   * below writes the "seen" mark, that updates the external store, `seen`
   * becomes the campaign key, `alreadySeen` flips true — and the card
   * disappears in the same tick it was shown. Observed exactly that: the
   * localStorage key was set and no card was ever on screen.
   *
   * Set during render rather than in an effect, which is the pattern React
   * sanctions for adjusting state from a value that changed; the `!shown`
   * guard makes it converge in one extra render and never loop.
   */
  const [shown, setShown] = useState(false);
  if (eligible && !shown) setShown(true);

  // `leaving` drives the exit transition; `gone` unmounts. Two states rather
  // than one so the card fades out instead of vanishing mid-read.
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!shown) return;
    // Marked seen on DISPLAY, not on dismissal. Someone who navigates away
    // after two seconds has still been shown it, and showing it again on the
    // next page would be exactly the nagging this is meant to avoid.
    markSeen(campaignKey);
    const t = window.setTimeout(() => setLeaving(true), AUTO_CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [shown, campaignKey]);

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setGone(true), reduced ? 0 : 260);
    return () => window.clearTimeout(t);
  }, [leaving, reduced]);

  if (!shown || gone) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-40 max-w-[calc(100vw-2rem)] print:hidden sm:bottom-6 sm:right-6"
      // Bottom-right, and deliberately clear of the AI assistant launcher,
      // which sits in the same corner: the launcher reserves the lowest
      // ~64px, so this rides above it rather than on top of it.
      style={{ marginBottom: "var(--valice-corner-stack, 0px)" }}
    >
      <div
        role="status"
        aria-live="polite"
        className={[
          "valice-glass pointer-events-auto flex w-[19rem] max-w-full items-start gap-3 rounded-2xl border p-4 shadow-2xl",
          reduced ? "" : leaving ? "promo-card-out" : "promo-card-in",
        ].join(" ")}
        style={{
          borderColor: "rgba(214,178,102,0.34)",
          background:
            "linear-gradient(150deg, rgba(24,34,27,0.94) 0%, rgba(12,24,19,0.96) 70%)",
        }}
      >
        <span
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{
            background:
              "linear-gradient(140deg, rgba(247,222,160,0.95) 0%, rgba(214,178,102,0.95) 100%)",
            color: "#2a1f06",
          }}
        >
          <GiftGlyph className="h-4.5 w-4.5" />
        </span>

        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.26em]"
            style={{ color: "#d6b266" }}
          >
            Welcome to Valice Press
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-mid">
            Every ebook is free to request for a limited time.
          </p>
          <Link
            href="/ebooks"
            onClick={() => setLeaving(true)}
            className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-semibold transition-colors hover:text-[#f0dfae] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b266]/60"
            style={{ color: "#e2c074" }}
          >
            Browse the free ebooks
            <span aria-hidden>→</span>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setLeaving(true)}
          aria-label="Dismiss the welcome offer"
          className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-fg-soft transition-colors hover:bg-white/5 hover:text-fg-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b266]/60"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
