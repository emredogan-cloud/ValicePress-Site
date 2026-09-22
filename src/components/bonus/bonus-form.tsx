"use client";

import { useRef, useState, type FormEvent } from "react";

/**
 * The only interactive part of /bonus. Everything else on that page is
 * server-rendered; this is a client island so the cover, copy and layout
 * ship as static HTML.
 *
 * It distinguishes two outcomes the API keeps separate:
 *   - `ok`      — the MailerLite subscription succeeded
 *   - `deliver` — the reader may proceed to the bonus
 * A recoverable list failure gives `ok: false, deliver: true`. In that case
 * the reader still gets the bonus and is never told they were subscribed.
 */

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

/** Copy for the two failures a reader can actually act on. */
const MESSAGES = {
  invalid: "Please enter a valid email address.",
  unavailable:
    "We couldn't open your bonus just now. Please try again in a moment.",
} as const;

export function BonusForm({ bookfunnelUrl }: { bookfunnelUrl: string | null }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });
  // Guards against a double submit landing between React's state update and
  // the disabled attribute taking effect.
  const inFlight = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setState({ kind: "error", message: MESSAGES.invalid });
      return;
    }

    // A missing destination is a configuration fault, not a reader fault. Do
    // not collect an address we cannot honour, and do not navigate nowhere.
    if (!bookfunnelUrl) {
      setState({ kind: "error", message: MESSAGES.unavailable });
      return;
    }

    inFlight.current = true;
    setState({ kind: "submitting" });

    const form = event.currentTarget;
    const honeypot =
      (form.elements.namedItem("website") as HTMLInputElement | null)?.value ??
      "";

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, website: honeypot }),
      });
      const data: unknown = await res.json().catch(() => null);
      const payload = (data ?? {}) as { deliver?: boolean; error?: string };

      if (payload.deliver) {
        setState({ kind: "success" });
        // Let the success line render and be announced before navigating.
        window.setTimeout(() => {
          window.location.href = bookfunnelUrl;
        }, 900);
        return;
      }

      setState({
        kind: "error",
        message:
          payload.error === "invalid-email"
            ? MESSAGES.invalid
            : MESSAGES.unavailable,
      });
    } catch {
      setState({ kind: "error", message: MESSAGES.unavailable });
    } finally {
      inFlight.current = false;
    }
  }

  const submitting = state.kind === "submitting";
  const succeeded = state.kind === "success";
  const disabled = submitting || succeeded;

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-7 w-full">
      <label
        htmlFor="bonus-email"
        className="block text-[0.7rem] font-medium uppercase tracking-[0.18em] text-fg-soft"
      >
        Email address
      </label>

      <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row">
        <input
          id="bonus-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={disabled}
          aria-invalid={state.kind === "error"}
          aria-describedby="bonus-status"
          className="h-12 w-full flex-1 rounded-lg border border-white/[0.10] bg-white/[0.04] px-4 text-[0.95rem] text-fg-hi placeholder:text-fg-fade transition-colors focus:border-[#d6b266]/60 focus:outline-none focus:ring-2 focus:ring-[#d6b266]/25 disabled:cursor-not-allowed disabled:opacity-60"
        />

        {/*
          Honeypot. Off-screen rather than display:none — some bots skip
          hidden inputs, few skip positioned ones. aria-hidden + tabIndex -1
          keep it away from assistive tech and the tab order.
        */}
        <div aria-hidden="true" className="absolute left-[-9999px] top-auto">
          <label htmlFor="bonus-website">Leave this field empty</label>
          <input
            id="bonus-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>

        <button
          type="submit"
          disabled={disabled}
          className="valice-cta valice-cta-gold h-12 shrink-0 px-7 text-[14px]"
        >
          {submitting
            ? "Sending your copy…"
            : succeeded
              ? "You're in…"
              : "Get the bonus"}
        </button>
      </div>

      {/*
        One live region for every outcome. Errors carry a ✕ and successes a ✓
        so the state is never signalled by colour alone.
      */}
      <div className="mt-3 min-h-[1.25rem]">
        <p
          id="bonus-status"
          role="status"
          aria-live="polite"
          className="text-[0.8rem] leading-relaxed"
        >
          {state.kind === "error" && (
            <span className="text-[#f3b0a0]">
              <span aria-hidden="true">✕ </span>
              {state.message}
            </span>
          )}
          {succeeded && (
            <span className="text-[var(--bonus-accent-hi)]">
              <span aria-hidden="true">✓ </span>
              You&rsquo;re in — opening your bonus…
            </span>
          )}
        </p>

        {/* Static reassurance, deliberately outside the live region. */}
        {state.kind === "idle" && (
          <p className="text-[0.68rem] uppercase tracking-[0.16em] text-fg-fade">
            Free · Instant access
          </p>
        )}
      </div>
    </form>
  );
}
