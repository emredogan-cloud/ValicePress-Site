"use client";

import { useState } from "react";

import type { CatalogItem } from "@/components/catalog/catalog-item";
import { CinematicRecommendationCarousel } from "@/components/cinematic/recommendation-carousel";

import { RecommendationCard } from "./recommendation-card";

/**
 * The cards of a "You might like" shelf, held still.
 *
 * Adding a book from the shelf re-renders the page on the server, and the page
 * leaves out whatever is already in the cart — so the card the reader just
 * pressed would be swapped for a different book a moment after it showed its
 * tick, and the strip would shift under their finger. The rail therefore keeps
 * the picks it first rendered with: the card stays where it is, shows that its
 * book is in the cart, and goes back to "+" if the reader removes the line. A
 * reload picks a fresh set.
 *
 * Whether each card's book is in the cart is not decided here — each card asks
 * the cart store — so freezing the list cannot freeze a stale answer.
 */
export function RecommendationRail({ picks, label }: { picks: CatalogItem[]; label: string }) {
  const [shown] = useState(picks);
  return (
    <CinematicRecommendationCarousel arrowVariant="outset" label={label}>
      {shown.map((book) => (
        <RecommendationCard key={book.id} book={book} />
      ))}
    </CinematicRecommendationCarousel>
  );
}
