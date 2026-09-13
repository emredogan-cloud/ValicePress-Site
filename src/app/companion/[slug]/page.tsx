import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buildPageMetadata } from "@/lib/metadata";
import { getCompanion, listCompanions } from "@/lib/companions";
import { getPublishedBookBySlug } from "@/lib/db/queries/catalog";
import { CompanionSignup } from "@/components/companion/companion-signup";
import { CompanionHero } from "@/components/companion/companion-hero";
import { CompanionResourceGrid } from "@/components/companion/companion-resource-grid";
import { AnswerChecker } from "@/components/companion/answer-checker";
import { buildCompanionView } from "@/lib/companion-view";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";

/**
 * /companion/[slug] — the free digital companion to a printed book.
 *
 * This is the landing point for a QR code printed inside a paperback, and the
 * single mechanism by which an Amazon buyer becomes a Valice reader. Amazon
 * never tells a publisher who bought a book; this page is how someone tells
 * us themselves.
 *
 * Statically generated for every companion in the registry, with no database
 * dependency at all. That is deliberate and load-bearing: a printed QR code
 * outlives deploys, schema changes and outages, so the page it points at must
 * be renderable from a constant. It resolves whether or not the book is on
 * sale, listed, or even still in the catalogue — see `src/lib/companions.ts`.
 */

export const dynamic = "force-static";

export function generateStaticParams() {
  return listCompanions().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const companion = getCompanion(slug);
  if (!companion) return buildPageMetadata({
    title: "Companion",
    description: "Free companion material from Valice Press.",
    path: `/companion/${slug}`,
    robots: { index: false },
  });

  const view = buildCompanionView(companion);
  const n = companion.assets.length;

  /**
   * PER-BOOK SOCIAL CARD.
   *
   * Every companion used to share one generic image of blank practice sheets,
   * so a link to the Kwaidan companion previewed identically to the World
   * Games one — and the directive is explicit that one book's identity must
   * never appear on another's page, sharing included. The book's own cover is
   * the only per-book image that exists for all of them, so it is the card.
   *
   * It falls back to the shared sheet image for the one companion whose book
   * has no cover asset yet, rather than shipping a broken preview.
   */
  const image = view.coverSrc
    ? {
        url: view.coverSrc,
        width: 1200,
        height: 1800,
        alt: view.coverAlt,
      }
    : {
        url: "/images/companion/og-default.webp",
        width: 1870,
        height: 841,
        alt: "Blank practice sheets and a pencil on a dark desk — the free companion material for this book.",
      };

  return buildPageMetadata({
    title: `${companion.bookTitle} — free companion`,
    // Unique per book by construction: it names the book and counts that
    // book's own downloads. The old description was `companion.intro`, which
    // is already unique, but said nothing about what the reader gets.
    description: `${n} free ${n === 1 ? "download" : "downloads"} for ${companion.bookTitle} — ${companion.intro}`,
    path: `/companion/${companion.slug}`,
    // Indexable: these pages are genuinely useful on their own and are a
    // legitimate long-tail search surface ("hangul practice sheet pdf"),
    // not a thin doorway page.
    image,
  });
}

export default async function CompanionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const companion = getCompanion(slug);
  if (!companion) notFound();

  /**
   * IS THE BOOK ACTUALLY ON THE STOREFRONT RIGHT NOW?
   *
   * THE STOREFRONT ANSWERS, NOT THE HAND-MAINTAINED FIELD. `companion.state`
   * is written by hand next to each companion, and hand-written state drifts:
   * measured on 2026-09-13, twenty of twenty-nine companions still said
   * `book-not-yet-available` for a book that was published and on sale — some
   * of them since 2026-09-11. The page was therefore printing "The book is not
   * on sale yet" underneath books a reader could have bought, which is the
   * same defect as a dead link, pointing the other way.
   *
   * `getPublishedBookBySlug` is the live answer and fails in the safe
   * direction: it returns null for a hidden book AND for a database it cannot
   * reach at build time, so the page offers no buy route rather than a broken
   * one. The hand-maintained field is left with the one job the storefront
   * cannot do — saying a book was deliberately WITHDRAWN, which looks
   * identical to "never published" from the database.
   *
   * This matters more here than anywhere else on the site: a QR code printed
   * inside a paperback outlives every commercial state the book passes
   * through, and the reader scanning it is holding the book already.
   */
  const bookOnStorefront = Boolean(await getPublishedBookBySlug(companion.bookSlug));
  const bookIsBuyable = companion.state !== "book-withdrawn" && bookOnStorefront;
  // The companion believes the book is for sale and the storefront disagrees.
  // Worth its own sentence: it is a temporary absence, not a withdrawal.
  const temporarilyUnlisted = companion.state === "book-available" && !bookOnStorefront;

  const view = buildCompanionView(companion);

  return (
    <div className="cinematic-root min-h-screen">
      <CinematicHeader />

      <main id="main-content" className="pb-24">
        {/* The hero carries the page's only <h1>, its own book's cover, and
            the single secondary CTA back to that book. */}
        <CompanionHero view={view} />

        <div className="mx-auto max-w-7xl space-y-14 px-4 sm:px-6 lg:space-y-16">
          {/* Where the book itself stands. Shown INSTEAD of the hero's buy
              route, never beside it, so the page cannot imply a purchase is
              possible when it is not. The hero's link is rendered
              unconditionally because a book page always exists; this strip is
              what tells the reader what they will find there. */}
          {!bookIsBuyable && (
            <div
              className="rounded-2xl border p-5"
              style={{
                borderColor: "rgba(214,178,102,0.25)",
                background: "rgba(214,178,102,0.06)",
              }}
            >
              <p className="text-[14.5px] leading-relaxed text-fg-mid">
                {temporarilyUnlisted
                  ? // Says only what is true and checkable. It gives no
                    // reason, because the reason is our business with a
                    // payment provider and not something a reader needs.
                    "This edition isn’t listed on valicepress.com at the moment. Everything on this page is free and works today regardless."
                  : companion.stateNote}
              </p>
            </div>
          )}

          <CompanionResourceGrid
            companionSlug={companion.slug}
            resources={view.resources}
            heading={companion.assetsHeading ?? "Practice material"}
            headingId="downloads"
          />

          {/* One companion has an interactive piece: the puzzle book's answer
              checker. It is keyed off the slug rather than added to the
              Companion type, because a `component` field on a data record is
              a field that will be null on twenty-eight of twenty-nine rows. */}
          {companion.slug === "codex-puzzles" && (
            <section aria-labelledby="checker">
              <h2 id="checker" className="font-serif text-[26px] text-fg-hi sm:text-3xl">
                Have you got it?
              </h2>
              <p className="mt-2 max-w-prose text-[14.5px] text-fg-soft">
                Type a puzzle number and your answer. Every answer in the book is
                printed at the back of the book — this is for the moment before
                you decide to look.
              </p>
              <div className="mt-6">
                <AnswerChecker />
              </div>
            </section>
          )}

          <section aria-labelledby="keep-posted">
            <h2 id="keep-posted" className="sr-only">
              Optional email updates
            </h2>
            <CompanionSignup
              source={companion.newsletterSource}
              bookTitle={companion.bookTitle}
            />
          </section>

          <section
            aria-labelledby="about-material"
            className="border-t border-white/8 pt-8"
          >
            <h2
              id="about-material"
              className="text-[12px] uppercase tracking-[0.22em] text-fg-fade lg:text-[11px]"
            >
              About this material
            </h2>
            <p className="mt-3 max-w-prose text-[14.5px] leading-relaxed text-fg-mid">
              {companion.rightsNote}
            </p>
            <p className="mt-5 text-[14.5px]">
              <Link href="/books" className="text-emerald-bright hover:underline">
                Browse the Valice Press catalogue
              </Link>
            </p>
          </section>
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}
