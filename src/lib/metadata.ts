import { TWITTER_SITE } from "@/lib/social";
import type { Metadata } from "next";

import { SITE_NAME } from "./seo";

/**
 * Page-metadata factory (WS-B) — the single source of truth that makes the
 * site-wide OpenGraph/Twitter defaults **un-droppable**.
 *
 * Background: Next.js merges metadata shallowly across segments, and a child
 * page's `openGraph` REPLACES (does not deep-merge) the parent's. So root-
 * layout defaults — `siteName`, `locale`, and the file-convention default OG
 * image — silently vanish on every page that defines its own `openGraph`
 * (all 17 indexable pages do; even the homepage lost `og:site_name`). Routing
 * every page through this factory guarantees those defaults are always
 * emitted while preserving each page's title / description / canonical /
 * og:type. Twitter image/title/description derive from OpenGraph (matching
 * Next's prior homepage behavior), so a single OG image yields a Twitter card.
 */

/** Alt mirrors `app/opengraph-image.tsx`'s `alt` export. */
const DEFAULT_OG_ALT =
  "Valice Press — Buy once, own forever. DRM-free, watermarked PDFs you can read on any device.";

/**
 * Branded default social image — the `/opengraph-image` route (1200×630 PNG),
 * resolved against `metadataBase` at render time.
 */
export const DEFAULT_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: DEFAULT_OG_ALT,
} as const;

type OgType = "website" | "article" | "book" | "profile";

export interface PageImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  type?: string;
}

export interface PageMetadataInput {
  /**
   * `<title>`: a string runs through the root `"%s · Valice Press"`
   * template; `{ absolute }` bypasses it (homepage).
   */
  title: string | { absolute: string };
  description: string;
  /** Canonical path (also `og:url`), e.g. `"/books"` or `"/books/meditations"`. */
  path: string;
  /** OG/Twitter title; defaults to the title text. */
  ogTitle?: string;
  /** OG/Twitter description; defaults to `description`. */
  ogDescription?: string;
  /** OpenGraph type; defaults to `"website"`. */
  type?: OgType;
  /** Article-only OpenGraph fields (emitted when provided; for `type: "article"`). */
  publishedTime?: string;
  section?: string;
  /** Override the default OG image (e.g. a real book cover). */
  image?: PageImage;
  /** Robots directives (e.g. `index:false` for demo/preview pages). */
  robots?: Metadata["robots"];
}

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const titleText =
    typeof input.title === "string" ? input.title : input.title.absolute;
  const ogTitle = input.ogTitle ?? titleText;
  const ogDescription = input.ogDescription ?? input.description;
  const image: PageImage = input.image ?? DEFAULT_OG_IMAGE;

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    ...(input.robots ? { robots: input.robots } : {}),
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: input.path,
      type: input.type ?? "website",
      siteName: SITE_NAME,
      locale: "en_US",
      images: [image],
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
      ...(input.section ? { section: input.section } : {}),
    },
    twitter: {
      card: "summary_large_image",
      site: TWITTER_SITE,
      title: ogTitle,
      description: ogDescription,
      // `images` intentionally omitted → Next derives twitter:image (+ alt/
      // width/height/type) from `openGraph.images`, so one OG image drives both.
    },
  };
}
