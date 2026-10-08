import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/metadata";

import { AboutBackground } from "@/components/about/about-background";
import { AboutFeatured } from "@/components/about/about-featured";
import { AboutHero } from "@/components/about/about-hero";
import { AboutReaders } from "@/components/about/about-readers";
import { AboutShelves } from "@/components/about/about-shelves";
import { AboutStandard } from "@/components/about/about-standard";
import { BeliefGrid } from "@/components/about/belief-grid";
import { FounderCard } from "@/components/about/founder-card";
import { ManifestoStrip } from "@/components/about/manifesto-strip";
import { NextStepsGrid } from "@/components/about/next-steps-grid";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { SITE_DESCRIPTION } from "@/lib/seo";
import {
  getAuthorPageBySlug,
  getFeaturedBooks,
  listAllCategories,
  listPublishedBooks,
} from "@/lib/db/queries/catalog";

/**
 * /about — what Valice Press is, written from what it actually publishes.
 *
 *   hero          the logo and the line under it, and one plain paragraph on the catalogue
 *   shelves       one card per real category: live count, the covers on it, a sentence from the books
 *   standard      three promises the books' own descriptions make, each tied to a book you can open
 *   featured      the catalogue's pinned books, as on the homepage
 *   readers       print, Kindle, direct download (only if on sale), free bonus scenes
 *   beliefs       four convictions
 *   founder       who runs it, in the founder's approved words; the contact card and the four networks
 *   manifesto     the brand line
 *   next steps    real routes, and the press's four networks
 *
 * It used to describe a digital-only bookshop ("A bookstore that doesn't lock you out") and had never
 * heard of the romance list, the folklore editions or the games books. Every number and cover here comes
 * from the database, every sentence about a shelf from `lib/about-copy.ts` (tested against the
 * catalogue), and nothing says downloads are on sale unless some are.
 *
 * Behind everything: `<AboutBackground>` — a `fixed` atmospheric overlay. Pure Server Component → ISR.
 */
export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "About",
  description: SITE_DESCRIPTION,
  path: "/about",
  ogTitle: "About — Valice Press",
  ogDescription: "Independent ideas. A longer tomorrow. What Valice Press publishes, how its books are made, and who runs it.",
  type: "article",
});

export default async function AboutPage() {
  const [categories, published, featured, founder] = await Promise.all([
    listAllCategories(),
    listPublishedBooks(),
    getFeaturedBooks(4),
    getAuthorPageBySlug("emre-dogan"),
  ]);
  const directCount = published.filter((b) => b.buyableHere).length;
  // The first two paragraphs of the founder's approved biography, as stored.
  const founderBio = (founder?.bio ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 2);

  return (
    <div className="cinematic-root">
      <CinematicHeader active="about" />

      {/* Atmospheric backdrop — fixed, behind every section */}
      <AboutBackground />

      <main id="main-content" className="relative z-10">
        <div className="mx-auto max-w-[1320px] px-4 pt-8 sm:px-6 sm:pt-12">
          {/* Hero paints immediately (LCP) — its motion is ambient, not a
              fade-in, so there's no reveal wrapper here. */}
          <AboutHero />

          <RevealOnScroll className="mt-24 sm:mt-32">
            <AboutShelves categories={categories} total={published.length} />
          </RevealOnScroll>

          <RevealOnScroll className="mt-24 sm:mt-32">
            <AboutStandard />
          </RevealOnScroll>

          <RevealOnScroll className="mt-24 sm:mt-32">
            <AboutFeatured books={featured} total={published.length} />
          </RevealOnScroll>

          <RevealOnScroll className="mt-24 sm:mt-32">
            <AboutReaders directCount={directCount} />
          </RevealOnScroll>

          <RevealOnScroll className="mt-24 sm:mt-32">
            <BeliefGrid />
          </RevealOnScroll>

          <RevealOnScroll className="mt-24 sm:mt-32">
            <FounderCard founderBio={founderBio} />
          </RevealOnScroll>

          <RevealOnScroll className="mt-24 sm:mt-32">
            <ManifestoStrip />
          </RevealOnScroll>

          <RevealOnScroll className="mt-24 sm:mt-32">
            <NextStepsGrid />
          </RevealOnScroll>

          <div className="h-24" />
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}
