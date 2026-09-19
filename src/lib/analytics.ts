import { track } from "@vercel/analytics";

/**
 * Cookieless funnel instrumentation (WS-D) on Vercel Analytics custom events.
 *
 * Privacy-first by construction: Vercel Analytics sets no cookies and stores
 * no PII, so this needs no consent banner (KVKK/GDPR-friendly). Callers MUST
 * pass only NON-identifying props — slugs, ids, prices, currency, counts —
 * and NEVER emails, names, addresses, or raw search text.
 */
export type AnalyticsEvent =
  | "view_item"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase"
  | "newsletter_signup"
  | "sample_read"
  | "search"
  /*
   * Codex Enigmatica verification funnel. Both events carry NOTHING but
   * their own name — no submission, no normalized form, no length. The
   * whole point of the verification endpoint is that the answer never
   * leaves the server, and an analytics beacon is exactly the kind of
   * side channel that quietly undoes that.
   */
  | "codex_verify_attempt"
  | "codex_verify_success"
  /* Companion pages: a free download opened, or a link followed to a book. */
  | "companion_download"
  | "related_click"
  /*
   * The brand film. Two events, because "it started" and "somebody acted on
   * it" answer different questions: the first says the section was reached
   * and the file was affordable, the second says the film sold something.
   */
  | "brand_film_play"
  | "brand_film_cta_click"
  /*
   * Quick View — the modal that now stands between a card and a book page.
   * `price_revealed` is the moment a price first becomes visible anywhere in
   * the journey, which is the whole point of the redesign: it is the funnel
   * step that used to happen on the card and now happens here.
   */
  | "quick_view_open"
  | "format_selected"
  | "price_revealed"
  | "amazon_click"
  | "direct_checkout_click"
  /*
   * The newsletter popup. Five events, which is not four too many: a popup
   * that is shown and dismissed is a different outcome from one that is
   * shown and ignored, and a submission that fails validation is the one
   * that tells you the field is wrong rather than the offer.
   */
  | "email_popup_triggered"
  | "email_popup_closed"
  | "email_popup_submitted"
  | "email_popup_validation_failed"
  | "email_subscriber_created";

export const ANALYTICS_EVENTS: readonly AnalyticsEvent[] = [
  "view_item",
  "add_to_cart",
  "begin_checkout",
  "purchase",
  "newsletter_signup",
  "sample_read",
  "search",
  "codex_verify_attempt",
  "codex_verify_success",
  "companion_download",
  "related_click",
  "brand_film_play",
  "brand_film_cta_click",
  "quick_view_open",
  "format_selected",
  "price_revealed",
  "amazon_click",
  "direct_checkout_click",
  "email_popup_triggered",
  "email_popup_closed",
  "email_popup_submitted",
  "email_popup_validation_failed",
  "email_subscriber_created",
];

export type EventProps = Record<string, string | number | boolean | null>;

/**
 * Fire a typed, PII-free funnel event. Safe to call from anywhere: it no-ops
 * during SSR (Vercel's `track` is client-only) and never throws into a user
 * flow (analytics is best-effort).
 *
 * Two sinks, deliberately. Vercel Web Analytics custom events are dropped on
 * the Hobby plan the project is on, so on their own they measure nothing.
 * The beacon to `/api/events` is the first-party record (see
 * `analytics_events` in the schema). Both carry the same PII-free props.
 */
export function trackEvent(event: AnalyticsEvent, props?: EventProps): void {
  if (typeof window === "undefined") return;
  try {
    track(event, props);
  } catch {
    // Best-effort: analytics must never break the page.
  }
  try {
    const body = JSON.stringify({
      event,
      props: props ?? {},
      path: window.location.pathname,
    });
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      navigator.sendBeacon(
        "/api/events",
        new Blob([body], { type: "application/json" }),
      );
    } else {
      void fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    // Best-effort: the first-party sink must never break the page either.
  }
}
