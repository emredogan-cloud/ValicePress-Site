import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AboutBook, type AuthorProfile } from "@/components/book-detail/about-book";
import { BookHero } from "@/components/book-detail/book-hero";
import { DetailTabs, type DetailTab } from "@/components/book-detail/detail-tabs";
import { LookInside } from "@/components/book-detail/look-inside";
import { CinematicReviewForm } from "@/components/book-detail/cinematic-review-form";
import { CinematicReviewsList } from "@/components/book-detail/cinematic-reviews-list";
import { CinematicStarRating } from "@/components/book-detail/cinematic-star-rating";
import { ExploreStrip } from "@/components/book-detail/explore-strip";
import { DirectEditionPanel } from "@/components/book-detail/direct-edition-panel";
import { FormatTable } from "@/components/book-detail/format-table";
import { RelatedBooksShelf } from "@/components/book-detail/related-books-shelf";
import { CompanionCallout } from "@/components/book-detail/companion-callout";
import { authorPortraitSrc } from "@/lib/asset-map";
import { bookHighlights, descriptionParagraphs, heroBlurb, lookInsideTiles, primaryAmazonEdition } from "@/lib/book-detail";
import { bundlesContaining } from "@/lib/bundles";
import { BookAddToCart } from "@/components/book-detail/book-add-to-cart";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import { relatedBooks } from "@/lib/related-books";
import { getCompanionForBook } from "@/lib/companions";
import {
  getPublishedBookBySlug,
  listPublishedBooks,
  listPublishedBookSlugs,
} from "@/lib/db/queries/catalog";
import {
  getBookRatingAggregate,
  getReviewsForBook,
} from "@/lib/db/queries/reviews";
import { buildBookJsonLd, getBaseUrl, getCoverImageUrl } from "@/lib/seo";
import { buildPageMetadata } from "@/lib/metadata";
import { TrackEvent } from "@/components/analytics/track-event";

/**
 * /books/[slug] — Product Detail page.
 *
 * Follows the reference design (`images/book-details-page.png`), in this order:
 *
 *   1. <BookHero>      — cover; author, title, subtitle, rating line, blurb,
 *                        chips, the primary buy action and "Read a preview"
 *   2. <DetailTabs>    — Overview · Preview · About the book · About the author ·
 *                        Editions (anchors; only the sections that exist)
 *   3. <FormatTable>   — Editions card: every edition and the route that buys it
 *   4. <LookInside>    — the book's own A+ pictures, real interior pages, back
 *                        cover and passages, with a viewer
 *   5. <AboutBook>     — the description, "What you'll find inside", the author
 *   6. Reviews, related books, the closing strip (unchanged)
 *
 * Classification target preserved: `● SSG` via `generateStaticParams`
 * over `listPublishedBookSlugs()`. ISR `revalidate = 3600`.
 *
 * Functional contracts preserved end-to-end:
 *   - JSON-LD payload (Book + Product + Offer + AggregateRating when reviews
 *     exist) is rendered verbatim, and no Offer for a title not sold here
 *   - Preview pages land in the static payload (paywall-content fix)
 *   - Review submission (server action `submitReview` → revalidate) untouched
 *   - Add-to-cart uses the same `addToCart` server action + `cart-changed`
 *   - Every Amazon link is the edition's own URL from the catalogue
 */

// SSG + ISR per ADR-1. The review SUBMISSION flow calls `revalidatePath`
// for the affected slug, so new reviews appear on the next request
// without waiting the full hour.
export const revalidate = 3600;

type BookSlugParams = Promise<{ slug: string }>;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await listPublishedBookSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

/**
 * Absolute URL of the book's canonical cover for metadata and JSON-LD:
 * the manifest asset on the site origin, else the R2 public URL, else null.
 */
function canonicalCoverUrl(book: { coverSrc?: string | null; coverKey: string | null }): string | null {
  if (book.coverSrc) return `${getBaseUrl().replace(/\/$/, "")}${book.coverSrc}`;
  return getCoverImageUrl(book.coverKey);
}

export async function generateMetadata({
  params,
}: {
  params: BookSlugParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const book = await getPublishedBookBySlug(slug);
  if (!book) {
    return { title: "Book not found" };
  }

  // Description preference: explicit subtitle > description excerpt > fallback.
  const description =
    book.subtitle ??
    (book.description
      ? `${book.description.slice(0, 157).trim()}…`
      : `${book.title} — Valice Press`);

  const coverImageUrl = canonicalCoverUrl(book);
  const url = `/books/${slug}`;

  return buildPageMetadata({
    title: book.title,
    description,
    path: url,
    type: "book",
    image: coverImageUrl
      ? { url: coverImageUrl, alt: `Cover of ${book.title}` }
      : undefined,
  });
}

export default async function BookDetailPage({
  params,
}: {
  params: BookSlugParams;
}) {
  const { slug } = await params;
  const book = await getPublishedBookBySlug(slug);
  // A slug with no published row is genuinely not a product. There was once
  // a demo-catalog fallback here that rendered a "preview listing" for
  // hard-coded bestsellers; it advertised books Valice Press cannot sell.
  if (!book) notFound();

  /**
   * THE TWO QUESTIONS THIS PAGE HAS TO KEEP APART.
   *
   * `deliverableHere` — this site holds the file and may hand it over. That is
   * what the free-ebook campaign runs on.
   *
   * `sellsHere` — this site may take money for it, which additionally requires
   * a live provider price. Since the Lemon Squeezy migration of 2026-09-13
   * that is a Lemon Squeezy variant id. A book can be deliverable and still
   * not sellable: Codex Mythologica's Kindle edition is in KDP Select until
   * 2026-11-03, and exclusivity is a contract, not a missing file. Such a book
   * keeps its page, its provenance and its print links, and simply has no buy
   * button until the term lapses.
   */
  const deliverableHere = book.formats.some(
    (f) =>
      f.format === "ebook" &&
      f.fulfillment === "direct" &&
      f.availability === "available",
  );
  const sellsHere = deliverableHere && Boolean(book.providerPriceId);

  // Reviews + aggregate + related books in parallel — all `safeQuery`-
  // wrapped so a missing DB degrades to `{count: 0, average: null}` /
  // `[]` / `[]` respectively. The related-books query is the simplest
  // possible "anything else published" pick; a future SUB-PR can swap
  // it for a category- or author-similarity query.
  const [reviewItems, ratingAggregate, allBooks] = await Promise.all([
    getReviewsForBook(book.id),
    getBookRatingAggregate(book.id),
    listPublishedBooks(),
  ]);

  const related = relatedBooks(book, allBooks, {
    bundledWith: bundlesContaining(slug).flatMap((bundle) => bundle.bookSlugs),
  });

  const aggregateRatingForJsonLd =
    ratingAggregate.count > 0 && ratingAggregate.average !== null
      ? {
          ratingValue: ratingAggregate.average,
          reviewCount: ratingAggregate.count,
        }
      : null;

  // Everything below is derived from records that are verified elsewhere
  // (see src/lib/book-detail.ts) — nothing is written for the page.
  const paragraphs = descriptionParagraphs(book.description);
  const blurb = heroBlurb(paragraphs);
  const highlights = bookHighlights(slug);
  const amazonEdition = primaryAmazonEdition(book.formats);
  const look = lookInsideTiles({ slug, title: book.title });
  const authorProfiles: AuthorProfile[] = book.authorProfiles.map((a) => {
    const theirs = allBooks.filter((b) => b.authors.some((x) => x.slug === a.slug)).map((b) => b.title);
    const shown = theirs.slice(0, 3).join(", ") + (theirs.length > 3 ? ` and ${theirs.length - 3} more` : "");
    return {
      ...a,
      portraitSrc: authorPortraitSrc(a.slug),
      // No biography on file → say only what the catalogue shows, never write one.
      line: theirs.length > 0 ? `Author of ${shown} on Valice Press.` : null,
    };
  });
  const tabs: DetailTab[] = [
    { id: "overview", label: "Overview" },
    ...(look.strip.length > 0 ? [{ id: "preview", label: "Preview" }] : []),
    ...(paragraphs.length > 0 ? [{ id: "about-the-book", label: "About the book" }] : []),
    ...(authorProfiles.length > 0 ? [{ id: "about-the-author", label: "About the author" }] : []),
    ...(book.formats.length > 0 ? [{ id: "editions", label: "Editions" }] : []),
  ];

  // JSON-LD payload — identical shape to the pre-cinematic page.
  const baseUrl = getBaseUrl();
  // One cover everywhere: the manifest asset (`book.coverSrc`, attached by
  // the query layer) is canonical; the R2 `coverKey` is the fallback; the
  // typographic placeholder is last. JSON-LD and Open Graph carry the same
  // file, absolutised, so a search result and the page cannot disagree.
  const coverSrc = book.coverSrc ?? getCoverImageUrl(book.coverKey);
  const coverImageUrl = canonicalCoverUrl(book);
  const jsonLd = buildBookJsonLd({
    baseUrl,
    slug,
    title: book.title,
    subtitle: book.subtitle,
    description: book.description,
    isbn: book.isbn,
    language: book.language,
    pageCount: book.pageCount,
    priceCents: book.priceCents,
    // No Offer for a title this store does not sell — see `sellsDirect` in
    // `buildBookJsonLd`. The print editions below stay: they exist, they are
    // on Amazon, and saying so is accurate.
    sellsDirect: sellsHere,
    currency: book.currency,
    authors: book.authors,
    coverImageUrl,
    aggregateRating: aggregateRatingForJsonLd,
    // Live Amazon print editions only: a verified ASIN behind a real URL.
    printEditions: book.formats.flatMap((f) =>
      (f.format === "paperback" ||
        f.format === "hardcover" ||
        f.format === "large_print") &&
      f.fulfillment === "amazon" &&
      f.availability === "available" &&
      f.amazonUrl
        ? [{ format: f.format, url: f.amazonUrl, pageCount: f.pageCount }]
        : [],
    ),
  });

  return (
    <div className="cinematic-root">
      <CinematicHeader active="books" />

      <main id="main-content" className="relative z-10">
        {/* JSON-LD — same payload, same emission strategy */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <TrackEvent
          event="view_item"
          props={{ slug, priceCents: book.priceCents, currency: book.currency }}
        />

        <BookHero
          bookId={book.id}
          slug={slug}
          title={book.title}
          subtitle={book.subtitle}
          description={book.description}
          blurb={blurb}
          coverKey={book.coverKey}
          coverSrc={coverSrc}
          priceCents={book.priceCents}
          currency={book.currency}
          pageCount={book.pageCount}
          language={book.language}
          isbn={book.isbn}
          authors={book.authors}
          ratingAggregate={ratingAggregate}
          highlights={highlights}
          amazon={amazonEdition}
          hasPreview={look.strip.length > 0}
          // Two questions, two answers.
          //
          // `directSale` — may we CHARGE here? Only with a live provider price
          // behind the button, so a title held out of the paid checkout gets no
          // add-to-cart rather than a button that fails at the till.
          //
          // `deliverableHere` — do we hold the file? That is what the
          // free-ebook campaign runs on. Gating the gift box on `directSale`
          // would have taken the free offer off two thirds of the catalogue.
          directSale={sellsHere}
          deliverableHere={deliverableHere}
        />

        <DetailTabs tabs={tabs} />

        {/* The free companion, before any buy route. A reader arriving from
            outside — a podcast, a forum, a printed QR code — is offered the
            free material first; it is free whether or not they ever buy, and
            <DirectEditionPanel> below only renders for books we sell here. */}
        {(() => {
          const companion = getCompanionForBook(slug);
          if (!companion) return null;
          return (
            <CompanionCallout
              companionSlug={companion.slug}
              label={
                companion.calloutLabel ??
                "Printable material for this book — free, no sign-up."
              }
            />
          );
        })()}

        {/* Editions — every format this title exists in, with the buy route each
            one actually supports. Print goes to Amazon because Amazon is what
            fulfils it; see <FormatTable>. */}
        <FormatTable
          title={book.title}
          formats={book.formats}
          sellsDirectEbook={sellsHere}
          addToCartSlot={sellsHere ? <BookAddToCart bookId={book.id} /> : undefined}
        />

        {/* Only for a book we actually sell here. A reader whose only route is
            Amazon does not need to be told what our library would have given
            them. */}
        {sellsHere && (
          <DirectEditionPanel
            title={book.title}
            pageCount={book.pageCount}
            hasEpub={book.hasEpub}
            companionSlug={getCompanionForBook(slug)?.slug ?? null}
          />
        )}

        <LookInside title={book.title} note={look.note} strip={look.strip} all={look.all} />
        {look.strip.length > 0 && <TrackEvent event="sample_read" onView props={{ slug }} />}

        <AboutBook title={book.title} paragraphs={paragraphs} highlights={highlights} authors={authorProfiles} />

        {/* Reviews section */}
        <section
          id="reviews"
          aria-labelledby="reviews-heading"
          className="mx-auto mt-14 sm:mt-24 max-w-3xl px-4 sm:px-6"
        >
          <header className="text-center">
            <p className="text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">
              Reader reviews
            </p>

            <div className="relative mx-auto mt-4 flex h-6 w-6 items-center justify-center">
              <div
                aria-hidden
                className="absolute h-6 w-6 rounded-full opacity-60"
                style={{
                  background:
                    "radial-gradient(circle, rgba(51,240,170,0.7) 0%, transparent 70%)",
                }}
              />
              <span
                aria-hidden
                className="catalog-diamond block h-2 w-2 rounded-[1px] bg-[#33f0aa]"
                style={{ transform: "rotate(45deg)" }}
              />
            </div>

            <h2
              id="reviews-heading"
              className="mt-5 font-serif text-[32px] font-medium leading-tight text-fg-hi sm:text-[40px]"
            >
              What readers say
            </h2>

            {ratingAggregate.count > 0 && ratingAggregate.average !== null && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <CinematicStarRating
                  value={ratingAggregate.average}
                  size="md"
                />
                <p className="text-sm text-fg-mid">
                  <span className="font-medium text-fg-hi">
                    {ratingAggregate.average.toFixed(1)}
                  </span>{" "}
                  across {ratingAggregate.count}{" "}
                  {ratingAggregate.count === 1 ? "review" : "reviews"}
                </p>
              </div>
            )}
          </header>

          <CinematicReviewsList reviews={reviewItems} />

          {/* Write-a-review form */}
          <div className="mt-12">
            <h3 className="text-center text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">
              Write a review
            </h3>
            <CinematicReviewForm slug={slug} bookId={book.id} />
          </div>
        </section>

        {/* Phase 3.F — RelatedBooksShelf resolves the Phase 1.C
            "related shelf follow-up" carry-forward. ExploreStrip stays
            below as the closing quiet line; both surfaces complement
            each other (catalog discovery + brand closer). */}
        <RelatedBooksShelf books={related} />

        <ExploreStrip />

        <div className="h-20" />
      </main>

      <HomeFooter />
    </div>
  );
}

