"use client";

import { Search, Star } from "lucide-react";

import {
  type CatalogItem,
  getCategoryCounts,
  getFormatCounts,
  getRatingCounts,
} from "./catalog-item";

/**
 * Premium filter sidebar — props-driven, presentational only.
 *
 * Receives filter state + setters from `<CatalogShell>`; never owns state
 * itself. This keeps the source-of-truth for the catalog single (the
 * shell) and lets the sidebar be tested in isolation by passing static
 * props.
 */
export interface FilterSidebarProps {
  allBooks: CatalogItem[];
  searchQuery: string;
  selectedCategories: ReadonlySet<string>;
  selectedFormats: ReadonlySet<string>;
  minRating: number;
  onSearchChange: (q: string) => void;
  onToggleCategory: (name: string) => void;
  onToggleFormat: (name: string) => void;
  onMinRatingChange: (v: number) => void;
  onResetAll: () => void;
}

export function FilterSidebar(props: FilterSidebarProps) {
  const categoryCounts = getCategoryCounts(props.allBooks);
  const formatCounts = getFormatCounts(props.allBooks);
  const ratingCounts = getRatingCounts(props.allBooks);

  return (
    <aside
      className="home-glass relative h-fit overflow-hidden rounded-[24px] p-6 lg:sticky lg:top-24 lg:self-start"
      aria-label="Catalog filters"
    >
      {/* Edge glow — top emerald line */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#33f0aa]/40 to-transparent"
      />

      {/* Header */}
      <header className="flex items-center justify-between">
        <h2 className="font-serif text-[18px] font-medium text-fg-hi">
          Filters
        </h2>
        <button
          type="button"
          onClick={props.onResetAll}
          className="text-xs font-medium text-emerald-bright transition-colors hover:text-emerald"
        >
          Reset all
        </button>
      </header>

      {/* Search */}
      <SectionWrap title="Search books">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-fade"
          />
          <input
            type="text"
            value={props.searchQuery}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder="Search within books..."
            className="block h-9 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] pl-9 pr-3 text-sm text-fg-hi placeholder:text-fg-fade transition-colors focus:border-emerald-bright/40 focus:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-bright/20"
          />
        </div>
      </SectionWrap>

      {/* Themes.
          The same `book_categories` rows the shelf has always filtered on,
          under the name a reader browsing a publisher's list would use. NOT a
          second filter beside the old one: a "theme" facet built from a
          separate hand-written vocabulary would be a second list to keep in
          step with the first, and the first is already the truth. */}
      <SectionWrap title="Themes & collections">
        <ul className="space-y-1">
          {categoryCounts.map((cat) => (
            <FilterCheckbox
              key={cat.name}
              label={cat.name}
              count={cat.count}
              checked={props.selectedCategories.has(cat.name)}
              onToggle={() => props.onToggleCategory(cat.name)}
            />
          ))}
        </ul>
      </SectionWrap>

      {/* Formats.
          Real facets now. Until 2026-09-19 every book in the catalogue was
          handed the literal array ["PDF"] by `toCatalogItems`, so this
          section had exactly one row, matched everything, and was hidden by
          the guard below for being useless. The counts are now derived from
          each book's own `book_formats` rows, which is what makes Digital,
          Kindle, Paperback, Hardcover and Large Print real choices. The guard
          stays: a catalogue that genuinely holds one format should still not
          offer a filter that filters nothing. */}
      {formatCounts.length > 1 && (
      <SectionWrap title="Formats">
        <ul className="space-y-1">
          {formatCounts.map((fmt) => (
            <FilterCheckbox
              key={fmt.name}
              label={fmt.name}
              count={fmt.count}
              checked={props.selectedFormats.has(fmt.name)}
              onToggle={() => props.onToggleFormat(fmt.name)}
            />
          ))}
        </ul>
      </SectionWrap>
      )}

      {/*
        THE PRICE SLIDER USED TO BE HERE, and it is deliberately gone.

        It offered "$0 — $50+" over a catalogue whose every direct-sale
        edition costs between $4.99 and $11.99: a control with a 45-dollar
        range and a 7-dollar spread, which cannot separate one book from
        another. Worse, it made price the axis a reader browses a publisher's
        list on. Format and theme are the axes that actually distinguish
        these books, and the price now appears where it can be judged — in
        Quick View, next to the pages and the page count.
      */}

      {/* Rating — hidden while nothing is reviewed. Every book in this
          catalog has zero reviews, so all five rows read 0 and every one of
          them returns an empty grid. Reappears on its own the moment a
          review lands. */}
      {ratingCounts.some((r) => r.count > 0) && (
      <SectionWrap title="Rating">
        <ul className="space-y-1">
          {ratingCounts.map((r) => {
            const isActive = props.minRating === r.stars;
            return (
              <li key={r.stars}>
                <button
                  type="button"
                  onClick={() =>
                    props.onMinRatingChange(isActive ? 0 : r.stars)
                  }
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-emerald-bright/10 text-fg-hi"
                      : "text-fg-mid hover:bg-white/[0.04] hover:text-fg-hi"
                  }`}
                  aria-pressed={isActive}
                >
                  <span className="flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        aria-hidden
                        className={`h-3 w-3 ${
                          i < r.stars
                            ? "fill-[#f4c44b] text-[#f4c44b]"
                            : "fill-transparent text-[#3a4039]"
                        }`}
                      />
                    ))}
                    <span className="ml-1.5 text-xs">& up</span>
                  </span>
                  <span className="text-xs tabular-nums text-fg-fade">
                    {r.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </SectionWrap>
      )}

    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function SectionWrap({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 border-t border-white/[0.05] pt-5 first-of-type:mt-7">
      <h3 className="mb-3 text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FilterCheckbox({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        className="group flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm text-fg-mid transition-colors hover:bg-white/[0.04] hover:text-fg-hi"
      >
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`flex h-4 w-4 items-center justify-center rounded-[5px] border transition-all ${
              checked
                ? "border-[#33f0aa] bg-[#33f0aa] shadow-[0_0_10px_rgba(51,240,170,0.5)]"
                : "border-white/[0.15] bg-white/[0.02] group-hover:border-white/[0.3]"
            }`}
          >
            {checked && (
              <svg
                className="h-2.5 w-2.5 text-[#06231a]"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 6.5l2.5 2.5L10 3.5" />
              </svg>
            )}
          </span>
          <span className={checked ? "text-fg-hi" : ""}>{label}</span>
        </span>
        <span className="text-xs tabular-nums text-fg-fade">{count}</span>
      </button>
    </li>
  );
}
