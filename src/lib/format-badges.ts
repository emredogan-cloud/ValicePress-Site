import type { BookEdition } from "@/components/book-card";

/**
 * What a catalogue card says about a book now that it no longer says a price.
 *
 * WHY THE PRICE LEFT THE CARD. A grid of covers with a price under each one
 * is a shop; a grid of covers that tells you what each book IS is a
 * catalogue. The price has not been hidden — it appears in Quick View, on the
 * book page, and at the till — but it is no longer the one fact a card is
 * allowed to carry, and the fact that replaced it is a more useful one.
 *
 * WHICH MEANS THE BADGE IS NOW THE CARD'S WHOLE CLAIM, and it has to be read
 * off `book_formats`, never assumed. Before this, every card in the catalog
 * was handed `formats: ["PDF"]` by a mapping function that did not look at
 * the book: a workbook with a PDF and an EPUB, a title that exists only as an
 * Amazon paperback, and a hardcover all said "PDF". That was survivable while
 * the badge was decoration beside a price. It is not survivable as the claim.
 *
 * NOTHING HERE INVENTS A FORMAT. A book with no `book_formats` rows produces
 * no badges at all, and the card simply shows less.
 */

export type FormatKey =
  | "Digital"
  | "PDF"
  | "EPUB"
  | "Kindle"
  | "Paperback"
  | "Hardcover"
  | "Large Print";

/** The order badges read in: what we sell ourselves, then print by weight. */
const ORDER: readonly FormatKey[] = [
  "Digital",
  "PDF",
  "EPUB",
  "Kindle",
  "Paperback",
  "Hardcover",
  "Large Print",
];

export interface BadgeInput {
  editions?: ReadonlyArray<BookEdition>;
  /** `books.epub_file_key is not null` — the only thing that knows. */
  hasEpub?: boolean;
  pageCount?: number | null;
}

/**
 * The format keys a book genuinely has, for the filter's facets.
 *
 * An ebook fulfilled by Amazon is a Kindle edition, not a "Digital" one this
 * store sells — the distinction matters because a reader filtering for
 * Digital is asking what they can buy here and download. An ebook fulfilled
 * directly is Digital, and carries PDF always and EPUB only when the press
 * actually holds one.
 */
export function formatKeys(book: BadgeInput): FormatKey[] {
  const keys = new Set<FormatKey>();
  for (const e of book.editions ?? []) {
    if (e.availability === "unavailable") continue;
    switch (e.format) {
      case "ebook":
        if (e.fulfillment === "direct") {
          keys.add("Digital");
          keys.add("PDF");
          if (book.hasEpub) keys.add("EPUB");
        } else {
          keys.add("Kindle");
        }
        break;
      case "paperback":
        keys.add("Paperback");
        break;
      case "hardcover":
        keys.add("Hardcover");
        break;
      case "large_print":
        keys.add("Large Print");
        break;
    }
  }
  return ORDER.filter((k) => keys.has(k));
}

export interface Badge {
  label: string;
  /** `format` reads in the accent; `content` is quieter. */
  tone: "format" | "content";
}

/**
 * The badges a card shows, at most three, most specific first.
 *
 * The digital editions collapse into ONE badge rather than three, because
 * "eBook · PDF + EPUB" is one product and "Digital / PDF / EPUB" as three
 * pills reads like three things to buy. Print editions each get their own,
 * because they are separate purchases on Amazon.
 *
 * The third badge is the page count, which is real, checkable, and the thing
 * a reader most often wants next. It is deliberately NOT a marketing line
 * like "60 Games" or "Illustrated Lore": nothing in the database counts the
 * games in a book, and a card is the last place to start guessing.
 */
export function formatBadges(book: BadgeInput): Badge[] {
  const keys = new Set(formatKeys(book));
  const out: Badge[] = [];

  if (keys.has("Digital")) {
    out.push({
      label: keys.has("EPUB") ? "eBook · PDF + EPUB" : "eBook · PDF",
      tone: "format",
    });
  } else if (keys.has("Kindle")) {
    out.push({ label: "Kindle", tone: "format" });
  }

  const print = (["Paperback", "Hardcover", "Large Print"] as const).filter((k) =>
    keys.has(k),
  );
  if (print.length) {
    out.push({ label: print.join(" · "), tone: "format" });
  }

  if (book.pageCount && book.pageCount > 0) {
    out.push({ label: `${book.pageCount} pages`, tone: "content" });
  }

  return out.slice(0, 3);
}

/** Human label for one edition row, used by Quick View's format buttons. */
export function editionLabel(e: BookEdition, hasEpub: boolean): string {
  switch (e.format) {
    case "ebook":
      if (e.fulfillment === "amazon") return "Kindle";
      return hasEpub ? "PDF + EPUB" : "PDF";
    case "paperback":
      return "Paperback";
    case "hardcover":
      return "Hardcover";
    case "large_print":
      return "Large Print";
  }
}
