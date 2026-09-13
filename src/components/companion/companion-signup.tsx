"use client";

import { useState, type FormEvent } from "react";

import {
  newsletterErrorMessage,
  subscribeToNewsletter,
  type NewsletterErrorCode,
  type NewsletterSource,
} from "@/lib/newsletter-client";
import { trackEvent } from "@/lib/analytics";

/**
 * Optional email signup on a companion page.
 *
 * Placed BELOW the free downloads, never above them, and worded so that
 * declining costs the reader nothing. The material on this page is already
 * theirs; this asks whether they want to hear when the next one exists.
 *
 * The heading says what arrives and roughly how often, because "subscribe"
 * with no promise is how lists get built and then unsubscribed from. Consent
 * is captured with the source tag so the record shows what was agreed to.
 *
 * Restyled 2026-09-13 to the approved companion composition — gold envelope,
 * copy, then the field — with every word, the source tag and the consent
 * behaviour untouched. This is a layout change and must stay one: the promise
 * that the sheets are yours either way is the reason the page converts at
 * all, and it is the one sentence no redesign may quietly drop.
 */
export function CompanionSignup({
  source,
  bookTitle,
}: {
  source: NewsletterSource;
  bookTitle: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "ok" }
    | { state: "error"; code: NewsletterErrorCode }
  >({ state: "idle" });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus({ state: "loading" });
    const result = await subscribeToNewsletter(trimmed, source);
    if (result.ok) {
      trackEvent("newsletter_signup");
      setStatus({ state: "ok" });
    } else {
      setStatus({ state: "error", code: result.code });
    }
  };

  if (status.state === "ok") {
    return (
      <div className="rounded-2xl border border-emerald-bright/30 bg-emerald-bright/5 p-6">
        <p className="font-serif text-lg text-fg-hi">You&apos;re on the list.</p>
        <p className="mt-2 text-sm leading-relaxed text-fg-mid">
          We&apos;ll write when there&apos;s a new practice set or the next book
          in this line is ready. Every email has a one-click unsubscribe, and we
          don&apos;t send discount blasts.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="home-glass rounded-2xl p-5 sm:p-7"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-7">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border sm:h-14 sm:w-14"
          style={{
            borderColor: "rgba(214,178,102,0.3)",
            background: "rgba(214,178,102,0.06)",
          }}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="#d6b266"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <rect x="2.5" y="5" width="19" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-[22px] text-fg-hi sm:text-2xl">
            Want to know when we add more?
          </h2>
          <p className="mt-2 max-w-prose text-[14.5px] leading-relaxed text-fg-mid">
            Optional — the sheets above are yours either way. If you&apos;d like
            an email when we publish new practice material or the next book
            after <span className="text-fg-hi">{bookTitle}</span>, leave an
            address. A few emails a year, unsubscribe in one click.
          </p>
        </div>

        <div className="w-full lg:max-w-[26rem]">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="companion-email" className="sr-only">
              Email address
            </label>
            <input
              id="companion-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={status.state === "loading"}
              className="min-h-11 w-full min-w-0 rounded-xl border border-white/12 bg-black/25 px-4 py-3 text-[15px] text-fg-hi outline-none transition placeholder:text-fg-low focus:border-emerald-bright/50 disabled:opacity-60 sm:flex-1"
            />
            <button
              type="submit"
              disabled={status.state === "loading"}
              className="home-cta-primary min-h-11 shrink-0 rounded-xl px-6 py-3 text-sm font-semibold tracking-tight disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status.state === "loading" ? "Adding…" : "Keep me posted"}
            </button>
          </div>

          {status.state === "error" && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {newsletterErrorMessage(status.code)}
            </p>
          )}

          <p className="mt-4 text-[12px] leading-relaxed text-fg-fade lg:text-[11px]">
            We only ever get your address because you typed it here. Amazon does
            not share customer details with publishers, and we never buy lists.
          </p>
        </div>
      </div>
    </form>
  );
}
