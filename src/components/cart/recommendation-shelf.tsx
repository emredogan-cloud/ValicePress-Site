import type { CatalogItem } from "@/components/catalog/catalog-item";

import { RecommendationRail } from "./recommendation-rail";

/**
 * "You might like" recommendation shelf for the cart page.
 *
 * Carousel logic (arrows, scroll, soft edges) lives in the shared
 * `<CinematicRecommendationCarousel>` primitive; the cards are held still by
 * `<RecommendationRail>`.
 *
 * Picks are real published books chosen by the page (`pickRecommendations`):
 * only titles the cart will accept, none already in the cart or owned, the ones
 * most related to the cart first. When there is nothing to recommend the shelf
 * renders nothing at all — an empty "You might like" heading over a blank rail
 * is worse than no shelf.
 */
export function RecommendationShelf({ picks }: { picks: CatalogItem[] }) {
  if (picks.length === 0) return null;

  return (
    <section aria-labelledby="cart-picks-heading" className="relative mt-24 px-6 sm:mt-28">
      {/* Section heading — centered, editorial */}
      <header className="text-center">
        <h2 id="cart-picks-heading" className="font-serif text-[28px] font-medium leading-tight tracking-tight text-fg-hi sm:text-[34px]">
          You might like
        </h2>
        <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-transparent via-emerald-bright/50 to-transparent" />
      </header>

      <div className="mt-10 lg:mx-12">
        <RecommendationRail picks={picks} label="Books you might like" />
      </div>
    </section>
  );
}
