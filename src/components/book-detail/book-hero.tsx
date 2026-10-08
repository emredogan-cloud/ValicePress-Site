import Link from "next/link";

import { BookAddToCart } from "@/components/book-detail/book-add-to-cart";
import { BookCover } from "@/components/book-detail/book-cover";
import { CinematicStarRating } from "@/components/book-detail/cinematic-star-rating";
import { GiftStrip } from "@/components/campaign/gift-strip";
import type { Highlight } from "@/lib/book-detail";
import { formatPrice } from "@/lib/format";

/**
 * The top of a book's page: cover on the left; author, title, subtitle, the first
 * lines of the description, what the book is, how to get it and how to look inside
 * on the right. The structure follows `images/book-details-page.png` — eyebrow,
 * serif title, italic subtitle, rating line, blurb, chips, a primary and a secondary
 * call to action, a line of facts — and keeps every rule the earlier hero enforced:
 *
 *  - a price is shown only when this site actually sells the book (`directSale`);
 *  - a rating is shown only when there is at least one review;
 *  - the free-promotion strip and the add-to-cart island are the same components
 *    as before, so their behaviour (campaign window, ownership check) is unchanged;
 *  - the Amazon button goes to the edition's own URL, and there is no button where
 *    there is no destination.
 *
 * ON A PHONE the hero is a compact two-column header — a small cover beside the
 * author, title and subtitle — and the way to get the book comes straight after it,
 * ahead of the blurb. The first version stacked a 390px-tall cover above the words,
 * which put the price and the buy button 1,070px down a 718px screen on the Redmi
 * (the earlier mobile baseline had them at 543px): a store whose buy button is
 * three screens away has hidden it. From `md` it is the two-column layout it always
 * was. Below `md` the words column is `display: contents`, so each of its parts is a
 * grid item that can be ordered; from `md` the same markup is the plain block it was.
 *
 * Pure Server Component; `BookAddToCart` and `GiftStrip` are the client islands.
 */

export interface BookHeroProps {
  bookId: string;
  slug: string;
  title: string;
  subtitle: string | null;
  /** The whole description (the gift strip quotes it); the blurb below is what is shown here. */
  description: string | null;
  /** The opening paragraphs shown under the title, and whether the description goes on. */
  blurb: { paragraphs: string[]; truncated: boolean };
  coverKey: string | null;
  coverSrc?: string | null;
  priceCents: number;
  currency: string;
  pageCount: number | null;
  language: string;
  isbn: string | null;
  authors: ReadonlyArray<{ slug: string; name: string }>;
  ratingAggregate: { count: number; average: number | null };
  highlights: Highlight[];
  /** The Amazon edition the primary button leads to, or null when there is none to lead to. */
  amazon: { href: string; label: string } | null;
  /** Whether there is anything to look inside (the secondary button scrolls to it). */
  hasPreview: boolean;
  /** May this site take money for the book? (A live price behind the button.) */
  directSale?: boolean;
  /** Do we hold the file and may we hand it over? (The free-promotion strip runs on this.) */
  deliverableHere?: boolean;
}

const LANGUAGE_NAMES: Record<string, string> = { en: "English", tr: "Turkish", de: "German", fr: "French", es: "Spanish" };

export function BookHero({
  bookId,
  slug,
  title,
  subtitle,
  description,
  blurb,
  coverKey,
  coverSrc,
  priceCents,
  currency,
  pageCount,
  language,
  isbn,
  authors,
  ratingAggregate,
  highlights,
  amazon,
  hasPreview,
  directSale = true,
  deliverableHere = directSale,
}: BookHeroProps) {
  const hasRating = ratingAggregate.count > 0 && ratingAggregate.average !== null;

  return (
    <section id="overview" aria-labelledby="book-title" className="mx-auto mt-6 max-w-[1180px] scroll-mt-28 px-4 sm:mt-10 sm:px-6">
      <div className="grid grid-cols-[minmax(0,_36%)_minmax(0,_1fr)] gap-x-4 gap-y-0 md:grid-cols-[minmax(0,_340px)_minmax(0,_1fr)] md:gap-12 lg:grid-cols-[minmax(0,_380px)_minmax(0,_1fr)] lg:gap-14">
        {/* ------------------------------------------------------------ cover */}
        <div className="col-start-1 row-start-1 w-full md:mx-0 md:max-w-none">
          <BookCover
            title={title}
            coverKey={coverKey}
            coverSrc={coverSrc}
            priority
            sizes="(min-width: 1024px) 380px, (min-width: 768px) 340px, 36vw"
            widthClass="w-full"
          />
        </div>

        {/* ------------------------------------------------------------ words */}
        <div className="contents min-w-0 md:block">
          {/* beside the cover on a phone; the top of the words column from md */}
          <div className="col-start-2 row-start-1 min-w-0 self-start">
          {authors.length > 0 && (
            <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-emerald-bright lg:text-[11px]">
              {authors.map((a, i) => (
                <span key={`${a.slug}-${i}`}>
                  <Link href={`/authors/${a.slug}`} className="transition-colors hover:text-fg-hi">
                    {a.name}
                  </Link>
                  {i < authors.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          )}

          <h1
            id="book-title"
            className="mt-3 text-balance font-serif text-[26px] font-medium leading-[1.06] tracking-[-0.02em] text-fg-hi min-[440px]:text-[34px] md:mt-4 md:text-[52px] md:leading-[1.04] md:tracking-[-0.025em] lg:text-[60px]"
          >
            {title}
          </h1>

          {subtitle && <p className="mt-2.5 text-balance font-serif text-[15px] italic leading-snug text-fg-mid min-[440px]:text-[18px] md:mt-4 md:text-[22px] md:leading-normal">{subtitle}</p>}
          </div>

          <div className="order-1 col-span-full mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-mid">
            {hasRating && (
              <>
                <span className="flex items-center gap-2">
                  <CinematicStarRating value={ratingAggregate.average as number} size="sm" />
                  <span className="font-medium text-fg-hi">{(ratingAggregate.average as number).toFixed(1)}</span>
                  <span className="text-fg-soft">
                    · {ratingAggregate.count} {ratingAggregate.count === 1 ? "review" : "reviews"}
                  </span>
                </span>
                <span aria-hidden className="h-4 w-px bg-white/15" />
              </>
            )}
            <span className="text-fg-soft">A Valice Press publication</span>
          </div>

          {blurb.paragraphs.length > 0 && (
            <div className="order-5 col-span-full mt-6 max-w-[62ch] space-y-3 text-pretty text-[15.5px] leading-[1.7] text-[#d4d4cc] sm:text-[16px]">
              {blurb.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {blurb.truncated && (
                <p>
                  <a href="#about-the-book" className="text-[14px] font-medium text-emerald-bright underline-offset-4 hover:underline">
                    Read the full description
                  </a>
                </p>
              )}
            </div>
          )}

          {highlights.length > 0 && (
            <ul aria-label="What this book offers" className="order-6 col-span-full mt-6 flex flex-wrap gap-2">
              {highlights.slice(0, 6).map((h) => (
                <li
                  key={h.label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-3.5 py-1.5 text-[13px] text-fg-hi"
                >
                  <span aria-hidden className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-[#33f0aa]" />
                  {h.label}
                </li>
              ))}
            </ul>
          )}

          {/* ---------------------------------------------- how to get it */}
          <div className="order-2 col-span-full mt-6 flex flex-wrap items-center gap-3 md:mt-8">
            {directSale ? (
              <div className="flex w-full flex-wrap items-center gap-4 sm:w-auto">
                <span className="font-serif text-[28px] font-medium leading-none text-fg-hi">{formatPrice(priceCents, currency)}</span>
                <div className="min-w-[200px] flex-1 sm:flex-none sm:basis-[230px]">
                  <BookAddToCart bookId={bookId} />
                </div>
              </div>
            ) : amazon ? (
              <a
                href={amazon.href}
                target="_blank"
                rel="noopener noreferrer"
                className="home-cta-primary inline-flex h-12 items-center justify-center gap-3 rounded-full px-7 text-[15px] font-semibold tracking-tight max-sm:w-full"
              >
                <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-[#032015]/90 text-[15px] font-bold leading-none text-[#33f0aa]">
                  a
                </span>
                Buy on Amazon
                <span aria-hidden>→</span>
                <span className="sr-only">{`: ${title}, ${amazon.label} (opens amazon.com in a new tab)`}</span>
              </a>
            ) : (
              <a href="#editions" className="home-cta-primary inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-[15px] font-semibold tracking-tight max-sm:w-full">
                See the editions
                <span aria-hidden>↓</span>
              </a>
            )}

            {hasPreview && (
              <a
                href="#preview"
                className="home-cta-secondary inline-flex h-12 items-center justify-center gap-2.5 rounded-full px-6 text-[15px] font-medium max-sm:w-full"
              >
                <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 5.5C5.2 4.4 7.6 4.2 10 5c1 .3 1.7.8 2 1.4.3-.6 1-1.1 2-1.4 2.4-.8 4.8-.6 7 .5v12c-2.2-1.1-4.6-1.3-7-.5-1 .3-1.7.8-2 1.4-.3-.6-1-1.1-2-1.4-2.4-.8-4.8-.6-7 .5z" />
                  <path d="M12 6.4v12" />
                </svg>
                Read a preview
              </a>
            )}
          </div>

          {/* The free-promotion strip. It owns its sentence AND its control (they
              appear and disappear together) and re-asks whether a file exists. */}
          <div className="order-3 col-span-full max-w-[560px]">
            <GiftStrip
              book={{
                slug,
                title,
                author: authors[0]?.name ?? null,
                description,
                priceCents,
                deliverableFree: deliverableHere,
                currency,
                coverSrc: coverSrc ?? null,
                pageCount,
              }}
            />
          </div>

          {directSale ? (
            <ul className="order-4 col-span-full mt-5 grid max-w-[560px] gap-x-6 gap-y-1.5 text-[12.5px] text-fg-mid sm:grid-cols-2">
              {["Instant download — nothing is shipped", "Yours to keep — never locked", "Watermarked PDF, no DRM", "14-day refund before download"].map((line) => (
                <li key={line} className="flex items-center gap-2">
                  <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-[#33f0aa] shadow-[0_0_4px_#33f0aa]" />
                  {line}
                </li>
              ))}
            </ul>
          ) : deliverableHere ? (
            <p className="order-4 col-span-full mt-4 max-w-[560px] text-[12.5px] leading-relaxed text-fg-soft">
              We aren’t selling this edition through this site’s checkout at the moment. Any printed edition it has is listed under Editions.
            </p>
          ) : null}

          <dl className="order-7 col-span-full mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 text-[14px] text-fg-mid">
            {pageCount !== null && (
              <div className="flex items-center gap-2">
                <dt className="sr-only">Pages</dt>
                <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] text-fg-soft" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />
                </svg>
                <dd className="text-fg-hi">{pageCount} pages</dd>
              </div>
            )}
            <div className="flex items-center gap-2">
              <dt className="sr-only">Language</dt>
              <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] text-fg-soft" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
              </svg>
              <dd className="text-fg-hi">{LANGUAGE_NAMES[language] ?? language}</dd>
            </div>
            {isbn && (
              <div className="flex items-center gap-2">
                <dt className="text-[12px] uppercase tracking-[0.18em] text-fg-soft">ISBN</dt>
                <dd className="font-mono text-xs text-fg-mid">{isbn}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}
