import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";

import { CampaignCountdown } from "@/components/campaign/campaign-countdown";
import { BookMarquee } from "@/components/home/book-marquee";
import { BrandFilmSection } from "@/components/home/brand-film-section";
import { CategoriesSection } from "@/components/home/categories-section";
import { FeaturedBooksSection } from "@/components/home/featured-books-section";
import { Hero } from "@/components/home/hero";
import { HomeFooter } from "@/components/home/home-footer";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { NewsletterSection } from "@/components/home/newsletter-section";
import { WhyReadersSection } from "@/components/home/why-readers-section";
import {
  getFeaturedBooks,
  listPublishedBooks,
  listAllCategories,
} from "@/lib/db/queries/catalog";
import { buildSiteJsonLd, getBaseUrl } from "@/lib/seo";

/**
 * Cinematic homepage — dark luxury SaaS aesthetic.
 *
 * Pure Server Component → page ships as `○ Static + ISR 1h`. The page's
 * own dark theme is scoped via `.cinematic-root`; the global
 * `<SiteHeader>` from `app/layout.tsx` is hidden by the `:has()` rule in
 * `globals.css`, and this page renders its own dark `<CinematicHeader>`
 * instead.
 *
 * Phase 2.G — featured books and categories are now sourced from the
 * real catalog queries (`getFeaturedBooks(6)`, `listAllCategories()`).
 * Both sections fall back to their original curated demo set when the
 * DB returns empty, so the homepage never looks abandoned on a fresh
 * deploy.
 */

export const revalidate = 3600; // ISR — matches the catalog's revalidate cadence.

export const metadata: Metadata = buildPageMetadata({
  title: {
    absolute: "Valice Press — Find it. Own it. Read it anywhere.",
  },
  description:
    "The Valice Press Book Store. Buy a digital book once, download a watermarked-free PDF, and read it on any device. Yours to keep — never locked.",
  path: "/",
  // og:description deliberately drops the "The Valice Press Book Store." lead-in.
  ogDescription:
    "Buy a digital book once, download a watermarked-free PDF, and read it on any device. Yours to keep — never locked.",
});

export default async function Home() {
  // Both fetches are SSG-time and safeQuery-wrapped — a missing or empty
  // DB degrades to `[]` and each section drops back to its curated demo
  // fallback (preserves the cinematic atmosphere on a fresh deploy).
  const [featuredBooks, categories, shelfBooks] = await Promise.all([
    getFeaturedBooks(6),
    listAllCategories(),
    // The whole published catalogue for the moving shelf — real books, real
    // covers, real URLs, straight from the database. Nothing hard-coded, so a
    // title published tomorrow is on the shelf tomorrow.
    listPublishedBooks(),
  ]);

  // Site-level structured data (Organization + WebSite + SearchAction),
  // built from the same env-driven origin as the sitemap and canonicals.
  const siteJsonLd = buildSiteJsonLd(getBaseUrl());

  return (
    <div className="cinematic-root">
      <CinematicHeader active="home" overlay />

      <main id="main-content" className="relative z-10">
        {/* Site-level JSON-LD — emitted only on the homepage (which carries
            no book graph) so the shared Organization `@id` stays unique. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />

        <Hero />
        <CampaignCountdown />
        {/* The shelf sits between the campaign and the reasons to trust us:
            the promotion says "free", and the very next thing a reader should
            see is what there is to take. */}
        <BookMarquee
          books={shelfBooks.map((b) => ({
            slug: b.slug,
            title: b.title,
            authors: b.authors.map((a) => a.name),
          }))}
        />
        {/* The film sits after the shelf and before the featured books: a
            reader has just seen what there is, and this is the answer to
            "who made it". It is the first band below the fold on every
            viewport, which is what keeps it off the LCP path. */}
        <BrandFilmSection />
        <FeaturedBooksSection books={featuredBooks} />
        <CategoriesSection categories={categories} />
        {/* Moved below the discovery sections. It answers "why buy from you",
            which is a question a reader only has after they have seen
            something they want. */}
        <WhyReadersSection />
        <NewsletterSection />
      </main>

      <HomeFooter />
    </div>
  );
}
