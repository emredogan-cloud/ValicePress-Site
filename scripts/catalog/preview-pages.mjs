/**
 * Which real pages of each book the storefront shows as its preview.
 *
 * WHAT THIS REPLACES
 * Every book page on this site used to render the same invented sample
 * prose — a first-person passage about buying a DRM'd ebook — under the
 * heading "A taste of the writing / Read the opening pages before you buy".
 * It was a placeholder that shipped. On `/books/meditations` it presented
 * modern invented text as an excerpt from Marcus Aurelius.
 *
 * The replacement is not better invented text. It is the actual pages,
 * rendered as images from the same PDF the buyer receives. For a bestiary,
 * a puzzle book and a workbook, an image is also the only honest preview:
 * their pages are plates, grids and diagrams, and a text extraction of them
 * is not what the reader would be buying.
 *
 * CHOOSING THE RANGE
 * Front matter is skipped — a title page and a copyright notice tell a
 * reader nothing about whether they want the book. Each range starts where
 * the book's actual work starts and covers a contiguous run, so the reader
 * sees how a real spread is built rather than four cherry-picked highlights.
 * Every range was read before it was chosen.
 *
 * HOW MUCH
 * Four pages each, out of 148–435. Enough to judge the typography, the
 * illustration standard and the voice; far short of the ~5% that would make
 * the preview a substitute for the book. The Myth Hunter's Field Book gets
 * puzzle pages WITHOUT their answer key, which is printed elsewhere.
 */
import { bookPath } from "../factory/book-dirs.mjs";

const BUILT = "scripts/tmp/digital-editions";

export const PREVIEW_PAGES = [
  {
    // Play Anywhere 1 (2026-09-10). The preview is one complete OPENING — the
    // rules page and its facing diagram-and-notes page — because the whole
    // promise of the book is that a game never turns a page, and two arbitrary
    // pages would not show it. 2 of 162, well under one and a half per cent.
    slug: "pencil-and-paper",
    source: bookPath("PLA-01", "08_OUTPUT", "PAPERBACK", "PencilAndPaper_interior_paperback.pdf"),
    pages: [40, 41],
    note: "One complete opening: Dots and Boxes, with the rules, the diagram, the sourced provenance and the strategy note.",
  },
  {
    slug: "meditations",
    // Fetched from R2 — this book has no source project on disk; the master
    // in the bucket is the only copy.
    source: `${BUILT}/meditations.pdf`,
    pages: [21, 24],
    note: "Book Two, mid-argument — Long's prose doing the thing it is bought for.",
  },
  {
    slug: "codex-mythologica",
    source: bookPath("CODEX-MYTHOLOGICA", "04_PRINT", "PAPERBACK", "CODEX_MYTHOLOGICA_INTERIOR_PAPERBACK.pdf"),
    pages: [24, 27],
    note: "Inside the Greek sequence, mid-retelling, at full narrative length.",
  },
  {
    slug: "codex-bestiarium",
    source: `${BUILT}/codex-bestiarium.pdf`,
    pages: [39, 42],
    note: "Two complete creature entries with their line-engraved plates.",
  },
  {
    slug: "codex-enigmatica",
    source: `${BUILT}/codex-enigmatica.pdf`,
    pages: [24, 27],
    note: "The first gate's opening puzzles — clues, constraints and answer form, no solutions.",
  },
  {
    slug: "the-great-book-of-world-games",
    source: `${BUILT}/the-great-book-of-world-games.pdf`,
    pages: [16, 19],
    note: "A complete game entry: provenance, rules and the board diagram you play from.",
  },
  {
    slug: "the-puzzles-of-henry-dudeney",
    source: `${BUILT}/the-puzzles-of-henry-dudeney.pdf`,
    // Part IV opens on the Haberdasher's puzzle with its figure; the next
    // page carries two more dissections. Statements only — no solutions.
    pages: [29, 30],
    note: "The Haberdasher's puzzle and two more dissections, in Dudeney's words with the original figures — puzzles only, no solutions.",
  },
  {
    slug: "the-great-book-of-world-myths",
    source: `${BUILT}/the-great-book-of-world-myths.pdf`,
    pages: [22, 25],
    note: "A full myth with its illustration, at the length a 9-year-old actually reads.",
  },
  {
    slug: "korean-hangul-handwriting-workbook",
    // The REMEDIATED interior of 2026-09-02, not the earlier build: this is
    // the file whose sources page reads "Korean Learner's Vocabulary List".
    //
    // 126pp, not the 124pp file this line used to name. Phase 5 APPENDED the
    // dedicated companion leaf, which renamed the old file to
    // `…_124pp.pre-companion.pdf` and left this path dangling — and because
    // build-previews.mjs used to drop a book from the manifest whenever its
    // source was missing, that silently deleted a live book's preview on the
    // next unrelated run. The path is corrected here and the builder now
    // keeps an already-rendered preview instead of dropping it.
    // The page range is unaffected: the leaf was appended after p.124.
    source: bookPath("01-KOREAN-HANGUL-HANDWRITING-WORKBOOK", "09_OUTPUT", "FINAL", "paperback", "paperback_interior_8.5x11_126pp.pdf"),
    // Lesson 4 entire: the rule for where a letter goes inside the square,
    // the six words built from it, and both practice pages. It is the step
    // the book exists for, and the one a buyer wants to see done well before
    // paying for 124 pages of ruled boxes.
    pages: [13, 16],
    note: "Lesson 4 in full: where each letter goes inside the syllable block, six real words built from it, and the trace-then-write practice pages.",
  },
  {
    slug: "codex-mythologica-the-puzzle-book",
    source: bookPath("04-CODEX-MYTHOLOGICA-THE-PUZZLE-BOOK", "OUTPUT", "PAPERBACK", "interior.pdf"),
    // `pages` is a RANGE, first to last, not a list — a first attempt at
    // [59, 76, 93, 137] rendered eighteen pages of the book into /public.
    //
    // Four consecutive pages from the middle of the deduction gathering, which
    // is where this book's one real difference from every other mythology
    // puzzle book is visible: the whole candidate table is printed with the
    // puzzle. A buyer deciding whether this is a quiz can see in one glance
    // that it is not.
    pages: [59, 62],
    note: "Four consecutive pages from the deduction gathering — a logic grid and its clues, and the deductions with their full candidate tables printed, which is the promise that nothing here needs knowledge you arrived with.",
  },
  {
    slug: "greek-alphabet-handwriting-workbook",
    source: bookPath("02-GREEK-ALPHABET-HANDWRITING-WORKBOOK", "OUTPUT", "KDP", "PAPERBACK", "interior.pdf"),
    // Lesson 8, beta, as the spread is actually printed: teaching page on the
    // verso, practice on the recto. Beta is the deliberate choice rather than
    // the first letter — it is the letter the 1998 Travlos study found Greek
    // schoolchildren writing twenty-eight different ways, so it is where this
    // book's one real differentiator is visible: the stroke order is printed
    // WITH the note saying where it came from and that it is recommended, not
    // official. A buyer who is deciding between this and the other Greek
    // workbooks needs to see exactly that page.
    pages: [30, 31],
    note: "Lesson 8 as a full spread: beta taught stroke by stroke, then the trace-to-free practice page — with the provenance note that says where the stroke order came from.",
  },
  {
    slug: "epictetus-discourses-and-enchiridion",
    source: `${BUILT}/epictetus-discourses-and-enchiridion.pdf`,
    // Inside Part Two, where the head-notes are doing the work this edition is
    // bought for: a chapter title Long ran into his own prose, an editor's
    // orientation under it, and then Epictetus at full length.
    pages: [60, 63],
    note: "Two discourses with their head-notes — the apparatus and the text on the same page, which is what the edition is for.",
  },
  {
    slug: "mythical-monsters",
    source: `${BUILT}/mythical-monsters.pdf`,
    // The Register of Claims, which is the apparatus this volume exists for:
    // Gould's assertion, what is established, and an editorial reading.
    // Three pages, not four: at 74 pages this is the shortest book in the
    // series and the catalogue test caps a preview at 5% of the whole.
    pages: [55, 57],
    note: "The Register of Claims \u2014 six of Gould's assertions set beside what is actually established, with an editorial reading of each.",
  },
  {
    slug: "indian-myth-and-legend",
    source: `${BUILT}/indian-myth-and-legend.pdf`,
    // Inside chapter II, where the density of gods is highest and the editor's
    // chapter introduction is doing the work the volume is bought for.
    pages: [30, 33],
    note: "The great Vedic deities, with the editor's chapter introduction above them \u2014 the apparatus and the text on the same spread.",
  },
  {
    slug: "myths-and-legends-of-china",
    source: `${BUILT}/myths-and-legends-of-china.pdf`,
    // The chapter that makes the book's argument: the Ministry of Thunder, with
    // the editor's chapter introduction above it saying what to watch for, and
    // then Werner at full length.
    pages: [40, 43],
    note: "The Ministry of Thunder, opening with the editor's chapter introduction — the apparatus and the text on the same spread, which is what the edition is for.",
  },
  {
    slug: "seneca-selected-dialogues",
    source: `${BUILT}/seneca-selected-dialogues.pdf`,
    // On Peace of Mind opens with Serenus diagnosing himself and Seneca
    // answering; the argument-map lines sit under the chapter numbers Seneca
    // never wrote.
    pages: [45, 48],
    note: "The opening of On Peace of Mind, with the argument map that gives every unnumbered chapter a description Seneca never supplied.",
  },
  {
    // Phase 2 book 1. This range was missing when book 2's was added — the title
    // had gone through the whole pipeline with no preview at all, so its page on
    // the storefront offered nothing to read.
    slug: "games-ancient-and-oriental",
    source: `${BUILT}/games-ancient-and-oriental.pdf`,
    // Birch's account of the Manchester relics, running into the thirty-square
    // board drawn from his description and marked EVIDENCE on its face: the
    // specialist's own words and the edition's diagram on the same spread.
    // Three pages, not four: at 78 pages this book is short enough that a fourth
    // would put the preview over the 5% of the volume the catalogue test allows,
    // and that test is the reason to stop rather than a hurdle to clear.
    pages: [21, 23],
    note: "Dr Birch on the Manchester relics, with the board of thirty compartments drawn from his description and marked EVIDENCE.",
  },
  {
    slug: "mancala",
    source: `${BUILT}/mancala.pdf`,
    // ONE page, and the shortness of the book is why. The catalogue's own test caps a
    // preview at 5% of the volume; this volume is 37 pages, so 5% is a single leaf, and
    // three pages of it would be 8.1% given away. The leaf chosen is the one that shows
    // what the reader is actually buying: the three panels reconstructing how a move
    // works, which is the edition's own reading of rules Culin left in prose.
    pages: [19, 19],
    note: "How a move works — the edition's reconstruction, in three panels, of the sowing rules Culin left as prose.",
  },
  {
    slug: "traditional-games",
    source: `${BUILT}/traditional-games.pdf`,
    // The opening of Green Gravel: the edition's head-note, the tunes engraved for it,
    // and the first of eighteen versions with the county under it. Four pages of 244 is
    // 1.6%, well inside the catalogue's own 5% cap.
    pages: [75, 78],
    note: "Green Gravel: the edition's head-note, the six tunes engraved from the notes, and the first versions with the counties they came from.",
  },
  {
    slug: "chess-and-playing-cards",
    source: `${BUILT}/chess-and-playing-cards.pdf`,
    // Culin on Chinese and Korean chess, with the two boards drawn from his own
    // descriptions on the same spread — the Chinese one with its River, and the
    // Korean one that rules the files straight across it. Four pages that show what
    // this edition does that the free scan does not: the entries set clean, the
    // footnotes lifted out of his sentences, and the boards you can actually see.
    pages: [28, 31],
    note: "Chinese and Korean chess, with both boards drawn from Culin's own descriptions and marked EVIDENCE.",
  },
  {
    slug: "korean-games",
    source: `${BUILT}/korean-games.pdf`,
    // Wilkinson on how the Korean pieces move, then his thirty-move illustrative
    // game — the page every other digital text of this book renders as "takes
    // takes 7 h" — then the prose picking up on the other side of it. If a reader
    // is going to judge this edition on four pages, these are the four that show
    // what it did that the free scans do not.
    pages: [61, 64],
    note: "Wilkinson on the Korean pieces, and his illustrative game rebuilt from the position of every word on the scanned page.",
  },
  {
    slug: "the-myth-hunters-field-book",
    source: bookPath("THE-MYTH-HUNTERS-FIELD-BOOK", "08_OUTPUT", "PAPERBACK", "interior.pdf"),
    pages: [14, 17],
    note: "Two puzzle spreads as they are printed — deliberately without the answer key.",
  },
  {
    // Phase 3 book 1. The head-note on p.18 and the opening of the longest tale.
    // Chosen because the head-note IS the edition: Hearn's text is free everywhere,
    // and what a buyer pays for here is the paragraph in front of it.
    slug: "kwaidan",
    source: `${BUILT}/kwaidan.pdf`,
    pages: [18, 21],
    note: "The edition's head-note to Mimi-Nashi-Hōïchi, and the opening of the tale it introduces.",
  },
  {
    // Phase 3 book 2. The Kwaidan of this book: the Kraken chapter, which Lee's
    // reputation rests on, with the edition's head-note in front of it. 4 of 232 = 1.7%.
    slug: "sea-monsters-unmasked",
    source: `${BUILT}/sea-monsters-unmasked.pdf`,
    pages: [20, 23],
    note: "The Kraken: the edition's head-note, then Lee reasoning his way from Pontoppidan's monster to a real animal.",
  },
  {
    // Phase 3 book 3. Chapter III, where the book changes gear into the sagas — and
    // where the typography has to carry Old Norse verse beside its translation.
    slug: "book-of-were-wolves",
    source: `${BUILT}/book-of-were-wolves.pdf`,
    pages: [27, 30],
    note: "The Were-Wolf in the North: the edition's head-note, and the saga verse set beside its translation.",
  },
  {
    // Phase 3 book 4. Deliberately includes p.32, ROWLI AND THE ELLYLL — one of the
    // twenty T. H. Thomas drawings, which are half of what this edition offers over the
    // free scan. 4 pages of 390 is 1.0%.
    slug: "british-goblins",
    source: `${BUILT}/british-goblins.pdf`,
    pages: [30, 33],
    note: "Sikes on the ellyllon, with T. H. Thomas's drawing of Rowli and the Ellyll on the page it belongs to.",
  },
  {
    // Phase 3 book 5a. The philology chapter, which the edition's own head-note calls the
    // best-argued in the volume — so a reader sees the apparatus judging the book, not
    // only praising it.
    slug: "fairy-mythology-vol-1",
    source: `${BUILT}/fairy-mythology-vol-1.pdf`,
    pages: [23, 26],
    note: "Origin of the Word Fairy: the edition's head-note and Keightley's best-argued chapter.",
  },
  {
    // Phase 3 book 5b. England — a quarter of this volume, and the section that shows
    // what the second half of Keightley is for.
    slug: "fairy-mythology-vol-2",
    source: `${BUILT}/fairy-mythology-vol-2.pdf`,
    pages: [15, 18],
    note: "England: the longest section in the whole work, with the edition's head-note in front of it.",
  },
  {
    // The first story's opening spread and the transparency note that governs the
    // whole book. Pages 26-27 are the first two pages of "The One Who Made Himself";
    // page 11 is the Turkish and English note on what this book is and is not, which
    // is the honest thing to show a buyer before they pay for it.
    slug: "how-the-world-began",
    source: `${BUILT}/how-the-world-began.pdf`,
    // [from, to], not a list - the first attempt passed four page numbers and got a
    // sixteen-page range. This is a story opening and the prose that follows it, which
    // is what a buyer needs to judge: pp. 25-28, "Chaos First".
    pages: [25, 28],
    note: "A story opening and the prose that follows it — Hesiod's Chaos, and why the usual translation of the word is wrong.",
  },
  {
    slug: "the-tricksters-table",
    source: `${BUILT}/the-tricksters-table.pdf`,
    // A WHOLE STORY AND ITS APPARATUS, not a sampler. pp. 21-24 are Anansi's
    // "Thunder's Two Gifts" complete, then "Where this came from", the historical
    // context and the comparative reading - the four-part structure that is the only
    // reason to buy this book rather than any other trickster collection. Showing
    // three story openings would show the prose and hide the argument.
    // 21-23, not 21-24. Page 24 is the last, sparse page of the reading — 0.56% ink —
    // and a near-blank sheet as the final preview image makes the book look thin on a
    // product page. Measured, not eyeballed.
    pages: [21, 23],
    note: "A whole tale and everything the book puts around it — Anansi and Thunder, then who wrote it down, when, and what that did to it.",
  },
  {
    slug: "words-from-the-gods",
    source: `${BUILT}/words-from-the-gods.pdf`,
    // pp. 9-10, not the front matter and not a single cherry-picked entry.
    // Page 9 is "panic" complete — hook, current meaning, body, both
    // authorities quoted under "What the evidence says", a cross-reference
    // and claim codes, start to finish on one page. Page 10 runs straight
    // into "cereal" through its own evidence block. Two entries, not one, so
    // the reader sees the format repeat rather than judging the book on its
    // single best example.
    pages: [9, 10],
    note: "Two complete entries back to back — panic, then cereal — showing the hook, the sourced body and both dictionaries quoted under \"What the evidence says\".",
  },
];
