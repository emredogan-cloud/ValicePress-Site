/**
 * The free-ebook campaign — one clock, one state machine, one place.
 *
 * WHY THIS FILE EXISTS AT ALL
 * The brief asked for a countdown on `/`, `/books` and `/ebooks`. Three
 * countdowns is three chances to disagree: a promotion that says "4 hours
 * left" on the home page and "6 hours left" on the shelf is not a promotion,
 * it is a bug a visitor can see. So the end timestamp is defined once, here,
 * and every surface — the banners, the gift boxes, the modal, the API that
 * accepts requests — asks this module rather than holding its own copy.
 *
 * WHY THE SERVER CLOCK IS THE ONLY CLOCK
 * `Date.now()` in a browser is the *visitor's* clock. It can be wrong by
 * hours, it can be deliberately wrong, and it is in whatever timezone the
 * device is set to. A campaign that ends "at midnight" on the client ends at
 * twenty-four different moments. Everything here works in absolute epoch
 * milliseconds, and the client is handed the server's `now` (see
 * `/api/campaign`) so it can compute an offset and tick locally without ever
 * trusting its own wall clock.
 *
 * WHY THE API MUST RE-CHECK
 * `/books` and `/ebooks` are `revalidate = 3600`. A page rendered while the
 * campaign was live can therefore still be in a CDN cache an hour after it
 * ended, gift boxes and all. Two consequences, both deliberate:
 *
 *   1. The countdown component re-checks against the server on mount and
 *      removes itself when the campaign is over, so a stale page corrects
 *      itself in the visitor's browser rather than waiting for revalidation.
 *   2. `POST /api/free-book` calls `campaignState()` itself and refuses once
 *      the window has closed. The UI is a convenience; the gate is the API.
 *      A cached page must never be able to buy someone a free book after the
 *      promotion ends.
 */

/**
 * Start and end of the promotion, in absolute UTC.
 *
 * Overridable by environment so the Founder can extend or cut the window
 * without a deploy, and so the QA pass can point the whole system at a
 * timestamp two minutes away and watch it expire for real (brief TEST 22).
 * `NEXT_PUBLIC_` because the countdown is a client component and needs the
 * same constant the server used.
 *
 * An unparseable value falls back to the constant rather than throwing:
 * a typo in an env var should not take the storefront down, and the
 * fallback is a *closed* window as soon as its date passes, never an
 * open-ended one.
 */
/**
 * THE REAL WINDOW, AS IT WAS ACTUALLY RUN.
 *
 * Opened  2026-09-10T00:00:00Z.
 * Closed  2026-09-19T02:00:00Z, by Founder decision, on the day Lemon Squeezy
 *         checkout was confirmed working end-to-end. It was extended twice
 *         while checkout was being built — the last extension ran to
 *         2026-09-26T12:00:00Z and was cut short deliberately, not by expiry.
 *
 * `NEXT_PUBLIC_FREE_CAMPAIGN_END` in Vercel production carries the same
 * instant. These two must not disagree: the constant is the floor, the env
 * var is the live control, and a promotion that gives books away is the one
 * place where the safe failure is "closed".
 */
const DEFAULT_START_ISO = "2026-09-10T00:00:00.000Z";
const DEFAULT_END_ISO = "2026-09-19T02:00:00.000Z";

/** Inside this many hours of the end, the campaign reads as EXPIRING. */
export const EXPIRING_WINDOW_HOURS = 6;

export type CampaignState = "scheduled" | "active" | "expiring" | "ended";

function parseIso(value: string | undefined, fallback: string): number {
  const ms = Date.parse(value ?? "");
  if (Number.isFinite(ms)) return ms;
  return Date.parse(fallback);
}

export function campaignStartMs(): number {
  return parseIso(process.env.NEXT_PUBLIC_FREE_CAMPAIGN_START, DEFAULT_START_ISO);
}

export function campaignEndMs(): number {
  return parseIso(process.env.NEXT_PUBLIC_FREE_CAMPAIGN_END, DEFAULT_END_ISO);
}

/**
 * The campaign's state at an instant.
 *
 * `now` is a parameter rather than an implicit `Date.now()` so this is a pure
 * function: the tests can drive it across the boundary in both directions,
 * and the client can evaluate it against *server* time instead of its own.
 */
export function campaignState(now: number = Date.now()): CampaignState {
  const start = campaignStartMs();
  const end = campaignEndMs();
  // A window whose end is not after its start is not a window. Treat a
  // mis-configured pair as "ended" — the failure mode of a promotion that
  // will not start is a missed weekend; the failure mode of one that will
  // not stop is giving away every book forever.
  if (!(end > start)) return "ended";
  if (now < start) return "scheduled";
  if (now >= end) return "ended";
  if (end - now <= EXPIRING_WINDOW_HOURS * 3_600_000) return "expiring";
  return "active";
}

/** True while a visitor may actually request a free book. */
export function campaignIsOpen(now: number = Date.now()): boolean {
  const s = campaignState(now);
  return s === "active" || s === "expiring";
}

/** Milliseconds left, floored at zero — never negative, never NaN. */
export function campaignMsRemaining(now: number = Date.now()): number {
  return Math.max(0, campaignEndMs() - now);
}

/**
 * Split a duration into the four units the countdown renders.
 *
 * Returned as numbers, not strings: the caller decides padding, and a
 * screen-reader label wants "4 hours, 3 minutes", not "04:03".
 */
export function splitDuration(ms: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
} {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
  };
}

/** A spoken form of the remaining time, for `aria-live` announcements. */
export function spokenRemaining(ms: number): string {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  if (ms <= 0) return "The offer has ended.";
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  // Seconds are only spoken in the last minute. Announcing a ticking second
  // hand to a screen reader for two days is not information, it is noise.
  if (!days && !hours && !minutes) parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);
  return `${parts.join(", ")} left`;
}

/** What the campaign is called wherever it is named. One string, one place. */
export const CAMPAIGN_HEADLINE = "Every ebook free for a limited time";

/**
 * The reason the promotion exists, said plainly.
 *
 * The brief asked that the offer "clearly communicate that the temporary
 * offer is a limited-time promotion while payment infrastructure is
 * unavailable". This is that sentence, and it is deliberately the only
 * marketing claim the campaign makes: no scarcity theatre about stock, no
 * invented "normally $X, today only" beyond the book's real list price.
 *
 * REWRITTEN 2026-09-19. Until then this string read "Our checkout is still
 * being set up, so every ebook is free to request while we finish it." That
 * stopped being true on 2026-09-18, when Lemon Squeezy checkout went live and
 * carried an order end-to-end — and the sentence was still on the home page
 * and still in `/api/campaign` the next morning. A promotion may be over or
 * running; it may never explain itself with a fact about the business that
 * has stopped being the case.
 */
export const CAMPAIGN_REASON =
  "A limited-time introductory promotion. It ran from 10 September 2026 and has now ended — every ebook is available to buy directly from Valice Press.";
