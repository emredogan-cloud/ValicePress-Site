import { describe, expect, it } from "vitest";

import { BOOKS, CATEGORIES } from "../../../scripts/catalog/valice-catalog.mjs";

import type { BookEdition } from "@/components/book-card";
import { type CatalogItem, toCatalogItems } from "@/components/catalog/catalog-item";
import { assetExists, assetSize, bookCoverSrc } from "@/lib/asset-map";
import { withKindleEditions } from "@/lib/kindle-editions";

import {
  SHELF_ORDER,
  amazonEditions,
  buildLibraryShelves,
  isAmazonProductUrl,
  shelfFor,
  withCollections,
  type LibraryInput,
} from "./library-shelves";

// The catalogue is plain JS (see `valice-catalog.test.ts`); these are the parts
// of it the shelves read.
interface CatalogueFormat {
  format: BookEdition["format"];
  availability: BookEdition["availability"];
  fulfillment: BookEdition["fulfillment"];
  priceCents: number | null;
  pageCount: number | null;
  amazonAsin: string | null;
  amazonUrl: string | null;
}

interface CatalogueBook {
  slug: string;
  title: string;
  subtitle?: string | null;
  websiteStatus: "published" | "draft";
  kdpSelect: boolean;
  categories: string[];
  formats: CatalogueFormat[];
}

const catalogue = BOOKS as unknown as CatalogueBook[];
const published = catalogue.filter((b) => b.websiteStatus === "published");
const categories = (CATEGORIES as unknown as Array<{ slug: string; name: string }>).map(
  ({ slug, name }) => ({ slug, name }),
);

/**
 * A catalogue record as `/books` receives it. `load-catalog.mjs` writes one
 * `book_formats` row per format, and `toEditions` in `db/queries/catalog.ts`
 * splits a direct ebook's Kindle twin out (`withKindleEditions`) and drops the
 * `unavailable` rows. This does the same, so the shelves are tested on the
 * editions a reader would actually be offered.
 */
function asInput(b: CatalogueBook): LibraryInput {
  const editions: BookEdition[] = withKindleEditions(
    b.formats.map((f) => ({ ...f, isbn: null, masterFileKey: null })),
  )
    .filter((f) => f.availability !== "unavailable")
    .map((f) => ({
      format: f.format,
      availability: f.availability,
      fulfillment: f.fulfillment,
      priceCents: f.priceCents,
      currency: "USD",
      amazonUrl: f.amazonUrl,
      pageCount: f.pageCount,
    }));
  const [item] = toCatalogItems([
    {
      id: b.slug,
      slug: b.slug,
      title: b.title,
      subtitle: b.subtitle ?? null,
      priceCents: 0,
      currency: "USD",
      authors: [],
      editions,
      coverSrc: bookCoverSrc(b.slug),
    },
  ]);
  return { item, categorySlugs: b.categories };
}

/** A test-only book. Its slug is not a catalogue title and has no assets. */
function fixture(slug: string, editions: BookEdition[] = []): CatalogItem {
  return toCatalogItems([
    { id: slug, slug, title: slug, priceCents: 0, currency: "USD", authors: [], editions, coverSrc: null },
  ])[0];
}

function edition(over: Partial<BookEdition>): BookEdition {
  return {
    format: "ebook",
    availability: "available",
    fulfillment: "amazon",
    priceCents: null,
    currency: "USD",
    amazonUrl: null,
    pageCount: null,
    ...over,
  };
}

const inputs = published.map(asInput);
const library = buildLibraryShelves(inputs, categories);

describe("SHELF_ORDER", () => {
  it("names every catalogue collection exactly once", () => {
    expect([...SHELF_ORDER].sort()).toEqual(categories.map((c) => c.slug).sort());
  });

  // `book_categories` has no order column, so the database cannot say which
  // collection is a book's main one; the catalogue can — it lists it first.
  // This is the test that keeps the shelves and the catalogue in step.
  it("stands every published book on the collection its catalogue record lists first", () => {
    for (const b of published) {
      expect(shelfFor(b.categories), b.slug).toBe(b.categories[0]);
    }
  });
});

describe("buildLibraryShelves, over the real catalogue", () => {
  it("stands every published book on exactly one shelf, and drops none", () => {
    const placed = library.shelves.flatMap((s) => s.books.map((b) => b.item.slug));
    expect(library.unshelved).toEqual([]);
    expect([...placed].sort()).toEqual(published.map((b) => b.slug).sort());
  });

  it("builds no empty shelf, and stacks the shelves in SHELF_ORDER", () => {
    for (const s of library.shelves) {
      expect(s.books.length, s.category.slug).toBeGreaterThan(0);
    }
    const ranks = library.shelves.map((s) => SHELF_ORDER.indexOf(s.category.slug));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("reaches every collection that holds a published book — by its shelf, or as a cross-shelf collection", () => {
    const shelved = new Set(library.shelves.map((s) => s.category.slug));
    const cross = new Set(library.crossShelfCategories.map((c) => c.slug));
    for (const slug of new Set(published.flatMap((b) => b.categories))) {
      expect(shelved.has(slug) !== cross.has(slug), slug).toBe(true);
    }
  });

  it("keeps the order it was given within a shelf", () => {
    const given = [...inputs].reverse();
    const position = new Map(given.map((b, i) => [b.item.slug, i]));
    for (const s of buildLibraryShelves(given, categories).shelves) {
      const order = s.books.map((b) => position.get(b.item.slug) as number);
      expect(order, s.category.slug).toEqual([...order].sort((a, b) => a - b));
    }
  });

  it("draws each cover from its thumb when one exists, at the proportion the manifest records", () => {
    for (const s of library.shelves) {
      for (const b of s.books) {
        const thumb = `/images/books/thumb/${b.item.slug}.webp`;
        if (b.item.coverSrc && assetExists(thumb)) expect(b.textureSrc, b.item.slug).toBe(thumb);
        const size = b.textureSrc ? assetSize(b.textureSrc) : null;
        expect(b.aspect, b.item.slug).toBe(size ? size.height / size.width : 1.5);
      }
    }
  });
});

describe("withCollections — the page's two reads, joined", () => {
  // What `listPublishedCollections()` returns: one row per collection, holding
  // the PUBLISHED books filed in it. The loader writes `book_categories` from
  // each record's `categories`, so this is the database's view of the catalogue.
  const memberships = categories.map((c) => ({
    ...c,
    bookSlugs: published.filter((b) => b.categories.includes(c.slug)).map((b) => b.slug),
  }));
  const items = published.map((b) => asInput(b).item);
  const joined = withCollections(items, memberships);

  it("files every book in exactly the collections its record lists, whatever order the database returns", () => {
    for (const [i, b] of published.entries()) {
      expect([...joined.books[i].categorySlugs].sort(), b.slug).toEqual([...b.categories].sort());
    }
    const shuffled = withCollections(items, [...memberships].reverse());
    const viaDb = buildLibraryShelves(shuffled.books, shuffled.categories);
    expect(viaDb.shelves.map((s) => [s.category.slug, s.books.map((x) => x.item.slug)])).toEqual(
      library.shelves.map((s) => [s.category.slug, s.books.map((x) => x.item.slug)]),
    );
    expect(viaDb.crossShelfCategories).toEqual(library.crossShelfCategories);
  });

  it("keeps a book that no collection lists, so the shelves can report it", () => {
    const { books } = withCollections([fixture("fixture-orphan")], memberships);
    expect(books).toEqual([{ item: expect.objectContaining({ slug: "fixture-orphan" }), categorySlugs: [] }]);
    expect(buildLibraryShelves(books, categories).unshelved).toHaveLength(1);
  });
});

describe("Amazon editions, over the real catalogue", () => {
  const offered = new Map(
    library.shelves.flatMap((s) => s.books).map((b) => [b.item.slug, b.amazonEditions]),
  );

  it("offers exactly the book's own available Amazon editions — none invented, none lost", () => {
    for (const b of published) {
      // An Amazon-fulfilled edition counts when it is available; a direct
      // ebook's ASIN is its Kindle twin, which is on sale by definition.
      const own = b.formats
        .filter((f) =>
          f.amazonUrl !== null &&
          (f.fulfillment === "amazon" ? f.availability === "available" : f.format === "ebook"),
        )
        .map((f) => f.amazonUrl as string);
      const urls = (offered.get(b.slug) ?? []).map((e) => e.url);
      expect([...urls].sort(), b.slug).toEqual([...own].sort());
    }
  });

  it("never leaves a KDP Select title without an Amazon link — its ebook is sold only there", () => {
    for (const b of published.filter((x) => x.kdpSelect)) {
      expect(offered.get(b.slug)?.length ?? 0, b.slug).toBeGreaterThan(0);
    }
  });

  it("lists editions in Quick View's order: Kindle, paperback, hardcover, large print", () => {
    const rank = ["Kindle", "Paperback", "Hardcover", "Large Print"];
    for (const [slug, editions] of offered) {
      const ranks = editions.map((e) => rank.indexOf(e.label));
      expect(ranks.every((r) => r >= 0), slug).toBe(true);
      expect(ranks, slug).toEqual([...ranks].sort((a, b) => a - b));
    }
  });
});

describe("isAmazonProductUrl", () => {
  it("accepts the catalogue's own link and a pasted Attribution link on amazon.com", () => {
    expect(isAmazonProductUrl("https://www.amazon.com/dp/B0HLPPCVT3")).toBe(true);
    expect(isAmazonProductUrl("https://www.amazon.com/dp/B0HLPPCVT3?maas=maas_adg_x&ref_=aa_maas")).toBe(true);
  });

  it("refuses another scheme, a look-alike host, another marketplace and a non-URL", () => {
    expect(isAmazonProductUrl("http://www.amazon.com/dp/B0HLPPCVT3")).toBe(false);
    expect(isAmazonProductUrl("javascript:alert(1)")).toBe(false);
    expect(isAmazonProductUrl("https://www.amazon.com.example.net/dp/B0HLPPCVT3")).toBe(false);
    expect(isAmazonProductUrl("https://www.amazon.co.uk/dp/B0HLPPCVT3")).toBe(false);
    expect(isAmazonProductUrl("B0HLPPCVT3")).toBe(false);
  });
});

describe("amazonEditions", () => {
  it("skips direct, coming-soon, unlinked and off-Amazon editions", () => {
    const item = fixture("fixture-editions", [
      edition({ fulfillment: "direct", amazonUrl: null }),
      edition({ format: "hardcover", availability: "coming_soon", amazonUrl: "https://www.amazon.com/dp/HC" }),
      edition({ format: "large_print", amazonUrl: null }),
      edition({ format: "paperback", amazonUrl: "https://example.com/dp/PB" }),
      edition({ format: "paperback", amazonUrl: "https://www.amazon.com/dp/PB" }),
    ]);
    expect(amazonEditions(item)).toEqual([
      { format: "paperback", label: "Paperback", url: "https://www.amazon.com/dp/PB" },
    ]);
  });
});

describe("shelf edge cases", () => {
  const known = [
    { slug: "romance", name: "Romance" },
    { slug: "zz-new", name: "A collection added later" },
    { slug: "aa-new", name: "Another added later" },
  ];

  it("gives a collection missing from SHELF_ORDER a shelf after the listed ones, by slug", () => {
    expect(shelfFor(["zz-new", "romance"])).toBe("romance");
    expect(shelfFor(["zz-new", "aa-new"])).toBe("aa-new");
    expect(shelfFor([])).toBeNull();
    const built = buildLibraryShelves(
      [
        { item: fixture("fixture-a"), categorySlugs: ["zz-new"] },
        { item: fixture("fixture-b"), categorySlugs: ["romance"] },
      ],
      known,
    );
    expect(built.shelves.map((s) => s.category.slug)).toEqual(["romance", "zz-new"]);
  });

  it("returns a book with no known collection as unshelved instead of dropping it", () => {
    const built = buildLibraryShelves(
      [{ item: fixture("fixture-c"), categorySlugs: ["not-a-collection"] }],
      known,
    );
    expect(built.shelves).toEqual([]);
    expect(built.unshelved.map((b) => b.item.slug)).toEqual(["fixture-c"]);
  });

  it("gives a book without a cover no texture and the placeholder proportion", () => {
    const [book] = buildLibraryShelves([{ item: fixture("fixture-d"), categorySlugs: ["romance"] }], known)
      .shelves[0].books;
    expect(book.textureSrc).toBeNull();
    expect(book.aspect).toBe(1.5);
  });
});
