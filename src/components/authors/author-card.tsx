import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { CATEGORY_INFO } from "@/lib/reference-authors";

import { AuthorPortrait } from "./author-portrait";
import type { AuthorCardData } from "./author-card-data";

/**
 * Author directory card.
 *
 * Every card is the same height, whatever the length of the line under the name: the body is a
 * flex column and the foot row is pushed to the bottom, so a three-line epithet beside a one-line
 * one still ends on the same baseline.
 *
 * TWO THINGS A READER MUST NEVER HAVE TO GUESS, so both are printed on the card:
 *   - whether Valice Press publishes this person ("On the Valice list", with a book count) or whether
 *     they are a reference author shown for context (no badge, "Reference author" in the foot);
 *   - what the picture is. A real photograph carries its own alt text; a person with no freely
 *     licensed photograph gets the designed identity mark — initials in a ring — which is plainly not
 *     a photograph. (It used to be captioned "Valice Press author", which the badge already says for
 *     the people it is true of, and which would be false for the rest.)
 */
export function AuthorCard({ author, priority = false }: { author: AuthorCardData; priority?: boolean }) {
  const published = author.kind === "published";

  return (
    <Link
      href={`/authors/${author.slug}`}
      className="group block h-full rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/60"
    >
      <article className="home-card-hover home-glass relative flex h-full flex-col overflow-hidden rounded-[22px] border-white/[0.08]">
        <div className="relative aspect-[3/4] w-full shrink-0">
          <AuthorPortrait
            theme={author.portrait}
            imageSrc={author.portraitSrc}
            imageAlt={author.portraitAlt}
            name={author.name}
            priority={priority}
          />
          {published && (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-emerald-bright/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#032015]">
              On the Valice list
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-bright/80">
            {CATEGORY_INFO[author.category].label}
          </p>
          <h2 className="mt-1.5 font-serif text-[16px] font-medium leading-tight text-fg-hi transition-colors group-hover:text-emerald-bright sm:text-[17px]">
            {author.name}
          </h2>
          {author.years && <p className="mt-0.5 text-[12px] text-fg-soft">{author.years}</p>}

          {author.blurb && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-fg-mid sm:line-clamp-3">{author.blurb}</p>}

          <div className="mt-auto flex items-center justify-between pt-4">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-fg-fade">
              {published ? `${author.bookCount} ${author.bookCount === 1 ? "Book" : "Books"}` : "Reference author"}
            </span>
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] text-fg-mid transition-all group-hover:border-emerald-bright/50 group-hover:bg-emerald-bright/10 group-hover:text-emerald-bright group-hover:shadow-[0_0_14px_rgba(51,240,170,0.4)]"
            >
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
