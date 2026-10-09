"use client";

import { Check, Loader2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Dialog, DialogBody, DialogClose } from "@/components/ui/dialog";
import { CAMPAIGN_REASON } from "@/lib/campaign";
import { formatCatalogPrice } from "@/lib/format";
import { subscribeToNewsletter } from "@/lib/newsletter-client";

import { GiftGlyph } from "./gift-box";
import { usePrefersReducedMotion } from "./use-campaign";

/**
 * Everything the modal needs to describe ONE book truthfully.
 *
 * `slug` is the only field the server trusts. Title, price and cover are
 * passed for rendering; the API looks all three up again from the slug so a
 * hand-edited payload cannot change what is recorded or what is delivered.
 */
export interface FreeBookSubject {
  slug: string;
  title: string;
  author?: string | null;
  /** Short description. Trimmed for the modal; the full text is on the page. */
  description?: string | null;
  priceCents: number;
  /**
   * Whether this store actually holds a file to give away — see the guard in
   * `<GiftBox>`. Undefined means "not supplied", and the guard then falls back
   * to the old price proxy, which fails closed.
   */
  deliverableFree?: boolean;
  currency?: string;
  coverSrc?: string | null;
  pageCount?: number | null;
  /** e.g. "Watermarked PDF · Valice Classics". Rendered verbatim. */
  edition?: string | null;
}

/** Viewport coordinates of the gift box that was pressed. */
export interface BurstOrigin {
  x: number;
  y: number;
}

/**
 * The little gold burst that plays where the gift box was pressed.
 *
 * It is decoration and is treated as decoration: `aria-hidden`,
 * `pointer-events: none`, no state anybody waits on, and it is simply not
 * rendered under `prefers-reduced-motion`. Above all it does NOT gate the
 * dialog — the dialog is already mounted and focusable while this plays. An
 * animation that has to finish before the content arrives is the "modal
 * appears after two seconds" bug wearing nicer clothes.
 *
 * It lives inside the portal, so like the dialog it cannot be captured by a
 * transformed ancestor.
 */
function CelebrationBurst({ origin }: { origin: BurstOrigin }) {
  // Fixed angles rather than Math.random(): a burst that differs every render
  // cannot be diffed in a screenshot test, and randomness buys nothing the eye
  // can see at 600ms.
  const spokes = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[101]"
      style={{ left: origin.x, top: origin.y }}
    >
      {spokes.map((deg, i) => (
        <span
          key={deg}
          className="free-book-spark"
          style={
            {
              "--spark-angle": `${deg}deg`,
              "--spark-distance": `${i % 2 === 0 ? 58 : 40}px`,
              animationDelay: `${(i % 3) * 22}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

type Phase = "form" | "sending" | "done" | "duplicate";

/**
 * The free-book request modal.
 *
 * THE ONE RULE THIS COMPONENT EXISTS TO KEEP
 * Nothing here is conditional on an Amazon review. The review line appears
 * only AFTER a successful request, is worded as a favour rather than a
 * requirement, says out loud that it changes nothing, and has no field to
 * report back through. There is no "paste your review link", no upload, no
 * second book unlocked by one. Amazon permits free copies and permits asking
 * for an honest review; it forbids requiring one or trying to influence what
 * it says. The wording below is written to be defensible against that rule
 * read strictly.
 *
 * ACCESSIBILITY
 * `role="dialog"` + `aria-modal`, focus moved to the panel on open and
 * returned to the trigger on close, Escape closes, Tab is trapped inside, the
 * backdrop is click-to-close, and the celebration is skipped entirely under
 * `prefers-reduced-motion`. The success state is announced through a polite
 * live region rather than by moving focus, so a screen-reader user is told
 * what happened without being yanked.
 */
export function FreeBookModal({
  book,
  onClose,
  burstOrigin,
}: {
  book: FreeBookSubject;
  onClose: () => void;
  /** Where the gift box was pressed, for the celebration burst. */
  burstOrigin?: BurstOrigin | null;
}) {
  const reduced = usePrefersReducedMotion();
  const emailRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();

  const [phase, setPhase] = useState<Phase>("form");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => onClose(), [onClose]);

  // Scroll lock, focus in / trap / return, Escape and Back are the shared
  // `Dialog`'s now. The two things this component learned the hard way are
  // built into it: the effect must not re-run when `onClose` changes identity
  // (an inline arrow in <GiftBox> re-captured `document.activeElement` on every
  // render, and focus was handed back to an element that no longer existed), so
  // the hook holds `onClose` in a ref; and focus is restored in cleanup, after
  // React has removed the dialog, so the browser cannot blur what was focused.

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      emailRef.current?.focus();
      return;
    }

    setPhase("sending");
    let res: Response;
    try {
      res = await fetch("/api/free-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          slug: book.slug,
          message: message.trim() || undefined,
          marketingConsent: consent,
          website: honeypot,
        }),
      });
    } catch {
      setPhase("form");
      setError("We couldn't reach the server. Please check your connection and try again.");
      return;
    }

    if (!res.ok) {
      setPhase("form");
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(errorMessage(res.status, body.error));
      return;
    }

    const body = (await res.json().catch(() => ({}))) as { status?: string };

    // The mailing list is a separate consent and therefore a separate call, to
    // the endpoint that already owns the audience, the verbatim consent
    // sentence and the welcome mail. It is fired after the request has
    // succeeded and its failure is swallowed: the book request stands either
    // way, and telling someone their book failed because a newsletter did
    // would be false.
    if (consent) {
      void subscribeToNewsletter(trimmed, "free-ebook-campaign");
    }

    setPhase(body.status === "duplicate" ? "duplicate" : "done");
  }

  const priceLabel = formatCatalogPrice(book.priceCents, book.currency ?? "USD");
  const showsRealPrice = book.priceCents > 0;

  /**
   * THE MODAL IS PORTALLED TO <body>, AND THAT IS THE WHOLE BUG FIX.
   *
   * `<GiftBox>` renders this component as its own sibling, which put the
   * dialog inside the catalog card's DOM. A `position: fixed` element is
   * normally laid out against the viewport — but ANY ancestor with a
   * `transform`, `filter`, `backdrop-filter`, `perspective`, `will-change` or
   * `contain` becomes its containing block instead. The catalog card carries
   *
   *     .cinematic-root .home-card-hover:hover { transform: translateY(-4px) }
   *
   * and you cannot click the gift box without hovering the card. So at the
   * exact moment of every click the card became the containing block.
   * Measured on production: a `fixed; inset:0` child of the card is
   * `0,0,1839,967` at rest and `573,41,241,472` — the card's own rectangle —
   * while that transform applies. The card also has `overflow: hidden`, which
   * then clips the panel.
   *
   * That one fact explains every symptom that was reported:
   *   - the dialog appearing *inside the book cover*: the card is the frame;
   *   - the page "shaking": the transform animates over 0.4s, so the dialog's
   *     coordinate system slides while it is being read;
   *   - the mouse behaving as if trapped: the full-screen backdrop was only
   *     241x472, so clicks outside it fell through to the page beneath;
   *   - the dialog "arriving after about two seconds": the pointer leaves the
   *     card, `:hover` ends, the 0.4s transition unwinds, the transform
   *     becomes `none`, and the dialog finally snaps to the viewport;
   *   - the product page being fine: its buy panel is `.home-glass` but NOT
   *     `.home-card-hover`, so nothing ever creates a containing block there.
   *
   * A portal is the structural answer rather than a cosmetic one: the dialog's
   * DOM node is a child of <body>, so no ancestor exists that *could* capture
   * it, whatever CSS any card grows later. Raising z-index or waiting on a
   * timer would have treated the symptom and left the trap in place.
   */
  return (
    <>
      {/* Plays over the backdrop and disappears on its own. Never blocks.
          Portaled on its own, OUTSIDE the panel: the panel animates with a
          `transform`, which would make it the containing block for this
          `position: fixed` burst — the very bug the long comment above is
          about. */}
      {!reduced && burstOrigin && typeof document !== "undefined"
        ? createPortal(<CelebrationBurst origin={burstOrigin} />, document.body)
        : null}

      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) close();
        }}
        labelledBy={titleId}
        describedBy={descId}
        size="lg"
        panelClassName={[
          "!border-[rgba(214,178,102,0.28)] !bg-[#0c1813] shadow-2xl",
          reduced ? "" : "free-book-modal-in",
        ].join(" ")}
      >
        {/* Outside the scroller: a tall form on a short phone cannot scroll the
            way out of sight. (The old panel grew taller than the screen with
            this button at its top, above the visible area, unreachable.) */}
        <DialogClose
          className="absolute right-2 top-2 z-[2] bg-black/30 backdrop-blur-sm"
        />

        <DialogBody>
          <div className="grid gap-0 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          {/* ---------------------------------------------------------------
              LEFT — the book. Cover, title, short description, the real price
              struck through, $0.00, edition line. Every value comes from the
              card that was clicked, so the wrong book cannot appear here.
              --------------------------------------------------------------- */}
          <aside
            className="border-b border-white/5 p-6 sm:border-b-0 sm:border-r"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="mx-auto w-[140px] overflow-hidden rounded-lg shadow-lg sm:w-[160px]">
              {book.coverSrc ? (
                <Image
                  src={book.coverSrc}
                  alt=""
                  width={320}
                  height={480}
                  /* Eager, not lazy. This cover is the first thing in a dialog
                     the reader has just opened deliberately — it is never
                     below the fold, and lazy-loading it left the left-hand
                     panel blank for the first seconds of every open. */
                  priority
                  sizes="160px"
                  className="h-auto w-full"
                />
              ) : (
                <div className="flex aspect-[2/3] items-center justify-center bg-[#12241d] text-center text-[11px] text-fg-soft">
                  {book.title}
                </div>
              )}
            </div>

            <h3
              id={titleId}
              className="mt-4 font-serif text-[19px] font-medium leading-snug text-fg-hi"
            >
              {book.title}
            </h3>
            {book.author && (
              <p className="mt-1 text-xs text-fg-soft">{book.author}</p>
            )}

            {book.description && (
              <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-fg-mid">
                {book.description}
              </p>
            )}

            <div className="mt-4 flex items-baseline gap-3">
              {/* A struck-through price is only honest when there IS one. A
                  book whose `price_cents` is 0 is not sold on this site at any
                  price (see `formatCatalogPrice`), so striking through "$0"
                  would invent a discount. Those books show the free line
                  alone. */}
              {showsRealPrice && (
                <span className="text-[15px] text-fg-soft line-through tabular-nums">
                  {priceLabel}
                </span>
              )}
              <span
                className="font-serif text-[26px] font-medium tabular-nums"
                style={{ color: "#e9d49a" }}
              >
                $0.00
              </span>
            </div>

            <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-fg-soft">
              {book.edition ??
                `Watermarked PDF${book.pageCount ? ` · ${book.pageCount} pages` : ""}`}
            </p>
          </aside>

          {/* ---------------------------------------------------------------
              RIGHT — the request.
              --------------------------------------------------------------- */}
          <div className="p-6 sm:p-7">
            {phase === "done" || phase === "duplicate" ? (
              <SuccessPanel
                duplicate={phase === "duplicate"}
                title={book.title}
                reduced={reduced}
                onClose={close}
              />
            ) : (
              <form onSubmit={submit} noValidate>
                <p
                  className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em]"
                  style={{ color: "#d6b266" }}
                >
                  <GiftGlyph className="h-4 w-4" />
                  Limited-time promotion
                </p>

                <h4 className="mt-3 font-serif text-[22px] font-medium leading-tight text-fg-hi">
                  This ebook is yours, free.
                </h4>

                <p id={descId} className="mt-3 text-[14px] leading-relaxed text-fg-mid">
                  You&apos;re eligible to receive this ebook free during our
                  limited-time Valice Press promotion. {CAMPAIGN_REASON}
                </p>

                <div className="mt-5">
                  <label
                    htmlFor="free-book-email"
                    className="block text-[13px] font-medium text-fg-hi"
                  >
                    Email address
                  </label>
                  <p className="mt-1 text-[12px] text-fg-soft">
                    Enter your email address to receive the PDF.
                  </p>
                  <input
                    ref={emailRef}
                    id="free-book-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "free-book-error" : undefined}
                    placeholder="you@example.com"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-[15px] text-fg-hi placeholder:text-fg-fade focus:border-[#d6b266]/60 focus:outline-none focus:ring-2 focus:ring-[#d6b266]/25"
                  />
                </div>

                <div className="mt-4">
                  <label
                    htmlFor="free-book-message"
                    className="block text-[13px] font-medium text-fg-hi"
                  >
                    Message / request{" "}
                    <span className="font-normal text-fg-soft">(optional)</span>
                  </label>
                  <textarea
                    id="free-book-message"
                    name="message"
                    rows={3}
                    maxLength={1000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Anything you'd like us to know — another title you're after, a format question, or nothing at all."
                    className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-[14px] text-fg-hi placeholder:text-fg-fade focus:border-[#d6b266]/60 focus:outline-none focus:ring-2 focus:ring-[#d6b266]/25"
                  />
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-relaxed text-fg-mid">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/30 accent-[#d6b266]"
                  />
                  <span>
                    Email me occasionally about new books and editions. Optional
                    — leaving this unticked does not affect your free book.
                  </span>
                </label>

                {/* Honeypot. Off-screen rather than display:none — some bots
                    skip hidden fields — and marked so assistive tech ignores
                    it and autofill never touches it. */}
                <div aria-hidden className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
                  <label htmlFor="free-book-website">Website</label>
                  <input
                    id="free-book-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                {error && (
                  <p
                    id="free-book-error"
                    role="alert"
                    className="mt-3 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-[13px] text-red-200"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={phase === "sending"}
                  /* `valice-cta` rather than `home-cta-primary`: this markup is
                     portaled to <body>, and `home-cta-primary` is only defined
                     beneath `.cinematic-root`. See the CTA block in
                     globals.css for the whole story. */
                  className="valice-cta valice-cta-gold mt-5 w-full px-5 py-3 text-[14px]"
                >
                  {phase === "sending" ? (
                    <>
                      <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send me the ebook"
                  )}
                </button>

                <p className="mt-3 text-[11.5px] leading-relaxed text-fg-soft">
                  We use your address to send this book and nothing else unless
                  you ticked the box above.{" "}
                  <a
                    href="/privacy"
                    className="underline decoration-dotted underline-offset-2 hover:text-fg-mid"
                  >
                    Privacy notice
                  </a>
                  .
                </p>
              </form>
            )}
          </div>
        </div>
        </DialogBody>
      </Dialog>
    </>
  );
}

function errorMessage(status: number, code?: string): string {
  if (status === 409) {
    if (code === "book-unavailable") {
      return "That title isn't one we can send from here — its editions are handled by Amazon. Browse the ebooks and pick another; they're all free right now.";
    }
    return "The promotion has just ended, so we can't take new requests. Sorry — you were very close.";
  }
  if (status === 429) {
    return "That's a lot of books in a short time. Please give it a few minutes, or reply to one of our emails and we'll help directly.";
  }
  if (code === "invalid-email") return "Please enter a valid email address.";
  if (code === "message-too-long") return "That message is a little long — please trim it to 1000 characters.";
  if (code === "unknown-book" || code === "invalid-book") {
    return "We couldn't find that book. Please refresh the page and try again.";
  }
  return "Something went wrong on our side. Please try again in a moment.";
}

/**
 * The confirmation.
 *
 * Two honest claims and one honest non-claim:
 *   - "Request received" — true the moment the row is written.
 *   - "within 24 hours" — the brief's wording, and it is the truthful one:
 *     delivery is an operator action against a signed URL, not an automatic
 *     send. Promising "instantly" would be a lie the first time someone
 *     refreshed their inbox.
 *   - the review line makes no claim at all about what a review should say and
 *     states plainly that it changes nothing.
 */
function SuccessPanel({
  duplicate,
  title,
  reduced,
  onClose,
}: {
  duplicate: boolean;
  title: string;
  reduced: boolean;
  onClose: () => void;
}) {
  return (
    <div aria-live="polite">
      <div className="flex items-center gap-3">
        <span
          className={[
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            reduced ? "" : "free-book-pop",
          ].join(" ")}
          style={{
            background: "linear-gradient(140deg, #f7dea0 0%, #d6b266 100%)",
            color: "#2a1f06",
          }}
        >
          <Check aria-hidden className="h-5 w-5" strokeWidth={3} />
        </span>
        <div>
          <h4 className="font-serif text-[20px] font-medium text-fg-hi">
            {duplicate ? "You've already asked for this one" : "Request received."}
          </h4>
          <p className="text-[13px] text-fg-soft">{title}</p>
        </div>
      </div>

      <p className="mt-4 text-[14px] leading-relaxed text-fg-mid">
        {duplicate ? (
          <>
            We already have a request for this title from your address, so we
            haven&apos;t queued a second one. If the first email hasn&apos;t
            arrived, check your spam folder — and if it still isn&apos;t there,
            reply to any Valice Press email and we&apos;ll send it straight
            over.
          </>
        ) : (
          <>You&apos;ll receive your PDF by email within 24 hours.</>
        )}
      </p>

      <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <p className="text-[13px] leading-relaxed text-fg-mid">
          If you have time after reading, we&apos;d be grateful for an honest
          review on Amazon. Reviews are completely optional and do not affect
          your eligibility for free books.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onClose}
          className="valice-cta valice-cta-gold px-5 py-2.5 text-[13px]"
        >
          Keep browsing
        </button>
        <a
          href="/ebooks"
          className="valice-cta valice-cta-gold-ghost px-5 py-2.5 text-[13px]"
        >
          See every ebook
        </a>
      </div>
    </div>
  );
}
