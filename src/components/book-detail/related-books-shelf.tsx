import { CinematicBookTile } from "@/components/cinematic/cinematic-book-tile";
import { CinematicRecommendationCarousel } from "@/components/cinematic/recommendation-carousel";
import type { BookCardData } from "@/components/book-card";

/**
 * <RelatedBooksShelf> — Phase 3.F. Resolves the Phase 1.C carry-forward
 * "Related books — RecommendationShelf reuse" item.
 *
 * Lives below the reviews on `/books/[slug]`. Shows up to 6 other
 * published books in a horizontal carousel, using the same arrow + edge
 * fade primitive as the cart & library shelves
 * (`<CinematicRecommendationCarousel>`).
 *
 * The "related" definition is intentionally simple: pass any list of
 * `BookCardData` that excludes the current book. The page filters
 * `listPublishedBooks()` by `slug !== currentSlug` and takes the first
 * N entries — no scoring / similarity logic yet (a later SUB-PR can
 * graduate to category/author-based picks once those queries land).
 *
 * Renders nothing if the input is empty (e.g. it's the only book).
 */
export function RelatedBooksShelf({
  books,
}: {
  books: BookCardData[];
}) {
  if (books.length === 0) return null;

  return (
    <section className="mx-auto mt-14 sm:mt-24 max-w-[1320px] px-4 sm:px-6">
      <header className="text-center">
        <p className="text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">
          Continue reading
        </p>

        <div className="relative mx-auto mt-4 flex h-6 w-6 items-center justify-center">
          <div
            aria-hidden
            className="absolute h-6 w-6 rounded-full opacity-60"
            style={{
              background:
                "radial-gradient(circle, rgba(51, 240, 170, 0.7) 0%, transparent 70%)",
            }}
          />
          <span
            aria-hidden
            className="catalog-diamond block h-2 w-2 rounded-[1px] bg-emerald-bright"
            style={{ transform: "rotate(45deg)" }}
          />
        </div>

        <h2 className="mt-5 font-serif text-[28px] font-medium leading-tight text-fg-hi sm:text-[32px]">
          You might also like
        </h2>
      </header>

      <div className="mt-10 lg:mx-12">
        <CinematicRecommendationCarousel
          arrowVariant="outset"
          label="Related books"
          prevLabel="Previous related books"
          nextLabel="More related books"
        >
          {books.map((book) => (
            <div
              key={book.id}
              className="w-[180px] flex-shrink-0 snap-start"
            >
              <CinematicBookTile book={book} />
            </div>
          ))}
        </CinematicRecommendationCarousel>
      </div>
    </section>
  );
}
