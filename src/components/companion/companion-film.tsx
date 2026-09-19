"use client";

import { AmbientVideo } from "@/components/media/ambient-video";
import { trackEvent } from "@/lib/analytics";

export interface CompanionFilmProps {
  /** Which companion this belongs to — carried into the analytics event. */
  companionSlug: string;
  src1080: string;
  src720: string;
  poster: string;
  /** What the film shows, for anyone who opts into motion. */
  label: string;
  eyebrow: string;
  heading: string;
  body: string;
  /** Short, checkable figures printed beside the film. */
  facts: ReadonlyArray<{ value: string; label: string }>;
}

/**
 * A short film at the head of a companion page, integrated rather than embedded.
 *
 * Same rules as the homepage band: full-bleed, no border, no radius, no card,
 * no shadow, no controls; silent, looping, `playsInline`; the type over it is
 * live HTML, never burned into the picture.
 *
 * THE FIGURES BESIDE IT ARE THE BOOK'S OWN. Whatever is printed here has to
 * survive being checked against the manuscript, because this page is what a
 * reader holding the paperback scans a QR code to reach — they can count.
 */
export function CompanionFilm({
  companionSlug,
  src1080,
  src720,
  poster,
  label,
  eyebrow,
  heading,
  body,
  facts,
}: CompanionFilmProps) {
  return (
    <section
      aria-labelledby="companion-film-heading"
      className="relative isolate overflow-hidden"
    >
      <div className="relative h-[58vh] min-h-[360px] w-full sm:h-auto sm:min-h-0 sm:aspect-[16/9] sm:max-h-[660px]">
        <AmbientVideo
          src1080={src1080}
          src720={src720}
          poster={poster}
          label={label}
          onPlay={() =>
            trackEvent("brand_film_play", { page: "companion", slug: companionSlug })
          }
        />

        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(5,7,5,0.94) 0%, rgba(5,7,5,0.58) 30%, rgba(5,7,5,0.08) 62%, rgba(5,7,5,0) 100%)",
          }}
        />

        <div className="absolute inset-x-0 bottom-0 px-4 pb-8 sm:px-6 sm:pb-12">
          <div className="mx-auto w-full max-w-7xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-bright/80">
              {eyebrow}
            </p>
            <h2
              id="companion-film-heading"
              className="mt-3 max-w-2xl font-serif text-[26px] font-medium leading-[1.14] tracking-tight text-white sm:text-[34px] lg:text-[38px]"
            >
              {heading}
            </h2>
            <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-white/75">
              {body}
            </p>

            {facts.length > 0 && (
              <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
                {facts.map((f) => (
                  <div key={f.label}>
                    <dt className="sr-only">{f.label}</dt>
                    <dd>
                      <span className="block font-serif text-[26px] leading-none text-white sm:text-[30px]">
                        {f.value}
                      </span>
                      <span className="mt-1.5 block text-[11px] uppercase tracking-[0.22em] text-white/55">
                        {f.label}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
