import highlightsJson from "@/content/book-highlights.json";
import lookInsideJson from "@/content/book-lookinside.json";
import type { BookFormat } from "@/lib/db/queries/catalog";
import { assetSize, bookBackSrc, bookLookInside, bookPreviewAssets } from "@/lib/asset-map";
import { getBookPreview } from "@/lib/book-media";
import { getPreview } from "@/lib/previews";

/**
 * What a book's page needs that is not already a column: the description as
 * paragraphs, the short blurb under the title, the chips, the picture strip.
 * Everything here is derived from records that were verified elsewhere — nothing
 * is written for the page.
 */

// ------------------------------------------------------------------ description

/** Paragraphs, in order, with the catalogue's own wording untouched. */
export function descriptionParagraphs(description: string | null | undefined): string[] {
  return (description ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/**
 * The few lines under the title: the opening paragraphs up to a sentence end
 * within `max` characters. `truncated` says there is more, so the page can link
 * to the full text instead of cutting a sentence in half.
 */
export function heroBlurb(paragraphs: string[], max = 600): { paragraphs: string[]; truncated: boolean } {
  const out: string[] = [];
  let used = 0;
  for (const p of paragraphs) {
    if (used + p.length <= max) {
      out.push(p);
      used += p.length;
      continue;
    }
    // Take whole sentences of this paragraph while they still fit.
    const sentences = p.match(/[^.!?]+[.!?]+["”’)]*(?:\s+|$)/g) ?? [p];
    let part = "";
    for (const s of sentences) {
      if (used + part.length + s.length > max) break;
      part += s;
    }
    if (part.trim()) out.push(part.trim());
    return { paragraphs: out, truncated: true };
  }
  return { paragraphs: out, truncated: false };
}

// ------------------------------------------------------------------ highlights

export interface Highlight {
  label: string;
}
const HIGHLIGHTS = highlightsJson as unknown as Record<string, { label: string; evidence: string }[] | string>;

/** The chips under "What you'll find inside" — each backed by words in the book's own record (see the test). */
export function bookHighlights(slug: string): Highlight[] {
  const entry = HIGHLIGHTS[slug];
  return Array.isArray(entry) ? entry.map((h) => ({ label: h.label })) : [];
}

// -------------------------------------------------------------------- editions

const PREFERRED: BookFormat["format"][] = ["ebook", "paperback", "hardcover", "large_print"];

/** The Amazon edition the hero's primary button leads to: the first live one in reading-preference order. */
export function primaryAmazonEdition(formats: BookFormat[]): { format: BookFormat["format"]; href: string; label: string } | null {
  for (const f of PREFERRED) {
    const row = formats.find((x) => x.format === f && x.fulfillment === "amazon" && x.availability === "available");
    const href = row?.amazonUrl ?? (row?.amazonAsin ? `https://www.amazon.com/dp/${row.amazonAsin}` : null);
    if (row && href) {
      return { format: row.format, href, label: row.format === "ebook" ? "Kindle edition" : row.format === "large_print" ? "Large print edition" : `${row.format[0].toUpperCase()}${row.format.slice(1)} edition` };
    }
  }
  return null;
}

// ----------------------------------------------------------------- look inside

export interface LookInsideTile {
  /** Stable key. */
  id: string;
  kind: "aplus" | "page" | "back" | "quote";
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
}

const LOOKINSIDE_ALT = lookInsideJson as unknown as Record<string, { name: string; alt: string }[]>;

/**
 * Everything the reader can look at before buying, strongest first (the order the
 * brief asks for): the book's own A+ pictures, then its real interior pages, then
 * its back cover, then the two passages. `strip` is what the page shows in a row;
 * the lightbox steps through all of it.
 *
 * Never padded and never borrowed: a book with no A+ picture has none, and a tile
 * exists only because its file is in the asset manifest under this book's slug.
 */
export function lookInsideTiles(book: { slug: string; title: string }): { strip: LookInsideTile[]; all: LookInsideTile[]; note: string | null } {
  const { slug, title } = book;
  const tiles: LookInsideTile[] = [];

  const alts = LOOKINSIDE_ALT[slug] ?? [];
  for (const [i, a] of bookLookInside(slug).entries()) {
    const alt = alts.find((x) => a.src.endsWith(`/${x.name}.webp`))?.alt ?? `Promotional picture for ${title}`;
    tiles.push({ id: a.src, kind: "aplus", src: a.src, alt: `${title} — ${alt}`, caption: i === 0 ? "From the book’s A+ page" : "", width: a.width, height: a.height });
  }

  const pages = bookPreviewAssets(slug);
  const preview = getPreview(slug);
  for (const p of pages) {
    const num = preview?.pages.find((x) => x.src === p.src)?.page ?? null;
    tiles.push({ id: p.src, kind: "page", src: p.src, alt: `${title} — page ${num ?? ""}`.trim(), caption: num ? `Page ${num}` : "A page of the book", width: p.width, height: p.height });
  }
  // the row: A+ pictures and real pages (at most six); back cover and passages follow in the lightbox
  const strip = tiles.slice(0, 6);

  const back = bookBackSrc(slug);
  const backSize = back ? assetSize(back) : null;
  if (back && backSize) tiles.push({ id: back, kind: "back", src: back, alt: `Back cover of ${title}`, caption: "Back cover", ...backSize });

  const media = getBookPreview(slug);
  for (const q of media.quoteVisuals) {
    const size = assetSize(q.image);
    if (!size) continue;
    tiles.push({
      id: q.image,
      kind: "quote",
      src: q.image,
      alt: `A passage from ${title} (${q.sourceLocation}): “${q.quote.replace(/\s*\n+\s*/g, " ")}”`,
      caption: `From ${q.sourceLocation}`,
      ...size,
    });
  }
  // a book with no rendered pages still has something to show in the row
  const row = strip.length > 0 ? strip : tiles.slice(0, 4);
  // Say what the row actually holds: when it opens with A+ pictures, the "first four pages" line is only part of it.
  const aplusCount = row.filter((x) => x.kind === "aplus").length;
  const pageNote = preview?.note ?? null;
  const note =
    aplusCount > 0 && pageNote
      ? `${aplusCount === 1 ? "A picture" : "Pictures"} from the book’s own A+ page, then ${pageNote.charAt(0).toLowerCase()}${pageNote.slice(1)}`
      : pageNote;
  return { strip: row, all: tiles, note };
}

