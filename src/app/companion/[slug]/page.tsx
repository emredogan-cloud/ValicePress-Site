import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buildPageMetadata } from "@/lib/metadata";
import { withLangRuns } from "@/lib/lang-runs";
import { getCompanion, listCompanions } from "@/lib/companions";
import { getPublishedBookBySlug } from "@/lib/db/queries/catalog";
import { CompanionSignup } from "@/components/companion/companion-signup";
import { CompanionDownloadLink } from "@/components/companion/companion-download-link";
import { AnswerChecker } from "@/components/companion/answer-checker";
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

  return buildPageMetadata({
    title: `${companion.bookTitle} — free companion`,
    description: companion.intro,
    path: `/companion/${companion.slug}`,
    // Indexable: these pages are genuinely useful on their own and are a
    // legitimate long-tail search surface ("hangul practice sheet pdf"),
    // not a thin doorway page.
    // One shared share-card (A-02) for all companion pages, replacing the
    // sitewide default (/opengraph-image, "Find it. Own it…") with something
    // on-topic for a QR code landed on from inside a physical book. Not a
    // fix for a missing image — buildPageMetadata already falls back to a
    // branded default — just a more specific one for this one route family.
    image: {
      url: "/images/companion/og-default.webp",
      width: 1870,
      height: 841,
      alt: "Blank practice sheets and a pencil on a dark desk — the free companion material for this book.",
    },
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

  return (
    <div className="cinematic-root min-h-screen">
      <CinematicHeader />

      <main id="main-content" className="mx-auto max-w-3xl px-4 sm:px-6 pb-24 pt-16">
        <p className="text-[12px] lg:text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-bright/80">
          Free companion
        </p>
        <h1 className="mt-4 font-serif text-[34px] font-medium leading-tight tracking-tight text-fg-hi sm:text-[42px]">
          {companion.bookTitle}
        </h1>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-fg-mid">
          {companion.intro}
        </p>

        {/* Honest statement of where the book itself stands. Shown instead of
            a buy button rather than alongside one, so the page never implies
            a purchase is possible when it isn't. */}
        {!bookIsBuyable && (
          <div className="mt-8 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-5">
            <p className="text-sm leading-relaxed text-fg-mid">
              {temporarilyUnlisted
                ? // Says only what is true and checkable. It does not give a
                  // reason, because the reason is our business with a payment
                  // provider and not something a reader needs.
                  "This edition isn’t listed on valicepress.com at the moment. Everything on this page is free and works today regardless."
                : companion.stateNote}
            </p>
          </div>
        )}

        {/* When the book IS on sale, one calm link to its page — the page
            carries the real format cards and prices; nothing is duplicated
            here that could go stale under a printed QR code. */}
        {bookIsBuyable && (
          <p className="mt-6 text-sm text-fg-mid">
            <Link
              href={`/books/${companion.bookSlug}`}
              className="text-emerald-bright hover:underline"
            >
              See the book, its formats and where to buy it
            </Link>
          </p>
        )}

        <section className="mt-12" aria-labelledby="downloads">
          <h2 id="downloads" className="font-serif text-2xl text-fg-hi">
            {companion.assetsHeading ?? "Practice material"}
          </h2>
          <p className="mt-2 text-sm text-fg-low">
            Free, no sign-up, reprint as often as you like.
          </p>

          <ul className="mt-6 space-y-4">
            {companion.assets.map((asset) => (
              <li
                key={asset.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="font-serif text-lg text-fg-hi">{withLangRuns(asset.title)}</h3>
                  <span className="font-mono text-[12px] lg:text-[11px] uppercase tracking-wider text-fg-low">
                    {asset.meta}
                  </span>
                </div>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-mid">
                  {asset.description}
                </p>
                <CompanionDownloadLink
                  companionSlug={companion.slug}
                  assetId={asset.id}
                  href={asset.href}
                />
              </li>
            ))}
          </ul>
        </section>

        {/* One companion has an interactive piece: the puzzle book's answer
            checker. It is keyed off the slug rather than added to the
            Companion type, because a `component` field on a data record is a
            field that will be null on fourteen of fifteen rows. */}
        {companion.slug === "codex-puzzles" && (
          <section className="mt-14" aria-labelledby="checker">
            <h2 id="checker" className="font-serif text-2xl text-fg-hi">
              Have you got it?
            </h2>
            <p className="mt-2 max-w-prose text-sm text-fg-low">
              Type a puzzle number and your answer. Every answer in the book is
              printed at the back of the book — this is for the moment before
              you decide to look.
            </p>
            <div className="mt-6">
              <AnswerChecker />
            </div>
          </section>
        )}

        <section className="mt-14">
          <CompanionSignup
            source={companion.newsletterSource}
            bookTitle={companion.bookTitle}
          />
        </section>

        <section className="mt-14 border-t border-white/8 pt-8">
          <h2 className="font-mono text-[12px] lg:text-[11px] uppercase tracking-[0.18em] text-fg-low">
            About this material
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-fg-mid">
            {companion.rightsNote}
          </p>
          <p className="mt-4 text-sm text-fg-mid">
            <Link href="/books" className="text-emerald-bright hover:underline">
              Browse the Valice Press catalogue
            </Link>
          </p>
        </section>
      </main>

      <HomeFooter />
    </div>
  );
}
