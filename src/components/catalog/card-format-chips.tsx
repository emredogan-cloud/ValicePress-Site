import type { Badge } from "@/lib/format-badges";

/**
 * The format chips under a catalogue card or list row: what the book is sold
 * as (digital, print). The page count is the quiet badge and gets its own
 * line (see `pagesOf`), so the chips can never need a third row.
 *
 * The row is a fixed-height box (`.catalog-card__chips`, globals.css), which
 * is what keeps one card from being taller than the next. A chip never wraps
 * inside itself; one that is too long for a narrow card prints its short form
 * (`Badge.compact`) instead — chosen by the CARD's own width, in CSS, so the
 * markup is identical on the server and the client. Screen readers always get
 * the full label: the visible wording is `aria-hidden`, the full one is
 * `sr-only`.
 *
 * Renders an empty reserved box when the book has no format rows: a card that
 * shows less is correct, and it must still be the same size.
 */
export function CardFormatChips({ badges, className = "" }: { badges: ReadonlyArray<Badge>; className?: string }) {
  const chips = badges.filter((b) => b.tone === "format");
  if (chips.length === 0) return <div aria-hidden className={`catalog-card__chips ${className}`} />;

  return (
    <ul className={`catalog-card__chips ${className}`}>
      {chips.map((b) => (
        <li
          key={b.label}
          className="inline-flex h-6 items-center whitespace-nowrap rounded-full border border-emerald-bright/25 bg-emerald-bright/[0.08] px-2 text-[10.5px] font-medium leading-none tracking-[0.02em] text-emerald-bright/90"
        >
          <span className="sr-only">{b.label}</span>
          {b.compact === b.label ? (
            <span aria-hidden>{b.label}</span>
          ) : (
            <>
              <span aria-hidden className="catalog-chip-full">
                {b.label}
              </span>
              <span aria-hidden className="catalog-chip-short">
                {b.compact}
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The quiet badge — the page count — or null. */
export function pagesOf(badges: ReadonlyArray<Badge>): string | null {
  return badges.find((b) => b.tone === "content")?.label ?? null;
}
