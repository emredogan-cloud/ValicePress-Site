/**
 * The ONE place a book's preview media is assembled.
 *
 * A book's preview used to be "whatever interior pages were rendered", read by two
 * parallel lists (`previews/index.ts` for the product page, the asset manifest for
 * the quick view). The brief asks for four curated panels in a fixed order:
 *
 *     1  FRONT COVER           the current cover
 *     2  BACK COVER            cropped from the book's own print wrap
 *     3  A PASSAGE             a quotation set in type, taken verbatim from the book
 *     4  A PASSAGE
 *
 * The structure of that preview is data, not component code:
 *
 *     { frontCover, backCover, quoteVisuals: [{ quote, sourceLocation, image }] }
 *
 * `frontCover` and `backCover` follow the file convention in `asset-map.ts` (a
 * cover exists because its file is in the manifest); `quoteVisuals` live in
 * `src/content/book-media.json`, keyed by slug, because a quotation is content
 * and needs its quote, where it is from, and the proof that it is the book's own.
 *
 * WHAT THIS REFUSES TO DO
 *  - It never pads. A book with no back cover has three panels, not four with a
 *    gap filled by someone else's art; the shortfall is filled, if at all, with
 *    the book's OWN interior pages and says what they are.
 *  - It never invents a quotation. The text of every quote is checked against
 *    the manuscript by `scripts/previews/verify-quotes.mjs` (SHA-256 of the source
 *    and the location of the match are recorded under `verification`), and
 *    `book-media.test.ts` fails if a record is missing that proof.
 *  - It never lets one book's image into another's preview: every image path must
 *    live under the book's own slug.
 */
import media from "@/content/book-media.json";
import { bookBackSrc, bookCoverSrc, bookPreviewSrcs, bookQuoteSrcs } from "@/lib/asset-map";

export interface QuoteProof {
  /** The file the quote was matched against (a path, as recorded on the machine that checked it). */
  source: string;
  /** SHA-256 of that file, so a changed manuscript is noticed. */
  sourceSha256: string;
  /** ISO date of the check. */
  checkedAt: string;
  /** How the match was made (normalisation applied before comparing). */
  method: string;
}

export interface QuoteVerification extends QuoteProof {
  /**
   * The second proof: the interior PDF the printer was sent contains the same words
   * in the same order. Present for every book that has a print interior.
   */
  interior?: QuoteProof;
}

export interface QuoteVisual {
  /** The passage, exactly as the book prints it. */
  quote: string;
  /** Where it is, as a reader would cite it ("Chapter 3", "p. 41", "Introduction"). */
  sourceLocation: string;
  /** The typeset card: `/images/previews/<slug>/quote-<n>.webp`. */
  image: string;
  verification: QuoteVerification;
}

export interface BookPreview {
  frontCover: string | null;
  backCover: string | null;
  quoteVisuals: QuoteVisual[];
}

type MediaFile = Record<string, { interior?: string; quoteVisuals?: QuoteVisual[] }>;
const MEDIA = media as unknown as MediaFile;

/** The structured preview of a book, as the brief specifies it. */
export function getBookPreview(slug: string): BookPreview {
  const declared = MEDIA[slug]?.quoteVisuals ?? [];
  // A declared quote whose card is not in the manifest is not shown: the
  // manifest is what says the file exists (same rule as every other asset).
  const present = new Set(bookQuoteSrcs(slug));
  return {
    frontCover: bookCoverSrc(slug),
    backCover: bookBackSrc(slug),
    quoteVisuals: declared.filter((q) => present.has(q.image)),
  };
}

export type PanelKind = "front" | "back" | "quote" | "interior";

export interface PreviewPanel {
  kind: PanelKind;
  src: string;
  /** Alt text: says what the image IS. A quote card's alt carries the quotation itself. */
  alt: string;
  /** A short caption for the gallery ("Front cover", "Back cover", "From Chapter 3", "Page 2 of the opening"). */
  caption: string;
}

/** The panels shown in a book's gallery: front, back, up to two passages — and, only to reach four, the book's own pages. */
export const TARGET_PANELS = 4;

export function previewPanels(book: { slug: string; title: string }): PreviewPanel[] {
  const { slug, title } = book;
  const preview = getBookPreview(slug);
  const panels: PreviewPanel[] = [];

  if (preview.frontCover) {
    panels.push({ kind: "front", src: preview.frontCover, alt: `Front cover of ${title}`, caption: "Front cover" });
  }
  if (preview.backCover) {
    panels.push({ kind: "back", src: preview.backCover, alt: `Back cover of ${title}`, caption: "Back cover" });
  }
  for (const q of preview.quoteVisuals.slice(0, 2)) {
    panels.push({
      kind: "quote",
      src: q.image,
      // paragraph breaks become spaces: an alt attribute is one run of text
      alt: `A passage from ${title} (${q.sourceLocation}): “${q.quote.replace(/\s*\n+\s*/g, " ")}”`,
      caption: `From ${q.sourceLocation}`,
    });
  }

  // Short of four? Fill with the book's OWN interior pages — never another book's
  // art, never a repeat — and label them as exactly that.
  if (panels.length < TARGET_PANELS) {
    const pages = bookPreviewSrcs(slug);
    for (const [i, src] of pages.slice(0, TARGET_PANELS - panels.length).entries()) {
      panels.push({
        kind: "interior",
        src,
        alt: `Interior page ${i + 1} from ${title}`,
        caption: pages.length > 1 ? `Inside the book, page ${i + 1}` : "Inside the book",
      });
    }
  }
  return panels;
}
