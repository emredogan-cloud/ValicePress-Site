import Link from "next/link";

import { BonusCover } from "@/components/bonus/bonus-cover";
import { BonusForm } from "@/components/bonus/bonus-form";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import { buildPageMetadata } from "@/lib/metadata";

/**
 * /weather-permitting-bonus — the lead magnet for THE SECOND CHAIR, the
 * extended-epilogue bonus scene for *Weather Permitting* (Bristlecone
 * Emergency, Book 1, by Quinn Gallagher). The paperback's back-matter QR code
 * and printed link, and the Kindle edition's back matter, all point here.
 *
 * It is /bonus's page, not a new design: the same cinematic shell
 * (`.cinematic-root` → `CinematicHeader` → `main#main-content` →
 * `HomeFooter`), the same grid and mobile order, the same promotion-gold
 * accent, the same `BonusForm` and the same MailerLite route. Only the words,
 * the cover and two names differ:
 *   - `funnel="weather-permitting"` files these readers under
 *     MAILERLITE_GROUP_ID_WEATHER_PERMITTING. Unlike the Larkspur Lake funnels
 *     it never falls back to the /bonus list (a different series and pen
 *     name), so an unset group fails closed instead;
 *   - NEXT_PUBLIC_BOOKFUNNEL_URL_WEATHER_PERMITTING is this bonus's BookFunnel
 *     delivery page (a "simple download page"), inlined at BUILD time exactly
 *     as /bonus's is.
 *
 * Unset delivery link: the page does not render the form at all, because the
 * form would collect an address it cannot honour. It says plainly that the
 * download opens soon. Setting the variable and redeploying turns the form on.
 * The address is printed in a book, so `src/lib/printed-address.ts` forgives
 * its case.
 */

const COVER = {
  // The bonus cover: the Book 1 cover art (owner-approved) re-set with the
  // Book 1 type system and the bonus title, 1600 x 2400, as a 1000 x 1500 WebP.
  src: "/images/bonus/the-second-chair-cover.webp",
  width: 1000,
  height: 1500,
  alt: "The Second Chair — a Weather Permitting bonus scene by Quinn Gallagher",
} as const;

export const metadata = buildPageMetadata({
  title: "The Second Chair — A Weather Permitting Bonus Scene",
  description:
    "A free extended epilogue for readers of Weather Permitting by Quinn Gallagher: a quiet Sunday morning with Judith and Casey on Cold Creek Road.",
  path: "/weather-permitting-bonus",
  image: {
    url: COVER.src,
    alt: COVER.alt,
    width: COVER.width,
    height: COVER.height,
  },
});

const BENEFITS = [
  "An exclusive, steamy extended epilogue with Judith & Casey",
  "Takes place after the Epilogue, so it contains spoilers",
  "EPUB and PDF editions",
] as const;

export default function WeatherPermittingBonusPage() {
  // Statically prerendered, so this NEXT_PUBLIC_* value is inlined at BUILD
  // time; changing it needs a redeploy (see /bonus for the same trade).
  const bookfunnelUrl =
    process.env.NEXT_PUBLIC_BOOKFUNNEL_URL_WEATHER_PERMITTING?.trim() || null;

  return (
    <div
      className="cinematic-root"
      style={
        {
          "--bonus-accent": "#d6b266",
          "--bonus-accent-hi": "#f7dea0",
        } as React.CSSProperties
      }
    >
      <CinematicHeader />

      <main id="main-content" className="relative z-10">
        {/* One soft warm wash behind the cover — the page's only ornament. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(58%_42%_at_28%_30%,rgba(200,161,94,0.10),transparent_72%)]"
        />

        <div className="mx-auto max-w-[1320px] px-4 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-16 lg:pt-20">
          <div className="mx-auto grid w-full max-w-5xl gap-y-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)] lg:items-center lg:gap-x-14 lg:gap-y-0">
            {/* 1 — kicker */}
            <p className="order-1 text-[0.66rem] font-medium uppercase tracking-[0.26em] text-[var(--bonus-accent)] lg:order-none lg:col-start-2 lg:row-start-1 lg:mb-3">
              Bristlecone Emergency &middot; Exclusive Bonus
            </p>

            {/* 2 — cover: compact on mobile, full column from lg; set into the page, not framed on it */}
            <div className="order-2 flex justify-center lg:order-none lg:col-start-1 lg:row-span-2 lg:row-start-1">
              <BonusCover
                src={COVER.src}
                alt={COVER.alt}
                width={COVER.width}
                height={COVER.height}
                priority
                sizes="(min-width: 1024px) 300px, (min-width: 640px) 190px, 42vw"
                className="h-auto w-[min(42vw,152px)] sm:w-[190px] lg:w-full lg:max-w-[300px]"
              />
            </div>

            {/* 3–5 — title, value proposition, form */}
            <div className="order-3 lg:order-none lg:col-start-2 lg:row-start-2">
              <h1
                style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
                className="text-[2.05rem] leading-[1.08] tracking-[-0.01em] text-fg-hi sm:text-[2.55rem] lg:text-[3rem]"
              >
                The Second Chair
              </h1>

              <p
                style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
                className="mt-2 text-[1.02rem] italic text-fg-soft sm:text-[1.1rem]"
              >
                A Weather Permitting Bonus Scene
              </p>

              <p className="mt-4 text-[0.95rem] leading-relaxed text-fg-soft">
                Their story didn&rsquo;t end with the proposal.
              </p>

              <p className="mt-4 max-w-prose text-[0.95rem] leading-relaxed text-fg-mid">
                A quiet Sunday morning on Cold Creek Road. No pagers. No board
                meetings. Just Judith finally making the green chile right, and
                Casey realizing she never has to leave.
              </p>

              <div className="mt-6 border-t border-white/[0.07] pt-5">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-[var(--bonus-accent)]">
                  Free bonus
                </p>
                <ul className="mt-3 space-y-2">
                  {BENEFITS.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-start gap-2.5 text-[0.9rem] leading-snug text-fg-mid"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-[var(--bonus-accent)]"
                      />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {bookfunnelUrl ? (
                <>
                  <BonusForm
                    bookfunnelUrl={bookfunnelUrl}
                    funnel="weather-permitting"
                  />

                  <p className="mt-4 text-[0.72rem] leading-relaxed text-fg-fade">
                    We only ask for your email. We&rsquo;ll send you occasional
                    news about the Bristlecone Emergency books, and you can
                    unsubscribe any time. See our{" "}
                    <Link
                      href="/privacy"
                      className="underline decoration-white/25 underline-offset-2 transition-colors hover:text-fg-soft"
                    >
                      privacy policy
                    </Link>
                    .
                  </p>
                </>
              ) : (
                <div
                  role="status"
                  className="mt-7 rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-4"
                >
                  <p className="text-[0.95rem] text-fg-hi">
                    The download for <em>The Second Chair</em> opens soon.
                  </p>
                  <p className="mt-1.5 text-[0.85rem] leading-relaxed text-fg-mid">
                    Please check back shortly.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}
