import Link from "next/link";
import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/metadata";
import { listCompanions } from "@/lib/companions";
import { withPinnedFirst } from "@/lib/pinned-books";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { CinematicHero } from "@/components/cinematic/cinematic-hero";
import { HomeFooter } from "@/components/home/home-footer";

/**
 * /companion — the index of every printed companion address.
 *
 * WHY THIS PAGE EXISTS
 * `src/lib/printed-address.ts` declares `/companion` a PRINTED address: it sits
 * in `PRINTED_EXACT` beside `/codex-enigmatica/verify`, which is the list of
 * paths this house has committed to keeping alive because they are set in ink
 * inside physical books. It returned 404 until 2026-09-19.
 *
 * That matters more than a missing page usually does. `companions.ts` opens
 * with the rule this whole area is built around — "a companion route must never
 * 404, and must never depend on the book being on sale" — because a QR code in
 * a paperback cannot be edited and will be scanned years from now. Every
 * `/companion/<slug>` honoured that rule; the bare address the same books print
 * as human-readable text beside the code did not. A reader who typed the URL
 * rather than scanning was told the publisher was unreliable.
 *
 * Statically generated from the registry, with no database dependency, for the
 * same reason as `/companion/[slug]`: a printed address outlives deploys,
 * schema changes and outages, so the page it points at must be renderable from
 * a constant.
 */

export const dynamic = "force-static";

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: "Companions",
    description:
      "Every free digital companion published by Valice Press — practice sheets, trackers, source ledgers and reference material for the printed books.",
    path: "/companion",
  });
}

export default function CompanionIndexPage() {
  // Alphabetical by book, with the pinned books' companions first
  // (`@/lib/pinned-books`) — only those that have one.
  const companions = withPinnedFirst(
    [...listCompanions()].sort((a, b) => a.bookTitle.localeCompare(b.bookTitle)),
    (c) => c.bookSlug,
  );

  return (
    <div className="cinematic-root">
      <CinematicHeader />

      <main id="main-content" className="relative z-10">
        <CinematicHero
          eyebrow="Printed in the back of every book"
          headlineHead="The"
          headlineTail="companions"
          size="lg"
          align="center"
          dust
          subtitle={
            <p>
              {companions.length} free pages of material that belongs off the
              page — practice sheets, trackers, source ledgers, reference
              tables. Nothing here is gated and nothing here asks you to buy
              anything. If you typed an address off a page and landed here, your
              book is on the list below.
            </p>
          }
        />

        <section className="mx-auto mt-12 max-w-[1320px] px-4 sm:mt-14 sm:px-6">
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.05] sm:grid-cols-2 lg:grid-cols-3">
            {companions.map((c) => (
              <li key={c.slug} className="bg-[#0b0c0b]">
                <Link
                  href={`/companion/${c.slug}`}
                  className="flex h-full flex-col gap-2 p-6 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <span className="text-[15px] font-medium leading-snug text-white/90">
                    {c.bookTitle}
                  </span>
                  <span className="text-[12px] tracking-wide text-white/45">
                    valicepress.com/companion/{c.slug}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-10 text-[13px] leading-relaxed text-white/50">
            Looking for the books themselves?{" "}
            <Link href="/books" className="underline underline-offset-4">
              The catalogue is here
            </Link>
            .
          </p>
        </section>

        <div className="h-24" />
      </main>

      <HomeFooter />
    </div>
  );
}
