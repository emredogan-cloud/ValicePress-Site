/**
 * Where each direct-sale digital edition comes from.
 *
 * Only titles that Valice Press may actually sell from its own store appear
 * here. Two are deliberately absent and the reason is recorded rather than
 * implied:
 *
 *   codex-mythologica            — the Kindle edition is enrolled in KDP
 *                                  Select (verified on the KDP bookshelf,
 *                                  2026-08-31). Select is exclusive: while
 *                                  enrolled, the digital edition may not be
 *                                  sold anywhere else, including here.
 *   korean-hangul-…-workbook     — unresolved CC BY-NC dictionary source
 *                                  (A7/S-0019). Non-commercial licensing
 *                                  blocks sale in every channel, not just
 *                                  Amazon's.
 *   the-myth-hunters-field-book  — no ebook exists by design. It is a
 *                                  write-in activity book.
 *
 * `printInterior` points into the book production repositories, which are
 * NOT part of this repository. The build script fails loudly rather than
 * silently skipping when a path is absent — which is how the 2026-09-05 pass
 * found that SIX of these paths had gone stale: the book repositories were
 * reorganised into CODEX-SERIES/, GAMES-PUZZLE/, LANGUAGE-SERIES/ (all since
 * folded into ROADMAP-BOOKS/, 2026-09-07) and
 * PHASE-1-BOOK/ after these lines were written, and nothing had re-cut a
 * digital edition since. Every path below was checked against the filesystem
 * on 2026-09-05.
 */
import { bookPath } from "../factory/book-dirs.mjs";

export const DIGITAL_EDITION_SOURCES = [
  {
    slug: "codex-bestiarium",
    printInterior: bookPath("CODEX-BESTIARIUM", "04_PRINT", "PAPERBACK", "CODEX_BESTIARIUM_INTERIOR_PAPERBACK.pdf"),
  },
  {
    slug: "codex-enigmatica",
    printInterior: bookPath("CODEX-ENIGMATICA", "08_OUTPUT", "PAPERBACK", "interior.pdf"),
  },
  {
    slug: "the-great-book-of-world-games",
    printInterior: bookPath("THE-GREAT-BOOK-OF-WORLD-GAMES", "08_OUTPUT", "PAPERBACK", "GreatBookOfWorldGames_interior_paperback.pdf"),
  },
  {
    slug: "the-great-book-of-world-myths",
    printInterior: bookPath("THE-GREAT-BOOK-OF-WORLD-MYTHS", "08_OUTPUT", "paperback", "interior.pdf"),
  },
  {
    // Valice Classics 2 (2026-09-02). The 6 × 9 print interior is already
    // small (scan-resolution figures), so the /ebook pass mostly normalises.
    slug: "the-puzzles-of-henry-dudeney",
    printInterior: bookPath("03-THE-PUZZLES-OF-HENRY-DUDENEY", "OUTPUT", "interior-main.pdf"),
    // The second delivered artifact. One purchase, both files: the worker
    // watermarks the PDF page by page and the EPUB by appending a licence
    // leaf and writing the same line into the package metadata.
    epub: bookPath("03-THE-PUZZLES-OF-HENRY-DUDENEY", "OUTPUT", "the-puzzles-of-henry-dudeney-main.epub"),
  },
  {
    // Valice Classics 8 (2026-09-05), Phase 2 book 1. The interior carries five
    // raster plates and nineteen rebuilt move tables, so the /ebook pass does
    // downsample rather than merely normalise.
    slug: "games-ancient-and-oriental",
    printInterior: bookPath("01-GAMES-ANCIENT-AND-ORIENTAL", "OUTPUT", "interior-main.pdf"),
    epub: bookPath("01-GAMES-ANCIENT-AND-ORIENTAL", "OUTPUT", "games-ancient-and-oriental.epub"),
  },
  {
    // Valice Classics 9 (2026-09-05). Phase 2 book 2. Five diagram plates and one
    // rebuilt move table; no photographic matter, so the /ebook pass normalises
    // rather than downsamples.
    slug: "korean-games",
    printInterior: bookPath("02-KOREAN-GAMES", "OUTPUT", "interior-main.pdf"),
    epub: bookPath("02-KOREAN-GAMES", "OUTPUT", "korean-games.epub"),
  },
  {
    // Valice Classics 13. Built as phase 3 book 1 (2026-09-06), rebuilt as ROADMAP
    // BOOK 06 (2026-09-08) at 142 pp. Two 1904 plates and no other raster matter, so
    // the /ebook pass normalises rather than downsamples.
    slug: "kwaidan",
    printInterior: bookPath("06-KWAIDAN", "OUTPUT", "interior-main.pdf"),
    epub: bookPath("06-KWAIDAN", "OUTPUT", "kwaidan.epub"),
  },
  {
    // Valice Classics 12 (2026-09-06). Phase 2 book 5, and the largest: 244 pages with
    // 78 engraved staves. The print interior is also the ebook's PDF — a book set with
    // music on the page is one a reader wants as a page rather than as reflowed text —
    // and the EPUB carries the reflowable version beside it.
    slug: "traditional-games",
    printInterior: bookPath("05-TRADITIONAL-GAMES", "OUTPUT", "interior-main.pdf"),
    epub: bookPath("05-TRADITIONAL-GAMES", "OUTPUT", "traditional-games.epub"),
  },
  {
    // Valice Classics 10 (2026-09-05). Phase 2 book 3. Five diagram plates, no
    // photographic matter, so the /ebook pass normalises rather than downsamples.
    slug: "chess-and-playing-cards",
    printInterior: bookPath("03-CHESS-AND-PLAYING-CARDS", "OUTPUT", "interior-main.pdf"),
    epub: bookPath("03-CHESS-AND-PLAYING-CARDS", "OUTPUT", "chess-and-playing-cards.epub"),
  },
  {
    // Valice Classics 11 (2026-09-05). Phase 2 book 4, and the only one of the five not
    // built from a scan. EBOOK ONLY: at 37 pages there is no paperback, so this
    // interior is not a print master — it IS the ebook's PDF.
    slug: "mancala",
    printInterior: bookPath("04-MANCALA", "OUTPUT", "interior-main.pdf"),
    epub: bookPath("04-MANCALA", "OUTPUT", "mancala.epub"),
  },
  {
    // Valice Classics 3 (2026-09-04). Text-only 6 × 9 interior with no plates,
    // so the /ebook pass is a normalising pass rather than a downsampling one.
    slug: "epictetus-discourses-and-enchiridion",
    printInterior: bookPath("05-EPICTETUS-DISCOURSES-AND-ENCHIRIDION", "OUTPUT", "interior-main.pdf"),
    epub: bookPath("05-EPICTETUS-DISCOURSES-AND-ENCHIRIDION", "OUTPUT", "epictetus-discourses-and-enchiridion.epub"),
  },
  {
    // Valice Classics 5 (2026-09-04). Volume one of two.
    slug: "myths-and-legends-of-china",
    printInterior: bookPath("03-MYTHS-AND-LEGENDS-OF-CHINA", "OUTPUT", "interior-main.pdf"),
    epub: bookPath("03-MYTHS-AND-LEGENDS-OF-CHINA", "OUTPUT", "myths-and-legends-of-china.epub"),
  },
  {
    // Valice Classics 6 (2026-09-04). Volume one of four.
    slug: "indian-myth-and-legend",
    printInterior: bookPath("04-INDIAN-MYTH-AND-LEGEND", "OUTPUT", "interior-main.pdf"),
    epub: bookPath("04-INDIAN-MYTH-AND-LEGEND", "OUTPUT", "indian-myth-and-legend.epub"),
  },
  {
    // Valice Classics 15 (2026-09-08). Volume one of the 1893 original.
    // Added 2026-09-19: the paperback has been live on Amazon since
    // 2026-09-11 (B0HJG58238) and the book was in no catalogue, no source
    // table and no preview manifest — it existed on Amazon and nowhere else
    // this house keeps a record.
    slug: "puzzles-old-and-new",
    printInterior: bookPath("01-PUZZLES-OLD-AND-NEW", "OUTPUT", "interior.pdf"),
    epub: bookPath("01-PUZZLES-OLD-AND-NEW", "OUTPUT", "book.epub"),
  },
  {
    // Valice Classics 7 (2026-09-04). Volume one of three.
    slug: "mythical-monsters",
    printInterior: bookPath("05-MYTHICAL-MONSTERS", "OUTPUT", "interior-main.pdf"),
    epub: bookPath("05-MYTHICAL-MONSTERS", "OUTPUT", "mythical-monsters.epub"),
  },
  {
    // Valice Script 2 (2026-09-04). The only workbook in this list, and the
    // reason it belongs here is the reason the Hangul workbook does not: a
    // PDF of a handwriting workbook is not a degraded copy of the paperback,
    // it is the format that lets a reader print page 31 twenty times instead
    // of once. The interior is vector at 0.4 MB, so the /ebook pass
    // normalises rather than downsamples.
    slug: "greek-alphabet-handwriting-workbook",
    printInterior: bookPath("02-GREEK-ALPHABET-HANDWRITING-WORKBOOK", "OUTPUT", "KDP", "PAPERBACK", "interior.pdf"),
    // Not the workbook as an ebook — a workbook's value is the empty box, and
    // an empty box cannot be written in on a screen. This is the other half:
    // a reflowable reference edition of the same material, 36 chapters with
    // the stroke diagrams as scalable SVG. One purchase, both files.
    epub: bookPath("02-GREEK-ALPHABET-HANDWRITING-WORKBOOK", "OUTPUT", "EBOOK", "greek-alphabet-reference.epub"),
  },
  {
    // Roadmap book 4 (2026-09-05). Two files, and neither is the other:
    // the print interior screen-normalised, which for a puzzle book is the
    // format that lets a reader print puzzle 63 twice, and a reflowable EPUB
    // whose grids are SVG and whose three hint passes are three documents.
    slug: "codex-mythologica-the-puzzle-book",
    printInterior: bookPath("04-CODEX-MYTHOLOGICA-THE-PUZZLE-BOOK", "OUTPUT", "PAPERBACK", "interior.pdf"),
    epub: bookPath("04-CODEX-MYTHOLOGICA-THE-PUZZLE-BOOK", "OUTPUT", "EBOOK", "codex-mythologica-the-puzzle-book.epub"),
  },
  {
    // Valice Classics 4 (2026-09-04).
    slug: "seneca-selected-dialogues",
    printInterior: bookPath("02-SENECA-SELECTED-DIALOGUES", "OUTPUT", "interior-main.pdf"),
    epub: bookPath("02-SENECA-SELECTED-DIALOGUES", "OUTPUT", "seneca-selected-dialogues.epub"),
  },
  {
    // Valice Classics 14 (2026-09-06). PHASE 3 book 2. Henry Lee's 1884 plates are
    // wood engravings at print resolution, so the /ebook pass downsamples.
    slug: "sea-monsters-unmasked",
    printInterior: bookPath("02-SEA-MONSTERS-UNMASKED", "OUTPUT", "interior-main.pdf"),
    epub: bookPath("02-SEA-MONSTERS-UNMASKED", "OUTPUT", "sea-monsters-unmasked.epub"),
  },
  {
    // Valice Classics 15 (2026-09-06). PHASE 3 book 3. Text-only, so the /ebook
    // pass normalises rather than downsamples.
    slug: "book-of-were-wolves",
    printInterior: bookPath("03-BOOK-OF-WERE-WOLVES", "OUTPUT", "interior-main.pdf"),
    epub: bookPath("03-BOOK-OF-WERE-WOLVES", "OUTPUT", "book-of-were-wolves.epub"),
  },
  {
    // Valice Classics 16 (2026-09-07). PHASE 3 book 4, and the longest of the phase:
    // 390 pages carrying twenty T. H. Thomas drawings.
    slug: "british-goblins",
    printInterior: bookPath("04-BRITISH-GOBLINS", "OUTPUT", "interior-main.pdf"),
    epub: bookPath("04-BRITISH-GOBLINS", "OUTPUT", "british-goblins.epub"),
  },
  {
    // Valice Classics 17 (2026-09-07). PHASE 3 book 5a. ONE project directory holds
    // BOTH volumes, so the file name — not the directory — is what distinguishes
    // them. Naming the wrong one here would sell Volume II under Volume I's price.
    slug: "fairy-mythology-vol-1",
    printInterior: bookPath("05-FAIRY-MYTHOLOGY", "OUTPUT", "interior-vol1.pdf"),
    epub: bookPath("05-FAIRY-MYTHOLOGY", "OUTPUT", "fairy-mythology-vol-1.epub"),
  },
  {
    // Valice Classics 18 (2026-09-07). PHASE 3 book 5b. See the note on 5a.
    slug: "fairy-mythology-vol-2",
    printInterior: bookPath("05-FAIRY-MYTHOLOGY", "OUTPUT", "interior-vol2.pdf"),
    epub: bookPath("05-FAIRY-MYTHOLOGY", "OUTPUT", "fairy-mythology-vol-2.epub"),
  },
  {
    // Play Anywhere 1 (2026-09-10) — the first ORIGINAL book in this list, and
    // the first at a 5 × 8 trim. Two files and neither replaces the other: the
    // print interior screen-normalised, which is the format that lets a reader
    // print the score sheets from the back, and a reflowable EPUB whose sixty
    // diagrams are 300 dpi rasters generated by the book's own vector code, so
    // the ebook figures and the printed figures cannot disagree.
    slug: "pencil-and-paper",
    printInterior: bookPath("PLA-01", "08_OUTPUT", "PAPERBACK", "PencilAndPaper_interior_paperback.pdf"),
    epub: bookPath("PLA-01", "08_OUTPUT", "KINDLE", "PencilAndPaper.epub"),
  },
  {
    // Under Every Sky 1 (2026-09-11). The 6 x 9 print interior is already
    // screen-legible and carries its four figures as vectors, so the /ebook pass
    // mostly normalises; the reflowable EPUB carries the same figures as 300 dpi
    // rasters produced by the book's own renderer, so the printed figures and the
    // reflowed figures cannot disagree. EPUBCheck 5.1.0 reports zero messages.
    slug: "how-the-world-began",
    printInterior: bookPath("UES-01", "08_OUTPUT", "UES-01-interior.pdf"),
    epub: bookPath("UES-01", "08_OUTPUT", "UES-01.epub"),
  },
  {
    // Under Every Sky 2 (2026-09-11). Same two files and the same reasoning as Volume
    // One: the 6 x 9 print interior is already screen-legible and carries its four
    // figures as vectors, and the reflowable EPUB carries the same figures as rasters
    // from the same renderer, so the printed and the on-screen figures cannot disagree.
    slug: "the-tricksters-table",
    printInterior: bookPath("UES-02", "08_OUTPUT", "UES-02-interior.pdf"),
    epub: bookPath("UES-02", "08_OUTPUT", "UES-02.epub"),
  },
  {
    // Etymon 1 (2026-09-17). Unlike the Under Every Sky pair, the interior is
    // not vector-only: it carries 41 AI-generated pictorial plates (10 part
    // openers, 35 entry plates, 1 chapter plate), tone-mapped to greyscale for
    // print and captioned as an editorial reconstruction; the 14 diagrams and
    // 47 route strips remain programmatic SVG. Rebuilt today (08_OUTPUT
    // timestamps 2026-09-17), 334 pages, matching 05_METADATA/metadata.json.
    slug: "words-from-the-gods",
    printInterior: bookPath("ETY-01", "08_OUTPUT", "ETY-01-interior.pdf"),
    epub: bookPath("ETY-01", "08_OUTPUT", "WordsFromTheGods.epub"),
  },
];


/** R2 masters key for a slug. Versioned so a re-cut edition never overwrites. */
export const masterKey = (slug, version = "v1") =>
  `books/${slug}/master/${version}/master.pdf`;

/** R2 masters key for the EPUB of a slug. Same version folder as the PDF. */
export const epubMasterKey = (slug, version = "v1") =>
  `books/${slug}/master/${version}/master.epub`;
