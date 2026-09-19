import Link from "next/link";

import { CoverImage } from "@/components/cover-image";
import { FormatBadgeRow } from "@/components/format-badge-row";

/**
 * The shape every catalog list item flows in. Defined alongside the UI
 * component that consumes it; query functions in `src/lib/db/queries/*`
 * import this type and return matching objects.
 */
/** One edition of a book, as `book_formats` records it. */
export interface BookEdition {
  format: "ebook" | "paperback" | "hardcover" | "large_print";
  availability: "available" | "coming_soon" | "unavailable";
  fulfillment: "direct" | "amazon";
  /**
   * NULLABLE, and it has to stay that way. A format row can exist with no
   * price — a coming-soon hardcover that has been typeset but not listed —
   * and the schema records that as null rather than 0. Widening it to
   * `number` here would make every consumer render "$0.00" for a book that
   * simply has no price yet, which is the class of defect this catalogue
   * exists to prevent.
   */
  priceCents: number | null;
  currency: string;
  amazonUrl: string | null;
  pageCount: number | null;
}

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
   * The editions this book actually exists in, straight from `book_formats`.
   *
   * ADDED 2026-09-19, and it replaces a hard-coded lie. Every catalog card
   * used to be told `formats: ["PDF"]` by `toCatalogItems()` regardless of
   * what the book was — so a workbook with a PDF and an EPUB, a title sold
   * only in paperback on Amazon, and a hardcover all carried the same badge.
   * The cards now show format instead of price, which means the badge is the
   * card's whole claim about the product; a hard-coded one would be a card
   * that lies about what it is selling.
   *
   * Surfaces that don't need it leave it undefined.
   */
  editions?: ReadonlyArray<BookEdition>;
  /** `books.epub_file_key is not null`. The only thing that knows. */
  hasEpub?: boolean;
  /** The work's page count, for the card's content badge. */
  pageCount?: number | null;
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
        {/* The price used to be here.
            It is not hidden — it appears in Quick View, on the book page and
            at the till. It is simply not what a card is for: a grid of covers
            with a price under each is a shop, and a grid that tells you what
            each book IS is a catalogue. The badges are read off the book's
            own `book_formats` rows, so a card can only claim a format the
            book actually has. */}
        <FormatBadgeRow book={book} className="mt-2.5" />
      </div>
    </Link>
  );
}
