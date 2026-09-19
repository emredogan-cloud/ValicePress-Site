"use client";

import Link from "next/link";

import { AmbientVideo } from "@/components/media/ambient-video";
import { trackEvent } from "@/lib/analytics";

/**
 * The Valice Press brand film, full-bleed, as a band of the homepage.
 *
 * WHY IT IS NOT THE HERO. The hero's photograph is the page's LCP element
 * and it is fast. Putting a film there would trade a ~180 KB image that
 * paints immediately for a multi-megabyte fetch that cannot, and the film
 * would be the first thing a visitor waits for rather than the first thing
 * they see. Here — one section down, below the fold on every viewport we
 * support — it costs nothing until a visitor scrolls toward it, and by then
 * they have already decided to stay.
 *
 * WHY IT HAS NO FRAME. The brief was that the film should look like part of
 * the page, not a video on it: no border, no rounded corners, no card, no
 * drop shadow, no controls. So the film IS the section — edge to edge, with
 * the same two scrims the hero uses to guarantee that live HTML type reads
 * against a picture whose per-pixel brightness we do not control.
 *
 * The type is never burned into the film. Every word below is real text.
 */
export function BrandFilmSection() {
  return (
    <section
      aria-labelledby="brand-film-heading"
      className="relative isolate overflow-hidden"
    >
      {/*
        16:9 on wide screens; taller and tighter on a phone, where a 16:9 band
        is a letterbox stripe with nothing in it. `object-cover` means the
        film is cropped rather than squashed at every ratio.
      */}
      <div className="relative h-[68vh] min-h-[420px] w-full sm:h-auto sm:min-h-0 sm:aspect-[16/9] sm:max-h-[760px]">
        <AmbientVideo
          src1080="/video/valice-brand-film-1080.mp4"
          src720="/video/valice-brand-film-720.mp4"
          poster="/video/valice-brand-film-poster.webp"
          label="The Valice Press brand film — a silent, looping portrait of the press's books and the desk they are made on."
          onPlay={() => trackEvent("brand_film_play", { page: "home" })}
        />

        {/* Readability scrims. Functional, not decorative — the same job the
            hero's gradients do, in the same idiom. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(5,7,5,0.92) 0%, rgba(5,7,5,0.55) 26%, rgba(5,7,5,0.06) 58%, rgba(5,7,5,0) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[120px]"
          style={{
            background:
              "linear-gradient(to bottom, rgba(5,7,5,0.6) 0%, rgba(5,7,5,0) 100%)",
          }}
        />

        <div className="absolute inset-x-0 bottom-0 px-6 pb-10 sm:pb-14 lg:px-12 lg:pb-16 xl:px-16 2xl:px-20">
          <div className="mx-auto w-full max-w-[1700px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-bright/80">
              The press
            </p>
            <h2
              id="brand-film-heading"
              className="mt-3 max-w-2xl font-serif text-[30px] font-medium leading-[1.12] tracking-tight text-white sm:text-[40px] lg:text-[46px]"
            >
              Books made the slow way, for people who read the slow way
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/75">
              Every Valice Press edition is typeset here, sourced against
              named authorities, and sold without DRM. Nothing in this film
              is a book we have not published.
            </p>
            <Link
              href="/books"
              onClick={() => trackEvent("brand_film_cta_click", { page: "home" })}
              className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-[13px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/18 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              See the catalogue
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
