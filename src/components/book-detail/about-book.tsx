import Image from "next/image";
import Link from "next/link";

import type { Highlight } from "@/lib/book-detail";

/**
 * "About the book" (the whole description, in its paragraphs), "What you'll find
 * inside" (the chips — each one a claim the book's own record makes), and "About
 * the author".
 *
 * The author card says what the record says and no more. An author with a
 * biography on file gets it; an author without one gets their name, the series
 * they write when the catalogue says so, and a link to their page — never a
 * biography written for the purpose. A portrait appears only if a portrait file
 * exists for that author; otherwise the card carries an initial, not a face.
 */

export interface AuthorProfile {
  slug: string;
  name: string;
  bio: string | null;
  portraitSrc: string | null;
  /** "Author of the Bristlecone Emergency series" — only when the catalogue names the series. */
  line: string | null;
}

export function AboutBook({
  title,
  paragraphs,
  highlights,
  authors,
}: {
  title: string;
  paragraphs: string[];
  highlights: Highlight[];
  authors: AuthorProfile[];
}) {
  return (
    <section className="mx-auto mt-10 grid max-w-[1180px] gap-6 px-4 sm:mt-14 sm:px-6 lg:grid-cols-[minmax(0,_1.15fr)_minmax(0,_1fr)]">
      {paragraphs.length > 0 && (
        <article id="about-the-book" aria-labelledby="about-book-heading" className="home-glass scroll-mt-36 rounded-[22px] p-6 sm:p-8">
          <header className="flex items-center gap-3">
            <Glyph d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />
            <h2 id="about-book-heading" className="font-serif text-[26px] font-medium text-fg-hi sm:text-[30px]">
              About the book
            </h2>
          </header>
          <div className="mt-5 space-y-4 text-pretty text-[15.5px] leading-[1.75] text-[#cfcfc8]">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </article>
      )}

      <div className="grid content-start gap-6">
        {highlights.length > 0 && (
          <aside aria-labelledby="inside-heading" className="home-glass rounded-[22px] p-6 sm:p-8">
            <header className="flex items-center gap-3">
              <Glyph d="M12 21s-7-4.4-9.3-8.6C1 9.2 2.6 5.5 6.2 5.5c2 0 3.2 1 3.8 2.1.6-1.1 1.8-2.1 3.8-2.1 3.6 0 5.2 3.7 3.5 6.9C19 16.6 12 21 12 21z" />
              <div>
                <h2 id="inside-heading" className="font-serif text-[24px] font-medium leading-tight text-fg-hi sm:text-[26px]">
                  What you’ll find inside
                </h2>
                <p className="text-[13px] text-fg-soft">As {title}’s own description puts it</p>
              </div>
            </header>
            <ul className="mt-5 flex flex-wrap gap-2.5">
              {highlights.map((h) => (
                <li key={h.label} className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-3.5 py-1.5 text-[13px] text-fg-hi">
                  <span aria-hidden className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-[#33f0aa]" />
                  {h.label}
                </li>
              ))}
            </ul>
          </aside>
        )}

        {authors.length > 0 && (
          <aside id="about-the-author" aria-labelledby="author-heading" className="home-glass scroll-mt-36 rounded-[22px] p-6 sm:p-8">
            <header className="flex items-center gap-3">
              <Glyph d="M4 20l4-1 10-10a2.1 2.1 0 0 0-3-3L5 16zM14 7l3 3" />
              <h2 id="author-heading" className="font-serif text-[24px] font-medium text-fg-hi sm:text-[26px]">
                About the {authors.length > 1 ? "authors" : "author"}
              </h2>
            </header>
            <ul className="mt-5 space-y-6">
              {authors.map((a) => (
                <li key={a.slug} className="flex gap-4">
                  <Portrait name={a.name} src={a.portraitSrc} />
                  <div className="min-w-0">
                    <p className="font-serif text-[19px] text-fg-hi">
                      <Link href={`/authors/${a.slug}`} className="hover:text-emerald-bright">
                        {a.name}
                      </Link>
                    </p>
                    {a.bio ? (
                      <p className="mt-1.5 line-clamp-9 text-[14px] leading-relaxed text-fg-mid">{a.bio.replace(/\s*\n+\s*/g, " ")}</p>
                    ) : a.line ? (
                      <p className="mt-1.5 text-[14px] leading-relaxed text-fg-mid">{a.line}</p>
                    ) : null}
                    <Link href={`/authors/${a.slug}`} className="mt-2 inline-block text-[13px] font-medium text-emerald-bright underline-offset-4 hover:underline">
                      More about {a.name}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </section>
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center text-emerald-bright">
      <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
}

function Portrait({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return (
      <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/[0.12]">
        <Image src={src} alt={`Portrait of ${name}`} fill sizes="64px" className="object-cover object-top" />
      </span>
    );
  }
  // No portrait on file: an initial, not a stand-in face.
  return (
    <span
      aria-hidden
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-gradient-to-br from-[#14241a] to-[#07110b] font-serif text-[26px] text-fg-hi"
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
