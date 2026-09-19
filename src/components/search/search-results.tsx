import Link from "next/link";

import type { BookCardData } from "@/components/book-card";
import { CoverArt } from "@/components/cinematic/cover-art";
import { FormatBadgeRow } from "@/components/format-badge-row";

/**
 * Cinematic search-results grid — rendered when `?q=…` is present.
 *
 * Each result is a compact glass card with a CSS-rendered cover (so
 * results don't depend on R2 cover uploads), title, author, and price.
 * When the real DB has covers via `coverKey`, this can be extended to
 * prefer `<Image>` over the gradient.
 *
 * Pure Server Component; the parent `<SearchPage>` is also Server.
 */
export function SearchResults({
  query,
  results,
}: {
  query: string;
  results: BookCardData[];
}) {
  return (
    <section className="mx-auto mt-12 max-w-7xl px-6 pb-20">
      <p className="text-center text-sm text-fg-soft">
        {results.length === 0 ? (
          <>
            No results for{" "}
            <span className="text-fg-hi">&ldquo;{query}&rdquo;</span>
          </>
        ) : (
          <>
            <span className="tabular-nums text-fg-hi">
              {results.length}
            </span>{" "}
            {results.length === 1 ? "result" : "results"} for{" "}
            <span className="text-fg-hi">&ldquo;{query}&rdquo;</span>
          </>
        )}
      </p>

      {results.length === 0 ? (
        <div className="home-glass mx-auto mt-10 max-w-md rounded-2xl px-8 py-12 text-center">
          <p className="font-serif text-lg text-fg-hi">
            Try a different search.
          </p>
          <p className="mt-2 text-sm text-fg-soft">
            Fewer words, a different spelling, or browse the full catalog
            instead.
          </p>
          <Link
            href="/books"
            className="home-cta-secondary mt-6 inline-flex h-10 items-center rounded-full px-5 text-sm font-medium"
          >
            Browse catalog →
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((book) => (
            <li key={book.id}>
              <ResultCard book={book} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Compact result card — real cover + title + author + price                  */
/* -------------------------------------------------------------------------- */

function ResultCard({ book }: { book: BookCardData }) {
  const author = book.authors[0]?.name ?? "—";

  return (
    <Link
      href={`/books/${book.slug}`}
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/60"
    >
      <div className="home-card-hover relative aspect-[2/3] overflow-hidden rounded-md border border-white/[0.08] bg-[#0a1410] shadow-[0_24px_48px_-20px_rgba(0,0,0,0.7)]">
        <CoverArt
          src={book.coverSrc}
          title={book.title}
          sizes="(min-width: 1280px) 18vw, (min-width: 640px) 33vw, 50vw"
        />
      </div>
      <div className="mt-3 px-0.5">
        <h3 className="line-clamp-2 font-serif text-sm font-medium leading-snug text-fg-hi transition-colors group-hover:text-emerald-bright">
          {book.title}
        </h3>
        <p className="mt-1 text-xs text-fg-soft">{author}</p>
        {/* No rating: this card used to print a constant "4.7 ★" on every
            result. Nothing in this catalog has a review, and an invented
            score is a fabrication, not a placeholder. */}
        {/* Format, not price — see <FormatBadgeRow>. */}
        <FormatBadgeRow book={book} size="sm" className="mt-2" />
      </div>
    </Link>
  );
}
