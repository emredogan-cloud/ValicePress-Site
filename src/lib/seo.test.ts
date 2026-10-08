/**
 * Unit tests for the SEO helpers (SUB-PR 4.5).
 *
 * Targets:
 *   - `getBaseUrl()` — env-driven canonical-origin resolution with
 *     fallback + trailing-slash normalization
 *   - `getCoverImageUrl()` — null cascade behavior + path joining
 *   - `buildBookJsonLd()` — the `AggregateRating` guard from SUB-PR 3.3
 *     (Google rich-results eligibility hinges on this not emitting an
 *     entry when reviewCount === 0)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAuthorJsonLd,
  buildBookJsonLd,
  buildSiteJsonLd,
  getBaseUrl,
  getCoverImageUrl,
  organizationNode,
} from "./seo";

beforeEach(() => {
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getBaseUrl", () => {
  it("falls back to http://localhost:3000 when NEXT_PUBLIC_APP_URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(getBaseUrl()).toBe("http://localhost:3000");
  });

  it("returns the configured URL when NEXT_PUBLIC_APP_URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://kitabevi.com.tr");
    expect(getBaseUrl()).toBe("https://kitabevi.com.tr");
  });

  it("strips a single trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://kitabevi.com.tr/");
    expect(getBaseUrl()).toBe("https://kitabevi.com.tr");
  });
});

describe("getCoverImageUrl", () => {
  it("returns null when coverKey is null", () => {
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://files.example.com");
    expect(getCoverImageUrl(null)).toBeNull();
    expect(getCoverImageUrl(undefined)).toBeNull();
  });

  it("returns null when R2_PUBLIC_BASE_URL is unset (even with a key)", () => {
    vi.stubEnv("R2_PUBLIC_BASE_URL", "");
    expect(getCoverImageUrl("covers/learning-rust.jpg")).toBeNull();
  });

  it("joins the base URL with the key", () => {
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://files.example.com");
    expect(getCoverImageUrl("covers/learning-rust.jpg")).toBe(
      "https://files.example.com/covers/learning-rust.jpg",
    );
  });

  it("normalizes a trailing slash on the base AND a leading slash on the key (no double-slash)", () => {
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://files.example.com/");
    expect(getCoverImageUrl("/covers/learning-rust.jpg")).toBe(
      "https://files.example.com/covers/learning-rust.jpg",
    );
  });
});

describe("buildBookJsonLd — AggregateRating guard", () => {
  const baseArgs = {
    baseUrl: "https://kitabevi.com.tr",
    slug: "learning-rust",
    title: "Learning Rust",
    subtitle: null,
    description: null,
    isbn: null,
    language: "en",
    pageCount: null,
    priceCents: 1500,
    currency: "USD",
    authors: [],
    coverImageUrl: null,
  };

  it("omits aggregateRating when not provided", () => {
    const graph = buildBookJsonLd(baseArgs);
    const entities = graph["@graph"];
    for (const entity of entities) {
      expect(entity).not.toHaveProperty("aggregateRating");
    }
  });

  it("omits aggregateRating when reviewCount is 0 (Google's eligibility rule)", () => {
    const graph = buildBookJsonLd({
      ...baseArgs,
      aggregateRating: { ratingValue: 0, reviewCount: 0 },
    });
    const entities = graph["@graph"];
    for (const entity of entities) {
      expect(entity).not.toHaveProperty("aggregateRating");
    }
  });

  it("includes aggregateRating on BOTH Book and Product when reviewCount > 0", () => {
    const graph = buildBookJsonLd({
      ...baseArgs,
      aggregateRating: { ratingValue: 4.5, reviewCount: 23 },
    });
    const entities = graph["@graph"] as ReadonlyArray<
      Record<string, unknown>
    >;
    const book = entities.find((e) => e["@type"] === "Book");
    const product = entities.find((e) => e["@type"] === "Product");
    expect(book).toBeDefined();
    expect(product).toBeDefined();
    expect(book?.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.5,
      reviewCount: 23,
      bestRating: 5,
      worstRating: 1,
    });
    expect(product?.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.5,
      reviewCount: 23,
      bestRating: 5,
      worstRating: 1,
    });
  });
});

describe("buildSiteJsonLd", () => {
  const baseUrl = "https://kitabevi.com.tr";

  function entitiesOf(url: string) {
    return buildSiteJsonLd(url)["@graph"] as ReadonlyArray<
      Record<string, unknown>
    >;
  }

  it("emits exactly an Organization and a WebSite node, in that order", () => {
    expect(entitiesOf(baseUrl).map((e) => e["@type"])).toEqual([
      "Organization",
      "WebSite",
    ]);
  });

  it("anchors the Organization @id and links it as the WebSite publisher", () => {
    const entities = entitiesOf(baseUrl);
    const org = entities.find((e) => e["@type"] === "Organization");
    const site = entities.find((e) => e["@type"] === "WebSite");

    // Must match `buildBookJsonLd`'s Organization @id so book graphs and the
    // homepage describe ONE brand entity across the whole site.
    expect(org?.["@id"]).toBe("https://kitabevi.com.tr/#organization");
    expect(site?.publisher).toEqual({
      "@id": "https://kitabevi.com.tr/#organization",
    });
  });

  it("exposes a SearchAction targeting the real /search endpoint", () => {
    const site = entitiesOf(baseUrl).find((e) => e["@type"] === "WebSite");
    expect(site?.potentialAction).toEqual({
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://kitabevi.com.tr/search?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    });
  });

  it("carries the real logo file and exactly the press's four social profiles", () => {
    const org = entitiesOf(baseUrl).find((e) => e["@type"] === "Organization") as Record<string, unknown>;
    expect(org.logo).toMatchObject({ "@type": "ImageObject", url: `${baseUrl}/images/brand/valice-press-logo-512.png` });
    expect(org.sameAs).toEqual([
      "https://x.com/ValicePress",
      "https://www.instagram.com/valicepress/",
      "https://www.facebook.com/profile.php?id=61594861742767",
      "https://www.tiktok.com/@valicepress",
    ]);
  });
});

describe("buildBookJsonLd — Offer emission for a held-out title", () => {
  /**
   * The Paddle compliance case: a public-domain title that still has a page,
   * still has a recorded price, and is no longer sold here. Emitting an Offer
   * for it would tell Google and every aggregator that we will sell something
   * we will not.
   */
  const base = {
    baseUrl: "https://valicepress.com",
    slug: "meditations",
    title: "Meditations",
    subtitle: null,
    description: null,
    isbn: null,
    language: "en",
    pageCount: 148,
    currency: "USD",
    authors: [{ name: "Marcus Aurelius" }],
    coverImageUrl: null,
  };
  const productOf = (args: Parameters<typeof buildBookJsonLd>[0]) =>
    buildBookJsonLd(args)["@graph"].find(
      (n) => (n as Record<string, unknown>)["@type"] === "Product",
    ) as Record<string, unknown>;

  it("emits no Offer when the store does not sell it, even with a price", () => {
    expect(productOf({ ...base, priceCents: 999, sellsDirect: false }).offers).toBeUndefined();
  });

  it("still emits an Offer when the store does sell it", () => {
    expect(productOf({ ...base, priceCents: 999, sellsDirect: true }).offers).toBeDefined();
  });

  it("defaults to emitting, so existing callers are unchanged", () => {
    expect(productOf({ ...base, priceCents: 999 }).offers).toBeDefined();
  });
});

describe("buildBookJsonLd — Offer emission", () => {
  const base = {
    baseUrl: "https://example.test",
    slug: "a-book",
    title: "A Book",
    subtitle: null,
    description: "About the book.",
    isbn: null,
    language: "en",
    pageCount: 100,
    currency: "USD",
    authors: [{ slug: "an-author", name: "An Author" }],
    coverImageUrl: null,
    aggregateRating: null,
  };

  const productOf = (priceCents: number) => {
    const graph = buildBookJsonLd({ ...base, priceCents })[
      "@graph"
    ] as unknown as Array<Record<string, unknown>>;
    return graph.find((n) => n["@type"] === "Product")!;
  };

  it("emits an Offer for a book this store sells", () => {
    const offer = productOf(1299).offers as Record<string, unknown>;
    expect(offer).toBeDefined();
    expect(offer.price).toBe("12.99");
    expect(offer.availability).toBe("https://schema.org/InStock");
  });

  it("emits NO Offer for a book priced at zero", () => {
    // Zero means "not sold here", not "free". Emitting price "0.00" with
    // InStock told Google that Codex Mythologica — a $4.99 Kindle title
    // enrolled in KDP Select — was a free download from this site.
    const product = productOf(0);
    expect(product.offers).toBeUndefined();
    expect(JSON.stringify(product)).not.toContain("0.00");
  });
});

describe("the press is ONE entity on every page", () => {
  const baseUrl = "https://valicepress.com";
  const orgIn = (graph: { readonly "@graph": readonly unknown[] }) =>
    (graph["@graph"] as ReadonlyArray<Record<string, unknown>>).find((n) => n["@type"] === "Organization")!;
  const expected = organizationNode(baseUrl) as unknown as Record<string, unknown>;

  it("book, author and site graphs all carry the same logo and the same four profiles", () => {
    const book = orgIn(
      buildBookJsonLd({
        baseUrl,
        slug: "weather-permitting",
        title: "Weather Permitting",
        subtitle: null,
        description: null,
        isbn: null,
        language: "en",
        pageCount: null,
        priceCents: 0,
        currency: "USD",
        authors: [],
        coverImageUrl: null,
      }),
    );
    const author = orgIn(buildAuthorJsonLd({ baseUrl, slug: "quinn-gallagher", name: "Quinn Gallagher", bio: null }));
    const site = orgIn(buildSiteJsonLd(baseUrl));

    for (const org of [book, author, site]) {
      expect(org["@id"]).toBe(`${baseUrl}/#organization`);
      expect(org.logo).toEqual(expected.logo);
      expect(org.sameAs).toEqual(expected.sameAs);
    }
    expect(expected.sameAs).toHaveLength(4);
  });
});
