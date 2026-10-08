/**
 * Words for <meta name="description"> — kept out of the page files so the
 * rules can be tested and so every page follows the same ones.
 *
 * WHY THERE ARE RULES. Search results show about 155–160 characters of a
 * description and cut the rest; a description of 20 characters says nothing; and
 * two pages that share one tell a crawler they are the same page. The book
 * pages used the book's subtitle verbatim, which is a fine description for
 * "Stewart Culin's 1894 Paper, Annotated — with a Playing Guide" and no
 * description at all for "A Small Town Romance" — which two different novels
 * share.
 */

/** The longest meta description we write. Longer is cut by the search engine anyway, somewhere we did not choose. */
export const META_DESCRIPTION_MAX = 160;

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * `text` cut to at most `max` characters at the best place to stop: the end of
 * a sentence, else a dash / semicolon / comma, else a word — with an ellipsis
 * only when the cut leaves a sentence unfinished. Never longer than `max`,
 * never mid-word, whitespace collapsed.
 */
export function clampText(text: string, max: number = META_DESCRIPTION_MAX): string {
  const t = collapse(text);
  if (t.length <= max) return t;

  const head = t.slice(0, max - 1); // room for the ellipsis
  const floor = Math.floor(max * 0.55); // do not give up more than ~45% of the text for a prettier stop

  // 1. the last complete sentence that fits (a full stop, ! or ? followed by a space, inside `max`)
  let sentenceEnd = -1;
  for (const m of t.slice(0, max + 1).matchAll(/[.!?](?=\s)/g)) if (m.index! + 1 <= max) sentenceEnd = m.index! + 1;
  if (sentenceEnd >= floor) return t.slice(0, sentenceEnd);

  // 2. a natural pause, then 3. a word boundary — and say that it goes on
  const pause = Math.max(head.lastIndexOf(" — "), head.lastIndexOf("; "), head.lastIndexOf(", "), head.lastIndexOf(": "));
  if (pause >= floor) return `${head.slice(0, pause).trimEnd()}…`;
  const space = head.lastIndexOf(" ");
  if (space >= floor) return `${head.slice(0, space).trimEnd().replace(/[,;:—-]+$/, "")}…`;
  return `${head.trimEnd()}…`;
}

/** Plain text from the little markup a blurb can carry. */
function plain(text: string): string {
  return collapse(
    text
      .replace(/<\/?(?:p|br|div|li|ul|ol|h[1-6])\b[^>]*>/gi, " ") // block tags separate words
      .replace(/<[^>]+>/g, "") // inline tags do not
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`#>]+/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+([.,;:!?])/g, "$1"),
  );
}

/**
 * The description of a book's page: the book's own words, whole sentences.
 *
 * A LONG subtitle is already a description ("Stewart Culin's 1894 Paper,
 * Annotated — with a Playing Guide") and is used as it is. A SHORT one is a
 * tag ("A Small Town Romance", "76 Myths from 19 Civilizations"): it leads, and
 * the opening of the book's own blurb follows it, so that two books under the
 * same tag read as two books. Nothing is written that is not already on the page.
 */
export function bookDescription(book: { title: string; subtitle?: string | null; description?: string | null }): string {
  const sub = collapse(book.subtitle ?? "");
  const firstParagraph = (book.description ?? "").split(/\n\s*\n/).map(plain).find(Boolean) ?? "";

  if (!firstParagraph) return clampText(sub || `${book.title} — Valice Press`);
  if (sub.length >= 60) return clampText(sub);
  if (!sub) return clampText(firstParagraph);
  return clampText(`${sub.replace(/[.!?]+$/, "")}. ${firstParagraph}`);
}

/**
 * A list read aloud: "A", "A and B", "A, B and C", and past `show` items
 * "A, B, C and 2 more" — so a long shelf does not push the sentence past what a
 * search result shows.
 */
export function joinList(items: readonly string[], show = 3): string {
  const list = items.map((i) => i.trim()).filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  if (list.length <= show) return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
  const rest = list.length - show;
  return `${list.slice(0, show).join(", ")} and ${rest} more`;
}
