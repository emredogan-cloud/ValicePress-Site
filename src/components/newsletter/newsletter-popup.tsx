"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { trackEvent } from "@/lib/analytics";
import { POPUP_SEEN_COOKIE } from "@/lib/visitor";

/**
 * The newsletter popup — once per person, across the whole site.
 *
 * THE RULE THIS COMPONENT EXISTS TO KEEP: a visitor meets this dialog once.
 * Not once per page, not once per session — once. Someone who sees it on the
 * homepage and then opens ten companion pages must see it exactly the one
 * time, whether they subscribed, closed it, or simply scrolled past.
 *
 * That is why the state is not in this component, nor in `sessionStorage`,
 * nor keyed by route:
 *
 *   1. A first-party cookie (`vp_np`) is the fast path. It is readable here,
 *      it is sent with every navigation, and it makes a repeat page load cost
 *      exactly nothing — no fetch, no render, no timer.
 *   2. `/api/popup` is the durable path. It recognises the visitor by browser
 *      id, by signed-in user, and by known contact, so clearing a cookie or
 *      switching device does not reset the promise.
 *
 * WHY 10 SECONDS AND NOT ON LOAD: the offer is worth something to someone who
 * is reading, and nothing to someone who has not looked yet. The timer starts
 * only after the eligibility answer comes back, so a visitor who has already
 * met it never has a timer at all.
 *
 * ACCESSIBILITY IS NOT A SETTING HERE. It is a real dialog: `role="dialog"`,
 * `aria-modal`, labelled by its own heading, focus moved into it on open and
 * returned to where it was on close, focus trapped while open, Escape closes,
 * the backdrop closes, and the page behind it does not scroll. A modal that
 * traps a keyboard user is worse than no modal.
 *
 * WHAT IT PROMISES IS WHAT IT DOES. The consent sentence is the same sentence
 * stored on the subscriber record. There is no countdown, no "limited", no
 * "only today" — the press has no such offer, so the popup does not invent
 * one.
 */

const CONSENT_TEXT =
  "I agree to receive occasional email from Valice Press about new books and editions. I can unsubscribe at any time.";

const DELAY_MS = 10_000;

/**
 * Where a dialog asking for an email address would be an interruption rather
 * than an offer: somebody's cart, the book they are reading, their own
 * account, and the operator's console.
 *
 * `/order` is deliberately NOT on this list. A reader who has just bought a
 * book is the best-qualified person on the site to hear about the next one,
 * and the once-per-person rule already guarantees they only meet it if they
 * never have before.
 */
const SILENT_PREFIXES = ["/admin", "/cart", "/read", "/account", "/sign-in", "/sign-up"];

function isSilent(pathname: string): boolean {
  return SILENT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

type Status = "idle" | "sending" | "ok" | "error";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/** Fire-and-forget; the visitor's experience never waits on it. */
function report(action: "shown" | "dismissed" | "submitted") {
  try {
    void fetch("/api/popup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* best effort */
  }
}

export function NewsletterPopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusTo = useRef<Element | null>(null);
  const reportedShown = useRef(false);

  // ---- eligibility, then the timer ---------------------------------------
  useEffect(() => {
    // Fast path: this browser has already met it. No request, no timer.
    if (readCookie(POPUP_SEEN_COOKIE) === "1") return;
    if (isSilent(pathname)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      try {
        const res = await fetch("/api/popup", { headers: { accept: "application/json" } });
        if (!res.ok) return;
        const data: unknown = await res.json();
        const eligible =
          typeof data === "object" && data !== null && "eligible" in data
            ? Boolean((data as { eligible: unknown }).eligible)
            : false;
        if (!eligible || cancelled) return;
        timer = setTimeout(() => {
          if (!cancelled) setOpen(true);
        }, DELAY_MS);
      } catch {
        // Offline, blocked, or the route is unreachable. Showing the popup
        // anyway would risk showing it on every page, so we do not.
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // Deliberately keyed on the pathname: a visitor who lands on /cart and
    // then navigates to a book page should get the timer at that point, not
    // be excluded for the rest of the session by where they happened to
    // arrive. The once-per-person guard upstream is what stops this from
    // becoming once-per-navigation.
  }, [pathname]);

  // ---- record the impression exactly once --------------------------------
  useEffect(() => {
    if (!open || reportedShown.current) return;
    reportedShown.current = true;
    report("shown");
    trackEvent("email_popup_triggered", {
      source_page: window.location.pathname,
    });
  }, [open]);

  const close = useCallback(
    (reason: "dismissed" | "submitted") => {
      setOpen(false);
      if (reason === "dismissed") {
        report("dismissed");
        trackEvent("email_popup_closed", { source_page: window.location.pathname });
      }
      const target = returnFocusTo.current;
      if (target instanceof HTMLElement) target.focus();
    },
    [],
  );

  // ---- modal behaviour: scroll lock, focus, Escape, focus trap -----------
  useEffect(() => {
    if (!open) return;

    returnFocusTo.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // The email field is the point of the dialog, so focus lands there and
    // not on the close button: a keyboard user's first Tab should leave the
    // form, not enter it.
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 30);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close("dismissed");
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      clearTimeout(focusTimer);
    };
  }, [open, close]);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const email = String(new FormData(form).get("email") ?? "").trim();

      // Validated here so the message is immediate and specific, and again on
      // the server, which is the check that counts.
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus("error");
        setError("That doesn’t look like an email address.");
        trackEvent("email_popup_validation_failed", { reason: "malformed" });
        inputRef.current?.focus();
        return;
      }

      setStatus("sending");
      setError(null);
      try {
        const res = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email,
            source: "popup",
            consentPath: window.location.pathname,
          }),
        });
        const data: { ok?: boolean; error?: string } = await res
          .json()
          .catch(() => ({}));

        if (res.ok && data.ok) {
          setStatus("ok");
          report("submitted");
          trackEvent("email_popup_submitted", {
            source_page: window.location.pathname,
          });
          return;
        }

        if (data.error === "invalid-email" || data.error === "disposable-email") {
          setStatus("error");
          setError(
            data.error === "disposable-email"
              ? "That looks like a throwaway address — please use one you read."
              : "That doesn’t look like an email address.",
          );
          trackEvent("email_popup_validation_failed", { reason: data.error });
          inputRef.current?.focus();
          return;
        }

        setStatus("error");
        setError("Something went wrong at our end. Please try again shortly.");
      } catch {
        setStatus("error");
        setError("We couldn’t reach the server. Please check your connection.");
      }
    },
    [],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
    >
      {/* The backdrop is a button so a pointer AND a screen reader both have a
          way out that is not the close control alone. */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => close("dismissed")}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-[2px]"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="newsletter-popup-heading"
        aria-describedby="newsletter-popup-body"
        className="relative grid w-full max-w-[980px] overflow-hidden rounded-xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.75)] sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)]"
        style={{ background: "#0b1d16", maxHeight: "min(92vh, 720px)" }}
      >
        {/* ---------------- left: the plate ---------------- */}
        <div className="relative hidden sm:block">
          <picture>
            <source type="image/avif" srcSet="/images/popup/newsletter-panel.avif" />
            <source type="image/webp" srcSet="/images/popup/newsletter-panel.webp" />
            <img
              src="/images/popup/newsletter-panel.webp"
              alt=""
              aria-hidden
              className="h-full w-full object-cover"
            />
          </picture>
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, rgba(6,17,12,0.30) 0%, rgba(6,17,12,0) 45%, rgba(11,29,22,0.55) 100%)",
            }}
          />
          <figcaption className="absolute inset-x-0 bottom-0 p-6">
            <p className="font-serif text-[14px] italic leading-snug text-[#e8e0cd]/85">
              “Books are compasses for a more intentional world.”
            </p>
            <p className="mt-1.5 text-[10px] uppercase tracking-[0.28em] text-[#c9a24a]/80">
              Valice Press
            </p>
          </figcaption>
        </div>

        {/* A short band instead of the tall plate on a phone, so the form is
            never pushed below the fold by decoration. */}
        <div className="relative h-28 sm:hidden">
          <picture>
            <source type="image/avif" srcSet="/images/popup/newsletter-panel-wide.avif" />
            <source type="image/webp" srcSet="/images/popup/newsletter-panel-wide.webp" />
            <img
              src="/images/popup/newsletter-panel-wide.webp"
              alt=""
              aria-hidden
              className="h-full w-full object-cover"
            />
          </picture>
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(11,29,22,0.15) 0%, rgba(11,29,22,0.95) 100%)",
            }}
          />
        </div>

        {/* ---------------- right: the offer ---------------- */}
        <div className="relative overflow-y-auto px-6 py-7 sm:px-9 sm:py-10">
          <button
            ref={closeRef}
            type="button"
            onClick={() => close("dismissed")}
            aria-label="Close and don’t show this again"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[#e8e0cd]/60 transition-colors hover:bg-white/10 hover:text-[#e8e0cd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a24a]"
          >
            <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>

          {status === "ok" ? (
            <div className="flex min-h-[260px] flex-col justify-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-[#c9a24a]">
                You’re on the list
              </p>
              <h2
                id="newsletter-popup-heading"
                className="mt-3 font-serif text-[28px] leading-tight text-[#f2ece0]"
              >
                Thank you — check your inbox
              </h2>
              <p id="newsletter-popup-body" className="mt-3 text-[14px] leading-relaxed text-[#e8e0cd]/70">
                A short welcome note is on its way. Every email we send carries
                an unsubscribe link, and one click is all it takes.
              </p>
              <button
                type="button"
                onClick={() => close("submitted")}
                className="mt-7 self-start rounded-full bg-[#c9a24a] px-6 py-2.5 text-[13px] font-semibold text-[#0b1d16] transition-colors hover:bg-[#d7b05b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a24a]"
              >
                Back to reading
              </button>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-[#c9a24a]">
                Stay in the loop
              </p>
              <h2
                id="newsletter-popup-heading"
                className="mt-3 font-serif text-[27px] leading-[1.14] text-[#f2ece0] sm:text-[32px]"
              >
                Join the Valice Press&nbsp;Newsletter
              </h2>
              <p
                id="newsletter-popup-body"
                className="mt-3 text-[14px] leading-relaxed text-[#e8e0cd]/72"
              >
                A few emails a year, when there is something to say: a new
                edition, a companion pack, or a book given away free for a
                while.
              </p>

              <ul className="mt-6 space-y-3.5">
                {[
                  {
                    title: "New editions",
                    body: "Told first, before the listing goes up",
                  },
                  {
                    title: "Free companion material",
                    body: "Printable boards, indexes and worksheets",
                  },
                  {
                    title: "Occasional giveaways",
                    body: "When a book is free for a while, you’ll know",
                  },
                ].map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <span
                      aria-hidden
                      className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#c9a24a]"
                    />
                    <span>
                      <span className="block text-[13.5px] font-medium text-[#f2ece0]">
                        {item.title}
                      </span>
                      <span className="block text-[12.5px] text-[#e8e0cd]/60">
                        {item.body}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              <form onSubmit={onSubmit} noValidate className="mt-7">
                <label htmlFor="newsletter-popup-email" className="sr-only">
                  Your email address
                </label>
                <input
                  ref={inputRef}
                  id="newsletter-popup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  placeholder="Your email address"
                  aria-invalid={status === "error" || undefined}
                  aria-describedby={
                    status === "error" ? "newsletter-popup-error" : "newsletter-popup-consent"
                  }
                  className="w-full rounded-full border border-[#c9a24a]/30 bg-[#06110c] px-5 py-3 text-[14px] text-[#f2ece0] placeholder:text-[#e8e0cd]/40 focus:border-[#c9a24a]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a24a]/40"
                />

                {status === "error" && error ? (
                  <p
                    id="newsletter-popup-error"
                    role="alert"
                    className="mt-2.5 px-2 text-[12.5px] text-[#f0b2a0]"
                  >
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#c9a24a] px-6 py-3 text-[14px] font-semibold text-[#0b1d16] transition-colors hover:bg-[#d7b05b] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a24a]"
                >
                  {status === "sending" ? "Joining…" : "Join the Journey"}
                  {status === "sending" ? null : <span aria-hidden>→</span>}
                </button>

                <p
                  id="newsletter-popup-consent"
                  className="mt-3.5 text-[11.5px] leading-relaxed text-[#e8e0cd]/50"
                >
                  {CONSENT_TEXT} We never sell or share your address. See our{" "}
                  <a
                    href="/privacy"
                    className="underline decoration-[#c9a24a]/40 underline-offset-2 hover:text-[#e8e0cd]/80"
                  >
                    privacy notice
                  </a>
                  .
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
