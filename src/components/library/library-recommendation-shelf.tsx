import { BookOpen } from "lucide-react";
import Link from "next/link";

import type { CatalogItem } from "@/components/catalog/catalog-item";
import { CinematicRecommendationCarousel } from "@/components/cinematic/recommendation-carousel";
import { RecommendationCard } from "@/components/cart/recommendation-card";

/**
 * Library bottom recommendation strip — editorial CTA LEFT + scroll-snap
 * book carousel RIGHT, inside a single glass panel.
 *
 * Phase 3.F — carousel logic moved into the shared
 * `<CinematicRecommendationCarousel>` primitive (overlay arrows + inner
 * padding so they sit cleanly inside the glass frame).
 *
 * Reuses the cart's `<RecommendationCard>` (with the inline `+`
 * add-to-cart button). On a library page, encouraging the reader to
 * add more books to their cart matches the surface intent.
 */
export function LibraryRecommendationShelf({
  picks,
}: {
  picks: CatalogItem[];
}) {
  if (picks.length === 0) return null;
  return (
    <section className="mx-auto mt-20 max-w-[1320px] px-4 sm:mt-24 sm:px-6">
      <div className="home-glass relative overflow-hidden rounded-[36px]">
        {/* Top emerald edge line */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-30 h-px bg-gradient-to-r from-transparent via-emerald-bright/40 to-transparent"
        />

        <div className="grid gap-0 lg:grid-cols-[1fr_1.6fr]">
          {/* LEFT — editorial CTA */}
          <div className="relative flex flex-col justify-center p-7 sm:p-10">
            <p className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-bright">
              Looking for your next read?
            </p>
            <h2 className="mt-4 font-serif text-[26px] font-medium leading-tight tracking-tight text-fg-hi sm:text-[32px]">
              Discover your next favorite book
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-fg-mid">
              Explore handpicked recommendations based on your interests.
            </p>
            <Link
              href="/books"
              className="home-cta-primary group mt-7 inline-flex h-11 w-fit items-center gap-2 rounded-full px-6 text-sm font-semibold tracking-tight"
            >
              <BookOpen aria-hidden className="h-4 w-4" />
              <span>Explore books</span>
              <span
                aria-hidden
                className="inline-block transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>

          {/* Vertical divider on lg+ */}
          <div
            aria-hidden
            className="pointer-events-none hidden h-full w-px self-stretch bg-gradient-to-b from-transparent via-white/[0.08] to-transparent lg:block"
          />

          {/* RIGHT — carousel */}
          <div className="relative border-t border-white/[0.05] py-7 lg:border-l lg:border-t-0 lg:py-9">
            <CinematicRecommendationCarousel arrowVariant="overlay" padX={7} label="Books to read next">
              {picks.map((book) => (
                <RecommendationCard key={book.id} book={book} />
              ))}
            </CinematicRecommendationCarousel>
          </div>
        </div>
      </div>
    </section>
  );
}
