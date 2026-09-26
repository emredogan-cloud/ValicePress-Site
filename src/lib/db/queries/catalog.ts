/**
 * Catalog read queries (Roadmap §6, §8, §10).
 *
 * Every public function:
 *   - is read-only,
 *   - returns a UI-friendly shape (no `bookAuthors` junction noise),
 *   - is wrapped in `safeQuery` so a missing/unprovisioned DB during build
 *     or scaffolding degrades to an empty result instead of crashing the
 *     page (graceful-empty-states requirement). Once `DATABASE_URL` is set,
 *     the fallback branch never executes.
 *
 * Column-level projection (via `columns: { … }`) is deliberate — the
 * `books` table carries the heavy `search_tsv` and the private
 * `master_file_key`; neither should leave the DB layer.
 */

import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import type { BookCardData } from "@/components/book-card";
import { bookCoverSrc } from "@/lib/asset-map";
import { withKindleEditions } from "@/lib/kindle-editions";
import { byPinnedRank } from "@/lib/pinned-books";

import { db } from "@/lib/db";
import type { bookFormats } from "@/lib/db/schema";

// -----------------------------------------------------------------------------
// safeQuery — make build / unprovisioned-env resilient.
// -----------------------------------------------------------------------------
async function safeQuery<T>(
  label: string,
  run: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    console.warn(
      `[catalog] ${label} failed (DB unavailable or query error):`,
      err instanceof Error ? err.message : err,
    );
    return fallback;
  }
}

// -----------------------------------------------------------------------------
// Cache tags (SUB-PR 4.2 — Next.js Data Cache invalidation surface).
//
// Any write path that mutates the catalog (e.g., admin `createBook`) calls
// `revalidateTag(CATALOG_TAG)` so cached reads pick up the change without
// waiting for the 5-minute revalidate window to elapse.
//
// Both tags are added to every cached catalog query, so an operator can
// invalidate "everything book-shaped" (CATALOG_TAG) or just the book set
// (BOOKS_TAG) depending on which surface mutated.
// -----------------------------------------------------------------------------
export const CATALOG_TAG = "catalog";
export const BOOKS_TAG = "books";
/**
 * 1-hour Data Cache window. Deliberately set to 3600s (not 300s) for two
 * reasons:
 *   1. Matches the existing `/sitemap.xml` page-level revalidate so the
 *      effective ISR cadence on the sitemap stays at 1 hour (Next.js
 *      uses min(page, cache) — a 5m inner cache would silently tighten
 *      the sitemap to 5m).
 *   2. The blog detail route consumes `getFeaturedBooks` via the
 *      `RelatedBooks` Server Component. A short inner-cache revalidate
 *      would propagate UP and turn the SUB-PR 3.2 "pure static" blog
 *      pages into ISR routes — fine in principle, but it would also
 *      mean the markdown loader (`src/lib/blog.ts`) has to read
 *      `src/content/**` at runtime, requiring `outputFileTracingIncludes`
 *      coverage. 1h ISR + the markdown trace include in `next.config.ts`
 *      together make this safe.
 */
const CACHE_REVALIDATE_SECONDS = 3600;

// -----------------------------------------------------------------------------
// Books — catalog browse + detail.
// -----------------------------------------------------------------------------

/**
 * `book_formats` rows → the shape every card surface reads.
 *
 * One function, because the catalog grid, the homepage shelf, search, the
 * category page and the author page all show format badges now where they
 * used to show a price, and five copies of this map is five chances for one
 * of them to disagree about what a book is. `unavailable` is dropped
 * everywhere for the same reason the detail page drops it: a format the
 * press decided not to produce is not news to a reader. A direct ebook with a
 * live Kindle ASIN arrives as two editions — see `withKindleEditions`.
 */
function toEditions(formats: ReadonlyArray<typeof bookFormats.$inferSelect>) {
  return withKindleEditions(formats)
    .filter((f) => f.availability !== "unavailable")
    .map((f) => ({
      format: f.format,
      availability: f.availability,
      fulfillment: f.fulfillment,
      priceCents: f.priceCents,
      currency: f.currency,
      amazonUrl: f.amazonUrl,
      pageCount: f.pageCount,
    }));
}
export async function listPublishedBooks(): Promise<BookCardData[]> {
  return safeQuery(
    "listPublishedBooks",
    async () => {
      const rows = await db.query.books.findMany({
        where: (b, { eq }) => eq(b.status, "published"),
      /* PHASE 9 — `publishedAt` alone is not a total order.
         Several books share a publication timestamp (they were provisioned in
         one batch), and Postgres is free to return tied rows in any order it
         likes. Measured: two adjacent cards on /books and /ebooks swapped
         places between two builds of identical code, at unchanged geometry —
         452px and 473px tall exchanged positions — which makes the rendered
         page irreproducible and any visual regression gate permanently flaky.
         `id` is the primary key, so it breaks every tie deterministically. */
        orderBy: (b, { desc, asc }) => [desc(b.publishedAt), asc(b.id)],
        columns: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          coverKey: true,
          priceCents: true,
          masterFileKey: true,
          epubFileKey: true,
          pageCount: true,
          providerPriceId: true,
          currency: true,
        },
        with: {
          bookAuthors: {
            orderBy: (ba, { asc }) => asc(ba.position),
            with: {
              author: { columns: { slug: true, name: true } },
            },
          },
          bookCategories: {
            with: {
              category: { columns: { name: true } },
            },
          },
          // The editions. Fetched here rather than on the detail page alone
          // because the catalog card now shows FORMAT where it used to show
          // price, and a card cannot be honest about a format it was never
          // told. See `BookCardData.editions`.
          formats: true,
        },
      });
      // Pinned books first (`@/lib/pinned-books`), then newest. Every surface
      // that draws on the whole catalogue — /books, the homepage shelf,
      // search's opening picks, the cart and library recommendations, the
      // related-books ranking — inherits the order from here.
      return rows.sort(byPinnedRank).map((b) => ({
        id: b.id,
        slug: b.slug,
        title: b.title,
        subtitle: b.subtitle,
        coverKey: b.coverKey,
        coverSrc: bookCoverSrc(b.slug),
        priceCents: b.priceCents,
        deliverableFree: Boolean(b.masterFileKey),
        buyableHere: Boolean(b.providerPriceId),
        hasEpub: Boolean(b.epubFileKey),
        pageCount: b.pageCount,
        currency: b.currency,
        authors: b.bookAuthors.map((ba) => ba.author),
        editions: toEditions(b.formats),
        // Primary collection for the catalog card — first by name when a book
        // belongs to several (deterministic; book_categories has no order col).
        primaryCategory:
          b.bookCategories
            .map((bc) => bc.category.name)
            .sort((a, z) => a.localeCompare(z))[0] ?? null,
      }));
    },
    [],
  );
}

/**
 * The "featured books" used by cross-link surfaces such as the blog's
 * `RelatedBooks` component (SUB-PR 3.2, Roadmap §13 — internal linking).
 *
 * The pinned books (`@/lib/pinned-books`) first, then the most recently
 * published, capped by `limit`. The cap is applied AFTER the pin, in code:
 * a `LIMIT` in the query would keep only the newest rows and silently drop a
 * pinned book that was published earlier. The catalogue is a few dozen rows,
 * so reading all of them costs nothing.
 *
 * Caching layout (SUB-PR 4.2):
 *   - The raw DB query (`_getFeaturedBooksFromDb`) is wrapped with
 *     `unstable_cache` so successful results live in Next.js's Data Cache
 *     for 5 minutes. Multiple `RelatedBooks` renders within that window
 *     share one Postgres round-trip.
 *   - The public `getFeaturedBooks` wraps THAT in `safeQuery` so a DB
 *     outage degrades to `[]` without poisoning the cache: when the
 *     underlying query throws, `unstable_cache` does NOT cache the
 *     rejection — the next call retries the DB.
 *   - Tag `CATALOG_TAG` / `BOOKS_TAG` lets `createBook` invalidate on
 *     write without waiting the full 5 minutes.
 */
const _getFeaturedBooksFromDb = unstable_cache(
  async (limit: number): Promise<BookCardData[]> => {
    const rows = await db.query.books.findMany({
      where: (b, { eq }) => eq(b.status, "published"),
    /* PHASE 9 — `publishedAt` alone is not a total order.
       Several books share a publication timestamp (they were provisioned in
       one batch), and Postgres is free to return tied rows in any order it
       likes. Measured: two adjacent cards on /books and /ebooks swapped
       places between two builds of identical code, at unchanged geometry —
       452px and 473px tall exchanged positions — which makes the rendered
       page irreproducible and any visual regression gate permanently flaky.
       `id` is the primary key, so it breaks every tie deterministically. */
      orderBy: (b, { desc, asc }) => [desc(b.publishedAt), asc(b.id)],
      columns: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        coverKey: true,
        priceCents: true,
        masterFileKey: true,
        epubFileKey: true,
        pageCount: true,
        providerPriceId: true,
        currency: true,
      },
      with: {
        formats: true,
        bookAuthors: {
          orderBy: (ba, { asc }) => asc(ba.position),
          with: {
            author: { columns: { slug: true, name: true } },
          },
        },
        /* The homepage card shows the collections a book actually belongs to,
           as chips. Real rows from `book_categories` — a book in one
           collection gets one chip, not an invented second. */
        bookCategories: {
          with: {
            category: { columns: { slug: true, name: true } },
          },
        },
      },
    });
    return rows.sort(byPinnedRank).slice(0, limit).map((b) => {
      const cats = b.bookCategories
        .map((bc) => bc.category)
        .filter(Boolean)
        .sort((x, y) => x.name.localeCompare(y.name));
      return {
        id: b.id,
        slug: b.slug,
        title: b.title,
        subtitle: b.subtitle,
        coverKey: b.coverKey,
        coverSrc: bookCoverSrc(b.slug),
        priceCents: b.priceCents,
        deliverableFree: Boolean(b.masterFileKey),
        buyableHere: Boolean(b.providerPriceId),
        hasEpub: Boolean(b.epubFileKey),
        pageCount: b.pageCount,
        editions: toEditions(b.formats),
        currency: b.currency,
        authors: b.bookAuthors.map((ba) => ba.author),
        primaryCategory: cats[0]?.name ?? null,
        categories: cats.map((c) => c.name),
      };
    });
  },
  // The key names the ordering as well as the query: without the `pinned`
  // segment, an entry cached by the previous (newest-only) code could be
  // served by this one until it expired.
  ["catalog:getFeaturedBooks:pinned"],
  { revalidate: CACHE_REVALIDATE_SECONDS, tags: [CATALOG_TAG, BOOKS_TAG] },
);

export async function getFeaturedBooks(limit: number): Promise<BookCardData[]> {
  return safeQuery(
    "getFeaturedBooks",
    () => _getFeaturedBooksFromDb(limit),
    [],
  );
}

/**
 * Published books that have a **direct-sale ebook edition** — the subset a
 * reader can actually buy on this site.
 *
 * Every other format links out to Amazon, so this is the real inventory of
 * the storefront as a shop rather than as a catalogue. `available` is the
 * gate, not merely the existence of an ebook row: a `coming_soon` ebook is
 * an intention, not stock.
 */
export async function listEbooks(): Promise<BookCardData[]> {
  return safeQuery(
    "listEbooks",
    async () => {
      const rows = await db.query.books.findMany({
        where: (b, { eq }) => eq(b.status, "published"),
      /* PHASE 9 — `publishedAt` alone is not a total order.
         Several books share a publication timestamp (they were provisioned in
         one batch), and Postgres is free to return tied rows in any order it
         likes. Measured: two adjacent cards on /books and /ebooks swapped
         places between two builds of identical code, at unchanged geometry —
         452px and 473px tall exchanged positions — which makes the rendered
         page irreproducible and any visual regression gate permanently flaky.
         `id` is the primary key, so it breaks every tie deterministically. */
        orderBy: (b, { desc, asc }) => [desc(b.publishedAt), asc(b.id)],
        columns: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          coverKey: true,
          priceCents: true,
          masterFileKey: true,
          epubFileKey: true,
          pageCount: true,
          providerPriceId: true,
          currency: true,
        },
        with: {
          bookAuthors: {
            orderBy: (ba, { asc }) => asc(ba.position),
            with: { author: { columns: { slug: true, name: true } } },
          },
          bookCategories: { with: { category: { columns: { name: true } } } },
          formats: true,
        },
      });

      // Pinned first among the ebooks sold here — only those that ARE sold
      // here: a pinned title whose ebook is Amazon's alone is not pulled in.
      return rows
        .sort(byPinnedRank)
        .filter((b) =>
          b.formats.some(
            (f) =>
              f.format === "ebook" &&
              f.fulfillment === "direct" &&
              f.availability === "available",
          ),
        )
        .map((b) => {
          const ebook = b.formats.find((f) => f.format === "ebook");
          return {
            id: b.id,
            slug: b.slug,
            title: b.title,
            subtitle: b.subtitle,
            coverKey: b.coverKey,
            coverSrc: bookCoverSrc(b.slug),
            // Show the ebook's own price, not the book's canonical one —
            // this page is specifically about the ebook edition.
            priceCents: ebook?.priceCents ?? b.priceCents,
            currency: ebook?.currency ?? b.currency,
            deliverableFree: Boolean(b.masterFileKey),
            buyableHere: Boolean(b.providerPriceId),
            hasEpub: Boolean(b.epubFileKey),
            pageCount: b.pageCount,
            editions: toEditions(b.formats),
            authors: b.bookAuthors.map((ba) => ba.author),
            primaryCategory:
              b.bookCategories
                .map((bc) => bc.category.name)
                .sort((a, z) => a.localeCompare(z))[0] ?? null,
          };
        });
    },
    [],
  );
}

export async function listPublishedBookSlugs(): Promise<Array<{ slug: string }>> {
  return safeQuery(
    "listPublishedBookSlugs",
    async () => {
      const rows = await db.query.books.findMany({
        where: (b, { eq }) => eq(b.status, "published"),
        columns: { slug: true },
      });
      return rows;
    },
    [],
  );
}

/**
 * One purchasable (or linkable) edition of a book.
 *
 * `fulfillment` is the field that decides what the reader is offered:
 * `direct` becomes an add-to-cart, `amazon` becomes a link out. Nothing in
 * the UI should infer that from the format name — a paperback is only an
 * Amazon link because Amazon fulfils it, and that is data, not a rule about
 * paperbacks.
 */
export interface BookFormat {
  format: "ebook" | "paperback" | "hardcover" | "large_print";
  availability: "available" | "coming_soon" | "unavailable";
  fulfillment: "direct" | "amazon";
  priceCents: number | null;
  currency: string;
  amazonAsin: string | null;
  amazonUrl: string | null;
  pageCount: number | null;
  isbn: string | null;
}

export interface BookDetail extends BookCardData {
  description: string | null;
  pageCount: number | null;
  language: string;
  isbn: string | null;
  publishedAt: Date | null;
  formats: BookFormat[];
  /**
   * True when this edition ships an EPUB alongside the watermarked PDF.
   *
   * Read from `books.epub_file_key` — the same column the fulfillment worker
   * branches on — so the storefront cannot promise a format the worker will
   * not produce. That is not hypothetical: the Dudeney Paddle description
   * once advertised an EPUB nothing delivered.
   */
  hasEpub: boolean;
  /**
   * The ACTIVE provider's id for this book's digital edition — a Lemon
   * Squeezy variant id today — or null when there is none.
   *
   * This is the storefront's single answer to "may we charge for this here?".
   * It is deliberately NOT the same question as "do we hold the file": a book
   * under an exclusivity term (Codex Mythologica, KDP Select to 2026-11-03)
   * answers yes to the second and no to the first. The buy control is not
   * rendered without it, and the checkout action refuses it a second time, so
   * a stale page cannot offer a button that fails at the till.
   */
  providerPriceId: string | null;
}

/** Display order: what we sell ourselves first, then print by weight. */
const FORMAT_ORDER: Record<BookFormat["format"], number> = {
  ebook: 0,
  paperback: 1,
  hardcover: 2,
  large_print: 3,
};

export async function getPublishedBookBySlug(
  slug: string,
): Promise<BookDetail | null> {
  return safeQuery(
    "getPublishedBookBySlug",
    async () => {
      const book = await db.query.books.findFirst({
        where: (b, { eq, and }) =>
          and(eq(b.slug, slug), eq(b.status, "published")),
        columns: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          description: true,
          coverKey: true,
          priceCents: true,
          masterFileKey: true,
          currency: true,
          pageCount: true,
          language: true,
          isbn: true,
          publishedAt: true,
          epubFileKey: true,
          providerPriceId: true,
        },
        with: {
          bookAuthors: {
            orderBy: (ba, { asc }) => asc(ba.position),
            with: {
              author: { columns: { slug: true, name: true } },
            },
          },
          formats: true,
          // Needed by the detail page's related shelf, which ranks a book in
          // the same collection above an unrelated one. Without it the rank
          // was silently dead: `primaryCategory` is optional on BookCardData,
          // so the comparison typechecked and always missed.
          bookCategories: { with: { category: { columns: { name: true } } } },
        },
      });
      if (!book) return null;
      return {
        id: book.id,
        slug: book.slug,
        title: book.title,
        subtitle: book.subtitle,
        description: book.description,
        coverKey: book.coverKey,
        coverSrc: bookCoverSrc(book.slug),
        priceCents: book.priceCents,
        deliverableFree: Boolean(book.masterFileKey),
        currency: book.currency,
        pageCount: book.pageCount,
        language: book.language,
        isbn: book.isbn,
        publishedAt: book.publishedAt,
        hasEpub: Boolean(book.epubFileKey),
        providerPriceId: book.providerPriceId,
        authors: book.bookAuthors.map((ba) => ba.author),
        primaryCategory:
          book.bookCategories
            .map((bc) => bc.category.name)
            .sort((a, z) => a.localeCompare(z))[0] ?? null,
        // `unavailable` formats are dropped rather than rendered as a
        // struck-through row: a format the press decided not to produce is
        // not news to the reader. The write-in Myth Hunter has no ebook and
        // says nothing about one. A direct ebook with a live Kindle ASIN
        // becomes two rows here — see `withKindleEditions` — and the stable
        // sort keeps this site's edition above Amazon's.
        formats: withKindleEditions(book.formats)
          .filter((f) => f.availability !== "unavailable")
          .sort((a, b) => FORMAT_ORDER[a.format] - FORMAT_ORDER[b.format])
          .map((f) => ({
            format: f.format,
            availability: f.availability,
            fulfillment: f.fulfillment,
            priceCents: f.priceCents,
            currency: f.currency,
            amazonAsin: f.amazonAsin,
            amazonUrl: f.amazonUrl,
            pageCount: f.pageCount,
            isbn: f.isbn,
          })),
      };
    },
    null,
  );
}

// -----------------------------------------------------------------------------
// Full-text search (Roadmap §10 FTS — uses `books.search_tsv` + GIN index)
//
// `websearch_to_tsquery('english', $1)` is the right parser for user input:
//   - accepts natural quoted phrases ("watermarked pdf")
//   - supports `or` and `-negation` syntax
//   - gracefully tolerates malformed input (returns an empty query, no crash)
//
// Ranking with `ts_rank(search_tsv, query)` keeps the most relevant titles
// at the top. Hard `limit(50)` caps result-set size — search is for *finding*,
// not for browsing pages of results.
//
// The user's `query` string is passed as a parameter (not interpolated), so
// it is safe from SQL injection — `websearch_to_tsquery` parses it server-side.
// -----------------------------------------------------------------------------
export async function searchBooks(query: string): Promise<BookCardData[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return safeQuery(
    "searchBooks",
    async () => {
      const rows = await db.query.books.findMany({
        where: (b, { eq, and }) =>
          and(
            eq(b.status, "published"),
            sql`${b.searchTsv} @@ websearch_to_tsquery('english', ${trimmed})`,
          ),
        /* Same tie-break as the catalog lists: ts_rank produces plenty of
           equal scores, and without a total order the results reshuffle
           between requests. */
        orderBy: (b, { desc, asc }) => [
          desc(
            sql`ts_rank(${b.searchTsv}, websearch_to_tsquery('english', ${trimmed}))`,
          ),
          asc(b.id),
        ],
        columns: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          coverKey: true,
          priceCents: true,
          masterFileKey: true,
          epubFileKey: true,
          pageCount: true,
          providerPriceId: true,
          currency: true,
        },
        with: {
          formats: true,
          bookAuthors: {
            orderBy: (ba, { asc }) => asc(ba.position),
            with: {
              author: { columns: { slug: true, name: true } },
            },
          },
        },
        limit: 50,
      });
      // Pinned books that MATCHED lead the results; the rest keep their rank.
      // A pinned book the query did not match is not added — searching for
      // "kwaidan" returns Kwaidan, not the pins.
      return rows.sort(byPinnedRank).map((b) => ({
        id: b.id,
        slug: b.slug,
        title: b.title,
        subtitle: b.subtitle,
        coverKey: b.coverKey,
        coverSrc: bookCoverSrc(b.slug),
        priceCents: b.priceCents,
        deliverableFree: Boolean(b.masterFileKey),
        buyableHere: Boolean(b.providerPriceId),
        hasEpub: Boolean(b.epubFileKey),
        pageCount: b.pageCount,
        editions: toEditions(b.formats),
        currency: b.currency,
        authors: b.bookAuthors.map((ba) => ba.author),
      }));
    },
    [],
  );
}

// -----------------------------------------------------------------------------
// Sitemap entries — published-book slugs + their last-modified timestamps.
// Used by `src/app/sitemap.ts` to emit accurate `<lastmod>` per URL.
// -----------------------------------------------------------------------------
export interface BookSitemapEntry {
  slug: string;
  lastModified: Date;
}

/**
 * Sitemap entry generator — cached on the same `CATALOG_TAG` / `BOOKS_TAG`
 * tags as `getFeaturedBooks` so a single `revalidateTag(CATALOG_TAG)` on
 * book publish invalidates both surfaces atomically.
 *
 * The page that calls this (`src/app/sitemap.ts`) has its OWN ISR cadence
 * (`revalidate: 3600`); this Data Cache layer is a second, finer-grained
 * cache. They compose: the sitemap re-renders at most every hour, and
 * within an hour, repeat calls (e.g., during a single SSG build) reuse
 * the DB result through this layer.
 */
const _getBookSitemapEntriesFromDb = unstable_cache(
  async (): Promise<BookSitemapEntry[]> => {
    const rows = await db.query.books.findMany({
      where: (b, { eq }) => eq(b.status, "published"),
      columns: { slug: true, updatedAt: true },
    });
    return rows.map((r) => ({ slug: r.slug, lastModified: r.updatedAt }));
  },
  ["catalog:getBookSitemapEntries"],
  { revalidate: CACHE_REVALIDATE_SECONDS, tags: [CATALOG_TAG, BOOKS_TAG] },
);

export async function getBookSitemapEntries(): Promise<BookSitemapEntry[]> {
  return safeQuery(
    "getBookSitemapEntries",
    () => _getBookSitemapEntriesFromDb(),
    [],
  );
}

// -----------------------------------------------------------------------------
// Cart — fetch the published-book details for the IDs in a session cart.
// -----------------------------------------------------------------------------
export async function getCartBooks(bookIds: string[]): Promise<BookCardData[]> {
  if (bookIds.length === 0) return [];
  return safeQuery(
    "getCartBooks",
    async () => {
      const rows = await db.query.books.findMany({
        where: (b, { and, eq, inArray }) =>
          and(eq(b.status, "published"), inArray(b.id, bookIds)),
        columns: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          coverKey: true,
          priceCents: true,
          masterFileKey: true,
          currency: true,
        },
        with: {
          bookAuthors: {
            orderBy: (ba, { asc }) => asc(ba.position),
            with: {
              author: { columns: { slug: true, name: true } },
            },
          },
        },
      });
      return rows.map((b) => ({
        id: b.id,
        slug: b.slug,
        title: b.title,
        subtitle: b.subtitle,
        coverKey: b.coverKey,
        coverSrc: bookCoverSrc(b.slug),
        priceCents: b.priceCents,
        deliverableFree: Boolean(b.masterFileKey),
        currency: b.currency,
        authors: b.bookAuthors.map((ba) => ba.author),
      }));
    },
    [],
  );
}

// -----------------------------------------------------------------------------
// Checkout — narrow projection of just what the active payment provider needs
// to open a checkout (id, slug, title, price, currency, provider price id).
// -----------------------------------------------------------------------------
export interface CheckoutItem {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  providerPriceId: string | null;
}

export async function getCheckoutItems(
  bookIds: string[],
): Promise<CheckoutItem[]> {
  if (bookIds.length === 0) return [];
  return safeQuery(
    "getCheckoutItems",
    async () => {
      const rows = await db.query.books.findMany({
        where: (b, { and, eq, inArray }) =>
          and(eq(b.status, "published"), inArray(b.id, bookIds)),
        columns: {
          id: true,
          // The slug is what a bundle is defined in terms of: `src/lib/bundles.ts`
          // names its members by catalogue slug, not by database uuid, so that
          // the definition survives a reseed.
          slug: true,
          title: true,
          priceCents: true,
          masterFileKey: true,
          currency: true,
          providerPriceId: true,
        },
      });
      return rows;
    },
    [],
  );
}

/**
 * Everything the purchase email needs about one book, in a single query.
 *
 * Lives here rather than being threaded through the watermark worker because
 * the worker already has the book id and nothing else it would need to carry;
 * widening its event payload to move a description and three Amazon links
 * through Inngest would make the queue contract change every time the email's
 * copy does.
 *
 * Deliberately NOT filtered on `status = 'published'`: this runs after money
 * has changed hands, and a buyer must get their receipt even if the title was
 * unpublished between the purchase and the send.
 */
export interface BookEmailDetail {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverSrc: string | null;
  /** Print editions a buyer could also get, on Amazon. Digital is excluded. */
  printEditions: Array<{ format: string; url: string }>;
}

export async function getBookEmailDetail(
  bookId: string,
): Promise<BookEmailDetail | null> {
  return safeQuery(
    "getBookEmailDetail",
    async () => {
      const row = await db.query.books.findFirst({
        where: (b, { eq }) => eq(b.id, bookId),
        columns: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          description: true,
        },
        with: { formats: true },
      });
      if (!row) return null;
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        subtitle: row.subtitle,
        description: row.description,
        coverSrc: bookCoverSrc(row.slug),
        printEditions: row.formats
          .filter(
            (f) =>
              f.format !== "ebook" &&
              f.availability === "available" &&
              Boolean(f.amazonUrl ?? f.amazonAsin),
          )
          .map((f) => ({
            format: f.format,
            url: f.amazonUrl ?? `https://www.amazon.com/dp/${f.amazonAsin}`,
          })),
      };
    },
    null,
  );
}

/**
 * Resolve a book from the payment provider's own id for it.
 *
 * The fallback path for fulfilment. Normally the webhook carries the book id
 * we put into the checkout ourselves, but two cases carry none: a purchase
 * made straight from the Lemon Squeezy storefront page (which never passed
 * through our checkout), and a replayed payload whose custom data was lost.
 * Resolving through the variant id keeps those deliverable, and — because the
 * lookup is exact and the column is unique per book — it cannot deliver the
 * wrong title, which is the one failure this whole system must not have.
 *
 * Deliberately NOT filtered on `status = 'published'`: someone who paid for a
 * book must receive it even if the storefront unpublished it an hour later.
 */
export async function getBookIdByProviderPriceId(
  providerPriceId: string,
): Promise<string | null> {
  if (!providerPriceId) return null;
  return safeQuery(
    "getBookIdByProviderPriceId",
    async () => {
      const row = await db.query.books.findFirst({
        where: (b, { eq }) => eq(b.providerPriceId, providerPriceId),
        columns: { id: true },
      });
      return row?.id ?? null;
    },
    null,
  );
}

// -----------------------------------------------------------------------------
// Categories — hub pages.
// -----------------------------------------------------------------------------
export async function listCategorySlugs(): Promise<Array<{ slug: string }>> {
  return safeQuery(
    "listCategorySlugs",
    async () => {
      const rows = await db.query.categories.findMany({
        columns: { slug: true },
      });
      return rows;
    },
    [],
  );
}

/**
 * Phase 2.D — every category with its name and slug, ordered by name.
 * Powers the `/categories` index page (the new browse-by-category hub).
 *
 * `bookCount` counts PUBLISHED books only, because it is shown to readers
 * as the size of a shelf they are about to open. Counting drafts would put
 * a number on the card that the category page then contradicts.
 */
export interface CategorySummary {
  slug: string;
  name: string;
  bookCount: number;
  /**
   * Covers of the published books actually filed in the category, newest
   * first — up to three public paths from the asset manifest. The category
   * cards compose these into their artwork, so a category looks like what is
   * in it rather than like a stock "genre world". Empty when no book in the
   * category has a cover asset.
   */
  coverSrcs: string[];
}

export async function listAllCategories(): Promise<CategorySummary[]> {
  return safeQuery(
    "listAllCategories",
    async () => {
      const rows = await db.query.categories.findMany({
        columns: { slug: true, name: true },
        with: {
          bookCategories: {
            columns: {},
            with: { book: { columns: { slug: true, status: true, publishedAt: true } } },
          },
        },
        orderBy: (c, { asc }) => asc(c.name),
      });
      return rows.map((c) => {
        // Newest first, then the pin — so the covers a category card composes
        // lead with a pinned book when, and only when, one is filed here.
        const published = c.bookCategories
          .map((bc) => bc.book)
          .filter((b) => b.status === "published")
          .sort(
            (a, b) =>
              (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
          )
          .sort(byPinnedRank);
        return {
          slug: c.slug,
          name: c.name,
          bookCount: published.length,
          coverSrcs: published
            .map((b) => bookCoverSrc(b.slug))
            .filter((src): src is string => Boolean(src))
            .slice(0, 3),
        };
      })
      /**
       * A genre hub with nothing in it is a promise the catalogue cannot keep.
       *
       * The loader already deletes a category no book is filed under at all;
       * this is the other half — a category whose books all exist but none of
       * which are currently PUBLISHED. It became real on 2026-09-12, when the
       * public-domain series was hidden for the Paddle domain review and
       * "Classics & Philosophy" went to eighteen books, none of them visible.
       * Its card would have rendered with a zero and three empty cover slots.
       *
       * Filtering here rather than in the component keeps every surface
       * agreeing: the hub grid, the count in the hero line and the sitemap all
       * read the same list. The category row itself is untouched, so the card
       * returns by itself when the books do.
       */
      .filter((c) => c.bookCount > 0);
    },
    [],
  );
}

export interface CategoryPageData {
  slug: string;
  name: string;
  /** Editorial hub copy (nullable; rendered when present). */
  description: string | null;
  books: BookCardData[];
}

export async function getCategoryPageBySlug(
  slug: string,
): Promise<CategoryPageData | null> {
  return safeQuery(
    "getCategoryPageBySlug",
    async () => {
      const category = await db.query.categories.findFirst({
        where: (c, { eq }) => eq(c.slug, slug),
        with: {
          bookCategories: {
            with: {
              book: {
                columns: {
                  id: true,
                  slug: true,
                  title: true,
                  subtitle: true,
                  coverKey: true,
                  priceCents: true,
                  masterFileKey: true,
                  epubFileKey: true,
                  pageCount: true,
                  providerPriceId: true,
                  currency: true,
                  status: true,
                  publishedAt: true,
                },
                with: {
                  formats: true,
                  bookAuthors: {
                    orderBy: (ba, { asc }) => asc(ba.position),
                    with: {
                      author: { columns: { slug: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!category) return null;

      // Only this category's books, pinned first among them. A pinned title
      // filed elsewhere stays elsewhere: the pin orders a shelf, it does not
      // stock one.
      const books: BookCardData[] = category.bookCategories
        .map((bc) => bc.book)
        .filter((b) => b.status === "published")
        .sort(
          (a, b) =>
            (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
        )
        .sort(byPinnedRank)
        .map((b) => ({
          id: b.id,
          slug: b.slug,
          title: b.title,
          subtitle: b.subtitle,
          coverKey: b.coverKey,
          coverSrc: bookCoverSrc(b.slug),
          priceCents: b.priceCents,
          deliverableFree: Boolean(b.masterFileKey),
          buyableHere: Boolean(b.providerPriceId),
          hasEpub: Boolean(b.epubFileKey),
          pageCount: b.pageCount,
          editions: toEditions(b.formats),
          currency: b.currency,
          authors: b.bookAuthors.map((ba) => ba.author),
        }));

      return {
        slug: category.slug,
        name: category.name,
        description: category.description,
        books,
      };
    },
    null,
  );
}

// -----------------------------------------------------------------------------
// Authors — author hub pages.
// -----------------------------------------------------------------------------
export async function listAuthorSlugs(): Promise<Array<{ slug: string }>> {
  return safeQuery(
    "listAuthorSlugs",
    async () => {
      const rows = await db.query.authors.findMany({
        columns: { slug: true },
      });
      return rows;
    },
    [],
  );
}

/**
 * Every author with a published book, plus how many they have.
 *
 * Powers the `/authors` discovery page. That page used to render a
 * hard-coded roster — Harari, Austen, Orwell, Rowling — with invented
 * roles and follower counts. Those are real people who do not publish with
 * Valice Press; listing them on a publisher's author page is a false claim
 * about who we publish, not placeholder styling. Real rows only.
 */
export interface AuthorSummary {
  slug: string;
  name: string;
  bio: string | null;
  bookCount: number;
}

export async function listAllAuthors(): Promise<AuthorSummary[]> {
  return safeQuery(
    "listAllAuthors",
    async () => {
      const rows = await db.query.authors.findMany({
        columns: { slug: true, name: true, bio: true },
        with: {
          bookAuthors: {
            with: { book: { columns: { status: true } } },
          },
        },
        orderBy: (a, { asc }) => asc(a.name),
      });

      return rows
        .map((a) => ({
          slug: a.slug,
          name: a.name,
          bio: a.bio,
          bookCount: a.bookAuthors.filter(
            (ba) => ba.book?.status === "published",
          ).length,
        }))
        // An author with nothing published yet has no page worth linking to.
        .filter((a) => a.bookCount > 0);
    },
    [],
  );
}

export interface AuthorPageData {
  slug: string;
  name: string;
  bio: string | null;
  books: BookCardData[];
}

export async function getAuthorPageBySlug(
  slug: string,
): Promise<AuthorPageData | null> {
  return safeQuery(
    "getAuthorPageBySlug",
    async () => {
      const author = await db.query.authors.findFirst({
        where: (a, { eq }) => eq(a.slug, slug),
        with: {
          bookAuthors: {
            with: {
              book: {
                columns: {
                  id: true,
                  slug: true,
                  title: true,
                  subtitle: true,
                  coverKey: true,
                  priceCents: true,
                  masterFileKey: true,
                  epubFileKey: true,
                  pageCount: true,
                  providerPriceId: true,
                  currency: true,
                  status: true,
                  publishedAt: true,
                },
                with: {
                  formats: true,
                  bookAuthors: {
                    orderBy: (ba, { asc }) => asc(ba.position),
                    with: {
                      author: { columns: { slug: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!author) return null;

      // This author's books only, pinned first among them.
      const books: BookCardData[] = author.bookAuthors
        .map((ba) => ba.book)
        .filter((b) => b.status === "published")
        .sort(
          (a, b) =>
            (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
        )
        .sort(byPinnedRank)
        .map((b) => ({
          id: b.id,
          slug: b.slug,
          title: b.title,
          subtitle: b.subtitle,
          coverKey: b.coverKey,
          coverSrc: bookCoverSrc(b.slug),
          priceCents: b.priceCents,
          deliverableFree: Boolean(b.masterFileKey),
          buyableHere: Boolean(b.providerPriceId),
          hasEpub: Boolean(b.epubFileKey),
          pageCount: b.pageCount,
          editions: toEditions(b.formats),
          currency: b.currency,
          authors: b.bookAuthors.map((ba) => ba.author),
        }));

      return {
        slug: author.slug,
        name: author.name,
        bio: author.bio,
        books,
      };
    },
    null,
  );
}
