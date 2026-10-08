import Link from "next/link";
import type { ReactNode } from "react";

import { CinematicBookTile } from "@/components/cinematic/cinematic-book-tile";
import type { BookCardData } from "@/components/book-card";
import {
  CATEGORY_INFO,
  sourceHost,
  type AuthorCategory,
  type DirectoryAuthor,
  type ReferenceAuthor,
  type ReferencePortrait,
} from "@/lib/reference-authors";

import { AuthorPortrait } from "./author-portrait";
import { DEFAULT_PORTRAIT } from "./author-card-data";

/**
 * The pieces of an author's page. The page assembles them; each one prints only what the data holds and
 * renders nothing when it holds nothing — a researched author gets works, a timeline and sources; an
 * author Valice publishes with only a catalogue biography gets that biography and their books, and no
 * empty headings waiting for facts nobody has checked.
 */

export function Section({ id, eyebrow, title, children, className = "" }: { id?: string; eyebrow: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className={`mx-auto mt-16 max-w-[1180px] px-4 sm:mt-20 sm:px-6 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">{eyebrow}</p>
      <h2 id={id ? `${id}-h` : undefined} className="mt-3 font-serif text-[28px] font-medium leading-tight text-fg-hi sm:text-[34px]">
        {title}
      </h2>
      <div className="mt-7">{children}</div>
    </section>
  );
}

/** Single-word name → all emerald. Multi-word → last word emerald (the site's heading convention). */
function splitNameForAccent(name: string): { head: string; tail: string } {
  const words = name.trim().split(/\s+/);
  if (words.length <= 1) return { head: "", tail: name };
  return { head: words.slice(0, -1).join(" "), tail: words[words.length - 1] };
}

export interface HeroProps {
  name: string;
  category: AuthorCategory;
  kind: "published" | "reference";
  bookCount: number;
  years: string | null;
  knownFor: string | null;
  facts: Array<{ label: string; value: string }>;
  portrait: ReferencePortrait | null;
  portraitNote: string | null;
  tags: string[];
  /** An author row exists but nothing of theirs is published yet. */
  pending?: boolean;
}

export function ProfileHero({ name, category, kind, bookCount, years, knownFor, facts, portrait, portraitNote, tags, pending = false }: HeroProps) {
  const { head, tail } = splitNameForAccent(name);
  const published = kind === "published";

  return (
    <header className="mx-auto grid max-w-[1180px] gap-10 px-4 pb-2 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[340px_1fr] lg:items-center lg:gap-16">
      <figure className="mx-auto w-full max-w-[220px] sm:max-w-[340px] lg:mx-0">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[22px] border border-white/[0.1] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
          <AuthorPortrait
            theme={DEFAULT_PORTRAIT}
            imageSrc={portrait?.src ?? null}
            imageAlt={portrait?.alt ?? null}
            name={name}
            priority
            sizes="(min-width: 640px) 340px, 220px"
          />
        </div>
        <figcaption className="mt-3 text-[12px] leading-snug text-fg-soft">
          {portrait ? (
            <>
              {portrait.credit}
              {portrait.licenceUrl && (
                <>
                  {" · "}
                  <a href={portrait.licenceUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-bright underline-offset-2 hover:underline">
                    Licence
                  </a>
                </>
              )}
              {" · "}
              <a href={portrait.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-bright underline-offset-2 hover:underline">
                Wikimedia Commons
              </a>
            </>
          ) : (
            portraitNote && <>{portraitNote} The mark above is a designed placeholder, not a likeness.</>
          )}
        </figcaption>
      </figure>

      <div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">
          <span>{CATEGORY_INFO[category].label}</span>
          {published && (
            <span className="rounded-full bg-emerald-bright/90 px-2.5 py-1 text-[10px] tracking-[0.14em] text-[#032015]">On the Valice list</span>
          )}
        </p>
        <h1 className="mt-4 font-serif text-[40px] font-medium leading-[1.05] tracking-[-0.02em] text-fg-hi sm:text-[56px] lg:text-[64px]">
          {head && <>{head} </>}
          <span
            style={{
              background: "linear-gradient(135deg, #33f0aa 0%, #1ddf8f 60%, #16c784 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {tail}
          </span>
        </h1>
        {years && <p className="mt-3 text-[15px] tracking-wide text-fg-mid">{years}</p>}
        {knownFor && <p className="mt-4 max-w-2xl font-serif text-[20px] italic leading-snug text-fg-hi sm:text-[22px]">{knownFor}</p>}

        {facts.length > 0 && (
          <dl className="mt-7 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-fade">{f.label}</dt>
                <dd className="mt-1 text-[14.5px] leading-snug text-fg-hi">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {tags.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Themes">
            {tags.map((t) => (
              <li key={t} className="rounded-full border border-white/[0.1] bg-white/[0.03] px-3 py-1 text-[12px] text-fg-mid">
                {t}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-7 max-w-2xl rounded-[14px] border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-[13px] leading-relaxed text-fg-soft">
          {pending ? (
            <>No titles by {name} are published yet. When one is, it appears on this page.</>
          ) : published ? (
            <>
              <strong className="font-semibold text-fg-mid">On the Valice list.</strong>{" "}
              {bookCount === 1 ? "One title" : `${bookCount} titles`} published by Valice Press {bookCount === 1 ? "carries" : "carry"} {name}&rsquo;s work; {bookCount === 1 ? "it is" : "they are"} below.
            </>
          ) : (
            <>
              <strong className="font-semibold text-fg-mid">A reference author.</strong> Valice Press has no connection with {name}, their publishers or their estate. {name} appears here as part of the
              reading context around the shelf.
            </>
          )}
        </p>
      </div>
    </header>
  );
}

export function Biography({ paragraphs }: { paragraphs: string[] }) {
  if (paragraphs.length === 0) return null;
  return (
    <Section id="biography" eyebrow="Biography" title="The life, briefly">
      <div className="home-glass max-w-3xl space-y-5 rounded-[22px] p-6 text-[16px] leading-[1.8] text-[#d3d3cc] sm:p-8">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-pretty">
            {p}
          </p>
        ))}
      </div>
    </Section>
  );
}

export function WorksAndTimeline({ works, events }: { works: ReferenceAuthor["works"]; events: ReferenceAuthor["events"] }) {
  if (works.length === 0 && events.length === 0) return null;
  return (
    <section className="mx-auto mt-16 grid max-w-[1180px] gap-12 px-4 sm:mt-20 sm:px-6 lg:grid-cols-2 lg:gap-14">
      {works.length > 0 && (
        <div id="works" aria-labelledby="works-h">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">Works</p>
          <h2 id="works-h" className="mt-3 font-serif text-[28px] font-medium leading-tight text-fg-hi sm:text-[34px]">
            Major works
          </h2>
          <ol className="mt-7 divide-y divide-white/[0.07] rounded-[22px] border border-white/[0.08] bg-white/[0.02]">
            {works.map((w) => (
              <li key={`${w.title}-${w.year ?? ""}`} className="flex gap-4 px-5 py-4">
                <span className="w-[82px] shrink-0 pt-0.5 text-[13px] font-medium tabular-nums text-emerald-bright/90">{w.year ?? "—"}</span>
                <span>
                  <span className="font-serif text-[17px] leading-snug text-fg-hi">{w.title}</span>
                  {w.note && <span className="mt-1 block text-[13.5px] leading-relaxed text-fg-soft">{w.note}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {events.length > 0 && (
        <div id="timeline" aria-labelledby="timeline-h">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">Timeline</p>
          <h2 id="timeline-h" className="mt-3 font-serif text-[28px] font-medium leading-tight text-fg-hi sm:text-[34px]">
            Turning points
          </h2>
          <ol className="relative mt-7 space-y-6 border-l border-white/[0.12] pl-7">
            {events.map((e) => (
              <li key={`${e.year}-${e.text.slice(0, 24)}`} className="relative">
                <span aria-hidden className="absolute -left-[33px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#33f0aa] shadow-[0_0_10px_#33f0aa]" />
                <p className="text-[13px] font-semibold tabular-nums tracking-wide text-emerald-bright">{e.year}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-[#d3d3cc]">{e.text}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

export function WhyTheyMatter({ name, relevance, influence }: { name: string; relevance: string; influence: string }) {
  return (
    <Section id="why" eyebrow="Why they are here" title={`${name} and the shelf`}>
      <div className="grid gap-5 lg:grid-cols-2">
        <article className="home-glass rounded-[22px] p-6 sm:p-8">
          <h3 className="font-serif text-[21px] text-fg-hi">Relevance</h3>
          <p className="mt-3 text-[15.5px] leading-[1.75] text-[#d3d3cc]">{relevance}</p>
        </article>
        <article className="home-glass rounded-[22px] p-6 sm:p-8">
          <h3 className="font-serif text-[21px] text-fg-hi">Influence</h3>
          <p className="mt-3 text-[15.5px] leading-[1.75] text-[#d3d3cc]">{influence}</p>
        </article>
      </div>
    </Section>
  );
}

export function PublishedBooks({ name, books }: { name: string; books: BookCardData[] }) {
  if (books.length === 0) return null;
  return (
    <Section id="books" eyebrow="On the Valice list" title={books.length === 1 ? "The title we publish" : `${books.length} titles we publish`}>
      <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {books.map((b) => (
          <li key={b.id}>
            <CinematicBookTile book={b} />
          </li>
        ))}
      </ul>
      <p className="sr-only">These are titles by or of {name}.</p>
    </Section>
  );
}

export function ShelfNeighbours({ name, books }: { name: string; books: BookCardData[] }) {
  if (books.length === 0) return null;
  return (
    <Section id="shelf" eyebrow="Nearby on the shelf" title="If you read this, you might look here">
      <p className="mb-6 max-w-2xl text-[14px] leading-relaxed text-fg-soft">
        These are Valice Press titles from the same part of the library. They are not by {name}, and they are not a recommendation on {name}&rsquo;s behalf — only the same shelf.
      </p>
      <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {books.map((b) => (
          <li key={b.id}>
            <CinematicBookTile book={b} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function RelatedAuthors({ authors }: { authors: DirectoryAuthor[] }) {
  if (authors.length === 0) return null;
  return (
    <Section id="related" eyebrow="Related authors" title="Read alongside">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {authors.map((a) => (
          <li key={a.slug}>
            <Link
              href={`/authors/${a.slug}`}
              className="home-card-hover home-glass group flex min-h-[84px] items-center gap-4 rounded-[18px] p-3 pr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/50"
            >
              <span className="relative block aspect-[3/4] h-[72px] shrink-0 overflow-hidden rounded-[10px] border border-white/[0.1]">
                <AuthorPortrait theme={DEFAULT_PORTRAIT} imageSrc={a.portraitSrc} imageAlt={a.portraitAlt} name={a.name} sizes="60px" />
              </span>
              <span className="min-w-0">
                <span className="block font-serif text-[16.5px] leading-tight text-fg-hi transition-colors group-hover:text-emerald-bright">{a.name}</span>
                {a.years && <span className="mt-0.5 block text-[12.5px] text-fg-soft">{a.years}</span>}
                <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-fade">{CATEGORY_INFO[a.category].label}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function SourcesSection({ name, sources, verifiedOn, discrepancy }: { name: string; sources: ReferenceAuthor["sources"]; verifiedOn: string | null; discrepancy?: string }) {
  if (sources.length === 0) return null;
  const when = verifiedOn ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${verifiedOn}T00:00:00Z`)) : null;
  return (
    <Section id="sources" eyebrow="Sources" title="Where this comes from">
      <div className="home-glass max-w-3xl rounded-[22px] p-6 sm:p-8">
        <p className="text-[14px] leading-relaxed text-fg-soft">
          Everything on this page about {name} is written from these sources, not from memory.
          {when ? ` Their dates and key claims were checked against the sources on ${when}.` : ""} The life dates are compared across Wikidata and the Library of Congress&rsquo;s authority records.
        </p>
        <ul className="mt-5 space-y-2.5">
          {sources.map((s) => (
            <li key={s.url} className="text-[14.5px] leading-snug">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-emerald-bright underline-offset-4 hover:underline">
                {s.label}
              </a>
              <span className="ml-2 text-[12px] text-fg-fade">{sourceHost(s.url)}</span>
            </li>
          ))}
        </ul>
        {discrepancy && <p className="mt-5 rounded-[12px] border border-amber-300/20 bg-amber-300/[0.05] px-4 py-3 text-[13px] leading-relaxed text-fg-mid"><strong className="font-semibold text-fg-hi">A note on the dates.</strong> {discrepancy}</p>}
      </div>
    </Section>
  );
}
