import { formatBadges, type BadgeInput } from "@/lib/format-badges";

/**
 * The line that took the price's place on a catalogue card.
 *
 * One component for every card surface — the catalog grid, the homepage
 * shelf, search, the category page, the author page — because five
 * hand-rolled badge rows is five chances for one of them to describe a book
 * differently from the others, and the badge is now the card's whole claim
 * about what it is selling.
 *
 * Renders NOTHING when a book has no format rows. A card that shows less is
 * correct; a card that shows "PDF" because that is the common case is not.
 */
export function FormatBadgeRow({
  book,
  className = "",
  size = "md",
}: {
  book: BadgeInput;
  className?: string;
  size?: "sm" | "md";
}) {
  const badges = formatBadges(book);
  if (badges.length === 0) return null;

  const text = size === "sm" ? "text-[10.5px]" : "text-[11px]";

  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {badges.map((b) => (
        <li
          key={b.label}
          className={`rounded-full border px-2 py-[3px] ${text} font-medium tracking-[0.02em] ${
            b.tone === "format"
              ? "border-emerald-bright/25 bg-emerald-bright/[0.08] text-emerald-bright/90"
              : "border-white/[0.09] bg-white/[0.03] text-fg-soft"
          }`}
        >
          {b.label}
        </li>
      ))}
    </ul>
  );
}
