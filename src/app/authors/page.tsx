import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/metadata";

import { AuthorsHero } from "@/components/authors/authors-hero";
import { AuthorsShell, type PortraitCredit } from "@/components/authors/authors-shell";
import { DEFAULT_PORTRAIT } from "@/components/authors/author-card-data";
import { listAllAuthors } from "@/lib/db/queries/catalog";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import { REFERENCE_AUTHORS, buildDirectory } from "@/lib/reference-authors";

/**
 * `/authors` — the authors directory.
 *
 * Two kinds of person, one list. The authors Valice Press publishes come from the catalogue (the
 * `authors` table, with a published book); the rest are researched reference authors — historical
 * voices, makers of games and puzzles, and the novelists of sapphic and lesbian romance — each with
 * sources, dates cross-checked against Wikidata and the Library of Congress, and a freely licensed
 * photograph where one exists (`src/content/authors`, `docs`: scripts/authors). A person who is both
 * appears once (`buildDirectory`).
 *
 * What this page must never do again is claim authors it does not publish. An earlier version listed
 * Harari, Austen and Orwell with invented roles and follower counts. Here a reference author is
 * labelled as one on its card, on its page, and in the sentence below the hero, and no card carries a
 * number nobody measured.
 *
 * If the database is unreachable the page still renders — the researched authors do not depend on it.
 */
export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "Authors",
  description:
    "The authors Valice Press publishes, and the writers around the shelf — folklore, philosophy, puzzles and games, and sapphic romance — each with sources.",
  path: "/authors",
  ogTitle: "Authors · Valice Press",
});

export default async function AuthorsDiscoveryPage() {
  const catalogue = await listAllAuthors();
  const authors = buildDirectory(catalogue).map((a) => ({ ...a, portrait: DEFAULT_PORTRAIT }));

  const credits: PortraitCredit[] = REFERENCE_AUTHORS.filter((a) => a.portrait)
    .map((a) => ({ slug: a.slug, name: a.name, credit: a.portrait!.credit, licence: a.portrait!.licence, licenceUrl: a.portrait!.licenceUrl }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="cinematic-root">
      <CinematicHeader active="authors" />

      <main id="main-content" className="relative z-10">
        <AuthorsHero />
        <p className="mx-auto max-w-2xl px-6 text-center text-[13px] leading-relaxed text-fg-soft">
          Authors marked <strong className="font-semibold text-fg-mid">On the Valice list</strong> are published here. Everyone else is a reference author, shown for the reading context around
          the shelf: Valice Press has no connection with them, their publishers or their estates.
        </p>
        <AuthorsShell authors={authors} credits={credits} />
        <div className="h-20" />
      </main>

      <HomeFooter />
    </div>
  );
}
