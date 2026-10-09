import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand-mark";

/**
 * About hero.
 *
 * LEFT  — the brand's own words. "Independent ideas. A longer tomorrow." is the line printed under the
 *         wordmark in the logo itself, so the page opens by saying what the mark says. Under it, one
 *         plain paragraph that says what the press publishes TODAY — read off the catalogue, not a
 *         publisher's boilerplate — and two real routes.
 * RIGHT — the logo, whole: the supplied artwork on its own cream tile (`BrandLockup`; the file's ground is
 *         cream and its lettering dark green, so it sits on a tile rather than being recoloured).
 *
 * This replaced "A bookstore that doesn't lock you out", a headline for a digital-only shop, and an
 * AI-generated crystal-and-open-book scene that depicted nothing the press makes.
 *
 * Pure Server Component.
 */
export function AboutHero() {
  return (
    <section aria-labelledby="about-heading" className="relative overflow-hidden">
      {/* `grid-cols-[minmax(0,1fr)]`, not the implicit auto column: an auto track grows to fit its widest child, and
          the 420px logo made it wider than a phone — the hero is overflow-hidden, so the headline and paragraph were
          clipped on the right without the page ever scrolling. */}
      <div className="grid grid-cols-[minmax(0,_1fr)] items-center gap-12 lg:grid-cols-[minmax(0,_1fr)_minmax(0,_420px)] lg:gap-20">
        <div className="relative z-10 pt-2 text-center sm:pt-6 lg:text-left">
          <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-emerald-bright lg:text-[11px]">About Valice Press</p>

          <div className="relative mx-auto mt-4 flex h-6 w-6 items-center justify-center lg:mx-0">
            <div
              aria-hidden
              className="absolute h-6 w-6 rounded-full opacity-60"
              style={{ background: "radial-gradient(circle, rgba(51, 240, 170, 0.7) 0%, transparent 70%)" }}
            />
            <span aria-hidden className="catalog-diamond block h-2 w-2 rounded-[1px] bg-emerald-bright" style={{ transform: "rotate(45deg)" }} />
          </div>

          <h1 id="about-heading" className="mt-6 font-serif text-[40px] font-medium leading-[1.04] tracking-[-0.025em] text-fg-hi sm:text-[54px] lg:text-[64px] xl:text-[72px]">
            Independent ideas. <span className="home-headline-accent">A longer tomorrow.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-fg-mid sm:text-[17px] lg:mx-0">
            Valice Press is an independent publisher of reference books on the world&rsquo;s myths, games and puzzles, of our own editions of public-domain classics, and of small-town romance.
            Print and Kindle editions are on Amazon, and some titles are also sold here as DRM-free downloads.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
            <Link href="/books" className="home-cta-primary group inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold tracking-tight">
              <BookOpen aria-hidden className="h-4 w-4" strokeWidth={1.9} />
              Browse the books
              <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
            <Link href="/authors" className="home-cta-secondary inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-medium tracking-tight">
              Meet the authors
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[420px]">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-10 -z-10 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(51, 240, 170, 0.16) 0%, transparent 65%)" }}
          />
          <BrandLockup size={420} priority className="shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]" />
        </div>
      </div>
    </section>
  );
}
