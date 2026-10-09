import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { clampText, joinList } from "@/lib/meta-text";
import { buildPageMetadata } from "@/lib/metadata";
import { buildBreadcrumbJsonLd, getBaseUrl } from "@/lib/seo";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";

import { CinematicBookTile } from "@/components/cinematic/cinematic-book-tile";
import { CinematicHero } from "@/components/cinematic/cinematic-hero";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import {
  getCategoryPageBySlug,
  listCategorySlugs,
} from "@/lib/db/queries/catalog";

/**
 * /categories/[slug] — Curated Archive page (genre detail).
 *
 * Phase 1.F cinematic redesign. This is where `<GenreCard>` on
 * `/genres` discovery lands — previously a warm-theme dump after a
 * cinematic discovery surface (audit P1.6). Now: dark, consistent.
 *
 * Decision: we DO NOT create `/genres/[slug]` (the audit-noted gap).
 * Instead `<GenreCard>` keeps pointing at `/categories/[slug]` (its
 * current hrefs) and this page becomes the cinematic genre detail.
 * One detail route, one source of truth.
 *
 * Layout:
 *   1. <CinematicHero size="md"> — eyebrow "Genre" + diamond + name
 *      (last word emerald). No panel art — solo variant; the books grid
 *      below is the visual focus.
 *   2. Glass tile grid (`<CinematicBookTile>`) — same chrome as
 *      /authors/[slug] for consistency.
 *   3. Empty state + editorial closer.
 *
 * Classification target preserved: `● SSG` via `generateStaticParams`
 * over `listCategorySlugs()`. ISR `revalidate = 3600`.
 */

// SSG + ISR per ADR-1.
export const revalidate = 3600;

type CategorySlugParams = Promise<{ slug: string }>;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await listCategorySlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: CategorySlugParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryPageBySlug(slug);
  if (!category) return { title: "Category not found" };
  const name = category.name;
  // The editorial copy when there is some; else what is really on the shelf — a count and the titles —
  // so seven category pages do not all say "Browse X on Valice Press."
  const titles = category.books.map((b) => b.title);
  const shelf =
    titles.length === 0
      ? `${name} on Valice Press.`
      : `${name} — ${titles.length} ${titles.length === 1 ? "book" : "books"} from Valice Press: ${joinList(titles)}.`;
  const description = clampText(category.description?.trim() || shelf);
  const url = `/categories/${slug}`;
  return buildPageMetadata({
    title: name,
    description,
    path: url,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: CategorySlugParams;
}) {
  const { slug } = await params;
  const category = await getCategoryPageBySlug(slug);

  // A slug with no category row is not a category. The previous version
  // resolved unknown slugs against two hard-coded demo sets so that a
  // fabricated genre card would never 404 — which meant the fabrication had
  // to keep existing to stop the links it created from breaking. The cards
  // are gone, so the fallback goes with them.
  if (!category) notFound();

  const name = category.name;
  const books = category.books;

  const { head, tail } = splitNameForAccent(name);

  return (
    <div className="cinematic-root">
      <CinematicHeader active="genres" />

      <main id="main-content" className="relative z-10">
        {/* Breadcrumb structured data + visible trail (WS-G / WS-F) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildBreadcrumbJsonLd(getBaseUrl(), [
                { name: "Home", path: "/" },
                { name: "Browse by category", path: "/categories" },
                { name, path: `/categories/${slug}` },
              ]),
            ),
          }}
        />
        <div className="mx-auto max-w-[1320px] px-4 pt-6 sm:px-6">
          <Breadcrumbs
            trail={[
              { name: "Home", href: "/" },
              { name: "Categories", href: "/categories" },
              { name },
            ]}
          />
        </div>

        <CinematicHero
          eyebrow="Genre"
          headlineHead={head}
          headlineTail={tail}
          size="md"
          align="center"
          subtitle={
            <p>
              {books.length === 0
                ? "No published titles in this genre yet."
                : books.length === 1
                  ? "One published title to explore."
                  : `${books.length} published titles to explore.`}
            </p>
          }
        />

        {/* Editorial hub copy (categories.description) — rendered when set */}
        {category?.description && (
          <p className="mx-auto mt-8 max-w-2xl px-4 sm:px-6 text-center text-base leading-relaxed text-fg-mid">
            {category.description}
          </p>
        )}

        {/* Books grid OR empty state */}
        <section className="mx-auto mt-20 max-w-[1320px] px-4 sm:mt-24 sm:px-6">
          {books.length === 0 ? (
            <div className="home-glass mx-auto max-w-md rounded-[20px] p-8 text-center">
              <p className="text-sm leading-relaxed text-fg-mid">
                Once titles are tagged with this category and published,
                they appear here.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {books.map((book) => (
                <li key={book.id}>
                  <CinematicBookTile book={book} headingLevel="h2" />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Editorial closer */}
        <section className="mx-auto mt-24 max-w-3xl px-4 sm:px-6 text-center sm:mt-28">
          <div className="relative mx-auto flex h-5 w-5 items-center justify-center">
            <div
              aria-hidden
              className="absolute h-5 w-5 rounded-full opacity-50"
              style={{
                background:
                  "radial-gradient(circle, rgba(51,240,170,0.6) 0%, transparent 70%)",
              }}
            />
            <span
              aria-hidden
              className="catalog-diamond block h-1.5 w-1.5 rounded-[1px] bg-[#33f0aa]"
              style={{ transform: "rotate(45deg)" }}
            />
          </div>
          <p className="mt-5 font-serif text-[18px] italic leading-relaxed text-fg-mid sm:text-[20px]">
            Browse other genres at the discovery hub.
          </p>
        </section>

        <div className="h-20" />
      </main>

      <HomeFooter />
    </div>
  );
}

/** Single-word category → all emerald. Multi-word → last word emerald. */
function splitNameForAccent(name: string): { head: string; tail: string } {
  const words = name.trim().split(/\s+/);
  if (words.length <= 1) return { head: "", tail: name };
  return {
    head: words.slice(0, -1).join(" "),
    tail: words[words.length - 1],
  };
}

