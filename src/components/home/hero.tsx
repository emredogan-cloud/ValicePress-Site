import type { CSSProperties } from "react";
import Link from "next/link";

import { HeroEditorialNotes, HeroSceneNotes } from "./hero-editorial-notes";
import { TrustRow } from "./trust-row";

/**
 * The hero.
 *
 * THE BOOKS ON THE LEDGE ARE THE REAL ONES.
 * Weather Permitting, The Sweetest Season and The Great Book of World Games, set
 * from their current cover files onto the empty plate the old hero was painted
 * on (`scripts/hero/compose-hero.py`). The previous picture showed three
 * "covers" that no book in the catalogue has — a cream one, a green one, a navy
 * one — which is the kind of thing a reader notices the moment they click
 * through and find a different book.
 *
 * THE TYPE IS NEVER IN THE IMAGE. Every word on this section is live HTML:
 * selectable, translatable, searchable, and legible to a screen reader. The
 * photograph carries no lettering at all.
 *
 * THE BOOKS AND THE TYPE NEVER SHARE PIXELS. The plate puts its three books in the
 * right 62% of the picture (the first book's spine is 38% of the way across); the
 * left 38% is empty wall and olive leaves, and that is where the headline goes. That
 * only works when the picture is shown at its own proportions on a screen wide
 * enough for the type to fit in the left 38% of it — the shape of the old full-bleed
 * `object-cover` hero on a 16:9 monitor, and nothing else. On a 1440x900 laptop,
 * a tablet or a phone `object-cover` crops the picture and slides the books under
 * the paragraph (measured: at 768px the paragraph ran over "Quinn Gallagher"; at 1440px
 * the third book was cut off by the screen edge). So the layout has three modes, and
 * in none of them does text sit on a cover:
 *
 *   < 640px     a banner of the three books ABOVE the headline, below the header
 *   640-1279px  the same, as a wider crop of the plate (1.9:1)
 *   >= 1280px   the whole scene, standing right of the type. It is sized so that
 *               the first book's spine starts where the type column ends — see
 *               SCENE_WIDTH — so it shrinks on a small laptop instead of cropping.
 *
 * `e2e/home.pw.ts` measures all of this: it takes the text boxes and the books'
 * rectangle (derived from the scene's own box and the plate's proportions) at nine
 * widths and fails if they touch.
 *
 * THE GRADIENT IS FUNCTIONAL, NOT DECORATIVE. At >= 1280px it is what guarantees the
 * headline's contrast against the olive leaves that reach into the type column.
 *
 * Pure Server Component — no client JS in the hero at all.
 */

/** The plate, in its own pixels (`scripts/hero/source/hero-plate-1672x941.png`). */
const PLATE = { w: 1672, h: 941 } as const;

/**
 * Where the first book's spine is, as a fraction of the plate's width: 635 / 1672 =
 * 0.3798. Everything right of it is books; everything left of it is the type's room.
 */
const BOOKS_FROM = 635 / PLATE.w;

/**
 * Where the type column ends at >= 1280px: its left padding (80px at its widest) + the
 * extra margin the 1700px-max column gets on a very wide screen + the paragraph's 480px
 * + a 24px gap. One expression, used by the scene's width and by the readability scrim,
 * so the books start where the type stops and the dark ground stops with them.
 */
const TYPE_END = "calc(80px + max(0px, (100vw - 1700px) / 2) + 504px)";

/**
 * Width of the scene at >= 1280px. The scene is right-aligned, so the first book's spine
 * lands at `100vw - (1 - 0.3798) * width`. We want that to be at least where the type
 * ends, so:
 *
 *     width <= (100vw - typeEnd) / 0.6202
 *
 * The other two terms stop it overflowing the screen (`100vw`) and, on a very wide, short
 * window, stop it being taller than the window (`100svh * 16:9`).
 */
const SCENE_WIDTH = `min(100vw, calc((100vw - var(--hero-type-end)) / ${(1 - BOOKS_FROM).toFixed(4)}), calc(100svh * ${(PLATE.w / PLATE.h).toFixed(4)}))`;

export function Hero() {
  return (
    <section data-hero className="relative isolate overflow-hidden pt-16 xl:pt-0" style={{ "--hero-type-end": TYPE_END } as CSSProperties}>
      {/* ---------------------------------------------------------------
          The picture. `<picture>` rather than next/image because the three
          layouts are three different crops of the plate, not three sizes of
          one: the phone gets the books alone, the tablet the plate's full width
          trimmed top and bottom, the desktop the plate whole.

          Below 1280px it is a block in the page — under the header, above the
          type. From 1280px it is absolutely positioned against the section's
          right edge and sized by SCENE_WIDTH, and it stands on the foot of
          the FIRST SCREEN, not of the section: on a 1280x720 laptop the
          section is ~900px tall, and a scene aligned to its foot had the books
          cut off by the fold. `min(100%, 100svh)` is the section's height or
          the window's, whichever is shorter; `.hero-scene-box` (globals.css)
          sets the scene's top from it, and never lets the first cover rise
          above the header. Its box always has the aspect
          ratio of the crop it is showing, so nothing is cropped by CSS and
          nothing shifts when the file arrives.
          --------------------------------------------------------------- */}
      <div aria-hidden className="xl:pointer-events-none xl:absolute xl:inset-x-0 xl:top-0 xl:h-[min(100%,100svh)]">
        <div
          data-hero-scene
          className="hero-scene-box relative aspect-[2190/1800] w-full sm:aspect-[3344/1762] xl:absolute xl:right-0 xl:aspect-[1672/941] xl:w-[var(--hero-scene-w)]"
          style={{ "--hero-scene-w": SCENE_WIDTH } as CSSProperties}
        >
          <div className="hero-scene-mask absolute inset-0">
            <picture className="block h-full w-full">
              <source
                media="(max-width: 639px)"
                type="image/avif"
                srcSet="/images/homepage/hero-featured-banner-640.avif 640w, /images/homepage/hero-featured-banner-960.avif 960w, /images/homepage/hero-featured-banner-1280.avif 1280w"
                sizes="100vw"
              />
              <source
                media="(max-width: 639px)"
                type="image/webp"
                srcSet="/images/homepage/hero-featured-banner-640.webp 640w, /images/homepage/hero-featured-banner-960.webp 960w, /images/homepage/hero-featured-banner-1280.webp 1280w"
                sizes="100vw"
              />
              <source
                media="(max-width: 1279px)"
                type="image/avif"
                srcSet="/images/homepage/hero-featured-wide-960.avif 960w, /images/homepage/hero-featured-wide-1280.avif 1280w, /images/homepage/hero-featured-wide-1672.avif 1672w, /images/homepage/hero-featured-wide-2560.avif 2560w"
                sizes="100vw"
              />
              <source
                media="(max-width: 1279px)"
                type="image/webp"
                srcSet="/images/homepage/hero-featured-wide-960.webp 960w, /images/homepage/hero-featured-wide-1280.webp 1280w, /images/homepage/hero-featured-wide-1672.webp 1672w, /images/homepage/hero-featured-wide-2560.webp 2560w"
                sizes="100vw"
              />
              <source
                type="image/avif"
                srcSet="/images/homepage/hero-featured-640.avif 640w, /images/homepage/hero-featured-960.avif 960w, /images/homepage/hero-featured-1280.avif 1280w, /images/homepage/hero-featured-1672.avif 1672w, /images/homepage/hero-featured-2560.avif 2560w, /images/homepage/hero-featured-3344.avif 3344w"
                sizes="100vw"
              />
              <source
                type="image/webp"
                srcSet="/images/homepage/hero-featured-640.webp 640w, /images/homepage/hero-featured-960.webp 960w, /images/homepage/hero-featured-1280.webp 1280w, /images/homepage/hero-featured-1672.webp 1672w, /images/homepage/hero-featured-2560.webp 2560w, /images/homepage/hero-featured-3344.webp 3344w"
                sizes="100vw"
              />
              {/*
                Decorative, so `alt=""`: the headline beside it already says what
                this is, and a made-up description of a photograph is noise in a
                screen reader. `fetchPriority="high"` because this is the LCP
                candidate and nothing else on the page should outrank it.
              */}
              <img
                src="/images/homepage/hero-featured-1672.webp"
                alt=""
                width={1672}
                height={941}
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </picture>
          </div>

          {/* The right-hand list and the sign-off, positioned in the plate's own
              proportions so they stay clear of the books when the scene resizes. */}
          <HeroSceneNotes />
        </div>
      </div>

      {/* Readability, from 1280px, where the olive leaves and the brass props reach
          into the type column. Strong to 280px before the type ends, gone 140px past
          it — anchored to the column in pixels, not to the screen in percent, which is
          what left "of many titles" over a brass bowl on a 2560px screen. */}
      <div
        aria-hidden
        className="absolute inset-0 hidden xl:block"
        style={{
          background:
            "linear-gradient(90deg, rgba(3,7,5,0.94) 0px, rgba(3,7,5,0.86) calc(var(--hero-type-end) - 280px), rgba(3,7,5,0.55) calc(var(--hero-type-end) - 120px), rgba(3,7,5,0.2) calc(var(--hero-type-end) + 20px), rgba(3,7,5,0) calc(var(--hero-type-end) + 140px))",
        }}
      />

      {/* The header needs a ground to read against, and the section has to hand
          over to the campaign band — the top 150px and the bottom 200px, two
          short strips rather than one gradient spanning the section, which would
          dim the photograph everywhere in between. Only where the picture runs
          behind the header (>= 1280px); below that the header sits on the page. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 hidden h-[150px] xl:block"
        style={{
          background:
            "linear-gradient(to bottom, rgba(3,7,5,0.72) 0%, rgba(3,7,5,0.28) 55%, rgba(3,7,5,0) 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 hidden h-[200px] xl:block"
        style={{
          background:
            "linear-gradient(to top, #050705 0%, rgba(5,7,5,0.72) 45%, rgba(5,7,5,0) 100%)",
        }}
      />

      {/* The editorial marginalia. Anchored to the section rather than to the
          centred text column, so they sit in the photograph's own dark margins
          — at 2000px wide that is the whole point of them. */}
      <HeroEditorialNotes />

      {/*
        WHY THIS IS NOT `max-w-7xl` ANY MORE.
        The photograph is full-bleed, the content was not. On an 1854px screen
        `max-w-7xl` (1280px) centred left a measured 280px — 15% of the
        viewport — of dead space before a single word, on the darkest part of
        the picture. It read as centred content floating on a wide image
        rather than as a page.

        A wider ceiling plus padding that grows with the viewport puts the
        headline near the left edge where an editorial page starts, and the
        gutter becomes a margin instead of a void. The ceiling is still there,
        because at 2500px a truly full-bleed text column would be unreadable.
        SCENE_WIDTH knows about this ceiling: it is the `max(0px, (100vw -
        1700px) / 2)` term.
      */}
      {/*
        `pb-[88px]` on mobile is the AI launcher's parking
        space, not padding taste. The launcher is `fixed bottom-4` and 56px
        tall, so it owns the bottom 72px of every screen. The hero stacks its
        CTAs at the bottom on a phone, so "Explore ebooks" sat underneath the
        launcher. Measured on a real Redmi Note 8, not in a simulator.
      */}
      <div className="relative mx-auto flex w-full max-w-[1700px] flex-col px-6 pb-[88px] sm:px-8 sm:pb-16 xl:min-h-[94vh] xl:px-16 xl:pb-20 xl:pt-40 2xl:px-20">
        {/* Below 1280px the type starts under the banner's melted foot. From
            1280px `my-auto` centres it in the room above the trust row, and the
            trust row stays at the foot of the section — which is where the books
            are NOT: they stand on the foot of the first screen, 56px up, and a
            row centred with the type ended up level with the first book's base
            on a 2560x1440 screen. */}
        <div className="-mt-8 max-w-[680px] sm:-mt-14 xl:my-auto xl:max-w-[700px]">
          {/* Eyebrow — a rule beneath it, not a bordered pill. */}
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#33f0aa] shadow-[0_0_8px_#33f0aa]"
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-fg-mid sm:text-[11px]">
              A Curated Library
            </span>
          </div>
          <div
            aria-hidden
            className="mt-3 h-px w-[min(300px,80%)]"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 100%)",
            }}
          />

          {/*
            THE WORDING IS UNCHANGED. The reference says "Books worth keeping."
            and it would have been easy to copy — but the headline is the one
            thing on this page that is Valice Press's rather than the mockup's.
            What changes is the typography: three lines, tighter leading, and
            the accent narrowed to the last line alone instead of the last two,
            so the emphasis lands once.
          */}
          <h1 className="mt-6 font-serif text-[44px] font-medium leading-[0.97] tracking-[-0.03em] text-fg-hi sm:text-[62px] lg:text-[68px] xl:text-[88px]">
            <span className="block">Find it.</span>
            <span className="block">Own it.</span>
            <span
              className="block"
              style={{
                background:
                  "linear-gradient(135deg, #4ff7bb 0%, #33f0aa 45%, #16c784 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Read it anywhere.
            </span>
          </h1>

          <p className="mt-6 max-w-[500px] text-[15px] leading-[1.7] text-fg-mid sm:mt-7 sm:text-[17px] xl:max-w-[480px]">
            Romance, world folklore, games and puzzles from an independent
            press. Read them in print or on Kindle through Amazon, or download
            a DRM-free PDF of many titles straight from here — yours to
            keep.
          </p>

          {/*
            "Watch Demo" is gone. There is no demo video, and a button that
            promises one is the same class of untruth as a book with an
            invented ASIN. Both CTAs now go somewhere real.
          */}
          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/books"
              className="valice-cta valice-cta-gold w-full px-7 text-[14px] sm:w-auto"
            >
              Browse the library
              <span aria-hidden className="text-[15px] leading-none">
                →
              </span>
            </Link>
            <Link
              href="/ebooks"
              className="valice-cta valice-cta-gold-ghost w-full px-7 text-[14px] sm:w-auto"
            >
              Explore ebooks
            </Link>
          </div>
        </div>

        {/* Full width, one row, spanning under the photograph rather than
            wrapping inside the text column. From 1280px it crosses the marble
            tabletop, which is the lightest thing in the frame, so it gets a
            scrim of its own — contrast measured where the background is
            brightest, not on the average. */}
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[-100vw] bottom-[-2rem] top-[-1.25rem]"
            style={{
              background:
                "linear-gradient(to bottom, rgba(3,7,5,0) 0%, rgba(3,7,5,0.72) 38%, rgba(3,7,5,0.86) 100%)",
            }}
          />
          <div className="relative">
            <TrustRow />
          </div>
        </div>
      </div>
    </section>
  );
}
