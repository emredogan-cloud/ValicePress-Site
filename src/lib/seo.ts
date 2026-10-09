/**
 * SEO helpers (Roadmap §13 — "the paywall-content problem" + structured data).
 *
 * Two narrow responsibilities:
 *  - URL construction (`getBaseUrl`, `getCoverImageUrl`) — never throw on
 *    missing env so build / dev / unprovisioned environments keep rendering.
 *  - JSON-LD assembly (`buildBookJsonLd`) — a typed Graph payload covering
 *    Organization + BreadcrumbList + Book + Product + Offer, plus an
 *    optional `AggregateRating` on both Book and Product when review data
 *    is available (added in SUB-PR 3.3).
 */

import { SOCIAL_URLS } from "@/lib/social";
import type {
  BreadcrumbList,
  Graph,
  Organization,
  SearchAction,
  WithContext,
} from "schema-dts";

import { getSiteUrl } from "./site-url";

export const SITE_NAME = "Valice Press";

/**
 * What the press is, in one sentence — the default <meta description>, the homepage's,
 * the WebSite and Organization nodes' and the hero's own paragraph all say this, so
 * they cannot drift into describing different businesses (they did: the hero said
 * "romance, folklore, games" while three descriptions still said "a digital bookstore").
 * True of the catalogue as it stands: every title is on Amazon, many are also sold here.
 */
export const SITE_DESCRIPTION =
  "Independent press: romance, world folklore, games and puzzles. Print and Kindle editions on Amazon; many titles also here as DRM-free PDFs.";

/**
 * The press as a structured-data entity — ONE definition, used by every graph
 * (home, book, author), because the `@id` is the same everywhere and a page that
 * declared it without the logo and the profiles would tell a crawler the press is
 * a thinner entity than the page next to it says it is.
 *
 * `logo` is the square 512px derivative of the supplied logo file (it exists under
 * /public — never a placeholder URL) and `sameAs` is the press's four social
 * profiles from `@/lib/social`, the one place those addresses are written.
 */
export function organizationNode(baseUrl: string, description?: string): Organization {
  return {
    "@type": "Organization",
    "@id": `${baseUrl}/#organization`,
    name: SITE_NAME,
    url: baseUrl,
    ...(description ? { description } : {}),
    logo: {
      "@type": "ImageObject",
      url: `${baseUrl}/images/brand/valice-press-logo-512.png`,
      width: "512",
      height: "512",
    },
    sameAs: [...SOCIAL_URLS],
  };
}

/**
 * Canonical site origin. Delegates to the single source of truth
 * (`getSiteUrl`) so canonical / OG / JSON-LD / sitemap / robots all resolve
 * through one validated, empty-safe, fallback-guarded resolver (WS-A).
 * Never throws.
 */
export function getBaseUrl(): string {
  return getSiteUrl();
}

/**
 * Construct a public URL for a cover stored at `coverKey` in R2.
 *
 * Returns `null` when either `coverKey` is empty OR `R2_PUBLIC_BASE_URL`
 * has not been provisioned. Both cases fall back to the typographic
 * placeholder rendered by `<CoverImage />` — no broken image links and
 * no Next/Image attempts against an unconfigured host.
 */
export function getCoverImageUrl(
  coverKey: string | null | undefined,
): string | null {
  if (!coverKey) return null;
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${coverKey.replace(/^\//, "")}`;
}

/**
 * Inputs for the optional `AggregateRating` block. When `reviewCount` is
 * 0 the caller MUST omit this argument (or pass `null`); Google's rich-
 * result eligibility rejects `aggregateRating: { reviewCount: 0 }`, and
 * including a "0-star" rating actively hurts the page's perceived signal.
 */
export interface AggregateRatingInput {
  /** Mean rating across approved reviews. */
  ratingValue: number;
  /** Total count of approved reviews. */
  reviewCount: number;
  /** Defaults to 5 if omitted. */
  bestRating?: number;
  /** Defaults to 1 if omitted. */
  worstRating?: number;
}

interface BookJsonLdArgs {
  baseUrl: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  isbn: string | null;
  language: string;
  pageCount: number | null;
  priceCents: number;
  /** ISO-4217 currency code (e.g., "USD"). */
  currency: string;
  /**
   * Does THIS STORE sell this book, today?
   *
   * An Offer is a statement that we will take money for this at this price, so
   * it may only be emitted when that is true. It used to be inferred from
   * `priceCents > 0`, which was a safe proxy only while the two always moved
   * together. They stopped on 2026-09-12: Paddle's review declined the domain
   * for "reselling/redistribution of third party content", eighteen
   * public-domain titles came off the paid checkout, and a price left in place
   * for any reason would have gone on advertising an offer nobody can accept.
   * Passing the fact explicitly is the difference between markup that is
   * accurate and markup that happens to be accurate.
   */
  sellsDirect?: boolean;
  authors: ReadonlyArray<{ name: string }>;
  coverImageUrl: string | null;
  /**
   * Aggregate review rating, when available. Pass `null` (or omit) when
   * there are zero approved reviews; the helper will then leave the
   * `aggregateRating` field off both Book and Product entities entirely.
   */
  aggregateRating?: AggregateRatingInput | null;
  /**
   * Print editions that are actually live on Amazon with a verified ASIN.
   * Emitted as `workExample` Book nodes (bookFormat + url) under the main
   * Book — a statement that the edition exists and where it is, never an
   * Offer: Amazon sells those, not this store.
   */
  printEditions?: ReadonlyArray<{
    format: "paperback" | "hardcover" | "large_print";
    url: string;
    pageCount?: number | null;
  }>;
}

const PRINT_FORMAT_SCHEMA = {
  paperback: {
    bookFormat: "https://schema.org/Paperback",
    label: "Paperback",
  },
  hardcover: {
    bookFormat: "https://schema.org/Hardcover",
    label: "Hardcover",
  },
  large_print: {
    bookFormat: "https://schema.org/Paperback",
    label: "Large print paperback",
  },
} as const;

/**
 * Build the JSON-LD `AggregateRating` literal once and reuse it across
 * Book + Product, so the two entities never drift in `ratingValue` or
 * `reviewCount`.
 */
function buildAggregateRatingBlock(input: AggregateRatingInput) {
  return {
    "@type": "AggregateRating" as const,
    ratingValue: input.ratingValue,
    reviewCount: input.reviewCount,
    bestRating: input.bestRating ?? 5,
    worstRating: input.worstRating ?? 1,
  };
}

/**
 * JSON-LD `@graph` for the book detail page — Organization,
 * BreadcrumbList, Book, Product + nested Offer, and (when review data
 * exists) `AggregateRating` on both Book and Product.
 *
 * Wrapped in a single graph (rather than multiple `<script>` tags) so
 * `@id` cross-references are visible to crawlers; the Book and Product
 * share canonical identity through the shared book URL.
 */
export function buildBookJsonLd(args: BookJsonLdArgs): Graph {
  const bookUrl = `${args.baseUrl}/books/${args.slug}`;
  const longDescription = args.description ?? args.subtitle ?? undefined;
  const cover = args.coverImageUrl ?? undefined;
  const priceText = (args.priceCents / 100).toFixed(2);

  // Guard: only emit aggregateRating when there is actually rating data.
  // Google rich-results eligibility rejects a `reviewCount: 0` entry.
  const aggregateRatingBlock =
    args.aggregateRating && args.aggregateRating.reviewCount > 0
      ? buildAggregateRatingBlock(args.aggregateRating)
      : null;

  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(args.baseUrl),
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: args.baseUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Books",
            item: `${args.baseUrl}/books`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: args.title,
            item: bookUrl,
          },
        ],
      },
      {
        "@type": "Book",
        "@id": `${bookUrl}#book`,
        name: args.title,
        ...(longDescription ? { description: longDescription } : {}),
        ...(args.isbn ? { isbn: args.isbn } : {}),
        bookFormat: "https://schema.org/EBook",
        inLanguage: args.language,
        ...(args.authors.length > 0
          ? {
              author: args.authors.map((a) => ({
                "@type": "Person" as const,
                name: a.name,
              })),
            }
          : {}),
        ...(args.pageCount ? { numberOfPages: args.pageCount } : {}),
        ...(cover ? { image: cover } : {}),
        ...(aggregateRatingBlock
          ? { aggregateRating: aggregateRatingBlock }
          : {}),
        ...(args.printEditions && args.printEditions.length > 0
          ? {
              workExample: args.printEditions.map((e) => ({
                "@type": "Book" as const,
                name: `${args.title} (${PRINT_FORMAT_SCHEMA[e.format].label})`,
                bookFormat: PRINT_FORMAT_SCHEMA[e.format].bookFormat,
                url: e.url,
                ...(e.pageCount ? { numberOfPages: e.pageCount } : {}),
              })),
            }
          : {}),
      },
      {
        "@type": "Product",
        name: args.title,
        ...(longDescription ? { description: longDescription } : {}),
        ...(cover ? { image: [cover] } : {}),
        brand: { "@type": "Organization", name: SITE_NAME },
        // An Offer is a statement that WE sell this, at this price. A book
        // with a price of 0 is not free — it is a title this store does not
        // sell, whose editions are all fulfilled by Amazon. Emitting
        // `price: "0.00"` + `InStock` for those told Google, and any
        // aggregator reading the markup, that Codex Mythologica was a free
        // download. No offer is the accurate markup when there is no offer.
        ...((args.sellsDirect ?? true) && args.priceCents > 0
          ? {
              offers: {
                "@type": "Offer" as const,
                url: bookUrl,
                price: priceText,
                priceCurrency: args.currency.toUpperCase(),
                availability: "https://schema.org/InStock",
                seller: { "@type": "Organization" as const, name: SITE_NAME },
              },
            }
          : {}),
        ...(aggregateRatingBlock
          ? { aggregateRating: aggregateRatingBlock }
          : {}),
      },
    ],
  };
}

/**
 * JSON-LD `@graph` for the site root — Organization + WebSite. Intended to
 * be emitted ONLY on the homepage (`src/app/page.tsx`).
 *
 * Why homepage-only and not the root layout: every book-detail graph
 * (`buildBookJsonLd`) already emits an Organization node under the SAME
 * `@id` (`${baseUrl}/#organization`). Declaring this graph globally would
 * produce duplicate `@id` nodes on those pages. The homepage carries no
 * book graph, so emitting it here keeps each `@id` unique per page while
 * still establishing the canonical brand + site entities that every book
 * graph cross-references.
 *
 * The `WebSite` node advertises on-site search via a `SearchAction`
 * (Google's sitelinks-search-box hint); its target — `/search?q=…` — is a
 * real, functioning endpoint, kept crawlable-but-`noindex` so the action
 * resolves for users while the results pages stay out of the index.
 *
 * The Organization node (logo, sameAs) comes from `organizationNode`, the single
 * source of brand identity for structured data.
 */
export function buildSiteJsonLd(baseUrl: string): Graph {
  // schema-dts models schema.org, which has no `query-input` property —
  // that token is Google's search-box convention, not a schema.org term.
  // Assert the action as `SearchAction` so the literal still lands in the
  // emitted JSON without loosening the typing of the rest of the graph.
  const searchAction = {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${baseUrl}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  } as unknown as SearchAction;

  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(baseUrl, SITE_DESCRIPTION),
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        url: baseUrl,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": `${baseUrl}/#organization` },
        potentialAction: searchAction,
      },
    ],
  };
}

export interface BreadcrumbTrail {
  name: string;
  /** Path relative to the site origin, e.g. `"/authors"`. */
  path: string;
}

/**
 * Reusable `BreadcrumbList` JSON-LD for hub/detail pages (WS-G). Emit it as
 * its own `<script type="application/ld+json">` — Google reads breadcrumbs
 * independently of any page graph, so multiple JSON-LD blocks are fine.
 */
export function buildBreadcrumbJsonLd(
  baseUrl: string,
  trail: ReadonlyArray<BreadcrumbTrail>,
): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: `${baseUrl}${crumb.path}`,
    })),
  };
}

interface AuthorJsonLdArgs {
  baseUrl: string;
  slug: string;
  name: string;
  bio: string | null;
  /** Researched facts, when the directory has them. Dates are four-digit years and only for 1000 onwards. */
  details?: {
    birthDate?: string;
    deathDate?: string;
    birthPlace?: string;
    deathPlace?: string;
    /** Absolute URL of the portrait. */
    image?: string;
    /** The person's own records elsewhere: Wikipedia, Wikidata, the Library of Congress. */
    sameAs?: string[];
  };
}

/**
 * JSON-LD `@graph` for an author page (WS-G) — Organization (cross-ref) +
 * BreadcrumbList + ProfilePage + Person. Establishes the author as a first-
 * class entity (E-E-A-T / knowledge-graph) under the same brand `@id` every
 * other graph references; the page's books link back via each book's own
 * `Book.author` Person (see `buildBookJsonLd`).
 */
export function buildAuthorJsonLd(args: AuthorJsonLdArgs): Graph {
  const url = `${args.baseUrl}/authors/${args.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(args.baseUrl),
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: args.baseUrl },
          {
            "@type": "ListItem",
            position: 2,
            name: "Authors",
            item: `${args.baseUrl}/authors`,
          },
          { "@type": "ListItem", position: 3, name: args.name, item: url },
        ],
      },
      {
        "@type": "ProfilePage",
        "@id": `${url}#profilepage`,
        url,
        name: args.name,
        mainEntity: { "@id": `${url}#person` },
      },
      {
        "@type": "Person",
        "@id": `${url}#person`,
        name: args.name,
        url,
        ...(args.bio ? { description: args.bio } : {}),
        ...(args.details?.birthDate ? { birthDate: args.details.birthDate } : {}),
        ...(args.details?.deathDate ? { deathDate: args.details.deathDate } : {}),
        ...(args.details?.birthPlace ? { birthPlace: { "@type": "Place" as const, name: args.details.birthPlace } } : {}),
        ...(args.details?.deathPlace ? { deathPlace: { "@type": "Place" as const, name: args.details.deathPlace } } : {}),
        ...(args.details?.image ? { image: args.details.image } : {}),
        ...(args.details?.sameAs?.length ? { sameAs: args.details.sameAs } : {}),
      },
    ],
  };
}
