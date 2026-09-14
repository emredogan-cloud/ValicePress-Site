import Link from "next/link";

import { CoverArt } from "@/components/cinematic/cover-art";
import { DownloadButton } from "@/components/download-button";
import { LibraryStatusMenu } from "@/components/library/library-status-menu";
import type { LibraryView } from "@/components/library/library-filters";
import { type LibraryEntry } from "@/lib/db/queries/account";

/**
 * The owned-books grid (rendered when `getUserLibrary` returns ≥ 1 entry).
 *
 * Phase 2.B — now accepts the filtered + sorted entries from
 * `<LibraryShell>` plus a `view` mode that selects between three
 * layouts:
 *
 *   - `grid`   → 5-up tile grid (the original)
 *   - `shelf`  → horizontal-scrolling 2-up "shelf" rows (compact)
 *   - `list`   → table-style single-line per book (data-dense)
 *
 * Each layout exposes the same actions: download (when ready), pending
 * pulse, revoked notice — plus the new `<LibraryStatusMenu>` so the
 * "Reading" / "Finished" tabs are populatable by the user.
 *
 * Pure Server Component (the `<DownloadButton>` and
 * `<LibraryStatusMenu>` inside each entry are the only Client islands).
 */

export function LibraryBooksGrid({
  library,
  view = "grid",
}: {
  library: LibraryEntry[];
  view?: LibraryView;
}) {
  if (library.length === 0) return null;

  if (view === "list") {
    return <LibraryListView entries={library} />;
  }
  if (view === "shelf") {
    return <LibraryShelfView entries={library} />;
  }
  return <LibraryGridView entries={library} />;
}

// ─────────────────────────────────────────────────────────────────────────
// Grid view — the original 5-up tile grid.
// ─────────────────────────────────────────────────────────────────────────
function LibraryGridView({ entries }: { entries: LibraryEntry[] }) {
  return (
    <section className="mx-auto mt-8 max-w-[1320px] px-4 sm:px-6">
      <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {entries.map((entry) => (
          <li key={entry.bookId}>
            <LibraryTile entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Shelf view — horizontal-scrolling row with two visible at a time on
// mobile. Same tile primitive, just a different container.
// ─────────────────────────────────────────────────────────────────────────
function LibraryShelfView({ entries }: { entries: LibraryEntry[] }) {
  return (
    <section className="mx-auto mt-8 max-w-[1320px] px-4 sm:px-6">
      <ul className="cart-shelf-track -mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-2">
        {entries.map((entry) => (
          <li
            key={entry.bookId}
            className="w-[42vw] flex-shrink-0 snap-start sm:w-[260px]"
          >
            <LibraryTile entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// List view — data-dense single-line-per-book layout. Small cover, title,
// status menu, download.
// ─────────────────────────────────────────────────────────────────────────
function LibraryListView({ entries }: { entries: LibraryEntry[] }) {
  return (
    <section className="mx-auto mt-8 max-w-[1320px] px-4 sm:px-6">
      <ul className="space-y-3">
        {entries.map((entry) => (
          <li key={entry.bookId}>
            <LibraryListRow entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far into the book this reader has got.
 *
 * Rendered only when there IS a position — a library of unopened books should
 * not be a wall of empty bars, and 0% is indistinguishable from "not started"
 * to anyone glancing at a shelf. The number is also given as text, because a
 * three-pixel bar is not information to a screen reader or to anyone who
 * cannot resolve it (§60).
 */
function ReadingProgressBar({
  progress,
}: {
  progress: LibraryEntry["progress"];
}) {
  if (!progress) return null;
  const percent = Math.max(1, Math.min(100, Math.round(progress.percent)));
  return (
    <div className="px-1 pb-0.5">
      <div
        className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.09]"
        role="img"
        aria-label={`${percent}% read, last on page ${progress.page}`}
      >
        <div
          className="h-full rounded-full bg-[#16c784]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-fg-muted">
        {percent}% · page {progress.page}
      </p>
    </div>
  );
}

function LibraryTile({ entry }: { entry: LibraryEntry }) {
  return (
    <article className="home-glass home-card-hover group relative flex flex-col overflow-hidden rounded-[22px] p-3">
      {/* Status menu — top-right above the cover, doesn't compete with download */}
      <div className="absolute right-4 top-4 z-20">
        <LibraryStatusMenu
          bookId={entry.bookId}
          initialStatus={entry.readStatus}
        />
      </div>

      <Link
        href={`/books/${entry.book.slug}`}
        className="relative block aspect-[2/3] overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#0a1410] shadow-[0_18px_36px_-14px_rgba(0,0,0,0.7)]"
      >
        <CoverArt
          src={entry.book.coverSrc}
          title={entry.book.title}
          eyebrow="Owned"
          sizes="(min-width: 1024px) 20vw, 42vw"
        />
      </Link>

      <div className="mt-4 flex flex-1 flex-col gap-1 px-1 pb-1">
        <h3 className="line-clamp-2 font-serif text-[14px] font-medium leading-snug text-fg-hi transition-colors group-hover:text-emerald-bright">
          {entry.book.title}
        </h3>
        {entry.book.subtitle && (
          <p className="line-clamp-1 text-xs text-fg-soft">
            {entry.book.subtitle}
          </p>
        )}

        <div className="mt-3">
          {entry.status === "ready" ? (
            // Phase E — primary "Read" (online reader) + secondary Download.
            // Shown ONLY for `ready`; the reader route re-checks ownership +
            // status, so this link never grants access on its own.
            <div className="flex flex-col gap-2">
              <Link
                href={`/read/${entry.bookId}`}
                className="home-cta-primary inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold tracking-tight"
              >
                {entry.progress ? "Continue reading" : "Read"}
              </Link>
              <ReadingProgressBar progress={entry.progress} />
              <DownloadButton bookId={entry.bookId} variant="secondary" label="Download PDF" />
              {/* Shown only when this order actually produced an EPUB. A
                  format button that appears before the file exists is the
                  defect this whole column was added to prevent. */}
              {entry.epubKey && (
                <DownloadButton
                  bookId={entry.bookId}
                  variant="secondary"
                  label="Download EPUB"
                  format="epub"
                />
              )}
            </div>
          ) : entry.status === "pending" ? (
            <p className="inline-flex items-center gap-2 text-xs text-fg-mid">
              <span
                aria-hidden
                className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#33f0aa] shadow-[0_0_6px_#33f0aa]"
              />
              Preparing your copy…
            </p>
          ) : (
            <p className="text-xs text-[#ff9b9b]">Access revoked.</p>
          )}
        </div>
      </div>
    </article>
  );
}

function LibraryListRow({ entry }: { entry: LibraryEntry }) {
  return (
    <article className="home-glass relative flex items-center gap-4 overflow-hidden rounded-[16px] p-3 sm:gap-5 sm:p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#33f0aa]/25 to-transparent"
      />

      {/* Mini cover — w-14 keeps it row-height friendly */}
      <Link
        href={`/books/${entry.book.slug}`}
        className="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded-md border border-white/[0.08] bg-[#0a1410]"
      >
        <CoverArt
          src={entry.book.coverSrc}
          title={entry.book.title}
          sizes="56px"
          titleClassName="font-serif text-[8px] font-medium leading-tight text-white line-clamp-3"
        />
      </Link>

      {/* Title + subtitle */}
      <div className="min-w-0 flex-1">
        <Link
          href={`/books/${entry.book.slug}`}
          className="block font-serif text-base font-medium leading-tight text-fg-hi transition-colors hover:text-emerald-bright"
        >
          {entry.book.title}
        </Link>
        {entry.book.subtitle && (
          <p className="mt-1 line-clamp-1 text-xs text-fg-soft">
            {entry.book.subtitle}
          </p>
        )}
      </div>

      {/* Status menu */}
      <div className="flex-shrink-0">
        <LibraryStatusMenu
          bookId={entry.bookId}
          initialStatus={entry.readStatus}
        />
      </div>

      {/* Read / Download / pending / revoked */}
      <div className="flex-shrink-0">
        {entry.status === "ready" ? (
          // Phase E — status-gated "Read" entry-point beside Download.
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/read/${entry.bookId}`}
              className="home-cta-primary inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold tracking-tight"
            >
              {entry.progress ? "Continue" : "Read"}
            </Link>
            {entry.progress && (
              <span className="text-[11px] text-fg-muted">
                {Math.max(1, Math.round(entry.progress.percent))}% · page{" "}
                {entry.progress.page}
              </span>
            )}
            <DownloadButton bookId={entry.bookId} size="sm" variant="secondary" label="PDF" />
            {entry.epubKey && (
              <DownloadButton
                bookId={entry.bookId}
                size="sm"
                variant="secondary"
                label="EPUB"
                format="epub"
              />
            )}
          </div>
        ) : entry.status === "pending" ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-fg-mid">
            <span
              aria-hidden
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#33f0aa]"
            />
            Preparing…
          </span>
        ) : (
          <span className="text-xs text-[#ff9b9b]">Revoked</span>
        )}
      </div>
    </article>
  );
}
