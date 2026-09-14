import type { Metadata } from "next";

import { FulfillmentPoller } from "@/components/fulfillment-poller";
import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import { LibraryEmptyPanel } from "@/components/library/library-empty-panel";
import { LibraryHero } from "@/components/library/library-hero";
import { LibraryRecommendationShelf } from "@/components/library/library-recommendation-shelf";
import { LibraryShell } from "@/components/library/library-shell";
import { LibraryStats } from "@/components/library/library-stats";
import { UnprovisionedNotice } from "@/components/unprovisioned-notice";
import { loadAuthenticatedLocalUser } from "@/lib/account";
import { countUserBookmarks, getUserLibrary } from "@/lib/db/queries/account";
import { listPublishedBooks } from "@/lib/db/queries/catalog";
import { toCatalogItems } from "@/components/catalog/catalog-item";

// Account routes read the cookie session + per-user DB — never cache,
// never prerender. The cinematic redesign preserves the classification.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your library",
  robots: { index: false, follow: false },
};

/**
 * Cinematic library page — opens after purchase / from the nav.
 *
 * Two states (both inside `.cinematic-root`):
 *   - **Empty** (`library.length === 0`): hero + stats (all zero) +
 *     filter bar + empty focal panel + recommendation shelf.
 *   - **With books**: same hero + stats (with real counts) + filter
 *     bar + owned-books grid + recommendation shelf.
 *
 * Auth gate untouched — `loadAuthenticatedLocalUser()` returns either a
 * resolved user context or a structured `UnprovisionedNotice` payload.
 * The notice surface uses the warm theme by default; rather than
 * cinematic-ize the gate too, we accept the visual hop in the unauth
 * case (it's rare and the notice is actionable).
 */
export default async function LibraryPage() {
  const userCtx = await loadAuthenticatedLocalUser();
  if (!userCtx.ok) {
    return (
      <UnprovisionedNotice
        title={userCtx.title}
        body={userCtx.body}
        missing={userCtx.missing}
      />
    );
  }

  const [library, bookmarkCount] = await Promise.all([
    getUserLibrary(userCtx.localUserId),
    countUserBookmarks(userCtx.localUserId),
  ]);
  const hasPending = library.some((entry) => entry.status === "pending");
  const isEmpty = library.length === 0;

  // "What to read next" — real published books, minus the ones already in
  // this reader's library. Recommending a book someone has already bought is
  // the one recommendation guaranteed to be useless.
  const ownedBookIds = new Set(library.map((entry) => entry.bookId));
  const recommendations = toCatalogItems(
    (await listPublishedBooks())
      .filter((b) => !ownedBookIds.has(b.id))
      .slice(0, 8),
  );

  return (
    <div className="cinematic-root">
      <CinematicHeader active="library" />

      <main id="main-content" className="relative z-10">
        {/* Poll for pending fulfillments — unchanged behavior */}
        <FulfillmentPoller enabled={hasPending} />

        <LibraryHero />
        <LibraryStats booksOwned={library.length} bookmarks={bookmarkCount} />

        {isEmpty ? (
          <LibraryEmptyPanel />
        ) : (
          // Phase 2.B — `<LibraryShell>` lifts the activeTab / sort / view
          // state above `<LibraryFilters>` and `<LibraryBooksGrid>` so the
          // filter bar actually drives the grid. The shell renders both
          // components in one piece.
          <LibraryShell library={library} />
        )}

        <LibraryRecommendationShelf picks={recommendations} />

        <div className="h-20" />
      </main>

      <HomeFooter />
    </div>
  );
}
