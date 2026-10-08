"use client";

import { Info, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";

import { trackEvent } from "@/lib/analytics";
import {
  newsletterErrorMessage,
  subscribeToNewsletter,
  type NewsletterErrorCode,
} from "@/lib/newsletter-client";

/**
 * Editorial sidebar — two stacked glass cards:
 *
 *   1. **About this category** — short description + 5 topic pills
 *      (real popular topics for the active category, hand-curated below)
 *   2. **Newsletter** — "Get new guides in your inbox" + form
 *
 * Per the brief: cards are companion UI, not utility panels. Glass +
 * subtle emerald glow + hover lift on pills.
 *
 * Client Component because the newsletter form holds local state.
 *
 * ⚠ This form used to `setStatus("ok")` and subscribe nobody — it told
 * the reader "you'll hear from us soon" and then threw the address away.
 * The other three cinematic forms were wired to `/api/newsletter` in
 * Phase 2.A; this one was left behind with a TODO, so the lie the route's
 * own header says was ended survived here. It is wired now, and it is
 * tagged `category` so one master list stays segmentable.
 */

const TOPICS_BY_CATEGORY: Record<string, string[]> = {
  "reading-guides": [
    "Choosing Books",
    "Reading Habits",
    "Mindset",
    "Focus",
    "Book Lists",
  ],
  "behind-the-scenes": [
    "Architecture",
    "Trade-offs",
    "Editorial Voice",
    "Typography",
    "Process Notes",
  ],
};

const ABOUT_BY_CATEGORY: Record<string, string> = {
  "reading-guides":
    "Reading Guides are here to help you make better reading decisions and get more out of every book.",
  "behind-the-scenes":
    "Behind the Scenes posts walk through the architectural and editorial choices behind this storefront.",
};

const DEFAULT_TOPICS = ["Featured", "Editorial", "Notes", "Lists", "Essays"];
const DEFAULT_ABOUT =
  "Curated essays and field notes from the Valice Press editorial desk.";

export function CategorySidebar({
  categorySlug,
}: {
  categorySlug: string;
}) {
  const topics = TOPICS_BY_CATEGORY[categorySlug] ?? DEFAULT_TOPICS;
  const about = ABOUT_BY_CATEGORY[categorySlug] ?? DEFAULT_ABOUT;

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "ok" }
    | { state: "error"; code: NewsletterErrorCode }
  >({ state: "idle" });

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus({ state: "loading" });
    const result = await subscribeToNewsletter(trimmed, "category");
    if (result.ok) {
      trackEvent("newsletter_signup");
      setStatus({ state: "ok" });
    } else {
      setStatus({ state: "error", code: result.code });
    }
  };

  return (
    <aside className="space-y-5">
      {/* About this category */}
      <div className="home-glass relative overflow-hidden rounded-[24px] p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#33f0aa]/35 to-transparent"
        />
        <header className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#16c784]/30 bg-[#16c784]/10 text-[#33f0aa] shadow-[0_0_10px_-2px_rgba(51,240,170,0.4)]">
            <Info aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
          <h2 className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.18em] text-[#88918a]">
            About this category
          </h2>
        </header>

        <p className="mt-4 text-sm leading-relaxed text-[#a7a7a0]">{about}</p>

        <p className="mt-6 text-[12px] lg:text-[10px] font-semibold uppercase tracking-[0.18em] text-[#88918a]">
          Popular topics
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {topics.map((topic) => (
            <li key={topic}>
              <button
                type="button"
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-[#a7a7a0] transition-all hover:-translate-y-0.5 hover:border-[#33f0aa]/30 hover:bg-[#33f0aa]/8 hover:text-[#e6e6e0] hover:shadow-[0_8px_18px_-6px_rgba(51,240,170,0.3)]"
              >
                {topic}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Newsletter */}
      <div className="home-glass relative overflow-hidden rounded-[24px] p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#33f0aa]/35 to-transparent"
        />
        <header className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#16c784]/30 bg-[#16c784]/10 text-[#33f0aa] shadow-[0_0_10px_-2px_rgba(51,240,170,0.4)]">
            <Mail aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <h2 className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.18em] text-[#88918a]">
            Newsletter
          </h2>
        </header>

        <p className="mt-4 font-serif text-[18px] font-medium leading-tight text-[#e6e6e0]">
          Get new guides in your inbox
        </p>
        <p className="mt-2 text-xs leading-relaxed text-[#88918a]">
          Subscribe to follow our reading guides and book recommendations.
        </p>

        {status.state === "ok" ? (
          <p
            role="status"
            className="mt-5 inline-block rounded-full border border-[#33f0aa]/30 bg-[#33f0aa]/10 px-4 py-2 text-xs text-[#33f0aa]"
          >
            Thanks — you&apos;ll hear from us soon.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-2.5">
            <label htmlFor="category-newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="category-newsletter-email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              className="h-10 w-full rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-xs text-[#e6e6e0] placeholder:text-[#5d675f] focus:border-[#33f0aa]/40 focus:outline-none focus:ring-2 focus:ring-[#33f0aa]/20"
            />
            <button
              type="submit"
              disabled={status.state === "loading"}
              className="home-cta-primary inline-flex h-10 w-full items-center justify-center rounded-full text-xs font-semibold tracking-tight disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status.state === "loading" ? "Subscribing…" : "Subscribe"}
            </button>
            {status.state === "error" ? (
              <p role="alert" className="text-xs leading-relaxed text-[#f0a3a3]">
                {newsletterErrorMessage(status.code)}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </aside>
  );
}
