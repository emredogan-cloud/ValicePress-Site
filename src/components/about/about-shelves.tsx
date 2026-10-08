import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { CategoryCoverStack } from "@/components/categories/category-cover-stack";
import { categoryLook } from "@/components/categories/category-icons";
import { SHELF_COPY } from "@/lib/about-copy";
import type { CategorySummary } from "@/lib/db/queries/catalog";

/** The order the shelves are introduced in: what the press is best known for first. */
const ORDER = ["myth-and-folklore", "games-and-play", "puzzle-and-challenge", "romance", "classics-and-philosophy", "language-and-learning", "young-explorers"] as const;

/**
 * How wide a cover in the fan is, as a fraction of its frame: 68% of the frame's height at a cover's 2:3, in the
 * 16:9 frame these cards use — 0.68 × 2/3 × 9/16. The images' `sizes` are scaled by it, and `e2e/quality.pw.ts`
 * fails any that ask for more than 2.3× what is drawn. (The wide card at `lg` has a taller frame; it keeps the
 * component's own ceiling.)
 */
const SHELF_COVER_FRACTION = 0.255;

const NAME: Record<string, string> = {
  "myth-and-folklore": "Myth & Folklore",
  "games-and-play": "Games & Play",
  "puzzle-and-challenge": "Puzzle & Challenge",
  romance: "Romance",
  "classics-and-philosophy": "Classics & Philosophy",
  "language-and-learning": "Language & Learning",
  "young-explorers": "Young Explorers",
};

/**
 * "What we publish" — one card per real shelf of the catalogue, with the live count and the covers of what
 * is on it, and a sentence about it written from the books themselves (`about-copy.ts`).
 *
 * The counts and covers come from the database (published books only), so they are right the day a book is
 * published or withdrawn. If the database cannot be reached the cards still render — names and sentences
 * are static — without numbers, rather than with invented ones.
 */
export function AboutShelves({ categories, total }: { categories: CategorySummary[]; total: number }) {
  const live = new Map(categories.map((c) => [c.slug, c]));
  const shelves = ORDER.filter((slug) => (live.size === 0 ? true : (live.get(slug)?.bookCount ?? 0) > 0));
  // Seven shelves in three columns would leave the last one alone beside two empty cells: it takes the row instead.
  const lastIsOrphan = shelves.length % 3 === 1;

  return (
    <section aria-labelledby="shelves-heading">
      <header className="max-w-2xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-emerald-bright lg:text-[11px]">The catalogue</p>
        <h2 id="shelves-heading" className="mt-3 font-serif text-[32px] font-medium leading-tight tracking-[-0.02em] text-fg-hi sm:text-[40px]">
          What we publish
        </h2>
        <p className="mt-3 text-base leading-relaxed text-fg-mid sm:text-[17px]">
          {total > 0 ? `${total} titles` : "The catalogue"} on {shelves.length} shelves. Every shelf has its own page, and every book on it has its own.
        </p>
      </header>

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shelves.map((slug, i) => {
          const c = live.get(slug);
          const look = categoryLook(slug);
          const Icon = look.icon;
          const wide = lastIsOrphan && i === shelves.length - 1;
          return (
            <li key={slug} className={wide ? "lg:col-span-3" : undefined}>
              <Link
                href={`/categories/${slug}`}
                className={`home-card-hover home-glass group flex h-full flex-col overflow-hidden rounded-[26px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/60 ${wide ? "lg:flex-row" : ""}`}
              >
                <div className={`relative w-full overflow-hidden ${wide ? "aspect-[16/9] lg:aspect-auto lg:min-h-[240px] lg:w-[34%] lg:shrink-0" : "aspect-[16/9]"}`}>
                  {c && c.coverSrcs.length > 0 ? (
                    <CategoryCoverStack coverSrcs={c.coverSrcs} name={NAME[slug]} tint={look.tint} sizes="(min-width: 1024px) 34vw, (min-width: 640px) 47vw, 90vw" coverFraction={wide ? undefined : SHELF_COVER_FRACTION} />
                  ) : (
                    <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 30%, ${look.tint} 0%, transparent 65%), linear-gradient(170deg, #0f1c16 0%, #07110b 100%)` }} />
                  )}
                </div>
                <div className={`flex flex-1 flex-col p-6 ${wide ? "lg:justify-center lg:p-10" : ""}`}>
                  <p className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-deep/30 bg-emerald-deep/10 text-emerald-bright">
                      <Icon aria-hidden className="h-4 w-4" strokeWidth={1.7} />
                    </span>
                    <span className="font-serif text-[21px] font-medium leading-tight text-fg-hi transition-colors group-hover:text-emerald-bright">{NAME[slug]}</span>
                  </p>
                  <p className="mt-3 flex-1 text-[14.5px] leading-relaxed text-fg-mid">{SHELF_COPY[slug].blurb}</p>
                  <p className="mt-5 flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.14em] text-fg-fade">
                    <span>{c ? `${c.bookCount} ${c.bookCount === 1 ? "title" : "titles"}` : "Browse the shelf"}</span>
                    <ArrowUpRight aria-hidden className="h-4 w-4 text-fg-soft transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-bright" />
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
