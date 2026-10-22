import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/metadata";

import { CampaignCountdown } from "@/components/campaign/campaign-countdown";
import { CatalogHero } from "@/components/catalog/catalog-hero";
import { CatalogShell } from "@/components/catalog/catalog-shell";
import {
  toCatalogItems,
  type CatalogItem,
} from "@/components/catalog/catalog-item";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import { buildLibraryShelves, withCollections } from "@/components/spiral-library/library-shelves";
import { SpiralLibrary } from "@/components/spiral-library/spiral-library";
import { listPublishedBooks, listPublishedCollections } from "@/lib/db/queries/catalog";

// ISR — revalidate every hour (matches the existing classification: `○ Static + ISR 1h`).
export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "All books · Browse the catalog",
  description:
    "Explore the entire collection of digital books. Filter by category, format, price, and rating; own every purchase forever.",
  path: "/books",
});

/**
 * `/books` — cinematic catalog page.
 *
 * Layout: dark cinematic-scoped (`.cinematic-root`) so the shared
 * `<CinematicHeader>` and `<HomeFooter>` render with the same visual
 * language as the homepage. Stays `○ Static + ISR 1h` because the
 * `listPublishedBooks()` fetch happens at build/regen time and the
 * interactive `<CatalogShell>` is a hydrating Client island.
 *
 * Data flow: the DB query returns `BookCardData[]`, which `toCatalogItems`
 * widens into the richer shape the catalog UI consumes (facet category,
 * formats, cover treatment). When the query returns nothing, the shell
 * renders its empty state.
 *
 * There used to be a demo-catalog fallback here — eleven hard-coded
 * bestsellers that rendered whenever no real book was published. It was
 * removed: those are books Valice Press has no right to sell, and a
 * visitor cannot distinguish "showcase" from "inventory". An empty shelf
 * is honest; a full shelf of other publishers' books is not.
 *
 * The page opens on the spiral library (`@/components/spiral-library`): the
 * same items, stood one shelf per collection, which the reader descends by
 * scrolling; the full catalogue follows it (`#all-books`). The library holds
 * the page's `<h1>`. If no book could be shelved — the collections read
 * failed, say — there is no library, and the page is the catalogue as before.
 */
export default async function BooksCatalogPage() {
  // `toCatalogItems` attaches each book's real cover from the asset
  // manifest, so this page and every other shelf draw the same file.
  const [rows, collections] = await Promise.all([listPublishedBooks(), listPublishedCollections()]);
  const books: CatalogItem[] = toCatalogItems(rows);
  const placed = withCollections(books, collections);
  const library = buildLibraryShelves(placed.books, placed.categories);
  const hasLibrary = library.shelves.length > 0;

  return (
    <div className="cinematic-root">
      <CinematicHeader active="books" />

      <main id="main-content" className="relative z-10">
        {hasLibrary ? <SpiralLibrary library={library} /> : null}
        <section id="all-books" aria-labelledby="all-books-title" className="scroll-mt-16">
          <CatalogHero
            heading={hasLibrary ? "h2" : "h1"}
            headingId="all-books-title"
            title={hasLibrary ? "The full catalogue" : undefined}
            subtitle={hasLibrary ? "Every book in one place — filter by collection or format, sort, or search." : undefined}
          />
          <CampaignCountdown />
          {/* The shell is server-rendered in its default view, so the cards
              and their links are in the HTML a crawler receives. The address
              bar (filters, sort, page) is applied by a child that renders
              nothing — see `<CatalogShell>`. */}
          <CatalogShell books={books} priorityCovers={!hasLibrary} />
        </section>
      </main>

      <HomeFooter />
    </div>
  );
}
