"use client";

import { SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CatalogBookCard } from "./catalog-book-card";
import {
  CatalogToolbar,
  type SortOption,
  type ViewMode,
} from "./catalog-toolbar";
import { type CatalogItem } from "./catalog-item";
import { FilterSidebar } from "./filter-sidebar";
import { FormatBadgeRow } from "@/components/format-badge-row";
import { Pagination } from "./pagination";
import { QuickView } from "./quick-view";

const PAGE_SIZE = 12; // 4 cols × 3 rows — larger cards, fuller catalog page (Issue 3)

const VALID_SORTS: ReadonlyArray<SortOption> = [
  "newest",
  "price-low",
  "price-high",
  "rating",
];
const VALID_VIEWS: ReadonlyArray<ViewMode> = ["grid", "list"];

/**
 * The single source of truth for the catalog's interactive state.
 *
 * Phase 2.F — URL-synced filters. Every interactive surface writes to
 * the URL via `router.replace`; mounting reads initial state from
 * `useSearchParams`; browser back/forward stays in sync because the
 * URL is authoritative. A refresh restores everything; a shared link
 * lands on the same filtered view; the back button rewinds filter
 * history one step at a time.
 *
 * Phase 2.I fold-in — the "Showing X-Y of 50,231" sahte global label
 * is gone; the toolbar now reflects the real catalog size.
 *
 * The page (`src/app/books/page.tsx`) stays a Server Component that
 * fetches `listPublishedBooks()` at SSG/ISR time and passes the baked-in
 * array as a prop here. Page classification stays `○ Static + ISR 1h` —
 * URL params only affect the client view, never the SSG payload.
 */

// URL param keys — kept short for shareable URLs.
const URL_KEYS = {
  query: "q",
  categories: "cat",
  formats: "fmt",
  rating: "r",
  sort: "sort",
  view: "view",
  page: "page",
} as const;

interface CatalogState {
  searchQuery: string;
  selectedCategories: Set<string>;
  selectedFormats: Set<string>;
  minRating: number;
  sortBy: SortOption;
  viewMode: ViewMode;
  currentPage: number;
}

const DEFAULT_STATE: CatalogState = {
  searchQuery: "",
  selectedCategories: new Set(),
  selectedFormats: new Set(),
  minRating: 0,
  sortBy: "newest",
  viewMode: "grid",
  currentPage: 1,
};

/**
 * Parse a `URLSearchParams` snapshot into a `CatalogState`, falling back
 * to defaults for any missing / malformed key. The catalog accepts
 * arbitrary URLs gracefully — `/books?p=hello` ignores `hello` rather
 * than throwing.
 */
function readStateFromParams(params: URLSearchParams): CatalogState {
  const categoriesParam = params.get(URL_KEYS.categories);
  const formatsParam = params.get(URL_KEYS.formats);
  const ratingParam = params.get(URL_KEYS.rating);
  const sortParam = params.get(URL_KEYS.sort);
  const viewParam = params.get(URL_KEYS.view);
  const pageParam = params.get(URL_KEYS.page);

  const ratingNum = ratingParam ? Number(ratingParam) : NaN;
  const pageNum = pageParam ? Number(pageParam) : NaN;

  const sort = (VALID_SORTS as readonly string[]).includes(sortParam ?? "")
    ? (sortParam as SortOption)
    : DEFAULT_STATE.sortBy;
  const view = (VALID_VIEWS as readonly string[]).includes(viewParam ?? "")
    ? (viewParam as ViewMode)
    : DEFAULT_STATE.viewMode;

  return {
    searchQuery: params.get(URL_KEYS.query) ?? "",
    selectedCategories: new Set(
      categoriesParam ? categoriesParam.split(",").filter(Boolean) : [],
    ),
    selectedFormats: new Set(
      formatsParam ? formatsParam.split(",").filter(Boolean) : [],
    ),
    minRating:
      Number.isFinite(ratingNum) && ratingNum >= 0 && ratingNum <= 5
        ? ratingNum
        : 0,
    sortBy: sort,
    viewMode: view,
    currentPage:
      Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1,
  };
}

/**
 * Serialize a `CatalogState` into URL query params, omitting any key that
 * matches the default value so the URL stays short. `/books` (no params)
 * is the canonical "no filters" URL.
 */
function writeStateToParams(state: CatalogState): URLSearchParams {
  const next = new URLSearchParams();
  if (state.searchQuery) next.set(URL_KEYS.query, state.searchQuery);
  if (state.selectedCategories.size > 0) {
    next.set(URL_KEYS.categories, Array.from(state.selectedCategories).join(","));
  }
  if (state.selectedFormats.size > 0) {
    next.set(URL_KEYS.formats, Array.from(state.selectedFormats).join(","));
  }
  if (state.minRating !== 0) {
    next.set(URL_KEYS.rating, String(state.minRating));
  }
  if (state.sortBy !== DEFAULT_STATE.sortBy) {
    next.set(URL_KEYS.sort, state.sortBy);
  }
  if (state.viewMode !== DEFAULT_STATE.viewMode) {
    next.set(URL_KEYS.view, state.viewMode);
  }
  if (state.currentPage !== 1) {
    next.set(URL_KEYS.page, String(state.currentPage));
  }
  return next;
}

export function CatalogShell({ books }: { books: CatalogItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initial state — read from the URL once at mount. Subsequent URL
  // changes from outside (browser back/forward) re-sync via the effect
  // below.
  const [state, setState] = useState<CatalogState>(() =>
    readStateFromParams(new URLSearchParams(searchParams?.toString() ?? "")),
  );

  // Resync local state when the URL changes from outside this component
  // (e.g. browser back/forward). We compare a serialized snapshot to
  // avoid an infinite re-render loop with the writer effect below.
  const lastWrittenQuery = useRef<string>(searchParams?.toString() ?? "");
  useEffect(() => {
    const currentQuery = searchParams?.toString() ?? "";
    if (currentQuery === lastWrittenQuery.current) return;
    lastWrittenQuery.current = currentQuery;
    setState(readStateFromParams(new URLSearchParams(currentQuery)));
  }, [searchParams]);

  // Write state → URL whenever state changes. Search input is debounced
  // (300ms) so typing doesn't pollute history. Everything else commits
  // immediately because filter clicks are deliberate.
  const writeUrl = useCallback(
    (next: CatalogState) => {
      const params = writeStateToParams(next);
      const queryString = params.toString();
      lastWrittenQuery.current = queryString;
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(url, { scroll: false });
    },
    [pathname, router],
  );

  const debouncedSearchWrite = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(() => {
    if (debouncedSearchWrite.current) clearTimeout(debouncedSearchWrite.current);
    debouncedSearchWrite.current = setTimeout(() => {
      writeUrl(state);
    }, 300);
    return () => {
      if (debouncedSearchWrite.current) clearTimeout(debouncedSearchWrite.current);
    };
    // The writer is debounced via this single effect; we re-run on every
    // state change so search typing collapses into one URL write.
  }, [state, writeUrl]);

  /* -------------------------------- filters ------------------------------ */
  const filtered = useMemo(() => {
    const needle = state.searchQuery.trim().toLowerCase();
    const arr = books.filter((b) => {
      if (needle && !b.title.toLowerCase().includes(needle)) return false;
      if (
        state.selectedCategories.size &&
        !state.selectedCategories.has(b.category)
      ) {
        return false;
      }
      if (
        state.selectedFormats.size &&
        !b.formats.some((f) => state.selectedFormats.has(f))
      ) {
        return false;
      }
      if (state.minRating && b.rating < state.minRating) return false;
      return true;
    });

    switch (state.sortBy) {
      case "price-low":
        return [...arr].sort((a, b) => a.priceCents - b.priceCents);
      case "price-high":
        return [...arr].sort((a, b) => b.priceCents - a.priceCents);
      case "rating":
        return [...arr].sort((a, b) => b.rating - a.rating);
      case "newest":
      default:
        return arr; // keep original order
    }
  }, [books, state]);

  /* ----------------------------- pagination ----------------------------- */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(state.currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const visible = filtered.slice(pageStart, pageEnd);

  /* ------------------------- filter handler helpers --------------------- */
  // Every filter change resets pagination to page 1 — without this the
  // user would land on page 5 after toggling a category that only has 8
  // matches, see an empty page, and be confused.
  const togglerForSetKey = (key: "selectedCategories" | "selectedFormats") => {
    return (name: string) => {
      setState((prev) => {
        const next = new Set(prev[key]);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return { ...prev, [key]: next, currentPage: 1 };
      });
    };
  };

  const onSearchChange = (q: string) =>
    setState((s) => ({ ...s, searchQuery: q, currentPage: 1 }));
  const onToggleCategory = togglerForSetKey("selectedCategories");
  const onToggleFormat = togglerForSetKey("selectedFormats");
  const onMinRatingChange = (v: number) =>
    setState((s) => ({ ...s, minRating: v, currentPage: 1 }));
  const onSortChange = (s: SortOption) =>
    setState((prev) => ({ ...prev, sortBy: s, currentPage: 1 }));
  const onViewChange = (v: ViewMode) =>
    setState((s) => ({ ...s, viewMode: v }));
  const onPageChange = (p: number) =>
    setState((s) => ({
      ...s,
      currentPage: Math.max(1, Math.min(p, totalPages)),
    }));
  const onResetAll = () =>
    setState({
      ...DEFAULT_STATE,
      // Replace the Sets with fresh instances so React picks up the change.
      selectedCategories: new Set(),
      selectedFormats: new Set(),
    });

  /* ------------------------- mobile filter sheet ------------------------- */
  /*
   * Below `lg:` the sidebar used to sit in normal flow ABOVE the results: on
   * the Redmi the first book cover was 1053px down — a screen and a half of
   * hero and filter controls before a single product, for a catalogue of 15.
   * The same <FilterSidebar> instance is now presented as a sheet on demand,
   * so filter state stays in one place.
   *
   * `lg:contents` on the wrapper is what keeps desktop untouched: at desktop
   * the wrapper generates no box at all, so <aside> remains a direct child of
   * the grid and its `lg:sticky lg:top-24 lg:self-start` behaves exactly as
   * before. Re-parenting it would have broken that.
   */
  const [filtersOpen, setFiltersOpen] = useState(false);

  /**
   * Quick View. Held here rather than inside each card so exactly one modal
   * can ever be open, and so the card stays a cheap, purely presentational
   * component that renders a real link.
   */
  const [quickBook, setQuickBook] = useState<CatalogItem | null>(null);

  const activeFilterCount =
    state.selectedCategories.size +
    state.selectedFormats.size +
    (state.minRating > 0 ? 1 : 0) +
    (state.searchQuery.trim() ? 1 : 0);

  useEffect(() => {
    if (!filtersOpen) return;
    const html = document.documentElement;
    const { body } = document;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      document.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  /* --------------------------------- render ----------------------------- */
  return (
    <div className="mx-auto grid max-w-[1440px] gap-8 px-4 pb-24 sm:px-6 lg:grid-cols-[300px_minmax(0,_1fr)] lg:gap-12">
      {/* Filters trigger — phone and tablet only. */}
      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        aria-expanded={filtersOpen}
        aria-controls="catalog-filters"
        aria-haspopup="dialog"
        className="home-glass inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/[0.08] text-sm font-medium text-fg-hi transition-colors hover:border-emerald-bright/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/50 lg:hidden"
      >
        <SlidersHorizontal aria-hidden className="h-4 w-4" />
        Filters
        {activeFilterCount > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-bright px-1.5 text-[12px] font-semibold text-[#032015]">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Backdrop — sheet only. */}
      {filtersOpen && (
        <div
          aria-hidden
          onClick={() => setFiltersOpen(false)}
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar. `lg:contents` dissolves this wrapper at desktop. */}
      <div
        id="catalog-filters"
        role={filtersOpen ? "dialog" : undefined}
        aria-modal={filtersOpen ? true : undefined}
        aria-label={filtersOpen ? "Filters" : undefined}
        className={`${
          filtersOpen
            ? "fixed inset-x-0 bottom-0 top-16 z-[70] overflow-y-auto overscroll-contain rounded-t-[24px] border-t border-white/[0.08] bg-[#0a1410] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            : "hidden"
        } lg:contents`}
      >
        {/* Close only — FilterSidebar renders its own "Filters / Reset all"
            header, and two of them read as a mistake. The dialog is named by
            aria-label instead. */}
        {filtersOpen && (
          <div className="mb-2 flex justify-end lg:hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              aria-label="Close filters"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-fg-mid transition-colors hover:text-fg-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/50"
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
        )}
        <FilterSidebar
          allBooks={books}
          searchQuery={state.searchQuery}
          selectedCategories={state.selectedCategories}
          selectedFormats={state.selectedFormats}
          minRating={state.minRating}
          onSearchChange={onSearchChange}
          onToggleCategory={onToggleCategory}
          onToggleFormat={onToggleFormat}
          onMinRatingChange={onMinRatingChange}
          onResetAll={onResetAll}
        />
        {filtersOpen && (
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="home-cta-primary mt-4 inline-flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold lg:hidden"
          >
            Show {filtered.length} {filtered.length === 1 ? "book" : "books"}
          </button>
        )}
      </div>

      {/* Main content */}
      <section className="min-w-0">
        <CatalogToolbar
          startIndex={visible.length === 0 ? 0 : pageStart + 1}
          endIndex={pageStart + visible.length}
          totalDisplayed={filtered.length}
          // Phase 2.I fold-in — the previous "50,231" sahte marketing
          // label is gone. We always show the real total catalog size
          // (the input `books` length) when no filters are active, and
          // the filtered count otherwise.
          totalGlobal={
            filtered.length === books.length
              ? books.length.toLocaleString("en-US")
              : filtered.length.toLocaleString("en-US")
          }
          sortBy={state.sortBy}
          viewMode={state.viewMode}
          onSortChange={onSortChange}
          onViewChange={onViewChange}
        />

        {/* Grid / list */}
        {books.length === 0 ? (
          <CatalogEmpty />
        ) : visible.length === 0 ? (
          <EmptyResults onReset={onResetAll} />
        ) : state.viewMode === "grid" ? (
          <ul className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((book, index) => (
              <li key={book.id}>
                {/* The first row is above the fold; those four covers are
                    loaded eagerly so the catalogue never shows an empty
                    frame where a cover exists. */}
                <CatalogBookCard
                  book={book}
                  priority={index < 4}
                  onQuickView={setQuickBook}
                />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-10 space-y-3">
            {visible.map((book) => (
              <li key={book.id}>
                <ListRow book={book} onQuickView={setQuickBook} />
              </li>
            ))}
          </ul>
        )}

        {/* Quick View. One instance for the whole grid. */}
        {/* Keyed by slug: opening a different book remounts the panel, so
            its selected edition and preview page reset without an effect. */}
        <QuickView
          key={quickBook?.slug ?? "quick-view-closed"}
          book={quickBook}
          onClose={() => setQuickBook(null)}
        />

        {/* Pagination */}
        <div className="mt-14">
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* List view row — compact horizontal layout for the alternate view mode      */
/* -------------------------------------------------------------------------- */

function ListRow({
  book,
  onQuickView,
}: {
  book: CatalogItem;
  onQuickView: (b: CatalogItem) => void;
}) {
  return (
    <div className="home-glass home-card-hover group flex items-center gap-5 rounded-2xl p-4">
      <div
        className="flex h-24 w-16 flex-shrink-0 flex-col justify-between rounded-md p-2 text-[8px]"
        style={{ background: book.cover.gradient }}
      >
        <span
          className="font-semibold uppercase tracking-[0.12em]"
          style={{
            color: book.cover.darkText
              ? "rgba(0,0,0,0.45)"
              : "rgba(255,255,255,0.5)",
          }}
        >
          {book.category.slice(0, 3)}
        </span>
        <span
          className="font-serif text-[12px] lg:text-[10px] leading-tight"
          style={{ color: book.cover.darkText ? "#1a1612" : "#fff" }}
        >
          {book.title.split(" ").slice(0, 2).join(" ")}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="truncate font-serif text-base font-medium text-fg-hi group-hover:text-emerald-bright">
          {book.title}
        </h4>
        <p className="mt-0.5 truncate text-sm text-fg-soft">{book.author}</p>
        <div className="mt-2 flex items-center gap-4 text-xs text-fg-mid">
          <span className="rounded-full bg-white/[0.04] px-2 py-0.5">
            {book.category}
          </span>
        </div>
        <FormatBadgeRow book={book} size="sm" className="mt-2" />
      </div>

      <div className="flex flex-col items-end gap-2">
        {/* The price is not here. It is one click away, in Quick View, beside
            the pages and the facts that make it mean something. */}
        <button
          type="button"
          onClick={() => onQuickView(book)}
          className="rounded-full border border-white/[0.14] px-4 py-1.5 text-[12px] font-medium text-fg-hi transition-colors hover:border-emerald-bright/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-bright"
        >
          Quick view
        </button>
        {/* Hidden entirely with no reviews — see <CatalogBookCard>. */}
        {book.rating > 0 && (
          <span className="flex items-center gap-1 text-xs text-fg-mid">
            <svg
              aria-hidden
              viewBox="0 0 12 12"
              className="h-3 w-3 fill-[#f4c44b]"
            >
              <path d="M6 1l1.6 3.3 3.4.5-2.5 2.4.6 3.4L6 9 2.9 10.6l.6-3.4L1 4.8l3.4-.5z" />
            </svg>
            <span className="tabular-nums">{book.rating.toFixed(1)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty-results state — shown when filters yield zero matches                */
/* -------------------------------------------------------------------------- */

/**
 * Nothing is published yet — distinct from "your filters matched nothing".
 * Offering a "reset filters" button when the catalog itself is empty sends
 * the reader in a circle, so this state offers the newsletter instead.
 */
function CatalogEmpty() {
  return (
    <div className="home-glass mt-10 rounded-2xl px-8 py-10 sm:py-16 text-center">
      <p className="font-serif text-xl text-fg-hi">
        The first editions are still at the press.
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-fg-soft">
        Valice Press publishes a small number of carefully made books rather
        than a large number of quick ones. Nothing is listed here yet.
      </p>
      <Link
        href="/#newsletter"
        className="home-cta-secondary mt-7 inline-flex h-10 items-center rounded-full px-5 text-sm font-medium"
      >
        Hear when the first one ships
      </Link>
    </div>
  );
}

function EmptyResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="home-glass mt-10 rounded-2xl px-8 py-10 sm:py-16 text-center">
      <p className="font-serif text-xl text-fg-hi">
        No books match these filters.
      </p>
      <p className="mt-2 text-sm text-fg-soft">
        Try widening the price range, or clear the filters to start over.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="home-cta-secondary mt-7 inline-flex h-10 items-center rounded-full px-5 text-sm font-medium"
      >
        Reset filters
      </button>
    </div>
  );
}
