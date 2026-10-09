/**
 * What the About page says about each shelf, written from the books' own descriptions in the
 * catalogue (`scripts/catalog/valice-catalog.mjs` → `onelinePromise`), not from a publisher's
 * boilerplate. One entry per catalogue category; `about-copy.test.ts` fails if a category exists
 * without copy here, or copy names a category that does not exist, or names a book that is not in
 * the catalogue — so the page cannot drift away from what the press actually publishes.
 *
 * `books` are the titles the sentence points at (slugs), each of which the test checks.
 */
export interface ShelfCopy {
  /** One sentence, in the present tense, about what is on the shelf. */
  blurb: string;
  /** Catalogue slugs the blurb names, in order of mention. */
  books: string[];
}

export const SHELF_COPY: Record<string, ShelfCopy> = {
  "myth-and-folklore": {
    blurb:
      "Reference books on the world's myths and monsters, and our editions of the folklorists who gathered them: Codex Mythologica and Codex Bestiarium beside Kwaidan, The Fairy Mythology and British Goblins.",
    books: ["codex-mythologica", "codex-bestiarium", "kwaidan", "fairy-mythology-vol-1", "british-goblins"],
  },
  "games-and-play": {
    blurb:
      "Games you can play tonight, and the classic surveys behind them: The Great Book of World Games, sixty-three traditional games with complete rules and boards, beside our editions of Culin's Korean Games, Falkener's Games Ancient and Oriental, and The Singing Games of England, Scotland, and Ireland.",
    books: ["the-great-book-of-world-games", "korean-games", "games-ancient-and-oriental", "traditional-games"],
  },
  "puzzle-and-challenge": {
    blurb:
      "Puzzle books whose answers are checked, and the puzzle classics: Codex Enigmatica, The Puzzles of Henry Dudeney, and a hundred myth puzzles in Codex Mythologica: The Puzzle Book.",
    books: ["codex-enigmatica", "the-puzzles-of-henry-dudeney", "codex-mythologica-the-puzzle-book"],
  },
  romance: {
    blurb:
      "Small-town and medical romance: The Larkspur Lake Novels by Harper Hayes and the Bristlecone Emergency series by Quinn Gallagher, with free bonus scenes for readers.",
    books: ["the-sweetest-season", "weather-permitting"], // Larkspur Lake and Bristlecone Emergency are series names; each is checked in the test too
  },
  "classics-and-philosophy": {
    blurb:
      "Our own editions of public-domain classics — Marcus Aurelius's Meditations among them — re-typeset as books to read, with introductions, notes and indexes, and each one naming its source and translator.",
    books: ["meditations"],
  },
  "language-and-learning": {
    blurb:
      "Handwriting workbooks — the Korean Hangul Handwriting Workbook and The Greek Alphabet Handwriting Workbook — that take an adult from nothing to writing every letter, and Words from the Gods, on the myths and mistakes hidden inside everyday English.",
    books: ["korean-hangul-handwriting-workbook", "greek-alphabet-handwriting-workbook", "words-from-the-gods"],
  },
  "young-explorers": {
    blurb:
      "For readers aged 8 to 12: The Great Book of World Myths and The Myth Hunter's Field Book, whose puzzles are each built from something a real culture actually made.",
    books: ["the-great-book-of-world-myths", "the-myth-hunters-field-book"],
  },
};

/**
 * The three things the catalogue's own descriptions keep promising, with a book that shows each. This is
 * the press's editorial standard in its own words — not a list of values — and each line is a claim about
 * a specific, linkable book.
 */
export interface Standard {
  title: string;
  body: string;
  example: { slug: string; label: string };
}

export const STANDARDS: Standard[] = [
  {
    title: "Sources named",
    body: "A myth is only as good as the person who wrote it down. Our reference books say who that was, when, and what writing it down did to the story.",
    example: { slug: "how-the-world-began", label: "How the World Began: thirty creation myths, each with its source named, dated and taken apart" },
  },
  {
    title: "Evidence on the page",
    body: "Where a reference book states something, it shows the evidence, so a reader can check the claim instead of trusting it.",
    example: { slug: "words-from-the-gods", label: "Words from the Gods: a hundred and forty-five words, and for every one the evidence" },
  },
  {
    title: "Editions that mark their seams",
    body: "Our editions of the old game classics keep what the author observed apart from what he concluded or supplied, so the evidence can be read apart from the theory.",
    example: { slug: "games-ancient-and-oriental", label: "Games Ancient and Oriental: the seam marked between what the evidence shows and what Falkener supplied" },
  },
];
