import Link from "next/link";

import { CoverImage } from "@/components/cover-image";
import { formatPrice } from "@/lib/format";

/**
 * The shape every catalog list item flows in. Defined alongside the UI
 * component that consumes it; query functions in `src/lib/db/queries/*`
 * import this type and return matching objects.
 */
export interface BookCardData {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverKey: string | null;
  /**
   * The book's real cover as a public path (`/images/books/<slug>.webp`),
   * resolved by the query layer from the asset manifest (`@/lib/asset-map`).
   * Null when no cover asset exists. Every surface draws THIS, so the same
   * book cannot show a cover on one route and a gradient on another.
   */
  coverSrc?: string | null;
  /**
   * Every collection this book belongs to, by name, alphabetical. Real rows
   * from `book_categories` — a book in one collection has one entry. Optional:
   * surfaces that do not show chips leave it undefined.
   */
  categories?: string[];
  priceCents: number;
  /**
   * Does this store hold a file it can give away for this book?
   *
   * `books.master_file_key is not null`, and nothing else. The gift box used
   * to infer it from `priceCents > 0`, which was a sound proxy only while
   * "priced" and "we have the file" were the same set. Those separated on
   * 2026-09-12 and have stayed separate. Checked against the database that
   * day — exactly three published books have no master, and they are exactly
   * the three that must never be offered free.
   */
  deliverableFree?: boolean;
  /**
   * Can a reader actually pay for this here, right now?
   *
   * `books.provider_price_id is not null` — the book is wired to a live
   * checkout at the active payment provider. A THIRD question, distinct from
   * both "is it priced" and "do we hold the file": between retiring one
   * provider and provisioning the next, a book is priced, deliverable and
   * unbuyable all at once, and that is exactly the state the whole catalogue
   * is in on 2026-09-13.
   *
   * Surfaces that do not need it leave it undefined, and consumers fall back
   * to the price test — see `src/lib/ai/catalog-context.ts`, where getting
   * this wrong sends a reader to a page with no buy button.
   */
  buyableHere?: boolean;
  currency: string;
  authors: ReadonlyArray<{ slug: string; name: string }>;
  /**
   * Primary collection/category name from the `book_categories` relation
   * (first by name when a book is in several). Optional — surfaces that don't
   * need it (search, cart, related) leave it undefined. Used by the catalog
   * grid card so it shows the real collection instead of a hardcoded tag.
   */
  primaryCategory?: string | null;
}

export function BookCard({ book }: { book: BookCardData }) {
  return (
    <Link
      href={`/books/${book.slug}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-md"
    >
      <CoverImage title={book.title} coverKey={book.coverKey} coverSrc={book.coverSrc} />
      <div className="mt-4">
        <h3 className="font-serif text-lg font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
          {book.title}
        </h3>
        {book.subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{book.subtitle}</p>
        )}
        {book.authors.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {book.authors.map((a) => a.name).join(", ")}
          </p>
        )}
        <p className="mt-2 text-sm font-medium text-foreground">
          {formatPrice(book.priceCents, book.currency)}
        </p>
      </div>
    </Link>
  );
}
