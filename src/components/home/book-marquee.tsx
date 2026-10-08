import Link from "next/link";

import { bookCoverSrc } from "@/lib/asset-map";

import { MarqueeMotion } from "./marquee-motion";

/**
 * A shelf that keeps moving.
 *
 * WHY IT IS CSS AND NOT JAVASCRIPT.
 * One `@keyframes` translating one element. No timer per card, no scroll
 * listener, no React state, no re-render — the compositor moves a single
 * transformed layer and the main thread never hears about it. This is a
 * Server Component: the whole section ships as static HTML and hydrates
 * nothing.
 *
 * HOW THE LOOP HIDES ITS SEAM.
 * The track holds the catalogue twice, end to end, and animates from
 * `translateX(-50%)` to `translateX(0)`. At the moment it snaps back, the
 * pixels under the viewport are identical to the pixels that were there a
 * frame earlier, because the second copy is the first copy. There is no jump
 * and no gap to see.
 *
 * WHY IT RUNS LEFT → RIGHT.
 * Asked for, and it is the right choice: a shelf drifting rightwards reads as
 * browsing along a bookcase. Rightward motion means starting at -50% and
 * ending at 0, which is why the animation runs in that direction rather than
 * the more usual 0 → -50%.
 *
 * SPEED. Roughly 34 px/s on desktop — slow enough to read a spine without
 * chasing it, which is the difference between a library and a stock ticker.
 * The duration is derived from the number of books so adding a title does not
 * silently speed the shelf up.
 */
export interface MarqueeBook {
  slug: string;
  title: string;
  authors: string[];
}

/**
 * The card advance at the widest breakpoint (card + gap), used only to give
 * the server a sensible starting duration. The real pace is calibrated in the
 * browser from the measured lane width, because the card size is
 * breakpoint-dependent and one fixed duration would mean a different speed at
 * every width. See `<MarqueeMotion>`.
 */
const CARD_ADVANCE = 216 + 26;
const PIXELS_PER_SECOND = 34;

export function BookMarquee({ books }: { books: MarqueeBook[] }) {
  /**
   * A book with no cover in the asset manifest is left off the shelf rather
   * than rendered as a hole. `bookCoverSrc` also returns null for art whose
   * aspect ratio is wrong for a cover, which is the manifest catching a bad
   * file — exactly the case where showing it would look worse than not.
   */
  const shelf = books
    .map((b) => ({
      ...b,
      // The manifest still decides whether a cover exists at all; the shelf
      // just points at the small build of it.
      cover: bookCoverSrc(b.slug)?.replace("/images/books/", "/images/books/thumb/") ?? null,
    }))
    .filter((b): b is MarqueeBook & { cover: string } => Boolean(b.cover));

  // Below three there is nothing to loop; the shelf would just sit there.
  if (shelf.length < 3) return null;

  const seconds = Math.round((shelf.length * CARD_ADVANCE) / PIXELS_PER_SECOND);
  // The duplicate is aria-hidden so a screen reader hears the catalogue once,
  // not twice. Sighted users see one continuous shelf either way.
  const lane = [
    { copy: shelf, hidden: false },
    { copy: shelf, hidden: true },
  ];

  return (
    <section data-scroller className="relative overflow-hidden py-12 sm:py-16" aria-labelledby="shelf-heading">
      <div className="mx-auto w-full max-w-[1700px] px-6 lg:px-12 xl:px-16 2xl:px-20">
        <h2
          id="shelf-heading"
          className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-bright/70 sm:text-[11px]"
        >
          The shelf
        </h2>
        <p className="mt-2.5 max-w-[560px] text-[14px] leading-relaxed text-fg-soft sm:text-[15px]">
          {/* Not "every book Valice Press publishes". It was, until the
              public-domain series came off the storefront on 2026-09-12 for
              the Paddle domain review and the shelf went from twenty-seven
              books to twelve — at which point the line was a claim the shelf
              no longer kept. This wording is true at either size. */}
          What&apos;s on the Valice Press shelf right now, moving past. Pick one up.
        </p>
      </div>

      {/* The wrapper is `<MarqueeMotion>`: it owns the speed, and nothing
          else. Hover slows the track by changing `playbackRate`, which the
          spec guarantees preserves position — see that file for what the old
          CSS-duration approach did instead. */}
      <MarqueeMotion>
        <div
          /* No gap BETWEEN the lanes — each lane carries its own trailing
             gap instead. `translateX(-50%)` is half the track, so a gap
             between the lanes makes the travel half a gap short of one lane
             and the loop drifts by that much every cycle. Measured: 9px. */
          className="marquee-track flex w-max"
          style={{ ["--marquee-duration" as string]: `${seconds}s` }}
        >
          {lane.map((l, li) => (
            <ul
              key={li}
              aria-hidden={l.hidden || undefined}
              className="flex shrink-0 list-none gap-4 pe-4 sm:gap-5 sm:pe-5 xl:gap-[26px] xl:pe-[26px]"
            >
              {l.copy.map((b) => (
                <li key={`${li}-${b.slug}`} className="shrink-0">
                  <Link
                    href={`/books/${b.slug}`}
                    tabIndex={l.hidden ? -1 : undefined}
                    /*
                      FEWER BOOKS, BIGGER BOOKS. The old shelf put 12+ covers
                      on a desktop screen at 132px each, which is a contact
                      sheet, not a bookshelf. Measured targets at these sizes:
                      ~7.7 visible at 1854px, ~6.0 at 1280, ~4.0 at 768,
                      ~2.3 at 390.
                    */
                    className="group/card block w-[150px] focus-visible:outline-none sm:w-[170px] lg:w-[190px] xl:w-[216px]"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/[0.07] bg-[#07110b] shadow-[0_12px_28px_-18px_rgba(0,0,0,0.9)] transition-[transform,border-color] duration-300 group-hover/card:-translate-y-1 group-hover/card:border-emerald-bright/30 group-focus-visible/card:ring-2 group-focus-visible/card:ring-[#33f0aa] motion-reduce:transition-none motion-reduce:group-hover/card:translate-y-0">
                      {/*
                        A plain <img> against a pre-built 264px thumbnail,
                        deliberately — not next/image.

                        `next/image` emits a fifteen-entry srcset up to 3840w
                        for every cover and falls back to `src=…&w=3840`. Fifty
                        four of those on one page is fifty four optimiser
                        round-trips for pictures rendered 132px wide, and it
                        locked the renderer up hard enough that screenshots
                        timed out. These are fixed-size thumbnails of local
                        files: one static 2x asset each, 15 KB, is the whole
                        job.

                        `fetchPriority="low"`: on a slow link Chrome widens
                        `loading="lazy"`'s reach, so twelve of these (~550 KB)
                        are requested ~1.7 s in, while the hero photograph — the
                        page's LCP — is still arriving. On the Redmi at 1.6 Mbps
                        / 70 ms the hero lands at 4.99 s with them competing and
                        4.1 s with them blocked outright; the hint alone moved it
                        to 4.90 s over the test server's HTTP/1.1, where every
                        request shares six sockets whatever its priority. Where
                        priorities are honoured (HTTP/2, which is production) it
                        should do more — measure after deploy.
                      */}
                      {/* eslint-disable-next-line @next/next/no-img-element -- see above: fixed-size local thumbnail, next/image is the regression here */}
                      <img
                        src={b.cover}
                        alt={l.hidden ? "" : `${b.title} — cover`}
                        width={432}
                        height={648}
                        loading="lazy"
                        fetchPriority="low"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="mt-3 line-clamp-2 text-[13px] leading-snug text-fg-mid transition-colors group-hover/card:text-fg-hi sm:text-[14px]">
                      {b.title}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>

        {/* The shelf runs out of the frame rather than stopping at an edge. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-28"
          style={{ background: "linear-gradient(90deg, #050705 0%, rgba(5,7,5,0) 100%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-28"
          style={{ background: "linear-gradient(270deg, #050705 0%, rgba(5,7,5,0) 100%)" }}
        />
      </MarqueeMotion>
    </section>
  );
}
