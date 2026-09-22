import Image from "next/image";
import Link from "next/link";

import { BonusForm } from "@/components/bonus/bonus-form";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import { buildPageMetadata } from "@/lib/metadata";

/**
 * /bonus — the lead magnet for THE FIRST FROST, the Larkspur Lake bonus
 * scene and recipe that accompanies *The Sweetest Season*.
 *
 * Built on the site's existing cinematic shell, not a private one:
 *   - `.cinematic-root` is the dark scope. It is also the mechanism that
 *     hides the warm `SiteHeader` (`body:has(.cinematic-root) > header
 *     { display: none }` in globals.css), and the `fg-*` tokens below are
 *     documented as only rendering correctly inside it.
 *   - `<CinematicHeader>` takes no `active` — /bonus is a campaign landing
 *     page, not one of the nav sections.
 *   - `id="main-content"` is the skip-link target every route carries.
 *
 * The accent is the promotion gold globals.css already establishes for the
 * gift box, welcome card and shared CTA (#f7dea0 / #d6b266 / #b89248) rather
 * than a second amber invented for this page. The two custom properties just
 * name it locally; the CTA itself is the shared `.valice-cta` primitive.
 *
 * Composition: one hero and nothing below it, so the five questions a lead
 * magnet has to answer — what this is, what you get, who it is for, what to
 * do, what happens next — all land before the fold.
 *
 * Rendering: server component. Only the form is a client island.
 */

const COVER = {
  src: "/images/books/the-sweetest-season.webp",
  width: 1024,
  height: 1536,
  alt: "The Sweetest Season — a Larkspur Lake novel by Harper Hayes",
} as const;

export const metadata = buildPageMetadata({
  title: "The First Frost — Exclusive Larkspur Lake Bonus",
  description:
    "A free bonus scene and recipe from The Sweetest Season by Harper Hayes.",
  path: "/bonus",
  image: {
    url: COVER.src,
    alt: COVER.alt,
    width: COVER.width,
    height: COVER.height,
  },
});

const BENEFITS = [
  "An exclusive Josie & Mara scene",
  "Mara's tested brown-butter peach cobbler recipe",
  "Instant access — no waiting",
] as const;

export default function BonusPage() {
  // NOTE: this page is statically prerendered (○), so a NEXT_PUBLIC_* value is
  // inlined at BUILD time, not read per request. The variable must therefore be
  // present in the build environment — setting it only on the running server
  // has no effect. That is the deliberate trade: the landing page ships as
  // static HTML, and changing the funnel link requires a redeploy.
  //
  // Unset is a configuration fault: the form refuses to collect an address it
  // cannot honour rather than sending a reader to an invalid destination.
  const bookfunnelUrl = process.env.NEXT_PUBLIC_BOOKFUNNEL_URL?.trim() || null;

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
          {/*
            One grid, two orders. Mobile stacks in the order a reader needs —
            kicker, cover, title, value, form — so the cover is seen before
            the ask without owning the first screen. From `lg` it becomes the
            two-column hero, the cover spanning both rows of the right column.
          */}
          <div className="mx-auto grid w-full max-w-5xl gap-y-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)] lg:items-center lg:gap-x-14 lg:gap-y-0">
            {/* 1 — kicker */}
            <p className="order-1 text-[0.66rem] font-medium uppercase tracking-[0.26em] text-[var(--bonus-accent)] lg:order-none lg:col-start-2 lg:row-start-1 lg:mb-3">
              Larkspur Lake &middot; Exclusive Bonus
            </p>

            {/* 2 — cover: compact on mobile, full column from lg */}
            <div className="order-2 flex justify-center lg:order-none lg:col-start-1 lg:row-span-2 lg:row-start-1">
              <Image
                src={COVER.src}
                alt={COVER.alt}
                width={COVER.width}
                height={COVER.height}
                priority
                sizes="(min-width: 1024px) 300px, (min-width: 640px) 190px, 42vw"
                className="h-auto w-[min(42vw,152px)] rounded-[3px] shadow-[0_1px_0_rgba(255,255,255,0.10),0_30px_64px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.07] transition-transform duration-500 sm:w-[190px] lg:w-full lg:max-w-[300px] motion-safe:hover:-translate-y-1"
              />
            </div>

            {/* 3–5 — title, value proposition, form */}
            <div className="order-3 lg:order-none lg:col-start-2 lg:row-start-2">
              <h1
                style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
                className="text-[2.05rem] leading-[1.08] tracking-[-0.01em] text-fg-hi sm:text-[2.55rem] lg:text-[3rem]"
              >
                The First Frost
              </h1>

              <p
                style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
                className="mt-2 text-[1.02rem] italic text-fg-soft sm:text-[1.1rem]"
              >
                An Exclusive Bonus Scene &amp; Recipe
              </p>

              <p className="mt-5 max-w-prose text-[0.95rem] leading-relaxed text-fg-mid">
                Step back into The Wharf Room on the first frozen morning of
                November. Read Josie and Mara&rsquo;s exclusive scene, plus get
                Mara&rsquo;s tested brown-butter peach cobbler recipe.
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

              <BonusForm bookfunnelUrl={bookfunnelUrl} />

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
            </div>
          </div>
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}
