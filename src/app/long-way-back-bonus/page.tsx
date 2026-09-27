import Link from "next/link";

import { BonusCover } from "@/components/bonus/bonus-cover";
import { BonusForm } from "@/components/bonus/bonus-form";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import { buildPageMetadata } from "@/lib/metadata";

/**
 * /long-way-back-bonus — the lead magnet for THE OCEAN (Sam's First Flight),
 * the bonus scene that accompanies *The Long Way Back*, Book Two of the
 * Larkspur Lake Novels. The paperback's back-cover QR code and the ebook's
 * back matter both point here.
 *
 * It is /bonus's page, not a new design: the same cinematic shell
 * (`.cinematic-root` → `CinematicHeader` → `main#main-content` →
 * `HomeFooter`), the same grid and mobile order, the same promotion-gold
 * accent, the same `BonusForm` and the same MailerLite route. Only the words,
 * the cover and two names differ:
 *   - `funnel="long-way-back"` lets the route file these readers under
 *     MAILERLITE_GROUP_ID_LONG_WAY_BACK when that group is configured (it
 *     falls back to the /bonus group until then);
 *   - NEXT_PUBLIC_BOOKFUNNEL_URL_LONG_WAY_BACK is this bonus's BookFunnel
 *     delivery page, inlined at BUILD time exactly as /bonus's is.
 *
 * Unset delivery link: the page does not render the form at all, because the
 * form would collect an address it cannot honour. It says plainly that the
 * download opens soon. Setting the variable and redeploying turns the form on.
 */

const COVER = {
  // The Book 2 ebook front cover (1600 x 2560 JPEG from BOOK-02-PUBLICATION/
  // cover/ebook-front-cover.jpg, the owner-approved art with its type), as a
  // 1000 x 1600 WebP.
  src: "/images/bonus/the-long-way-back-cover.webp",
  width: 1000,
  height: 1600,
  alt: "The Long Way Back — Book Two of The Larkspur Lake Novels by Harper Hayes",
} as const;

export const metadata = buildPageMetadata({
  title: "The Ocean — A Bonus Scene from The Long Way Back",
  description:
    "A free bonus scene from The Long Way Back by Harper Hayes: Sam Hale's first flight, and the ocean in January.",
  path: "/long-way-back-bonus",
  image: {
    url: COVER.src,
    alt: COVER.alt,
    width: COVER.width,
    height: COVER.height,
  },
});

const BENEFITS = [
  "An exclusive Sam & Priya scene",
  "A first flight, from airport security to the ocean at dusk",
  "EPUB and PDF editions",
] as const;

export default function LongWayBackBonusPage() {
  // Statically prerendered, so this NEXT_PUBLIC_* value is inlined at BUILD
  // time; changing it needs a redeploy (see /bonus for the same trade).
  const bookfunnelUrl =
    process.env.NEXT_PUBLIC_BOOKFUNNEL_URL_LONG_WAY_BACK?.trim() || null;

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
              Larkspur Lake &middot; Exclusive Bonus
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
                The Ocean
              </h1>

              <p
                style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
                className="mt-2 text-[1.02rem] italic text-fg-soft sm:text-[1.1rem]"
              >
                A Bonus Scene from The Long Way Back
              </p>

              <p className="mt-4 text-[0.95rem] leading-relaxed text-fg-soft">
                Sam Hale&rsquo;s first flight.
                <br />
                Priya and Sam&rsquo;s first winter trip to the ocean.
              </p>

              <p className="mt-4 max-w-prose text-[0.95rem] leading-relaxed text-fg-mid">
                Sam Hale has spent his whole life close to the lake. Now, for
                the first time, he&rsquo;s boarding a plane. Come along for an
                exclusive bonus scene from <em>The Long Way Back</em> as Priya
                takes Sam to see the ocean in January.
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
                    funnel="long-way-back"
                  />

                  <p className="mt-4 text-[0.72rem] leading-relaxed text-fg-fade">
                    We&rsquo;ll email you occasionally about the Larkspur Lake
                    books. Unsubscribe any time. See our{" "}
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
                    The download for <em>The Ocean</em> opens soon.
                  </p>
                  <p className="mt-1.5 text-[0.85rem] leading-relaxed text-fg-mid">
                    Please check back shortly. In the meantime, the Book One
                    bonus,{" "}
                    <Link
                      href="/bonus"
                      className="underline decoration-white/25 underline-offset-2 transition-colors hover:text-fg-soft"
                    >
                      The First Frost
                    </Link>
                    , is ready now.
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
