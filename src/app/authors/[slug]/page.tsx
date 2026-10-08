import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { buildPageMetadata } from "@/lib/metadata";
import { buildAuthorJsonLd, getBaseUrl } from "@/lib/seo";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";

import {
  Biography,
  ProfileHero,
  PublishedBooks,
  RelatedAuthors,
  ShelfNeighbours,
  SourcesSection,
  WhyTheyMatter,
  WorksAndTimeline,
} from "@/components/authors/author-profile";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import type { BookCardData } from "@/components/book-card";
import {
  getAuthorPageBySlug,
  getCategoryPageBySlug,
  listAllAuthors,
  listAuthorSlugs,
} from "@/lib/db/queries/catalog";
import {
  CATALOGUE_AUTHOR_CATEGORY,
  allAuthorSlugs,
  buildDirectory,
  getReferenceAuthor,
  schemaYear,
  verifiedOn,
  type AuthorCategory,
} from "@/lib/reference-authors";

/**
 * /authors/[slug] — one author.
 *
 * Two sources, one page. An author Valice Press publishes comes from the catalogue (the `authors`
 * table: name, the approved biography, their published books); a researched author comes from
 * `src/content/authors/<slug>.json` (dates, works, a timeline, why they matter, sources, a licensed
 * photograph). A person who is both — Hearn: researched, and Kwaidan is on the list — gets one page
 * with the catalogue's biography and the researched facts.
 *
 * A slug that is neither is a 404: the old fallback that invented a role and a "known for" line for
 * whoever was asked about is gone for good (see `author-card-data.ts`).
 *
 * SSG + ISR per ADR-1: every researched slug is generated even if the database is unreachable.
 */
export const revalidate = 3600;

type Params = Promise<{ slug: string }>;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const fromCatalogue = await listAuthorSlugs();
  return allAuthorSlugs(fromCatalogue.map((s) => s.slug)).map((slug) => ({ slug }));
}

async function load(slug: string) {
  const ref = getReferenceAuthor(slug);
  const db = await getAuthorPageBySlug(slug);
  if (!ref && !db) return null;
  const name = db?.name ?? ref!.name;
  const books = db?.books ?? [];
  const category: AuthorCategory = ref?.category ?? CATALOGUE_AUTHOR_CATEGORY[slug] ?? "valice-original";
  const kind: "published" | "reference" | "pending" = books.length > 0 ? "published" : ref ? "reference" : "pending";
  return { ref, db, name, books, category, kind };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Author not found" };
  const { ref, db, name } = data;

  const oneLine = (db?.bio ?? "").replace(/\s+/g, " ").trim();
  const description = ref
    ? `${name} (${ref.years}) — ${ref.knownFor}`.slice(0, 157)
    : oneLine
      ? oneLine.length > 157
        ? `${oneLine.slice(0, 157).trim()}…`
        : oneLine
      : `Books by ${name} on Valice Press.`;

  return buildPageMetadata({
    title: name,
    description,
    path: `/authors/${slug}`,
    type: "profile",
    ...(ref?.portrait ? { image: { url: ref.portrait.src, alt: ref.portrait.alt, width: ref.portrait.width, height: ref.portrait.height, type: "image/webp" } } : {}),
  });
}

/** Up to `limit` books from the given catalogue categories, one from each in turn, none by this author. */
async function shelfNeighbours(categories: string[], author: string, limit = 4): Promise<BookCardData[]> {
  const lists = (await Promise.all(categories.map((c) => getCategoryPageBySlug(c))))
    .map((c) => (c?.books ?? []).filter((b) => !b.authors.some((a) => a.slug === author)));
  const out: BookCardData[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < limit && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const b = l[i];
      if (b && !seen.has(b.id) && out.length < limit) {
        seen.add(b.id);
        out.push(b);
      }
    }
  }
  return out;
}

export default async function AuthorPage({ params }: { params: Params }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { ref, db, name, books, category, kind } = data;

  const paragraphs = db?.bio
    ? db.bio.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    : (ref?.bio ?? []);

  const directory = buildDirectory(await listAllAuthors());
  const related = (ref?.related ?? []).map((s) => directory.find((d) => d.slug === s)).filter((d): d is NonNullable<typeof d> => Boolean(d));
  const neighbours = ref?.shelf?.length ? await shelfNeighbours(ref.shelf, slug) : [];

  const facts: Array<{ label: string; value: string }> = [];
  if (ref) {
    facts.push({ label: "Born", value: [ref.born, ref.birthplace].filter(Boolean).join(" · ") });
    if (ref.died) facts.push({ label: "Died", value: [ref.died, ref.deathplace].filter(Boolean).join(" · ") });
    facts.push({ label: "Nationality", value: ref.nationality });
  }

  const baseUrl = getBaseUrl();
  const bioForLd = paragraphs[0] ?? null;

  return (
    <div className="cinematic-root">
      <CinematicHeader active="authors" />

      <main id="main-content" className="relative z-10 pb-24">
        {/* Author entity graph (Organization + Breadcrumb + ProfilePage + Person). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildAuthorJsonLd({
                baseUrl,
                slug,
                name,
                bio: bioForLd,
                details: ref
                  ? {
                      birthDate: schemaYear(ref.bornYear),
                      deathDate: schemaYear(ref.diedYear),
                      birthPlace: ref.birthplace,
                      deathPlace: ref.deathplace,
                      image: ref.portrait ? `${baseUrl}${ref.portrait.src}` : undefined,
                      sameAs: ref.sources.map((s) => s.url).filter((u) => /wikipedia\.org|wikidata\.org|id\.loc\.gov/.test(u)),
                    }
                  : undefined,
              }),
            ),
          }}
        />
        <div className="mx-auto max-w-[1180px] px-4 pt-6 sm:px-6">
          <Breadcrumbs trail={[{ name: "Home", href: "/" }, { name: "Authors", href: "/authors" }, { name }]} />
        </div>

        <ProfileHero
          name={name}
          category={category}
          kind={kind === "pending" ? "reference" : kind}
          bookCount={books.length}
          years={ref?.years ?? null}
          knownFor={ref?.knownFor ?? null}
          facts={facts}
          portrait={ref?.portrait ?? null}
          portraitNote={ref?.portraitNote ?? null}
          tags={ref?.tags ?? []}
          pending={kind === "pending"}
        />

        <Biography paragraphs={paragraphs} />
        {ref && <WorksAndTimeline works={ref.works} events={ref.events} />}
        {ref && <WhyTheyMatter name={name} relevance={ref.relevance} influence={ref.influence} />}
        <PublishedBooks name={name} books={books} />
        <ShelfNeighbours name={name} books={neighbours} />
        <RelatedAuthors authors={related} />
        {ref && <SourcesSection name={name} sources={ref.sources} verifiedOn={verifiedOn(slug)} discrepancy={ref.dateDiscrepancy} />}
      </main>

      <HomeFooter />
    </div>
  );
}
