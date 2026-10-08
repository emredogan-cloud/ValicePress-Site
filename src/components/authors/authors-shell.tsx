"use client";

import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { CATEGORY_INFO, CATEGORY_ORDER, type AuthorCategory } from "@/lib/reference-authors";

import { AuthorCard } from "./author-card";
import { AUTHOR_SORTS, type AuthorCardData, type AuthorSort } from "./author-card-data";

type Facet = "all" | "published" | AuthorCategory;

export interface PortraitCredit {
  slug: string;
  name: string;
  credit: string;
  licence: string;
  licenceUrl: string | null;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** A directory sorts by family name: "Ann Bannon" under B, "Henry E. Dudeney" under D, "T. H. Thomas" under T. */
const surnameKey = (name: string) => {
  const parts = fold(name).replace(/\./g, "").split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : fold(name);
};

/**
 * The directory: search, a filter, a sort, and the cards.
 *
 * ONE LIST, FILTERED — never two lists with the same person in each. "On the Valice list" is a facet
 * over the same people the categories are, so Hearn is one card that answers both filters.
 *
 * Everything here is a view over data that already carries its own facts (`buildDirectory`): the
 * counts on the filters are counted, not typed, and a filter with nobody in it is not offered.
 * The result count is announced to screen readers when it changes.
 */
export function AuthorsShell({ authors, credits }: { authors: AuthorCardData[]; credits: PortraitCredit[] }) {
  const [query, setQuery] = useState("");
  const [facet, setFacet] = useState<Facet>("all");
  const [sortBy, setSortBy] = useState<AuthorSort>("Surname A → Z");

  const facets = useMemo(() => {
    const count = (f: Facet) => authors.filter((a) => (f === "all" ? true : f === "published" ? a.kind === "published" : a.category === f)).length;
    const list: Array<{ id: Facet; label: string; n: number }> = [
      { id: "all", label: "Everyone", n: count("all") },
      { id: "published", label: "On the Valice list", n: count("published") },
      ...CATEGORY_ORDER.map((c) => ({ id: c as Facet, label: CATEGORY_INFO[c].filter, n: count(c) })),
    ];
    return list.filter((f) => f.n > 0);
  }, [authors]);

  const visible = useMemo(() => {
    const needle = fold(query.trim());
    const rows = authors.filter((a) => {
      if (facet === "published" && a.kind !== "published") return false;
      if (facet !== "all" && facet !== "published" && a.category !== facet) return false;
      return !needle || a.haystack.includes(needle);
    });
    const byName = (a: AuthorCardData, b: AuthorCardData) => surnameKey(a.name).localeCompare(surnameKey(b.name)) || a.name.localeCompare(b.name);
    if (sortBy === "Most books") return [...rows].sort((a, b) => b.bookCount - a.bookCount || byName(a, b));
    if (sortBy === "Earliest born") return [...rows].sort((a, b) => (a.bornYear ?? 9999) - (b.bornYear ?? 9999) || byName(a, b));
    return [...rows].sort(byName);
  }, [authors, query, facet, sortBy]);

  const reset = () => {
    setQuery("");
    setFacet("all");
  };

  return (
    <>
      <div className="mx-auto mt-6 flex max-w-2xl items-center justify-center px-6">
        <div className="relative w-full">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-fade" />
          <label htmlFor="author-search" className="sr-only">
            Search authors by name, work, place or theme
          </label>
          <input
            id="author-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="Search by name, a book, a place…"
            autoComplete="off"
            className="h-11 w-full rounded-full border border-white/[0.08] bg-white/[0.03] pl-10 pr-4 text-sm text-fg-hi transition-colors placeholder:text-fg-fade focus:border-emerald-bright/40 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-emerald-bright/20"
          />
        </div>
      </div>

      <div role="group" aria-label="Filter authors" className="mx-auto mt-5 flex max-w-5xl flex-wrap justify-center gap-2 px-6">
        {facets.map((f) => {
          const on = facet === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFacet(f.id)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/50 ${
                on
                  ? "border-emerald-bright/60 bg-emerald-bright/15 text-emerald-bright"
                  : "border-white/[0.1] bg-white/[0.03] text-fg-mid hover:border-white/[0.2] hover:text-fg-hi"
              }`}
            >
              {f.label}
              <span className={`text-[11px] ${on ? "text-emerald-bright/80" : "text-fg-fade"}`}>{f.n}</span>
            </button>
          );
        })}
      </div>

      <div className="mx-auto mt-10 flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6">
        <p role="status" aria-live="polite" className="text-sm text-fg-soft">
          {visible.length === authors.length ? `${visible.length} authors` : `${visible.length} of ${authors.length} authors`}
        </p>
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-fg-soft">
            Sort by:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.currentTarget.value as AuthorSort)}
            aria-label="Sort authors"
            className="h-11 cursor-pointer appearance-none rounded-full border border-white/[0.08] bg-white/[0.03] pl-[68px] pr-9 text-sm text-fg-hi transition-colors hover:border-white/[0.14] focus:border-emerald-bright/40 focus:outline-none focus:ring-2 focus:ring-emerald-bright/20"
          >
            {AUTHOR_SORTS.map((s) => (
              <option key={s} value={s} className="bg-[#0a1410]">
                {s}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-mid" />
        </div>
      </div>

      <section aria-label="Authors" className="mx-auto mt-6 max-w-7xl px-6">
        {visible.length === 0 ? (
          <EmptyResults onClear={reset} />
        ) : (
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {visible.map((author, i) => (
              <li key={author.slug} className="h-full">
                {/* Two, not six: the hero takes the top of the page, so on most screens only the first row of
                    portraits is anywhere near the fold, and each `priority` image is a preload the
                    LCP element has to share bandwidth with. */}
                <AuthorCard author={author} priority={i < 2} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mx-auto mt-16 max-w-3xl px-6">
        <details className="home-glass group rounded-[18px] px-5 py-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-fg-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/50">
            Photograph credits
            <ChevronDown aria-hidden className="h-4 w-4 text-fg-mid transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-3 text-[13px] leading-relaxed text-fg-soft">
            Every portrait here is in the public domain or freely licensed, from Wikimedia Commons, and the licence is recorded with it. Where a licence asks for the photographer to be named, they are named
            below and on the author&apos;s own page. Authors with no free photograph show their initials instead.
          </p>
          <ul className="mt-4 space-y-2.5 text-[13px] leading-snug text-fg-mid">
            {credits.map((c) => (
              <li key={c.slug}>
                <Link href={`/authors/${c.slug}`} className="font-medium text-fg-hi hover:text-emerald-bright">
                  {c.name}
                </Link>{" "}
                — {c.credit}
                {c.licenceUrl && (
                  <>
                    {" "}
                    (
                    <a href={c.licenceUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-bright underline-offset-2 hover:underline">
                      licence
                    </a>
                    )
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </>
  );
}

function EmptyResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="home-glass mx-auto mt-6 max-w-md rounded-2xl px-8 py-12 text-center">
      <p className="font-serif text-lg text-fg-hi">No authors match.</p>
      <p className="mt-2 text-sm text-fg-soft">Try a different word, or clear the search and the filter.</p>
      <button type="button" onClick={onClear} className="home-cta-secondary mt-6 inline-flex h-11 items-center rounded-full px-5 text-sm font-medium">
        Show everyone
      </button>
    </div>
  );
}
