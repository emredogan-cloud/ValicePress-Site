/**
 * Unit tests for the page-metadata factory (WS-B).
 *
 * These pin the contract that makes the OG drift class impossible: every
 * page gets `siteName` + `locale` + a default OG image that Next would
 * otherwise drop, while preserving canonical/title/og:type. Includes the
 * PDP (book + cover-override) case — the locally-unprerenderable surface —
 * so the cover-vs-default branch is proven without a DB.
 */

import { describe, expect, it } from "vitest";

import { buildPageMetadata, DEFAULT_OG_IMAGE } from "./metadata";

type Loose = Record<string, unknown>;

describe("buildPageMetadata", () => {
  it("sets canonical + un-droppable defaults (siteName, locale, OG image, twitter)", () => {
    const m = buildPageMetadata({
      title: "All books",
      description: "Browse the catalog.",
      path: "/books",
    });
    expect(m.alternates?.canonical).toBe("/books");
    expect(m.title).toBe("All books");

    const og = m.openGraph as Loose;
    expect(og.siteName).toBe("Valice Press");
    expect(og.locale).toBe("en_US");
    expect(og.url).toBe("/books");
    expect(og.type).toBe("website");
    expect(og.images).toEqual([DEFAULT_OG_IMAGE]);
    expect(og.title).toBe("All books"); // og:title defaults to the page title
    expect(og.description).toBe("Browse the catalog.");

    const tw = m.twitter as Loose;
    expect(tw.card).toBe("summary_large_image");
    expect(tw.site).toBe("@ValicePress"); // the press's own handle, from @/lib/social
    expect(tw.title).toBe("All books");
  });

  it("honors ogTitle / ogDescription / type overrides", () => {
    const og = buildPageMetadata({
      title: "About",
      description: "Long-form description.",
      path: "/about",
      ogTitle: "About — Valice Press",
      ogDescription: "Short share blurb.",
      type: "article",
    }).openGraph as Loose;
    expect(og.title).toBe("About — Valice Press");
    expect(og.description).toBe("Short share blurb.");
    expect(og.type).toBe("article");
  });

  it("PDP: uses a real cover when provided, else the branded default — siteName stays either way", () => {
    const withCover = buildPageMetadata({
      title: "Meditations",
      description: "The private diary of the Roman emperor.",
      path: "/books/meditations",
      type: "book",
      image: { url: "https://cdn.example/meditations.webp", alt: "Cover of Meditations" },
    }).openGraph as Loose;
    expect(withCover.type).toBe("book");
    expect(withCover.images).toEqual([
      { url: "https://cdn.example/meditations.webp", alt: "Cover of Meditations" },
    ]);
    expect(withCover.siteName).toBe("Valice Press");

    const noCover = buildPageMetadata({
      title: "Meditations",
      description: "…",
      path: "/books/meditations",
      type: "book",
    }).openGraph as Loose;
    expect(noCover.images).toEqual([DEFAULT_OG_IMAGE]);
  });

  it("passes robots through (demo/preview noindex) and uses {absolute} title for og", () => {
    const m = buildPageMetadata({
      title: { absolute: "Valice Press — Find it. Own it." },
      description: "d",
      path: "/",
      robots: { index: false, follow: true },
    });
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.title).toEqual({ absolute: "Valice Press — Find it. Own it." });
    expect((m.openGraph as Loose).title).toBe("Valice Press — Find it. Own it.");
  });

  it("emits article publishedTime/section when provided; omits robots otherwise", () => {
    const og = buildPageMetadata({
      title: "Post",
      description: "d",
      path: "/blog/x",
      type: "article",
      publishedTime: "2026-01-01",
      section: "Reading guides",
    }).openGraph as Loose;
    expect(og.publishedTime).toBe("2026-01-01");
    expect(og.section).toBe("Reading guides");

    expect(buildPageMetadata({ title: "x", description: "d", path: "/x" })).not.toHaveProperty(
      "robots",
    );
  });
});
