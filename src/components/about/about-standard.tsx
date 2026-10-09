import Link from "next/link";

import { STANDARDS } from "@/lib/about-copy";

/**
 * "How we make books" — the editorial standard, in three points, each tied to a specific book a reader can
 * open and check. These are the three things the catalogue's own descriptions keep promising; the
 * `about-copy.test.ts` suite fails if an example names a book that is not in the catalogue.
 */
export function AboutStandard() {
  return (
    <section aria-labelledby="standard-heading">
      <header className="max-w-2xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-emerald-bright lg:text-[11px]">The standard</p>
        <h2 id="standard-heading" className="mt-3 font-serif text-[32px] font-medium leading-tight tracking-[-0.02em] text-fg-hi sm:text-[40px]">
          Books that show their evidence
        </h2>
        <p className="mt-3 text-base leading-relaxed text-fg-mid sm:text-[17px]">
          Myths, games and puzzles are easy to get wrong and hard to check. Our aim is to make them the other way round.
        </p>
      </header>

      <ol className="mt-10 grid gap-5 lg:grid-cols-3">
        {STANDARDS.map((s, i) => (
          <li key={s.title} className="home-glass relative flex flex-col overflow-hidden rounded-[28px] p-7">
            <span aria-hidden className="font-serif text-sm text-fg-fade">0{i + 1}</span>
            <h3 className="mt-4 font-serif text-[22px] font-medium leading-tight text-fg-hi">{s.title}</h3>
            <p className="mt-3 flex-1 text-[14.5px] leading-relaxed text-fg-mid">{s.body}</p>
            <p className="mt-5 border-t border-white/[0.07] pt-4 text-[13px] leading-snug text-fg-soft">
              <Link href={`/books/${s.example.slug}`} className="font-medium text-emerald-bright underline decoration-emerald-bright/30 underline-offset-4 hover:decoration-emerald-bright">
                {s.example.label}
              </Link>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
