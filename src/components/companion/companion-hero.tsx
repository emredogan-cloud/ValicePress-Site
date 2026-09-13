import Link from "next/link";

import { CoverArt } from "@/components/cinematic/cover-art";
import type { CompanionView } from "@/lib/companion-view";

/**
 * The companion hero — the canonical composition approved 2026-09-13.
 *
 * Two columns on desktop: editorial text left, the book itself right. The
 * right half is a full-bleed atmosphere built from THE BOOK'S OWN COVER — the
 * same file, scaled up, blurred and pushed behind the sharp copy of itself.
 *
 * WHY THE COVER IS ITS OWN BACKGROUND. The approved reference has a
 * photographic still life behind The Great Book of World Games. No such
 * photograph exists for the other twenty-eight books, and the directive is
 * explicit that new artwork must not be generated and that one book's image
 * must never appear on another's page. Deriving the atmosphere from the
 * cover satisfies both: every page is unmistakably about its own book, the
 * palette comes from that book's own art, and nothing new had to be drawn.
 *
 * The sharp cover is `contain`-fitted inside a fixed aspect box, so no title,
 * author line or imprint is ever cropped away — a rule, not a preference.
 */
export function CompanionHero({ view }: { view: CompanionView }) {
  const { companion, coverSrc, coverAlt, coverAspect, tagline } = view;

  return (
    <section className="relative isolate overflow-hidden">
      {/* ---------------------------------------------------------------
          Atmosphere. Aria-hidden and empty-alt throughout: it is the same
          picture as the sharp cover beside it, so announcing it twice would
          make a screen reader read the book's title two ways for no gain.
          --------------------------------------------------------------- */}
      {coverSrc && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute inset-0 scale-150 bg-cover bg-center opacity-40 blur-[64px] saturate-150"
            style={{ backgroundImage: `url(${coverSrc})` }}
          />
          {/* Two washes, not one. The vertical keeps the header legible over
              any cover and lands the foot of the hero back on the page
              ground; the horizontal protects the copy column, which several
              of these covers would otherwise sit behind in pale gold. Both
              leave the middle alone so the atmosphere is actually visible —
              an earlier pass stacked two opaque gradients and erased it. */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#050705] via-transparent to-[#050705]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050705] via-[#050705]/75 to-transparent lg:via-[#050705]/55" />
        </div>
      )}

      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-14 lg:pb-20 lg:pt-16">
        {/* ---------------- copy ---------------- */}
        <div className="max-w-[36rem]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-emerald-bright lg:text-[11px]">
            Free companion
          </p>

          <h1 className="mt-5 font-serif text-[34px] font-medium leading-[1.08] tracking-tight text-fg-hi sm:text-[44px] lg:text-[56px]">
            {companion.bookTitle}
          </h1>

          {/* The gold rule and its three measured segments. */}
          <div className="mt-6 flex items-center gap-3">
            <span
              aria-hidden
              className="h-px w-10 shrink-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(214,178,102,0.7), rgba(214,178,102,0))",
              }}
            />
            {/* 12px on a phone, 11px from lg: — the house floor. Measured on
                the Redmi: tracked uppercase below 12px is the "unreadable
                small metadata" the directive warns about, and this line is
                the one that has to survive being read at arm's length. */}
            <p className="text-[12px] font-medium uppercase tracking-[0.22em] lg:text-[11px]"
               style={{ color: "#d6b266" }}>
              {tagline.join("  ·  ")}
            </p>
          </div>

          <p className="mt-6 max-w-prose text-[15px] leading-relaxed text-fg-mid sm:text-base">
            {companion.intro}
          </p>

          <p className="mt-4 text-[15px] leading-relaxed text-fg-soft">
            <span className="text-fg-hi">Free, no sign-up</span> — just open and
            print.
          </p>

          {/* The single secondary CTA. Book-specific by construction: the slug
              comes from the companion's own record, never from a literal. */}
          <div className="mt-8">
            <Link
              href={`/books/${companion.bookSlug}`}
              className="group inline-flex min-h-11 items-center gap-2 text-[15px] font-medium text-emerald-bright transition-colors hover:text-emerald-bright/80"
            >
              See the book, its formats and where to buy it
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
        </div>

        {/* ---------------- the book ---------------- */}
        {/* Capped rather than allowed to fill the column: at full width a
            1000×1600 cover stands 860px tall and shoves the copy block into
            the middle of the viewport, which is not the approved composition.
            The reference's book occupies roughly two thirds of the fold. */}
        <div className="relative mx-auto w-full max-w-[19rem] sm:max-w-[21rem] lg:max-w-[24rem]">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-8 -z-10 rounded-full opacity-60 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(214,178,102,0.18), transparent 70%)",
            }}
          />
          {/* The frame takes the COVER'S ratio, so the art fills it exactly:
              nothing is cropped and nothing is letterboxed. These covers run
              1.500–1.600, and a fixed box at either end of that range eats a
              title or an author line. */}
          <div
            className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a1410] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]"
            style={{ aspectRatio: coverAspect }}
          >
            {/* The hero image is the LCP element on this route, so it is
                eager and priority, and `sizes` is declared so the browser
                fetches a 352px file on a phone rather than the widest one.
                `<CoverArt>` letterboxes a large-trim cover instead of
                cropping it, and falls back to a typographic stand-in for the
                one book whose cover asset does not exist yet. */}
            <CoverArt
              src={coverSrc}
              alt={coverAlt}
              title={companion.bookTitle}
              eyebrow="Valice Press"
              priority
              sizes="(max-width: 640px) 88vw, (max-width: 1024px) 22rem, 34rem"
              titleClassName="font-serif text-[20px] font-medium leading-tight text-white"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
