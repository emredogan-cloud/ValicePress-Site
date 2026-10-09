import { CinematicHero } from "@/components/cinematic/cinematic-hero";

/**
 * Cart hero — Phase 3.E migrated to the shared `<CinematicHero>`.
 *
 *   - `variant="empty"`     → "Your cart is empty"
 *   - `variant="with-items"`→ "{n} {book/books} in your cart" (n in emerald)
 *
 * Was ~125 lines of duplicated eyebrow + diamond + dust + headline JSX;
 * now ~30 lines of declarative composition.
 */
export function CartHero({
  variant,
  itemCount,
}: {
  variant: "empty" | "with-items";
  /** Only consulted when variant === "with-items". */
  itemCount?: number;
}) {
  if (variant === "empty") {
    return (
      <CinematicHero
        eyebrow="Your cart"
        headlineHead="Your cart is"
        headlineTail="empty"
        size="lg"
        align="center"
        dust
      />
    );
  }

  const count = itemCount ?? 0;
  const noun = count === 1 ? "book" : "books";
  return (
    <CinematicHero
      eyebrow="Your cart"
      headlineHead=""
      headlineTail={String(count)}
      // The visible headline is just the number; the heading a screen reader
      // announces says what it counts.
      headlineLabel={`${count} ${noun} in your cart`}
      size="lg"
      align="center"
      dust
      subtitle={
        <p>
          <span className="font-serif text-[20px] italic text-fg-mid">
            {noun} in your cart
          </span>
        </p>
      }
    />
  );
}
