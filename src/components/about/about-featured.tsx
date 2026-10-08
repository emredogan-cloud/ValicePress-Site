import Link from "next/link";

import type { BookCardData } from "@/components/book-card";
import { CinematicBookTile } from "@/components/cinematic/cinematic-book-tile";

/**
 * "Start here" — the same books the homepage leads with (the catalogue's pinned order), as tiles that link
 * to their own pages. Nothing is hand-picked on this page: when the pins change, so does this row.
 */
export function AboutFeatured({ books, total }: { books: BookCardData[]; total: number }) {
  if (books.length === 0) return null;
  return (
    <section aria-labelledby="featured-heading">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-emerald-bright lg:text-[11px]">Featured</p>
          <h2 id="featured-heading" className="mt-3 font-serif text-[32px] font-medium leading-tight tracking-[-0.02em] text-fg-hi sm:text-[40px]">
            Start here
          </h2>
        </div>
        <Link href="/books" className="text-sm font-medium text-emerald-bright underline decoration-emerald-bright/30 underline-offset-4 hover:decoration-emerald-bright">
          {total > 0 ? `All ${total} titles` : "All titles"}
        </Link>
      </header>
      <ul className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-4">
        {books.map((b) => (
          <li key={b.id}>
            <CinematicBookTile book={b} />
          </li>
        ))}
      </ul>
    </section>
  );
}
