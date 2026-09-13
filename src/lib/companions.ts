/**
 * Digital companions — the bridge from a printed book to an owned reader.
 *
 * A companion is a free web page whose address is printed inside a physical
 * book (as a short URL and a QR code). It carries material that genuinely
 * belongs off the page — practice sheets a reader will reprint, a tracker,
 * reference tables — and it is the ONLY mechanism that turns an Amazon buyer,
 * whom Amazon owns, into a Valice reader, whom we do.
 *
 * ── THE RULE THAT SHAPES THIS FILE ────────────────────────────────────────
 * A QR code printed in a paperback is permanent. It cannot be edited, and it
 * will be scanned years after the edition it appears in has changed, been
 * repriced, or been withdrawn. Therefore:
 *
 *   **A companion route must never 404, and must never depend on the book
 *   being on sale.**
 *
 * Every companion resolves to a real page in every state — before the book is
 * listed, while it is in review, after it is live, and after it has been
 * withdrawn. What changes is the `state` below, which controls what the page
 * says about buying, never whether the page exists. A reader who scans a code
 * and lands on a 404 has been told the publisher is unreliable, and that is a
 * far more expensive outcome than a page that says "not on sale yet".
 *
 * ── CONSENT ───────────────────────────────────────────────────────────────
 * Every companion asset is free and ungated. The email field is genuinely
 * optional and is never a condition of access: the download links work
 * whether or not anyone subscribes. This is deliberate. Gating a promised
 * bonus behind an address is the dark pattern the strategy explicitly
 * rejects, and it also converts worse than the honest version — a reader who
 * subscribes after finding the material useful is worth more than one who
 * subscribed to get past a wall.
 *
 * We also never imply Amazon shared anything. The reader typed the URL or
 * scanned the code themselves; that is the only relationship that exists.
 */

import type { CompanionNewsletterSource } from "@/lib/newsletter-client";

/**
 * Where a companion is in its lifecycle. This mirrors the book's real
 * commercial state and is the single field a founder edits when that changes.
 */
export type CompanionState =
  /** Book is on sale somewhere; show buying options. */
  | "book-available"
  /** Book is submitted/in review or otherwise not yet purchasable anywhere. */
  | "book-not-yet-available"
  /** Book has been withdrawn. Material stays up for existing owners. */
  | "book-withdrawn";

export type CompanionAsset = {
  /** Stable id — also the download route segment. */
  id: string;
  title: string;
  /** What it is and why a reader would want it. No marketing adjectives. */
  description: string;
  /** `generated` assets are produced by a route; `static` live in /public. */
  kind: "generated" | "static";
  /** Href to fetch it. */
  href: string;
  /** Shown next to the link so nobody downloads a surprise. */
  meta: string;
};

export type Companion = {
  slug: string;
  /** Slug of the book in the `books` table this companion belongs to. */
  bookSlug: string;
  bookTitle: string;
  state: CompanionState;
  /**
   * Why the state is what it is. Rendered to the reader in plain language
   * when the book is not purchasable — an honest sentence beats silence.
   */
  stateNote: string;
  /** One line, printed under the heading. */
  intro: string;
  /**
   * A shorter line for the callout on the book's own page, where the reader
   * has not yet decided to buy anything. Optional: without it the callout
   * falls back to a generic sentence.
   */
  calloutLabel?: string;
  /** The newsletter tag this page's signups carry. */
  newsletterSource: CompanionNewsletterSource;
  /** Heading over the download list; defaults to "Practice material". */
  assetsHeading?: string;
  /**
   * The gold line under the hero title, as separate tracked segments.
   *
   * OPTIONAL, and usually absent on purpose. Without it the line is derived
   * from the companion's own assets — how many, in what formats, free — which
   * is true for every book by construction. Set it only when there is
   * something specific and checkable to say that the assets do not already
   * say. It is a place for a fact, not for an adjective.
   */
  heroTagline?: string[];
  assets: CompanionAsset[];
  /**
   * Rights position for the companion's OWN content, tracked separately from
   * the book's. A companion can be clean while its book is not.
   */
  rightsNote: string;
};

/**
 * ── KOREAN HANGUL HANDWRITING WORKBOOK ────────────────────────────────────
 *
 * Until 2026-09-02 the book carried an unresolved licensing question on the
 * dictionary sources behind its 97 vocabulary words (CC BY-SA / CC BY-NC).
 * That was remediated on 2026-09-02: the sources were withdrawn, every word
 * re-verified against the National Institute of Korean Language's learner
 * vocabulary list (KOGL Type 1), and every gloss rewritten — see the book
 * project's RIGHTS.md. The Founder's Gate 2 sign-off and the KDP file
 * replacement are still pending, so the book is not on sale yet.
 *
 * This companion was built to be independent of the old sources and stays
 * that way: it contains no vocabulary list and no dictionary-derived
 * material. Its assets are:
 *   - practice grids, which are our own geometry and carry no third-party
 *     rights at all;
 *   - a lesson tracker, which is a checklist of the book's own structure;
 *   - a jamo reference using Revised Romanization, the South Korean
 *     government's official public romanization standard, not a dictionary.
 *
 * That separation is the point: the companion can go live and start building
 * the list while the book's rights question is still being resolved.
 */
const HANGUL: Companion = {
  slug: "hangul",
  bookSlug: "korean-hangul-handwriting-workbook",
  bookTitle: "Korean Hangul Handwriting Workbook",
  // The paperback is live on Amazon (B0HHHWXGG4, found and verified
  // 2026-09-02). The direct ebook still waits on the Founder's Gate 2
  // signature, so the book page — not this note — is where the formats live.
  state: "book-available",
  stateNote:
    "The workbook is on sale as a paperback on Amazon. Everything on this " +
    "page is free and works on its own — you do not need the book to use it.",
  intro:
    "Free practice material for learning to write Hangul by hand. Reprint the " +
    "grids as often as you like; handwriting is a volume exercise.",
  newsletterSource: "hangul-companion",
  rightsNote:
    "Everything on this page is Valice Press's own work. The practice grids " +
    "are generated geometry. Romanization follows Revised Romanization, the " +
    "official South Korean standard.",
  assets: [
    {
      id: "practice-grid",
      title: "Hangul practice grid (원고지 style)",
      description:
        "Square writing grid with faint quarter-guides, the standard shape for " +
        "practising syllable blocks. Blank, so it works for any lesson and at " +
        "any stage. Print it as many times as you need.",
      kind: "generated",
      href: "/companion/hangul/sheets/practice-grid.pdf",
      meta: "PDF · US Letter · 4 pages",
    },
    {
      id: "stroke-boxes",
      title: "Stroke-order practice boxes",
      description:
        "Larger boxes with a dotted start-corner marker, for drilling a single " +
        "letter until the stroke order is automatic. Twelve boxes per row.",
      kind: "generated",
      href: "/companion/hangul/sheets/stroke-boxes.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
    {
      id: "lesson-tracker",
      title: "Thirty-lesson progress tracker",
      description:
        "One page listing all thirty lessons with a box for each of the three " +
        "passes the book asks for — trace, dot-start, empty box. Pin it up and " +
        "mark it off; it is the only honest way to see whether you are actually " +
        "practising or just re-reading.",
      kind: "generated",
      href: "/companion/hangul/sheets/lesson-tracker.pdf",
      meta: "PDF · US Letter · 1 page",
    },
  ],
};

/**
 * ── THE GREAT BOOK OF WORLD GAMES ─────────────────────────────────────────
 *
 * The book is live on Amazon (paperback, hardcover, Kindle) and sold here as
 * a direct ebook, so the page shows buying options. Every file is generated
 * by the book project's own `04_BUILD/companion_pack.py` from the manuscript
 * data — the index, the cards and the score sheets restate what the printed
 * book says (players, time, age, materials, objective, page), and the boards
 * are the book's own vector diagrams scaled to a Letter sheet. Nothing here
 * reveals a game's full rules; the book stays the product.
 *
 * Files live in /public/companion/world-games/ and are regenerated, never
 * hand-edited. The manifest next to them carries the measured page counts.
 */
const WORLD_GAMES: Companion = {
  slug: "world-games",
  bookSlug: "the-great-book-of-world-games",
  bookTitle: "The Great Book of World Games",
  state: "book-available",
  stateNote:
    "The book is on sale: paperback, hardcover and Kindle on Amazon, and a " +
    "DRM-free PDF here. Everything on this page is free either way.",
  intro:
    "Thirty-one printable boards drawn from the book's own diagrams — the Royal " +
    "Game of Ur, Senet, Hnefatafl, Nine Men's Morris and twenty-seven more, each " +
    "scaled up to fill a Letter sheet — with a one-glance index of all fifty-six " +
    "games, cut-out reference cards and score sheets. Free, no sign-up.",
  calloutLabel:
    "Thirty-one printable boards — the Royal Game of Ur, Senet, Hnefatafl and " +
    "the rest — plus a game index, cut-out reference cards and score sheets.",
  newsletterSource: "world-games-companion",
  assetsHeading: "Table-side material",
  rightsNote:
    "Everything on this page is Valice Press's own work, generated from the " +
    "book's manuscript data: the boards are the book's own vector diagrams, and " +
    "the cards and index restate the book's player counts, times, ages and " +
    "page numbers. The full rules and the stories stay in the book.",
  assets: [
    {
      id: "boards-pack",
      title: "Boards pack",
      description:
        "Thirty-one boards, one to a page and scaled up to fill a Letter " +
        "sheet: the Royal Game of Ur and Senet, Hnefatafl and Tablut, Nine " +
        "Men's Morris, Pachisi, Patolli, Yut Nori and the rest. Print on card " +
        "or slip the page under glass, add counters, and the game is ready to " +
        "play. The boards whose rules are a modern reconstruction rather than " +
        "a surviving rulebook are marked as such on the page.",
      kind: "static",
      href: "/companion/world-games/boards-pack.pdf",
      meta: "PDF · US Letter · 32 pages",
    },
    {
      id: "game-index",
      title: "Game index",
      description:
        "Every game in the book on three pages: players, time, age, where it " +
        "comes from and the page it starts on, in the book's own order. Use it " +
        "to pick tonight's game before you open the book.",
      kind: "static",
      href: "/companion/world-games/game-index.pdf",
      meta: "PDF · US Letter · 3 pages",
    },
    {
      id: "quick-reference-cards",
      title: "Quick-reference cards",
      description:
        "One cut-out card for each of the fifty-six games, with the players, " +
        "time, age, materials and the objective, and the page where the full " +
        "rules are. Four to a sheet with cut lines, so nobody has to hold the " +
        "book open at the table.",
      kind: "static",
      href: "/companion/world-games/quick-reference-cards.pdf",
      meta: "PDF · US Letter · 14 pages",
    },
    {
      id: "score-sheets",
      title: "Score sheets",
      description:
        "A general score grid for two to six players, a match record, and " +
        "tally sheets for the games whose rules actually call for a count. " +
        "Print as many as you need.",
      kind: "static",
      href: "/companion/world-games/score-sheets.pdf",
      meta: "PDF · US Letter · 8 pages",
    },
  ],
};

/**
 * ── THE PUZZLES OF HENRY DUDENEY ──────────────────────────────────────────
 *
 * Valice Classics 2. Built 2026-09-02 and on sale the same day, after the
 * Founder signed Gates 2, 5, 8 and 12. The companion went live first, as the
 * series rule says: the puzzle sheets are Dudeney's own public-domain text and figures,
 * the hints booklet is Valice Press's editorial apparatus. Neither contains
 * a solution. Files are generated by the book project's
 * `BUILD/build_companion.py` into /public/companion/dudeney/.
 */
const DUDENEY: Companion = {
  slug: "dudeney",
  bookSlug: "the-puzzles-of-henry-dudeney",
  bookTitle: "The Puzzles of Henry Dudeney",
  // On sale since 2026-09-02: the direct ebook (PDF + EPUB) at $9.99. The
  // paperback follows when the Founder has a proof in hand.
  state: "book-available",
  stateNote:
    "The book is on sale here as a DRM-free PDF and EPUB. The puzzle sheets " +
    "and the hints on this page are free and stand on their own; the " +
    "solutions are in the book.",
  intro:
    "Free material for Henry Dudeney's puzzles: twelve puzzles to work on paper, " +
    "in his own words and with his own figures, and a hint for every one of the " +
    "110 puzzles in the Valice edition.",
  newsletterSource: "dudeney-companion",
  assetsHeading: "Puzzle material",
  rightsNote:
    "Dudeney's puzzle texts and figures are in the public domain (he died in " +
    "1930; the sources are Project Gutenberg #16713 and #27635). The hints are " +
    "Valice Press's own writing. Nothing on this page gives an answer.",
  assets: [
    {
      id: "puzzle-sheets",
      title: "Twelve puzzle sheets",
      description:
        "Twelve of the book's puzzles, one to a Letter page in Dudeney's own " +
        "words with the original figure and room to work. No answers on the " +
        "sheet.",
      kind: "static",
      href: "/companion/dudeney/puzzle-sheets.pdf",
      meta: "PDF · US Letter · 13 pages",
    },
    {
      id: "hints",
      title: "Hints booklet",
      description:
        "One hint for every one of the 110 puzzles, numbered as in the book. " +
        "A hint says where to look and never gives the answer.",
      kind: "static",
      href: "/companion/dudeney/hints.pdf",
      meta: "PDF · US Letter · 7 pages",
    },
  ],
};


/**
 * ── THE GREAT BOOK OF WORLD MYTHS ─────────────────────────────────────────
 *
 * The strongest companion case in the catalogue, and until 2026-09-03 the
 * one that did not exist: the book already carries a hand-drawn world map,
 * a card per culture, a sourced pronunciation guide and a Who's Who, and its
 * buyers are parents and teachers, who print things. Every file is generated
 * by the book project's `04_BUILD/companion_pack.py` from the same research
 * indexes the interior is typeset from; the page numbers are measured from
 * the built paperback. No retelling is reproduced — the stories stay in the
 * book. Files live in /public/companion/world-myths/.
 */
const WORLD_MYTHS: Companion = {
  slug: "world-myths",
  bookSlug: "the-great-book-of-world-myths",
  bookTitle: "The Great Book of World Myths",
  state: "book-available",
  stateNote:
    "The book is on sale: paperback, hardcover and Kindle on Amazon, and a " +
    "DRM-free PDF here. Everything on this page is free either way.",
  intro:
    "Free material for the book: the twenty-two-culture map at full size, a " +
    "cut-out card for every culture, every pronunciation in one list, and a " +
    "Who's Who of every god, hero and monster with the page to find them on.",
  newsletterSource: "world-myths-companion",
  assetsHeading: "Classroom and table material",
  rightsNote:
    "Everything on this page is Valice Press's own work, generated from the " +
    "book's research indexes: the map and the culture vignettes are the " +
    "book's own artwork, and the cards, names and Who's Who restate the " +
    "book's own back matter. The stories themselves stay in the book.",
  assets: [
    {
      id: "world-map",
      title: "The world map, full size",
      description:
        "The book's hand-drawn twenty-two-culture map on one landscape sheet, " +
        "with the same numbered markers and key as the opening spread. Pin it " +
        "up beside the book.",
      kind: "static",
      href: "/companion/world-myths/world-map.pdf",
      meta: "PDF · US Letter landscape · 1 page",
    },
    {
      id: "culture-cards",
      title: "Culture cards",
      description:
        "Twenty-two cut-out cards, two to a sheet: who tells each culture's " +
        "stories, where they are set, what survives of them today, and the " +
        "stories from that culture in the book with their page numbers.",
      kind: "static",
      href: "/companion/world-myths/culture-cards.pdf",
      meta: "PDF · US Letter · 11 pages",
    },
    {
      id: "say-these-names",
      title: "Say these names",
      description:
        "Every pronunciation in the book in one alphabetical list, with the " +
        "story each name comes from. Capitals mark the stressed syllable.",
      kind: "static",
      href: "/companion/world-myths/say-these-names.pdf",
      meta: "PDF · US Letter · 5 pages",
    },
    {
      id: "whos-who",
      title: "Who's who",
      description:
        "Every god, hero, monster and mortal with a glossary entry, " +
        "alphabetically: what they are, their other names, and the story and " +
        "page where each appears.",
      kind: "static",
      href: "/companion/world-myths/whos-who.pdf",
      meta: "PDF · US Letter · 4 pages",
    },
  ],
};

/**
 * ── CODEX BESTIARIUM ──────────────────────────────────────────────────────
 *
 * A reference book earns a printable reference sheet. The four files are the
 * book's own four indexes — Thompson motif codes, creatures, kin families,
 * traditions — generated by `08_BUILD/companion_pack.py` from
 * 01_SOURCE/spec.json and indexes.json, page numbers included. Nobody else
 * publishes a printable motif index for a bestiary. No entry text is
 * reproduced. Files live in /public/companion/codex-bestiarium/.
 */
const CODEX_BESTIARIUM: Companion = {
  slug: "codex-bestiarium",
  bookSlug: "codex-bestiarium",
  bookTitle: "Codex Bestiarium",
  state: "book-available",
  stateNote:
    "The book is on sale: paperback, hardcover, large print and Kindle on " +
    "Amazon, and a DRM-free PDF here. Everything on this page is free either way.",
  intro:
    "Free reference sheets for the bestiary: the Thompson motif index, an " +
    "alphabetical creature index with pronunciations and pages, the eight " +
    "kin families, and the forty traditions — the book's own indexes, " +
    "printable.",
  newsletterSource: "codex-bestiarium-companion",
  assetsHeading: "Reference sheets",
  rightsNote:
    "Everything on this page is Valice Press's own work, generated from the " +
    "book's research data. Motif codes follow the Motif-Index of " +
    "Folk-Literature, a scholarly classification; the entries themselves " +
    "stay in the book.",
  assets: [
    {
      id: "motif-index",
      title: "Motif index",
      description:
        "Every Thompson motif code the book cites, in index order, with the " +
        "creatures filed under each code and their page numbers. Take a code " +
        "to the Motif-Index and the regional collections open up.",
      kind: "static",
      href: "/companion/codex-bestiarium/motif-index.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
    {
      id: "creature-index",
      title: "Creature index",
      description:
        "All 112 creatures in one alphabetical list: how to say the name, " +
        "class, tradition, kin family, other names, and the page.",
      kind: "static",
      href: "/companion/codex-bestiarium/creature-index.pdf",
      meta: "PDF · US Letter · 4 pages",
    },
    {
      id: "kin-chart",
      title: "Kin chart",
      description:
        "The eight kin families — one image told by several traditions that " +
        "never met — with every member, its tradition and page, and how the " +
        "tellings diverge.",
      kind: "static",
      href: "/companion/codex-bestiarium/kin-chart.pdf",
      meta: "PDF · US Letter · 1 page",
    },
    {
      id: "traditions-index",
      title: "Traditions index",
      description:
        "The forty traditions with their creatures, each creature's class and page.",
      kind: "static",
      href: "/companion/codex-bestiarium/traditions-index.pdf",
      meta: "PDF · US Letter · 1 page",
    },
  ],
};

/**
 * ── CODEX MYTHOLOGICA ─────────────────────────────────────────────────────
 *
 * The widest audience and the least obvious free artefact — until the
 * book's own tags are read as an index. Its seventy-six myths carry theme
 * tags (the underworld, sacrifice, creation, the trickster…); sorted by
 * theme they become the comparative reading tool the book is built for.
 * Generated by `08_BUILD/companion_pack.py` from 01_SOURCE/book-edited.json,
 * page numbers measured from the built paperback. The Kindle edition is in
 * KDP Select until 2026-11-03, so no ebook is sold here — the note says so.
 * Files live in /public/companion/codex-mythologica/.
 */
const CODEX_MYTHOLOGICA: Companion = {
  slug: "codex-mythologica",
  bookSlug: "codex-mythologica",
  bookTitle: "Codex Mythologica",
  state: "book-available",
  stateNote:
    "The book is on sale on Amazon: paperback, hardcover, large print and " +
    "Kindle. Its ebook is not sold here. Everything on this page is free either way.",
  intro:
    "Free reading material for the book: the nineteen traditions with every " +
    "myth and its page, and the seventy-six myths re-sorted by theme so one " +
    "question — the underworld, the trickster, creation — can be followed " +
    "across the traditions that asked it.",
  newsletterSource: "codex-mythologica-companion",
  assetsHeading: "Reading material",
  rightsNote:
    "Everything on this page is Valice Press's own work, generated from the " +
    "book's own manuscript data: titles, subtitles, epochs and theme tags. " +
    "The retellings stay in the book.",
  assets: [
    {
      id: "reading-companion",
      title: "Reading companion",
      description:
        "The nineteen traditions in the book's order, each with its epoch, " +
        "the book's own one-line description, and every myth from that " +
        "tradition with its subtitle and page.",
      kind: "static",
      href: "/companion/codex-mythologica/reading-companion.pdf",
      meta: "PDF · US Letter · 4 pages",
    },
    {
      id: "theme-index",
      title: "Theme index",
      description:
        "The seventy-six myths re-sorted by theme, most-shared first, each " +
        "line with its tradition and page — the list for reading cultures " +
        "that never met side by side.",
      kind: "static",
      href: "/companion/codex-mythologica/theme-index.pdf",
      meta: "PDF · US Letter · 14 pages",
    },
  ],
};

/**
 * ── THE MYTH HUNTER'S FIELD BOOK ──────────────────────────────────────────
 *
 * A write-in book whose answer key is printed inside it, so the companion is
 * not an answer service: it is what a family needs to FINISH the book. A
 * quest log of all 120 pages with tick boxes and seal rings, cut-out cards
 * for the twenty-two peoples, and a spare completion certificate for the
 * second child who shares the copy. Generated by `04_BUILD/companion_pack.py`
 * from book.json and the 01_SOURCE indexes, page numbers measured from the
 * built paperback. No answer and no seal word appears in any file — printing
 * a seal word would remove the book's only self-check. Files live in
 * /public/companion/myth-hunters-field-book/.
 */
const MYTH_HUNTERS: Companion = {
  slug: "myth-hunters-field-book",
  bookSlug: "the-myth-hunters-field-book",
  bookTitle: "The Myth Hunter's Field Book",
  state: "book-available",
  stateNote:
    "The book is on sale as a paperback on Amazon. It is a write-in book, so " +
    "there is no ebook. Everything on this page is free.",
  intro:
    "Free material for finishing the book: a quest log of all 120 pages with " +
    "tick boxes and a ring for each region's seal, cut-out cards for the " +
    "twenty-two peoples on the route, and a spare Field Researcher " +
    "certificate. No answers are printed here — they are in the book.",
  newsletterSource: "myth-hunters-companion",
  assetsHeading: "Expedition material",
  rightsNote:
    "Everything on this page is Valice Press's own work, generated from the " +
    "book's manuscript data: mission lines, page numbers and the route. " +
    "No answer and no seal word appears in any file.",
  assets: [
    {
      id: "quest-log",
      title: "Quest log",
      description:
        "The whole route on six sheets: every page in book order with its " +
        "mission line, page number and a box to tick, the star-box pages " +
        "marked, and a ring to draw each region's seal into.",
      kind: "static",
      href: "/companion/myth-hunters-field-book/quest-log.pdf",
      meta: "PDF · US Letter · 6 pages",
    },
    {
      id: "culture-cards",
      title: "Culture cards",
      description:
        "Twenty-two cut-out cards, one per people the route meets, in route " +
        "order: name, region, whether the tradition is living today, and " +
        "which pages in the book are theirs.",
      kind: "static",
      href: "/companion/myth-hunters-field-book/culture-cards.pdf",
      meta: "PDF · US Letter · 4 pages",
    },
    {
      id: "field-researcher-certificate",
      title: "Spare certificate",
      description:
        "A clean copy of the Field Researcher certificate from the back of " +
        "the book, with the six seal rings — for a second reader sharing the " +
        "book, or a second run through it.",
      kind: "static",
      href: "/companion/myth-hunters-field-book/field-researcher-certificate.pdf",
      meta: "PDF · US Letter · 1 page",
    },
  ],
};

/**
 * ── EPICTETUS: THE DISCOURSES AND ENCHIRIDION ─────────────────────────────
 *
 * Valice Classics 3, built 2026-09-04 as Book 1 of the public-domain factory's
 * Phase 1. The book is NOT on sale: Gate 2 (rights) is prepared but unsigned
 * and no Paddle product exists, so the state below is honest about that.
 *
 * The companion is deliberately independent of the book's sale state, which is
 * the standing rule in this file: a QR printed in a paperback is permanent and
 * must never 404. All four assets here are built from the same content files as
 * the book and stand on their own — the Enchiridion is public domain in full,
 * and the glossary, reading paths and concordance are Valice's own writing.
 */
const EPICTETUS: Companion = {
  slug: "epictetus",
  bookSlug: "epictetus-discourses-and-enchiridion",
  bookTitle: "Epictetus: The Discourses and Enchiridion",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built and validated but not yet on sale — the " +
    "rights gate is signed by a person, not a script, and that signature is " +
    "outstanding. Everything on this page is free and works today regardless.",
  intro:
    "Free material for Epictetus: the complete Enchiridion to print, the " +
    "eighteen working terms on one sheet, four ways into the Discourses, and " +
    "the passages where Long's two translations touch.",
  newsletterSource: "epictetus-companion",
  assetsHeading: "Reading material",
  rightsNote:
    "Epictetus died around 135 and George Long, whose translation this is, " +
    "died in 1879, so the text on these sheets is in the public domain " +
    "everywhere (source: Project Gutenberg #10661). The glossary, the reading " +
    "paths and the concordance are Valice Press's own writing.",
  assets: [
    {
      id: "enchiridion-card",
      title: "The Enchiridion, complete",
      description:
        "All fifty-two chapters of Arrian's handbook in George Long's 1877 " +
        "translation, set two columns to a page. The whole of Stoicism's " +
        "best-known short text, free to print and keep.",
      kind: "static",
      href: "/companion/epictetus/enchiridion-card.pdf",
      meta: "PDF · US Letter · 7 pages",
    },
    {
      id: "glossary-sheet",
      title: "The working terms",
      description:
        "The eighteen words Epictetus uses technically and English hides — " +
        "will, appearance, assent, preconception, the ruling faculty — each " +
        "with Long's own rendering and where to find it.",
      kind: "static",
      href: "/companion/epictetus/glossary-sheet.pdf",
      meta: "PDF · US Letter · 1 page",
    },
    {
      id: "reading-paths",
      title: "Four ways in",
      description:
        "Where to start depending on why you picked the book up, with the " +
        "chapter numbers so it works with any edition, and what is in each of " +
        "the seven thematic parts.",
      kind: "static",
      href: "/companion/epictetus/reading-paths.pdf",
      meta: "PDF · US Letter · 1 page",
    },
    {
      id: "concordance",
      title: "What Marcus Aurelius read",
      description:
        "Marcus thanks Junius Rusticus for lending him Epictetus. George Long " +
        "translated both books and marked where they touch. Four passages " +
        "verified present, and the two Long cites that are not in his own " +
        "selection — listed, because a table that hides its gaps is worth less.",
      kind: "static",
      href: "/companion/epictetus/concordance.pdf",
      meta: "PDF · US Letter · 1 page",
    },
  ],
};

/**
 * ── GAMES ANCIENT AND ORIENTAL ────────────────────────────────────────────
 *
 * Valice Classics 8, built 2026-09-05 as Book 1 of the public-domain factory's
 * Phase 2 — the first Valice edition made from a SCAN rather than from a
 * proof-read transcription.
 *
 * The boards are the point of this companion. Falkener's complaint about two
 * centuries of antiquarian scholarship was that the game was never played; the
 * one thing a reader of this edition can do that his readers could not is print
 * the board and play on it. They are drawn by the same code path as the figures
 * in the book, so the sheet and the diagram cannot disagree, and each carries
 * the same EVIDENCE or RECONSTRUCTION mark.
 */
/**
 * Korean Games (Culin, 1895) — Valice Classics 9.
 *
 * Culin recorded these games from people who were playing them, and then the
 * diagrams that would let a reader play went into plates and text figures this
 * edition cannot reproduce: he names two of his artists — Ki San, the Korean
 * painter Kim Chun-gŭn, and Teotiku Morimoto — and no death year is recoverable
 * for either. So the boards here are drawn from his descriptions by the same
 * code path as the figures in the book, and the sheet and the diagram cannot
 * disagree. The spellings card is peculiar to this book: a reader who wants to
 * look anything up has to get from Culin's tjyang-keui to the janggi the rest of
 * the world writes, and no edition of this text has ever supplied the bridge.
 */
/**
 * Chess and Playing Cards (Culin, 1898) — Valice Classics 10.
 *
 * A catalogue of a hundred and twenty objects that printed no index to itself. The
 * entry finder here is the index the 1898 volume never made: every entry with
 * Culin's own number and the page of the Report it stands on. The boards are drawn
 * from his descriptions by the same code path as the figures in the book, because
 * none of his fifty plates can be cleared — several are his own reuse of the Korean
 * Games artwork by Ki San, for whom no death year is recorded.
 */
const CHESS_AND_PLAYING_CARDS: Companion = {
  slug: "chess-and-playing-cards",
  bookSlug: "chess-and-playing-cards",
  bookTitle: "Chess and Playing Cards: The Chess, Divination and Card Collections",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built, validated and priced but not yet on sale — " +
    "creating the payment product is a live write that is held behind a " +
    "founder action. Everything on this page is free and works today regardless.",
  intro:
    "Free material for Culin's 1898 catalogue: three chessboards at playing size " +
    "to print, the nine forms of chess compared on one sheet, the register that " +
    "keeps his objects apart from his argument, and every entry listed with his " +
    "own numbers — the index the original never printed.",
  newsletterSource: "chess-and-playing-cards-companion",
  assetsHeading: "Print and play",
  rightsNote:
    "Stewart Culin died in 1929 and the 1898 United States imprint puts this text " +
    "in the public domain there on its own. None of the fifty plates or the text " +
    "figures is reproduced: several plates are Culin's own reuse of the artwork " +
    "made for Korean Games by Ki San — the Korean painter Kim Chun-gŭn — for whom " +
    "no death year is recorded, and the museum photographs and text figures are " +
    "unattributed. Every board on these sheets was drawn for this edition from the " +
    "descriptions in Culin's text.",
  assets: [
    {
      id: "boards",
      title: "Three chessboards to print and play on",
      description:
        "The Chinese board with its River and its two palaces, the Korean board " +
        "that rules the files straight across that River so the River is ignored, " +
        "and the Japanese board of nine squares each way. Drawn at playing size " +
        "from Culin's own counts. Coins or draughts will do for men.",
      kind: "static",
      href: "/companion/chess-and-playing-cards/boards.pdf",
      meta: "PDF · US Letter · 3 pages",
    },
    {
      id: "chess-compared",
      title: "Nine forms of chess, compared",
      description:
        "Chaturanga, the Maldive, Malay and Burmese games, the European, the " +
        "Chinese, the Korean and the Japanese — with the board, the men, and the " +
        "single structural decision that tells each of them apart. Drawn entirely " +
        "from Culin's own descriptions.",
      kind: "static",
      href: "/companion/chess-and-playing-cards/chess-compared.pdf",
      meta: "PDF · US Letter · 1 page",
    },
    {
      id: "register-card",
      title: "The Register of Object and Argument",
      description:
        "For each part of the catalogue: what the objects are, what Culin says " +
        "they show, what the claim actually rests on, and how to read the " +
        "difference. The instrument this edition is built around.",
      kind: "static",
      href: "/companion/chess-and-playing-cards/register-card.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
    {
      id: "entry-finder",
      title: "Every entry in the catalogue",
      description:
        "All seventy-six entries of this volume with Culin's own numbers and the " +
        "page of the 1898 Report each stands on. The 1898 volume printed a table " +
        "of contents and no index; this is the finding aid it never had.",
      kind: "static",
      href: "/companion/chess-and-playing-cards/entry-finder.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
  ],
};

const KOREAN_GAMES: Companion = {
  slug: "korean-games",
  bookSlug: "korean-games",
  bookTitle: "Korean Games: The Games of Chance and Divination",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built, validated and priced but not yet on sale — " +
    "creating the payment product is a live write that is held behind a " +
    "founder action. Everything on this page is free and works today regardless.",
  intro:
    "Free material for Culin's Korean games: three boards at playing size to " +
    "print, the bridge from his 1895 spellings to the ones in use today, the " +
    "register that keeps what he saw apart from what he concluded, and the " +
    "guide to what you can actually sit down and play.",
  newsletterSource: "korean-games-companion",
  assetsHeading: "Print and play",
  rightsNote:
    "Stewart Culin died in 1929 and W. H. Wilkinson, who wrote the chapter on " +
    "chess, died in 1930, so their text is in the public domain (source: " +
    "Internet Archive, koreangameswith00culigoog). None of the 1895 plates or " +
    "text figures is reproduced. Culin names two of his artists — Ki San, the " +
    "Korean painter Kim Chun-gŭn, and Teotiku Morimoto — and no death year is " +
    "recoverable for either; the remaining figures are unattributed. Every " +
    "board on these sheets was drawn for this edition from the descriptions in " +
    "Culin's text.",
  assets: [
    {
      id: "boards",
      title: "Three boards to print and play on",
      description:
        "The nyout board — twenty marks round a circle and an interior cross " +
        "of nine — the merrells board of twenty-four points, and the " +
        "five-by-five lattice of four-field kono, at playing size on US " +
        "Letter. Each carries the mark it carries in the book: EVIDENCE where " +
        "Culin describes the board, RECONSTRUCTION where the starting array is " +
        "this edition's reading. Coins or dried beans will do for men.",
      kind: "static",
      href: "/companion/korean-games/boards.pdf",
      meta: "PDF · US Letter · 4 pages",
    },
    {
      id: "spellings-card",
      title: "A Note on the Spellings",
      description:
        "Sixteen of Culin's words against Revised Romanisation and " +
        "McCune–Reischauer: nyout is yut, tjyang-keui is janggi, pa-tok is " +
        "baduk. The book keeps his spellings, because changing them would " +
        "quietly claim he wrote something he did not. This card is how you " +
        "look anything up.",
      kind: "static",
      href: "/companion/korean-games/spellings-card.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
    {
      id: "register-card",
      title: "The Register of Record and Inference",
      description:
        "For each of the six parts: what Culin records at first hand, what he " +
        "is told, what he concludes, and how to read the difference. He is a " +
        "careful observer and a bold theorist, and the two are not the same " +
        "instrument.",
      kind: "static",
      href: "/companion/korean-games/register-card.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
    {
      id: "how-to-play",
      title: "The playing guide",
      description:
        "Every game in the book a reader can actually sit down and play, with " +
        "what Culin leaves out said plainly — and a section on what cannot be " +
        "played from these pages at all, because a guide that lists only its " +
        "successes is advertising.",
      kind: "static",
      href: "/companion/korean-games/how-to-play.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
  ],
};

const GAMES_ANCIENT: Companion = {
  slug: "games-ancient-and-oriental",
  bookSlug: "games-ancient-and-oriental",
  bookTitle: "Games Ancient and Oriental: The Egyptian Games",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built, validated and priced but not yet on sale — " +
    "creating the payment product is a live write that is held behind a " +
    "founder action. Everything on this page is free and works today regardless.",
  intro:
    "Free material for Falkener's Egyptian games: three boards at playing " +
    "size to print, the register that separates the evidence from the " +
    "reconstruction, the terms, and the three timelines this volume keeps apart.",
  newsletterSource: "games-ancient-and-oriental-companion",
  assetsHeading: "Print and play",
  rightsNote:
    "Edward Falkener died in 1896 and Dr Samuel Birch, whose 1864 paper the " +
    "book prints, died in 1885, so their text is in the public domain " +
    "everywhere (source: Internet Archive, gamesancientorie00falkuoft). None " +
    "of the 1892 illustrations is reproduced. The line figures are unsigned " +
    "and no draughtsman is named for them; the colophon credits the " +
    "photographic plates to Owen Williams, photographer, of Laugharne, whose " +
    "dates are not recoverable. Every board on these sheets was drawn for " +
    "this edition from the descriptions in the text.",
  assets: [
    {
      id: "boards",
      title: "Three boards to print and play on",
      description:
        "The board of thirty compartments, Senat at five squares each way, " +
        "and the concentric rings of Hab em Han — at playing size, on US " +
        "Letter. Each carries the same mark it carries in the book: EVIDENCE " +
        "where an ancient source describes the board, RECONSTRUCTION where " +
        "Falkener inferred it. Counters or coins will do for men.",
      kind: "static",
      href: "/companion/games-ancient-and-oriental/boards.pdf",
      meta: "PDF · US Letter · 3 pages",
    },
    {
      id: "register-card",
      title: "The Register of Reconstructions",
      description:
        "For each of the three games: what the evidence shows, what Falkener " +
        "supplies, and what is known now — which in every case includes that " +
        "the rules are still not known. The instrument the book is built " +
        "around, on one sheet.",
      kind: "static",
      href: "/companion/games-ancient-and-oriental/register-card.pdf",
      meta: "PDF · US Letter · 1 page",
    },
    {
      id: "the-terms",
      title: "The terms",
      description:
        "The games, dynasties and seventeenth-century antiquaries Falkener " +
        "assumes you already know — sent, senet, mehen, latrunculi, Seega, " +
        "Hyde, Birch — with what each one is and, where it differs, what it " +
        "is called now.",
      kind: "static",
      href: "/companion/games-ancient-and-oriental/the-terms.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
    {
      id: "chronology",
      title: "Three timelines",
      description:
        "The Egyptian, which is deep and imprecise; the classical, which is " +
        "shallow and better dated; and the antiquarian, which runs from " +
        "Salmasius in 1620 to Falkener in 1892. Keeping them apart is most of " +
        "what makes the book readable.",
      kind: "static",
      href: "/companion/games-ancient-and-oriental/chronology.pdf",
      meta: "PDF · US Letter · 1 page",
    },
  ],
};

/**
 * ── SENECA: SELECTED DIALOGUES ────────────────────────────────────────────
 *
 * Valice Classics 4, built 2026-09-04 as Book 2 of the public-domain factory's
 * Phase 1. Not on sale: Gate 2 prepared but unsigned, no Paddle product.
 *
 * This book exists because the 2026-09-03 research pass found that the source
 * the previous candidate pool had chosen for Seneca — the Loeb/Gummere text —
 * could not be cleared: the pool recorded "Gummere d.1919" where 1919 was the
 * imprint year of one volume of a series whose next volume appeared in 1925.
 * Aubrey Stewart (d. 1918) is the verified substitute, and this companion's
 * material is drawn from his translation, which is clear everywhere.
 */
const SENECA: Companion = {
  slug: "seneca",
  bookSlug: "seneca-selected-dialogues",
  bookTitle: "Seneca: Selected Dialogues",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built and validated but not yet on sale — the " +
    "rights gate is signed by a person, not a script, and that signature is " +
    "outstanding. Everything on this page is free and works today regardless.",
  intro:
    "Free material for Seneca: On the Shortness of Life complete, a line on " +
    "every one of the seventy-nine chapters, the working terms on one sheet, " +
    "and four ways into the dialogues.",
  newsletterSource: "seneca-companion",
  assetsHeading: "Reading material",
  rightsNote:
    "Seneca died in 65 and Aubrey Stewart, whose translation this is, died in " +
    "1918, so the text on these sheets is in the public domain everywhere " +
    "(source: Project Gutenberg #64576). The argument map, the glossary and " +
    "the reading paths are Valice Press's own writing.",
  assets: [
    {
      id: "shortness-of-life",
      title: "On the Shortness of Life",
      description:
        "Seneca's most famous essay, complete and unabridged, in Aubrey " +
        "Stewart's 1889 translation. Twenty chapters on why life is not short " +
        "and we are simply wasteful with it.",
      kind: "static",
      href: "/companion/seneca/shortness-of-life.pdf",
      meta: "PDF · US Letter · 5 pages",
    },
    {
      id: "argument-map",
      title: "What is in every chapter",
      description:
        "Seneca wrote no headings; the chapter numbers were added by later " +
        "editors and tell you nothing. A line for each of the seventy-nine, so " +
        "you can find a passage again.",
      kind: "static",
      href: "/companion/seneca/argument-map.pdf",
      meta: "PDF · US Letter · 3 pages",
    },
    {
      id: "glossary-sheet",
      title: "The working terms",
      description:
        "The fourteen words Seneca uses technically and plain English hides — " +
        "happy, virtue, indifferent, leisure, the wise man — each with the " +
        "Latin and where to find it.",
      kind: "static",
      href: "/companion/seneca/glossary-sheet.pdf",
      meta: "PDF · US Letter · 1 page",
    },
    {
      id: "reading-paths",
      title: "Four ways in",
      description:
        "Where to start depending on why you picked Seneca up — including the " +
        "one for readers who want to know whether he can be trusted.",
      kind: "static",
      href: "/companion/seneca/reading-paths.pdf",
      meta: "PDF · US Letter · 1 page",
    },
  ],
};

/**
 * ── THE GREEK ALPHABET HANDWRITING WORKBOOK ───────────────────────────────
 *
 * Valice Script 2. Built 2026-09-04. The page exists before the book does,
 * which is the rule: the address `valicepress.com/companion/greek` is printed
 * on page 99 of an edition that cannot be edited once it is printed, so the
 * material behind it has to be there first and has to stay there.
 *
 * Every sheet is generated by the book project's `BUILD/build_companion.py`
 * from `BUILD/greek_data.py` — the same file the book itself is typeset from
 * — so the chart cannot drift from the book, and the stroke boxes cannot
 * teach an order the book does not.
 *
 * The stroke-boxes sheet is the one that justifies the page. The book has
 * room to drill each letter once; this is all forty-eight forms, one to a
 * page, with the start dots printed and the boxes empty. That is a thing a
 * reader reprints, not a thing they download once.
 */
const GREEK: Companion = {
  slug: "greek",
  bookSlug: "greek-alphabet-handwriting-workbook",
  bookTitle: "The Greek Alphabet Handwriting Workbook",
  // Not on sale anywhere yet: the paperback is built and packaged but not
  // uploaded, and the direct ebook waits on a Paddle price that cannot be
  // created from this environment. The page says so plainly rather than
  // showing a buy button that goes nowhere.
  state: "book-not-yet-available",
  stateNote:
    "The workbook is not on sale yet. Everything on this page is free and " +
    "works on its own \u2014 you do not need the book to use any of it.",
  intro:
    "Free practice material for learning to write the Greek alphabet by hand. " +
    "Reprint the grids as often as you like: handwriting is a volume exercise, " +
    "and one page of a bound book is never enough of it.",
  newsletterSource: "greek-companion",
  rightsNote:
    "Everything on this page is Valice Press's own work, generated from the " +
    "book's own data. The letterforms are set in DejaVu Sans, a Bitstream Vera " +
    "derivative that may be redistributed; the stroke marks are drawn from " +
    "coordinates, not traced from anyone's diagram. Greek has no official " +
    "stroke-order standard, and the orders shown here are the ones the book " +
    "recommends, with their provenance printed in the book.",
  assets: [
    {
      id: "stroke-sheets",
      title: "Stroke-order practice sheets \u2014 all 53 forms",
      description:
        "One page for every form the book teaches \u2014 24 letters in both cases " +
        "and the five variants: the letter with its numbered stroke marks, the " +
        "same letter again for each stroke with the marks building up in order, " +
        "and then ruled lines carrying only the start dots. This is the drill " +
        "the book has room to do once and you will want to do twenty times.",
      kind: "static",
      href: "/companion/greek/stroke-sheets.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 53 pages",
    },
    {
      id: "practice-grid",
      title: "Four-line practice grid",
      description:
        "The book's own writing rule \u2014 four lines, so a \u03b2 has somewhere to put " +
        "its descender and a \u03a0 has somewhere to reach \u2014 blank, at four sizes from " +
        "large to word-sized. Works at any stage and for any letter.",
      kind: "static",
      href: "/companion/greek/practice-grid.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 4 pages",
    },
    {
      id: "alphabet-chart",
      title: "The alphabet on one page",
      description:
        "All 24 letters with their Greek names, their English names, what they " +
        "sound like, and the number of strokes in each case. One sheet, for the " +
        "wall next to the desk.",
      kind: "static",
      href: "/companion/greek/alphabet-chart.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "lesson-tracker",
      title: "Thirty-two-lesson progress tracker",
      description:
        "Every lesson with a box for each of the three passes the book asks for " +
        "\u2014 trace, dot-start, free. Pin it up and mark it off; it is the only " +
        "honest way to see whether you are practising or re-reading.",
      kind: "static",
      href: "/companion/greek/lesson-tracker.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
  ],
};

const CHINA_GODS: Companion = {
  slug: "china-gods",
  bookSlug: "myths-and-legends-of-china",
  bookTitle: "Myths and Legends of China: Volume One, The Gods",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built and validated but not yet on sale — the " +
    "rights gate is signed by a person, not a script, and that signature is " +
    "outstanding. Everything on this page is free and works today regardless.",
  intro:
    "Free material for Werner's Myths and Legends of China: the celestial " +
    "ministries on one sheet, the twenty-five figures with the chapters they " +
    "appear in, four ways into the book, and what the marks in the names mean.",
  newsletterSource: "china-gods-companion",
  assetsHeading: "Reading material",
  rightsNote:
    "E. T. C. Werner died in 1954, so his 1922 text is in the public domain " +
    "in the United States and, since 1 January 2025, in the UK, the EU and " +
    "Türkiye (source: Project Gutenberg #15250). The register, the glossary, " +
    "the reading paths and the note on the names are Valice Press's own " +
    "writing. The 1922 colour plates are not reproduced anywhere here: no " +
    "source names their artist, so they cannot be cleared.",
  assets: [
    {
      id: "ministries",
      title: "The ministries of heaven",
      description:
        "The Chinese gods hold posts. Thunder, the waters, fire, epidemics, " +
        "medicine, exorcism, smallpox and time are ministries with presidents " +
        "and staff. Werner catalogues them in a chapter this edition does not " +
        "print, so the register was rebuilt from the chapters it does — nine " +
        "ministries, the officers he names, and the chapter to read.",
      kind: "static",
      href: "/companion/china-gods/ministries.pdf",
      meta: "PDF · US Letter · 1 page",
    },
    {
      id: "who-is-who",
      title: "Who is who",
      description:
        "Twenty-five figures — P'an Ku, Shên I the archer, Lei Kung the Duke " +
        "of Thunder, the Eight Immortals — each with the chapters they appear " +
        "in and how often. Every reference was produced by searching the text, " +
        "so nothing points at a chapter that does not contain the name.",
      kind: "static",
      href: "/companion/china-gods/who-is-who.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
    {
      id: "reading-paths",
      title: "Four ways in",
      description:
        "Where to start depending on why you picked the book up, with Werner's " +
        "own chapter numbers so it works with any edition of the 1922 text, and " +
        "how long each of the eight chapters runs.",
      kind: "static",
      href: "/companion/china-gods/reading-paths.pdf",
      meta: "PDF · US Letter · 1 page",
    },
    {
      id: "the-names",
      title: "The names",
      description:
        "Wade-Giles has two marks that do most of the work and almost nobody " +
        "is told what they are for. Once you know that t' and t are different " +
        "consonants, several hundred names stop being noise.",
      kind: "static",
      href: "/companion/china-gods/the-names.pdf",
      meta: "PDF · US Letter · 1 page",
    },
  ],
};

const VEDIC_GODS: Companion = {
  slug: "vedic-gods",
  bookSlug: "indian-myth-and-legend",
  bookTitle: "Indian Myth and Legend: Volume One, The Vedic Gods",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built and validated but not yet on sale \u2014 the " +
    "rights gate is signed by a person, not a script, and that signature is " +
    "outstanding. Everything on this page is free and works today regardless.",
  intro:
    "Free material for Mackenzie's Indian Myth and Legend: which of his " +
    "comparisons still stand, the thirty-two figures with the chapters they " +
    "appear in, four ways into the book, and how to read the Sanskrit names.",
  newsletterSource: "vedic-gods-companion",
  assetsHeading: "Reading material",
  rightsNote:
    "Donald A. Mackenzie died in 1936, so his 1913 text is in the public " +
    "domain in the United States and, since 1 January 2007, in the UK, the EU " +
    "and T\u00fcrkiye (source: Project Gutenberg #47228). The register, the " +
    "who's-who, the reading paths and the note on the names are Valice " +
    "Press's own writing. None of the 1913 illustrations is reproduced: two of " +
    "those in these chapters are paintings by Nandalal Bose, who died in 1966 " +
    "and whose work is still in copyright, and the rest name no creator at all.",
  assets: [
    {
      id: "comparisons",
      title: "Which comparisons still stand",
      description:
        "Mackenzie compares Indra to Thor, Agni to Heimdal and half the " +
        "pantheon to something Babylonian, in the same tone whether the " +
        "parallel is a proven cognate or a theory nobody now defends. Four " +
        "kinds, graded by how much weight each will bear.",
      kind: "static",
      href: "/companion/vedic-gods/comparisons.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "who-is-who",
      title: "Who is who",
      description:
        "Thirty-two gods, demons and mortals \u2014 Indra, Agni, Varuna, Yama " +
        "who was the first man, the dragon Vritra \u2014 each with the chapters " +
        "they appear in and how often. Note that there are two Savitris: a " +
        "solar deity and a princess, and they are not the same figure.",
      kind: "static",
      href: "/companion/vedic-gods/who-is-who.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 2 pages",
    },
    {
      id: "reading-paths",
      title: "Four ways in",
      description:
        "Where to start depending on why you picked the book up, with " +
        "Mackenzie's own chapter numbers so it works with any edition of the " +
        "1913 text, and how long each of the five chapters runs.",
      kind: "static",
      href: "/companion/vedic-gods/reading-paths.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "the-names",
      title: "The names",
      description:
        "Sanskrit has three s-sounds, a set of long vowels Mackenzie usually " +
        "does not mark, and a final -a that is pronounced. Four things worth " +
        "knowing before several hundred proper names start arriving.",
      kind: "static",
      href: "/companion/vedic-gods/the-names.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
  ],
};

const THE_DRAGON: Companion = {
  slug: "the-dragon",
  bookSlug: "mythical-monsters",
  bookTitle: "Mythical Monsters: Volume One, The Dragon",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built and validated but not yet on sale \u2014 the " +
    "rights gate is signed by a person, not a script, and that signature is " +
    "outstanding. Everything on this page is free and works today regardless.",
  intro:
    "Free material for Gould's Mythical Monsters: six of his claims set " +
    "against what is actually established, his sources graded from the Shan " +
    "Hai King to the Straits Times, the dragon vocabulary, and three ways in.",
  newsletterSource: "the-dragon-companion",
  assetsHeading: "Reading material",
  rightsNote:
    "Charles Gould died in 1893, so his 1886 text has been in the public " +
    "domain everywhere Valice sells since 1 January 1964 (source: Project " +
    "Gutenberg #40972). The register of claims, the graded source list, the " +
    "glossary and the reading paths are Valice Press's own writing. None of " +
    "the 1886 figures is reproduced: the book names no illustrator, so they " +
    "cannot be cleared.",
  assets: [
    {
      id: "claims",
      title: "Six claims, and what is actually known",
      description:
        "Gould believed dragons were real animals. His prose is equally " +
        "confident whether he is reporting a text, reporting a fact, or " +
        "drawing a conclusion, and he never marks the transitions. This sheet " +
        "sets six of his claims beside what is established, and says which is " +
        "which.",
      kind: "static",
      href: "/companion/the-dragon/claims.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "sources",
      title: "His sources, graded",
      description:
        "The Chinese classics, which are genuinely old and honestly used; the " +
        "classical authors, mostly quoting one another; the Renaissance " +
        "naturalists, compiling from those; and the Victorian newspapers, " +
        "which are not evidence of anything.",
      kind: "static",
      href: "/companion/the-dragon/sources.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "vocabulary",
      title: "The dragon vocabulary",
      description:
        "Eighteen terms \u2014 lung and ying-lung, the Shan Hai King and the " +
        "Yih King, the real gliding lizard Draco that Gould presses into " +
        "service \u2014 each with the chapters it appears in.",
      kind: "static",
      href: "/companion/the-dragon/vocabulary.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "reading-paths",
      title: "Three ways in",
      description:
        "Where to start, with Gould's own chapter numbers so it works with any " +
        "edition of the 1886 text \u2014 including the twenty-minute route for " +
        "readers who want the measure of the book before committing to it.",
      kind: "static",
      href: "/companion/the-dragon/reading-paths.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
  ],
};


/**
 * Roadmap book 4 — Codex Mythologica: The Puzzle Book (2026-09-05).
 *
 * The brief for this one said, in as many words, do not make a marketing page.
 * So it carries four things a reader would actually come back for: ten puzzles
 * that are NOT in the book, every hint in the book as a printable card set,
 * the eighteen filled grids, and an answer checker that works without the page
 * being a list of answers anybody can read by opening it.
 *
 * The ten extra puzzles went through the same gate the hundred in the book did
 * — each solved by a program that saw only what is printed, each to exactly one
 * answer. A free sample that is wrong tells a reader what the paid book is
 * like.
 */
const CODEX_PUZZLES: Companion = {
  slug: "codex-puzzles",
  bookSlug: "codex-mythologica-the-puzzle-book",
  bookTitle: "Codex Mythologica: The Puzzle Book",
  // Built end to end on 2026-09-05 and not uploaded to KDP; the direct ebook
  // needs a Paddle price. The page says so rather than showing a buy button
  // that goes nowhere — and it exists from today, because the QR code printed
  // inside the book will outlive every commercial state the book is ever in.
  state: "book-not-yet-available",
  stateNote:
    "The book is not on sale yet. Everything on this page is free and works " +
    "on its own \u2014 the ten puzzles here are not in the book, so you can do " +
    "them without owning it.",
  intro:
    "Ten more puzzles, every hint from the book, the filled grids, and a " +
    "checker that will tell you whether you have an answer right.",
  newsletterSource: "codex-puzzles-companion",
  assetsHeading: "Puzzles, hints and answers",
  rightsNote:
    "Everything here is Valice Press's own work. The puzzles are generated " +
    "from the editorial apparatus of CODEX MYTHOLOGICA and CODEX BESTIARIUM " +
    "\u2014 which civilization a myth is filed under, which class a creature is " +
    "in \u2014 both of which this press wrote and publishes. The mythological " +
    "facts themselves belong to the traditions they come from and are not " +
    "claimed by anybody. Where a sentence is quoted it is quoted whole and " +
    "attributed to the story it came from.",
  assets: [
    {
      id: "extra-puzzles",
      title: "Ten more puzzles \u2014 not in the book",
      description:
        "Four ciphers, three deductions, a word fit, a word search and a " +
        "picture, numbered 101 to 110 so you can tell them from the hundred " +
        "in the book. Answers at the back. Each one was solved by a program " +
        "that saw only the printed page and had to reach exactly one answer, " +
        "which is the same gate the book's hundred went through.",
      kind: "static",
      href: "/companion/codex-puzzles/extra-puzzles.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 12 pages",
    },
    {
      id: "hint-cards",
      title: "Every hint, in three passes",
      description:
        "All three hundred and thirty hints \u2014 the hundred puzzles in the " +
        "book and the ten here \u2014 printed the way the book prints them: every " +
        "first hint, then every second, then every third. Looking up the first " +
        "hint for puzzle sixty-one does not put the third one in front of you.",
      kind: "static",
      href: "/companion/codex-puzzles/hint-cards.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 13 pages",
    },
    {
      id: "solution-grids",
      title: "The filled grids",
      description:
        "Eleven word fits and nine pictures, solved. These are the answers a " +
        "sentence cannot carry, and printing them is the only honest way to " +
        "give them.",
      kind: "static",
      href: "/companion/codex-puzzles/solution-grids.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 6 pages",
    },
  ],
};

const MANCALA: Companion = {
  slug: "mancala",
  bookSlug: "mancala",
  bookTitle: "Mancala, the National Game of Africa",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built, validated and priced but not yet on sale — " +
    "creating the payment product is a live write that is held behind a " +
    "founder action. Everything on this page is free and works today regardless.",
  intro:
    "Free material for Culin's 1894 paper: two boards at playing size to print, " +
    "all three complete games on a single sheet you can keep beside the board, " +
    "the register that separates what he watched from what he was told, and " +
    "every one of the twenty-two illustrations he published listed with the " +
    "provenance he recorded for it.",
  newsletterSource: "mancala-companion",
  assetsHeading: "Print and play",
  rightsNote:
    "Stewart Culin died in 1929 and the 1896 United States imprint puts this " +
    "text in the public domain there on its own. None of the paper's five " +
    "plates or fifteen text figures is reproduced: no photographer and no " +
    "draughtsman is named for any of them, so nothing on this page is taken " +
    "from them. Both boards were drawn for this edition from the counts in " +
    "Culin's own text — fourteen holes and ninety-eight counters for the " +
    "Syrian games, four rows for Chuba.",
  assets: [
    {
      id: "boards",
      title: "Two mancala boards to print and play on",
      description:
        "The two-row board of fourteen holes for the Syrian games, and the " +
        "four-row board for Chuba. Drawn at playing size, with cups large " +
        "enough to hold a stack of coins. Beans, coins or shells will do for " +
        "counters; the game has always been played with whatever was to hand.",
      kind: "static",
      href: "/companion/mancala/boards.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 2 pages",
    },
    {
      id: "how-to-play",
      title: "All three games, on one sheet",
      description:
        "La'b madjnuni — the crazy game, whose result is fixed by the opening " +
        "layout — its companion la'b akila, and Chuba. Culin sets his rules " +
        "out as prose in the middle of an argument; here they are set out to " +
        "be played from, and every place he leaves something unsaid says so.",
      kind: "static",
      href: "/companion/mancala/how-to-play.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "register-card",
      title: "A Register of Record and Inference",
      description:
        "What Culin watched in Washington Street, what a lad from Damascus " +
        "told him, what he read in Lane and Hyde, and what he concluded from " +
        "the three — kept apart on one page. A short paper moves between them " +
        "inside a single sentence, which is exactly when it matters.",
      kind: "static",
      href: "/companion/mancala/register-card.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "the-objects",
      title: "The objects he figured",
      description:
        "All twenty-two captions from the illustrations this edition does not " +
        "reproduce, in Culin's own wording, with the museum numbers and the " +
        "provenance he recorded — a catalogue of the boards a curator could " +
        "put his hands on in Philadelphia in 1894.",
      kind: "static",
      href: "/companion/mancala/the-objects.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
  ],
};

const TRADITIONAL_GAMES: Companion = {
  slug: "traditional-games",
  bookSlug: "traditional-games",
  bookTitle: "The Singing Games of England, Scotland, and Ireland",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built, validated and priced but not yet on sale — " +
    "creating the payment product is a live write that is held behind a " +
    "founder action, and the paperback has not been uploaded to KDP. " +
    "Everything on this page is free and works today regardless.",
  intro:
    "Free material for Alice Gomme's 1894 singing games: eight tunes engraved " +
    "large enough to prop on a piano, those eight games set out to be played " +
    "from, the register that keeps what she collected apart from what she " +
    "concluded, and the gazetteer of every county and collector named in the " +
    "volume.",
  newsletterSource: "traditional-games-companion",
  assetsHeading: "Print and sing",
  rightsNote:
    "Alice Bertha Gomme died on 5 January 1938 and this work has been in the " +
    "public domain everywhere since the end of 2008; the 1894 British imprint " +
    "puts it there in the United States on its own. Every stave on these sheets " +
    "was engraved for this edition from the notes — pitch and duration — and " +
    "not one is a photograph or a tracing of her printed page. The drawings in " +
    "the 1894 volumes, which are by J. P. Emslie, are not reproduced here: he " +
    "died in 1913 and his work is out of copyright, but this edition draws its " +
    "own rather than reprinting his.",
  assets: [
    {
      id: "tunes",
      title: "Eight tunes to sing them to",
      description:
        "The melodies of the eight games in the playing guide — Nuts in May, " +
        "Hark the Robbers, Green Gravel, Jenny Jones, the Mulberry Bush, " +
        "Milking Pails, London Bridge and the Jolly Miller — engraved from the " +
        "notes Gomme took down from the children, at a size you can read at " +
        "arm's length.",
      kind: "static",
      href: "/companion/traditional-games/tunes.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 3 pages",
    },
    {
      id: "how-to-play",
      title: "How to play eight of them",
      description:
        "The same eight games set out to be played from rather than read " +
        "about: how many players, what shape they stand in, what each verse " +
        "is for and how the game ends. Drawn entirely from Gomme's own " +
        "descriptions, with every place she leaves something unstated marked.",
      kind: "static",
      href: "/companion/traditional-games/how-to-play.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 3 pages",
    },
    {
      id: "register-card",
      title: "A Register of Collection and Conjecture",
      description:
        "What Gomme collected, what she was told, what she concluded, and how " +
        "to tell the three apart — class by class, on one sheet. The " +
        "instrument the edition is built around, and the thing that makes a " +
        "Victorian folklorist's book usable now.",
      kind: "static",
      href: "/companion/traditional-games/register-card.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 2 pages",
    },
    {
      id: "gazetteer",
      title: "Where the games were sung",
      description:
        "Every county and country named under a version or a tune in the " +
        "forty-three games, with the games recorded there, and the collectors " +
        "who sent the most. Built by reading the 296 attribution lines Gomme " +
        "printed under her versions.",
      kind: "static",
      href: "/companion/traditional-games/gazetteer.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 3 pages",
    },
  ],
};

/**
 * PHASE 3, BOOK 1 (2026-09-06). Valice Classics 13, and the first of the Bestiarium
 * expansion. The four sheets are the parts of the apparatus a reader wants beside the
 * book rather than inside it: the provinces, the creatures, the provenance, and a way
 * to play the hundred-candles game with seventeen tales instead of a hundred.
 */
const KWAIDAN: Companion = {
  slug: "kwaidan",
  bookSlug: "kwaidan",
  bookTitle: "Kwaidan: Stories and Studies of Strange Things",
  state: "book-available",
  stateNote:
    "The direct edition is on sale at valicepress.com — a watermarked PDF and an " +
    "EPUB, yours to keep. The paperback and the hardcover are built and packaged " +
    "but no Amazon listing exists yet, so nothing here links to one. Everything on " +
    "this page is free and works whether or not you buy the book.",
  intro:
    "Free material for Hearn's seventeen ghost stories and three insect essays: " +
    "the thirteen old provinces against the prefectures they became, the creatures " +
    "named by what folklore calls them, where each of them would sit in Codex " +
    "Bestiarium, the register of what Hearn took and what he was told, and a sheet " +
    "for reading the book aloud by candlelight.",
  newsletterSource: "kwaidan-companion",
  assetsHeading: "Print and read",
  rightsNote:
    "Lafcadio Hearn died on 26 September 1904 and Kwaidan was published in Boston " +
    "on 2 April 1904, so the text is in the public domain on two independent " +
    "grounds. The two plates are by Takeuchi Keishū, born 13 November 1861 and " +
    "dead on 3 January of 1942 or 1943 (Wikidata Q11545824); on either date the " +
    "term expired more than a decade ago, and the edition reproduces both. Two " +
    "neighbouring layers are not printed, on the same reasoning. The unsigned " +
    "introduction of March 1904 is not by Hearn and names no author anywhere. And " +
    "thirty-six of the eighty-five notes in the electronic text were written by its " +
    "transcribers rather than by Hearn — they carry no anchor and no back-link, " +
    "because no sentence of his calls them — so the edition prints his forty-nine " +
    "and none of theirs.",
  assets: [
    {
      id: "provinces-card",
      title: "The Provinces",
      description:
        "The thirteen old provinces Hearn names — Musashi, Iyo, Mutsu, Tamba, Noto, " +
        "Kai, Shinano, Kii and the rest — against the modern prefectures they became, " +
        "with the tale each belongs to. It also carries the correction: the text " +
        "places Niigata in Echizen, and Niigata is in Echigo. That slip has been " +
        "reprinted for a century and the edition leaves Hearn's sentence alone and " +
        "tells you instead.",
      kind: "static",
      href: "/companion/kwaidan/provinces-card.pdf",
      meta: "PDF · US Letter · 1 page",
    },
    {
      id: "yokai-cards",
      title: "The Yōkai Cards",
      description:
        "Fifteen cards, one for each creature and apparition in the book, named by " +
        "what folklore calls it rather than by Hearn's title — which matters most " +
        "for \u201cMujina\u201d, where the thing on the road is a noppera-bō and the " +
        "animal in the title never appears. Each card carries the class the creature " +
        "would take in Codex Bestiarium.",
      kind: "static",
      href: "/companion/kwaidan/yokai-cards.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
    {
      id: "codex-concordance",
      title: "The Codex Concordance",
      description:
        "Where the fifteen would sit in the six classes of Codex Bestiarium — and " +
        "why not one of them is already in it. The Codex gives Japan three creatures " +
        "with bodies: the tengu, the kappa and Yamata-no-Orochi. Its smallest class, " +
        "the restless dead, runs to eight entries from eight traditions and none of " +
        "them is Japanese. Five of these fifteen would go straight into it. The sheet " +
        "prints all six classes so a reader holding one book can place the other.",
      kind: "static",
      href: "/companion/kwaidan/codex-concordance.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
    {
      id: "register-card",
      title: "The Register of Provenance",
      description:
        "What Hearn's own note establishes about where these tales came from, and " +
        "what it leaves open. THREE pieces have an origin he states — one Chinese, one " +
        "told to him by a farmer of Chōfu in Musashi, one that happened to him. A " +
        "fourth is not stated by him at all and is marked as evident rather than " +
        "stated: it is plainly autobiography. The remaining sixteen are shown as open " +
        "rather than assigned to one of his five named books on a guess.",
      kind: "static",
      href: "/companion/kwaidan/register-card.pdf",
      meta: "PDF · US Letter · 1 page",
    },
    {
      id: "hundred-candles",
      title: "The Hundred Candles",
      description:
        "Hyakumonogatari kaidankai is the Edo game the genre is named after: a " +
        "hundred lamps, a tale each, one lamp out after every one, and the thing " +
        "the tales have been summoning arrives when the last goes dark. Companies " +
        "stopped at ninety-nine. This sheet plays it with the seventeen tales of " +
        "this book, in an order that works, and tells you to stop at sixteen.",
      kind: "static",
      href: "/companion/kwaidan/hundred-candles.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
  ],
};

/**
 * SEA MONSTERS UNMASKED — Phase 3, book 2.
 *
 * Two 1883 shilling handbooks written for one exhibition, printed complete with all 68
 * of their figures. The sheets carry the four things that work better beside the book
 * than inside it: the casebook of sightings the sea-serpent chapter assumes you are
 * holding, an index to a plate sequence that restarts halfway through, a scorecard of
 * what has held up, and the one argument in the book that was fully vindicated.
 */
const SEA_MONSTERS_UNMASKED: Companion = {
  slug: "sea-monsters-unmasked",
  bookSlug: "sea-monsters-unmasked",
  bookTitle: "Sea Monsters Unmasked, and Sea Fables Explained",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built and validated \u2014 230 pages, both handbooks entire, " +
    "all 68 figures \u2014 but its pages have not been deployed and no payment product " +
    "exists for it yet, so the storefront row is deliberately held back. Everything on " +
    "this page is free and works today regardless.",
  intro:
    "Free material for Henry Lee's two 1883 handbooks, in which the kraken turns out to " +
    "be a giant squid, the mermaid a dugong, the hydra an octopus, and the sea serpent " +
    "stays unsolved: the casebook of named sightings, an index to all sixty-eight plates, " +
    "a scorecard of which of his explanations survived, and the kraken's timeline from " +
    "Olaus Magnus to the first film of a living giant squid.",
  newsletterSource: "sea-monsters-unmasked-companion",
  assetsHeading: "Print and read",
  rightsNote:
    "Henry Lee lived 1826\u20131888 and both handbooks were published in London in 1883, " +
    "so the text is in the public domain on two independent grounds. The figures are a " +
    "separate layer and each was assessed: the 1883 cuts lent by the Illustrated London " +
    "News, the Graphic, the Leisure Hour and Land and Water are corporate publications of " +
    "1883 whose term expired at the end of 1953; the second frontispiece is after a " +
    "painting by Otto Sinding, 1842\u20131909; and the facsimiles of Olaus Magnus, " +
    "Aldrovandus, Gerard and Pontoppidan were never in question. All sixty-eight are " +
    "reproduced.",
  assets: [
    {
      id: "casebook",
      title: "The Casebook",
      description:
        "Every named sighting the two handbooks discuss \u2014 Egede's monster off " +
        "Greenland in 1734, the Gloucester serpent, H.M.S. D\u00e6dalus in 1848, the " +
        "Alecton's squid, the Pauline, the Osborne, the City of Baltimore \u2014 with " +
        "what was reported and what Lee makes of it. The sea-serpent chapter moves " +
        "between eight cases in forty pages and assumes you are holding all of them at " +
        "once.",
      kind: "static",
      href: "/companion/sea-monsters-unmasked/casebook.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "plate-index",
      title: "The Sixty-Eight Plates",
      description:
        "Every figure in both books, numbered as Lee numbers them \u2014 which means " +
        "there are two figure 1s and two figure 24s, because the second handbook starts " +
        "its sequence again. Each is marked as evidence of an animal, evidence of a " +
        "belief, or decoration, which is the question worth asking of every picture in " +
        "the book.",
      kind: "static",
      href: "/companion/sea-monsters-unmasked/plate-index.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 2 pages",
    },
    {
      id: "scorecard",
      title: "Right, Wrong, Still Open",
      description:
        "Lee's eight chapters, what each concludes, and how it has lasted \u2014 with " +
        "the three places a modern reader should hold him to account: the surviving " +
        "marine reptile he reports without endorsing, the fish-god plates that rest on a " +
        "reading no longer accepted, and the dugong that does not live in the seas most " +
        "of the mermaid sightings come from.",
      kind: "static",
      href: "/companion/sea-monsters-unmasked/scorecard.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "kraken-timeline",
      title: "The Kraken, 1555 to now",
      description:
        "The one argument in the book that was fully vindicated, in order: Olaus Magnus, " +
        "Pontoppidan's ridiculed bishopric, Steenstrup naming Architeuthis in 1857, the " +
        "Alecton, the Newfoundland strandings Lee had only just heard about \u2014 and " +
        "then nothing at all for a hundred and nineteen years, until a living giant squid " +
        "was photographed in 2002 and finally filmed in its own water in 2012.",
      kind: "static",
      href: "/companion/sea-monsters-unmasked/kraken-timeline.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
  ],
};

/**
 * THE BOOK OF WERE-WOLVES — Phase 3, book 3.
 *
 * Baring-Gould's 1865 account, all sixteen chapters. The sheets carry the four things
 * that work better beside the book than inside it: the casebook of trials, a scorecard of
 * what survived, the Norse vocabulary his best chapters are built on, and a single page
 * saying which chapters describe murders — so the book can be lent on with the warning
 * attached.
 */
const BOOK_OF_WERE_WOLVES: Companion = {
  slug: "book-of-were-wolves",
  bookSlug: "book-of-were-wolves",
  bookTitle: "The Book of Were-Wolves",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built and validated \u2014 198 pages, all sixteen chapters \u2014 " +
    "but its pages have not been deployed and no payment product exists for it yet, so the " +
    "storefront row is deliberately held back. Everything on this page is free and works " +
    "today regardless.",
  intro:
    "Free material for Sabine Baring-Gould's 1865 book: the casebook of every werewolf trial " +
    "he describes, including the two in which a French court looked at a full confession and " +
    "refused to execute; a scorecard of which of his explanations survived; the Norse words " +
    "his best chapters are built on; and a page saying which chapters describe murders.",
  newsletterSource: "book-of-were-wolves-companion",
  assetsHeading: "Print and read",
  rightsNote:
    "Sabine Baring-Gould lived 1834\u20131924 and the book was published in London in 1865, " +
    "so the text is in the public domain on two independent grounds. There is no illustration " +
    "layer to assess: the 1865 book has no plates, and the only image in the Project Gutenberg " +
    "transcription is Gutenberg's own generated cover, which this edition does not use. " +
    "Baring-Gould's own translations \u2014 the 1508 sermon, the Norse verse, the French trial " +
    "records \u2014 are part of the 1865 book and carry no separate right.",
  assets: [
    {
      id: "casebook",
      title: "The Casebook of Trials",
      description:
        "Every prosecution the book describes, with year, place, charge, court and sentence " +
        "\u2014 Poligny 1521, Dole 1573, the Gandillons and Roulet in 1598, Jean Grenier at " +
        "Bordeaux in 1603, the Mar\u00e9chal de Retz at Nantes in 1440. Two are set apart: in " +
        "1598 the Parlement of Paris sent a confessed werewolf to an asylum instead of the " +
        "stake, and in 1603 the Parlement of Bordeaux held that lycanthropy was not a punishable " +
        "crime and sentenced a boy of thirteen to perpetual imprisonment in a monastery. Both courts treated the confession as evidence about the man rather than about " +
        "the crime.",
      kind: "static",
      href: "/companion/book-of-were-wolves/casebook.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "scorecard",
      title: "Right, Wrong, Still Open",
      description:
        "Ten claims and what became of each. The philology held \u2014 his account of the " +
        "berserk, and of a word that meant both wolf and outlaw, is still the standard " +
        "reading. The mythology did not: chapter X is comparative mythology at its most " +
        "confident and the school was demolished within his lifetime. And the medicine was " +
        "replaced by something much narrower than his \u201cinnate cruelty\u201d.",
      kind: "static",
      href: "/companion/book-of-were-wolves/scorecard.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "norse-words",
      title: "The Norse Words",
      description:
        "Berserkr, \u00falfhe\u00f0inn, hamr, hamrammr, vargr, eigi einhamr \u2014 the " +
        "vocabulary the best chapters of the book are built on, with what each means and " +
        "where the sagas use it. Baring-Gould read Old Norse and assumed a reader who could " +
        "follow him; this sheet is for the reader who cannot.",
      kind: "static",
      href: "/companion/book-of-were-wolves/norse-words.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "what-is-in-it",
      title: "What Is in Which Chapter",
      description:
        "Six of the sixteen chapters describe murders, taken from the trial records \u2014 " +
        "the French prosecutions of the sixteenth century, the trial of a thirteen-year-old " +
        "boy, the three chapters on the Mar\u00e9chal de Retz, a Galician case of 1849 and " +
        "the Paris grave-violations of the same year. This page says which and what is in " +
        "them, so the book can be given to somebody else with the warning attached.",
      kind: "static",
      href: "/companion/book-of-were-wolves/what-is-in-it.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
  ],
};

/**
 * British Goblins — Valice Classics 16.
 *
 * Sikes's 1880 book entire, four Books and thirty-two chapters. The sheets carry the four
 * things that work better beside the book than inside it: the Welsh vocabulary he glosses
 * once and then uses for a hundred pages, a scorecard of what became of each of his
 * claims, the sourcing he never marks at the point of use, and the places the stories
 * belong to.
 */
const BRITISH_GOBLINS: Companion = {
  slug: "british-goblins",
  bookSlug: "british-goblins",
  bookTitle: "British Goblins",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built and validated \u2014 390 pages, all four Books and " +
    "thirty-two chapters, with twenty of T. H. Thomas's drawings \u2014 but its pages have " +
    "not been deployed and no payment product exists for it yet, so the storefront row is " +
    "deliberately held back. Everything on this page is free and works today regardless.",
  intro:
    "Free material for Wirt Sikes's 1880 book: the Welsh words it uses without explaining " +
    "them, a scorecard of which of his claims survived, a sheet that marks his sources where " +
    "he does not, and a gazetteer of the parishes the stories come from.",
  newsletterSource: "british-goblins-companion",
  assetsHeading: "Print and read",
  rightsNote:
    "Wirt Sikes lived 1836\u20131883 and the book was published in London in 1880, so the " +
    "text is in the public domain on two independent grounds. The illustration layer was " +
    "assessed separately and cleared: the twenty-one drawings are T. H. Thomas's " +
    "(1839\u20131915), published in the same volume, and the edition sets twenty of them. " +
    "The six music engravings in the Project Gutenberg transcription are NOT Thomas's " +
    "\u2014 they were set in 2010 by Lesley Halamek, who transcribed the music \u2014 and " +
    "this edition does not reproduce them. Each air is named and placed in the apparatus " +
    "instead.",
  assets: [
    {
      id: "welsh-words",
      title: "The Welsh Words",
      description:
        "Twenty-six terms with how to say them and what they mean \u2014 tylwyth teg, " +
        "ellyllon, gwragedd annwn, coblynau, canwyll corff, cyhyraeth, gwrach y rhibyn, " +
        "cwn Annwn. Sikes glosses a word once and then uses it for a hundred pages as " +
        "though the reader had it. This is the card to keep beside the book, with the " +
        "letters that catch people out \u2014 w and y are vowels, dd is the th of this, ll " +
        "has no English equivalent.",
      kind: "static",
      href: "/companion/british-goblins/welsh-words.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 3 pages",
    },
    {
      id: "scorecard",
      title: "Right, Wrong, Still Open",
      description:
        "Eleven claims and what became of each. The collection held \u2014 the tales, the " +
        "customs and the death-portent system are all confirmed by later Welsh collectors " +
        "working in Welsh. The argument did not: the sourcing was condemned within a decade, " +
        "the fairy-origin theories have no evidential support, and the rites he watched at " +
        "Pontypridd and called Druidic had been started in about 1853 by a living Welshman.",
      kind: "static",
      href: "/companion/british-goblins/scorecard.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "who-told-him",
      title: "Who Told Him",
      description:
        "The book's central defect is that it names a source once and then stops marking it, " +
        "so four hundred pages arrive in one voice. This sheet does the marking for him, " +
        "chapter group by chapter group \u2014 what is Edmund Jones's Monmouthshire of 1780, " +
        "what is Giraldus, what is Lady Charlotte Guest, and the much smaller amount that is " +
        "Sikes standing in a room watching.",
      kind: "static",
      href: "/companion/british-goblins/who-told-him.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 2 pages",
    },
    {
      id: "gazetteer",
      title: "Where the Stories Are",
      description:
        "The parishes, valleys, lakes and wells the book names, with the county and what " +
        "happens there \u2014 St Dogmell's, Cwm Llan, Llyn Barfog, the Pontypridd rocking " +
        "stone, Holywell. Sikes gives a parish more often than he gives a source, and a " +
        "parish is the best evidence in the book that a real person told him something.",
      kind: "static",
      href: "/companion/british-goblins/gazetteer.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 2 pages",
    },
  ],
};

/**
 * The Fairy Mythology, Volume I — Valice Classics 17.
 *
 * One roadmap title, two product volumes, split at Keightley's own Great Britain division.
 * The sheets differ per volume because the volumes do.
 */
const FAIRY_MYTHOLOGY_VOL_1: Companion = {
  slug: "fairy-mythology-vol-1",
  bookSlug: "fairy-mythology-vol-1",
  bookTitle: "The Fairy Mythology, Volume I",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built and validated \u2014 332 pages, thirty sections, all of Keightley from his preface to the end of Switzerland \u2014 but its pages have not been deployed and no payment product exists for it yet, so the storefront row is deliberately held back. Everything on this page is free and works today regardless.",
  intro:
    "Free material for the first volume of Keightley\u2019s 1850 Fairy Mythology: the northern vocabulary the book uses without explaining, a reading list of the collectors he translates, a scorecard of what became of his claims, a measured concordance of the motifs he compares, and the insular alphabet the original was set in.",
  newsletterSource: "fairy-mythology-vol-1-companion",
  assetsHeading: "Print and read",
  rightsNote:
    "Thomas Keightley lived 1789\u20131872 and this text is the enlarged edition of 1850, reprinted in 1892, so it is in the public domain on two independent grounds. The illustration layer was assessed separately. This volume carries the frontispiece of the 1850 Bohn issue, attributed to George Cruikshank (1792\u20131878) on the bibliographic record of that issue \u2014 the mark on the plate is not legible at source resolution and this edition does not claim to have read it \u2014 and six of the seven engraved script blocks, which are anonymous work published in 1850. All clear. One layer is REFUSED: the 141 one-letter images the 2012 transcribers made to stand for the insular and Gaelic letterforms are their work, not Keightley's, and this edition replaces every one with its Unicode character instead.",
  assets: [
    {
      id: "words",
      title: "The Northern Words",
      description:
        "Twenty-seven terms — <i>alfar</i>, <i>duergar</i>, <i>elle-folk</i>, <i>nis</i>, <i>tomte</i>, <i>kobold</i>, <i>nix</i>, <i>Servan</i> — with what each means and which language it is. Keightley writes for a reader who has Danish, German and a little Norse; this is the card for the reader who has none of them.",
      kind: "static",
      href: "/companion/fairy-mythology-vol-1/words.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 2 pages",
    },
    {
      id: "who-collected-it",
      title: "Who Collected It",
      description:
        "Thiele, Faye, Afzelius, Arndt and Grimm, with what each of them published, when, and which parts of the volume are theirs. Keightley names his sources, which for 1828 is the remarkable thing about him; this sheet turns those citations into a reading list.",
      kind: "static",
      href: "/companion/fairy-mythology-vol-1/who-collected-it.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 2 pages",
    },
    {
      id: "scorecard",
      title: "Right, Wrong, Still Open",
      description:
        "Ten claims and what became of each. The collectors, the etymology of <i>fairy</i>, Oberon\u2019s descent from Alberich and the Norse survival in Shetland all held. The Persian derivation, the Eddic elf-orders and the identity of the German and Scandinavian dwarfs did not.",
      kind: "static",
      href: "/companion/fairy-mythology-vol-1/scorecard.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 2 pages",
    },
    {
      id: "motifs",
      title: "A Concordance of Motifs",
      description:
        "The changeling, the egg-shell test, the stolen bride, the midwife fetched to the hill, the fairy ointment, the gift of clothes — counted section by section across both volumes. The book is a comparison and never indexes what it compares; this is a measurement, not an argument.",
      kind: "static",
      href: "/companion/fairy-mythology-vol-1/motifs.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "the-letters-he-set",
      title: "The Letters He Set",
      description:
        "The insular Anglo-Saxon and Gaelic type of the original, letter by letter, with the word that identifies each one — <i>Munt-ælfen</i>, <i>Wulfes-fist</i>, <i>daine maiṫ</i>, <i>siaḃra</i>. The transcription this edition works from set them as pictures; here they are characters.",
      kind: "static",
      href: "/companion/fairy-mythology-vol-1/the-letters-he-set.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
  ],
};

/**
 * The Fairy Mythology, Volume II — Valice Classics 18.
 *
 * One roadmap title, two product volumes, split at Keightley's own Great Britain division.
 * The sheets differ per volume because the volumes do.
 */
const FAIRY_MYTHOLOGY_VOL_2: Companion = {
  slug: "fairy-mythology-vol-2",
  bookSlug: "fairy-mythology-vol-2",
  bookTitle: "The Fairy Mythology, Volume II",
  state: "book-not-yet-available",
  stateNote:
    "The Valice edition is built and validated \u2014 322 pages, twenty-one sections, Keightley from his Great Britain division to the end of the Appendix \u2014 but its pages have not been deployed and no payment product exists for it yet, so the storefront row is deliberately held back. Everything on this page is free and works today regardless.",
  intro:
    "Free material for the second volume: the western vocabulary, the collectors — and the collaborators — behind the English and Irish material, a scorecard of what became of his claims, the shared motif concordance, and the insular and Gaelic alphabet.",
  newsletterSource: "fairy-mythology-vol-2-companion",
  assetsHeading: "Print and read",
  rightsNote:
    "Thomas Keightley lived 1789\u20131872 and this text is the enlarged edition of 1850, reprinted in 1892, so it is in the public domain on two independent grounds. The illustration layer was assessed separately. This volume has no frontispiece \u2014 it is in Volume I \u2014 and carries one engraved block, the word Keightley says is called in the Arabic language znoon. Anonymous work published in 1850, and clear. One layer is REFUSED: the 141 one-letter images the 2012 transcribers made to stand for the insular and Gaelic letterforms are their work, not Keightley's, and this edition replaces every one with its Unicode character instead.",
  assets: [
    {
      id: "words",
      title: "The Words of the West",
      description:
        "Twenty-six terms — <i>pouke</i>, <i>pixy</i>, <i>brownie</i>, <i>sidhe</i>, <i>banshee</i>, <i>korrigan</i>, <i>lutin</i>, <i>duende</i> — with what each means and which language it is, and where a being also appears in Volume I under a northern name.",
      kind: "static",
      href: "/companion/fairy-mythology-vol-2/words.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 2 pages",
    },
    {
      id: "who-collected-it",
      title: "Who Collected It",
      description:
        "Croker, Hone, Scott, the Grimms and the rest — with what each published, which parts of the volume are theirs, and which of them Keightley worked with rather than merely read. That last distinction is why this volume needs the sheet more than Volume I does.",
      kind: "static",
      href: "/companion/fairy-mythology-vol-2/who-collected-it.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "scorecard",
      title: "Right, Wrong, Still Open",
      description:
        "Ten claims and what became of each — including one the author withdrew himself. The house-spirit family, the death-warners and the mine-spirits held. Celtic unity did not, and the Irish material is unusable as a record on Keightley\u2019s own evidence.",
      kind: "static",
      href: "/companion/fairy-mythology-vol-2/scorecard.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 2 pages",
    },
    {
      id: "motifs",
      title: "A Concordance of Motifs",
      description:
        "The same measured concordance as Volume I, counted across both, so a reader of either can see where a thread begins and where it runs on.",
      kind: "static",
      href: "/companion/fairy-mythology-vol-2/motifs.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
    {
      id: "the-letters-he-set",
      title: "The Letters He Set",
      description:
        "The insular and Gaelic type of the original. The Irish letters matter most in this volume: <i>daine maiṫ</i> and <i>siaḃra</i>, restored with the séimhiú dot Keightley printed.",
      kind: "static",
      href: "/companion/fairy-mythology-vol-2/the-letters-he-set.pdf",
      meta: "PDF \u00b7 US Letter \u00b7 1 page",
    },
  ],
};

/**
 * ── WORDS FROM THE GODS (ETYMON, VOLUME ONE) ──────────────────────────────
 *
 * This book's whole claim is that you can check it. Every entry quotes the
 * dictionary entry it rests on, and the back matter names the words that were
 * researched and rejected. The companion is the natural extension of exactly
 * that promise and nothing else: it carries the apparatus, not the prose.
 *
 * The three files are generated by `04_BUILD/companion_pack.py` from the
 * book's own indexes — the evidence table, the full candidate pool including
 * every rejection, and the source list with a working link to each scan. No
 * entry text is reproduced; the stories stay in the book.
 *
 * The candidate pool is the unusual one. Almost nobody publishes the words
 * their method threw out, and publishing them is the strongest evidence that
 * the method was real.
 */
const ETYMON: Companion = {
  slug: "etymon",
  bookSlug: "words-from-the-gods",
  bookTitle: "Words from the Gods",
  state: "book-not-yet-available",
  stateNote:
    "The book is finished but not yet on sale — it has not been uploaded to " +
    "KDP. Everything on this page is free now and stays free afterwards.",
  intro:
    "The apparatus behind the 314-page book: every word tested and what " +
    "happened to it, the authorities quoted for each entry, and a direct link " +
    "to every source scan so you can check any quotation against the page it " +
    "came from.",
  calloutLabel: "See every word the method tested — including the rejects",
  newsletterSource: "etymon-companion",
  assetsHeading: "Check the book yourself",
  rightsNote:
    "These three files are Valice Press's own work, generated from the " +
    "book's research indexes. The works they point at are public domain: " +
    "eleven from Project Gutenberg and two from the Internet Archive, each " +
    "listed with the identifier it was actually downloaded from. No entry " +
    "text from the book is reproduced here.",
  assets: [
    {
      id: "evidence-table",
      title: "The evidence table",
      description:
        "All 145 words in the book, the authorities quoted for each, how " +
        "many separate claims the entry makes, and which entries end in an " +
        "open question rather than an answer.",
      kind: "static",
      href: "/companion/etymon/etymon-evidence-table.pdf",
      meta: "PDF · US Letter · 4 pages",
    },
    {
      id: "candidate-pool",
      title: "Every word tested — including the ones that failed",
      description:
        "All 348 words put through the two-authority gate, by theme, showing " +
        "which dictionaries carried each one and whether it passed. The book " +
        "prints 145 of them; this is everything else as well.",
      kind: "static",
      href: "/companion/etymon/etymon-candidate-pool.pdf",
      meta: "PDF · US Letter · 8 pages",
    },
    {
      id: "sources",
      title: "The sources, and how to open them",
      description:
        "All thirteen works on the shelf with a direct link to each scan, " +
        "what was verified about each one, and — stated plainly — the four " +
        "that were searched and ended up carrying nothing.",
      kind: "static",
      href: "/companion/etymon/etymon-sources.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
  ],
};


/**
 * ── PENCIL & PAPER ────────────────────────────────────────────────────────
 *
 * Play Anywhere 1, and the first original book from Agent A's line. Built
 * 2026-09-10. The companion goes up before the book is on sale, which is the
 * house rule and matters more here than usual: the QR code is printed on
 * page 150 of the paperback and was decoded out of the BUILT PDF, so this
 * route has to answer from the day the first proof is ordered.
 *
 * Every sheet is generated by the book project's own `04_BUILD/companion_pack.py`
 * from the manuscript data, so a sheet cannot name a game the book does not
 * contain.
 */
const PLAY_ANYWHERE: Companion = {
  slug: "play-anywhere",
  bookSlug: "pencil-and-paper",
  bookTitle: "Pencil & Paper",
  state: "book-not-yet-available",
  stateNote:
    "The book is finished and going to Amazon; it is not on sale yet. " +
    "Everything on this page is free now and stays free either way.",
  intro:
    "Score sheets, ten-by-ten fleet grids, a one-page index of all sixty games " +
    "and twelve cut-out rule cards — the material that is easier on a loose " +
    "sheet than in a pocket book. Free, no sign-up.",
  calloutLabel:
    "Score sheets, fleet grids, an index of all sixty games and twelve cut-out " +
    "rule cards, free to print.",
  newsletterSource: "play-anywhere-companion",
  assetsHeading: "Sheets to print",
  rightsNote:
    "Everything on this page is Valice Press's own work, generated from the " +
    "book's manuscript data. The rule cards carry the book's own wording for " +
    "twelve games; the provenance notes and the strategy notes stay in the book.",
  assets: [
    {
      id: "score-sheets",
      title: "Score sheets",
      description:
        "The eight sheets from the back of the book, printed larger: a Dots " +
        "and Boxes lattice, two sea-battle spreads, a Jotto log, a Bulls and " +
        "Cows deduction table, the racetrack circuit, a Categories grid, and a " +
        "blank column for whatever else you are playing.",
      kind: "static",
      href: "/companion/play-anywhere/score-sheets.pdf",
      meta: "PDF · US Letter · 8 pages",
    },
    {
      id: "fleet-grids",
      title: "Fleet grids",
      description:
        "Sixteen lettered and numbered ten-by-ten grids, four to a sheet — " +
        "enough for eight full games of Sea Battle or Salvo without anyone " +
        "having to rule a grid by hand first.",
      kind: "static",
      href: "/companion/play-anywhere/fleet-grids.pdf",
      meta: "PDF · US Letter · 4 pages",
    },
    {
      id: "game-index",
      title: "The sixty games",
      description:
        "Every game in the book on two pages: how many people it needs, how " +
        "long it takes, and whether it wants plain paper or squared. Use it to " +
        "pick a game before you open the book.",
      kind: "static",
      href: "/companion/play-anywhere/game-index.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
    {
      id: "rule-cards",
      title: "Rule cards",
      description:
        "Twelve cut-out cards, six to a sheet, carrying the complete rules for " +
        "the games most often wanted away from the book — Noughts and Crosses, " +
        "Dots and Boxes, Sprouts, Sim, Sea Battle, Bulls and Cows, Jotto, " +
        "Ghost, Categories, Doublets, Nim and Bachet's Hundred.",
      kind: "static",
      href: "/companion/play-anywhere/rule-cards.pdf",
      meta: "PDF · US Letter · 2 pages",
    },
  ],
};

/**
 * ── HOW THE WORLD BEGAN (Under Every Sky 1) ───────────────────────────────
 *
 * The QR code on the last page of the paperback points here. It was printed
 * before the book was on sale anywhere, which is exactly the case the rule at
 * the top of this file was written for: the route exists now, in the
 * not-yet-available state, and it will still exist when the state changes.
 *
 * The companion is unusual in what it carries. It is not practice material —
 * it is the book's own apparatus, published in full and free: the thirteen
 * corrections made while the book was written, the source ledger, all 726
 * typed claims with the kind of claim each one is, and the bibliography.
 * The book's argument is that a retelling should show its work, and a
 * companion that withheld the work would undercut it.
 */
const UNDER_EVERY_SKY: Companion = {
  slug: "under-every-sky",
  bookSlug: "how-the-world-began",
  bookTitle: "How the World Began",
  state: "book-not-yet-available",
  stateNote:
    "The book is finished but is not on sale yet — the Kindle, paperback " +
    "and hardcover editions have not been listed. Everything on this page " +
    "is free and stays free whether or not you ever buy it.",
  intro:
    "The book's whole apparatus, published in full: the thirteen corrections " +
    "made while it was written, every source behind the thirty stories, and " +
    "all 726 claims with the kind of claim each one is.",
  calloutLabel: "See every source and every claim, free",
  newsletterSource: "under-every-sky-companion",
  assetsHeading: "Sources, claims and corrections",
  rightsNote:
    "Everything on this page is Vâliçe Press's own editorial work — ledgers, " +
    "citations and corrections generated from the book's own records. The " +
    "underlying texts it cites are public-domain collections and scholarship " +
    "published between the nineteenth and early twentieth centuries; those " +
    "are named and dated here rather than reproduced. The retellings " +
    "themselves stay in the book. These are historical and academic sources, " +
    "not the direct practice of any living tradition, and no community or " +
    "outside reviewer has read this material.",
  assets: [
    {
      id: "sources-and-ledgers",
      title: "Every source and every claim, on one page",
      description:
        "The whole apparatus as one browsable page: the thirteen corrections, " +
        "the source ledger, all 726 typed claims, and the bibliography.",
      kind: "static",
      href: "/companion/under-every-sky/sources-and-ledgers.html",
      meta: "HTML · one page",
    },
    {
      id: "corrections",
      title: "The thirteen corrections",
      description:
        "Every place the plan turned out to be wrong and what was done about " +
        "it — five of them because a downloaded file was not the edition its " +
        "filename claimed. The same list is printed in the back of the book.",
      kind: "static",
      href: "/companion/under-every-sky/corrections.json",
      meta: "JSON · 13 records",
    },
    {
      id: "source-ledger",
      title: "Source ledger",
      description:
        "Every source record behind the thirty stories: work, author, " +
        "edition, the file it was read from, and that file's hash.",
      kind: "static",
      href: "/companion/under-every-sky/source-ledger.json",
      meta: "JSON · 33 records",
    },
    {
      id: "claim-ledger",
      title: "Claim ledger",
      description:
        "All 726 claims, each tagged as a primary or historical source, as " +
        "scholarship, or as this book's own editorial interpretation, with " +
        "the story it appears in.",
      kind: "static",
      href: "/companion/under-every-sky/claim-ledger.json",
      meta: "JSON · 726 claims",
    },
    {
      id: "claims",
      title: "Claim ledger, as a spreadsheet",
      description:
        "The same 726 claims as a CSV, for anyone who would rather sort and " +
        "filter them somewhere else.",
      kind: "static",
      href: "/companion/under-every-sky/claims.csv",
      meta: "CSV · 726 rows",
    },
  ],
};

/**
 * ── THE TRICKSTER'S TABLE (Under Every Sky 2) ─────────────────────────────
 *
 * Registered before the QR code was generated, which is the order this house
 * now works in: UES-01 printed a code on page 231 pointing at a route that did
 * not exist, and only a gate written afterwards caught it. The book's QR gate
 * fails unless this entry is here.
 *
 * The companion carries the book's apparatus in full and free — the source
 * ledger, all 224 typed claims, the corrections, and the list of traditions
 * the book declined with the reason for each. That last list is the most
 * useful thing this particular volume can publish, because the declines are
 * what a reader is most likely to question.
 */
const TRICKSTERS_TABLE: Companion = {
  slug: "tricksters-table",
  bookSlug: "the-tricksters-table",
  bookTitle: "The Trickster's Table",
  state: "book-not-yet-available",
  stateNote:
    "The book is finished but is not on sale yet — no edition has been listed " +
    "anywhere. Everything on this page is free and stays free either way.",
  intro:
    "The book's apparatus in full: the eighteen sources behind the eighteen " +
    "tales, all 224 claims with the kind of claim each one is, the three " +
    "corrections logged while it was made, and every tradition the book " +
    "declined, with the reason.",
  calloutLabel: "See every source and every claim, free",
  newsletterSource: "tricksters-table-companion",
  assetsHeading: "Sources, claims and corrections",
  rightsNote:
    "Everything on this page is Vâliçe Press's own editorial work — ledgers, " +
    "citations and corrections generated from the book's own records. The " +
    "underlying texts it cites are public-domain collections and scholarship " +
    "published between the seventeenth and early twentieth centuries; those " +
    "are named and dated here rather than reproduced. The retellings stay in " +
    "the book. These are historical and academic sources, not the direct " +
    "practice of any living tradition, and no community or outside reviewer " +
    "has read this material.",
  assets: [
    {
      id: "sources-and-ledgers",
      title: "Every source and every claim, on one page",
      description:
        "The whole apparatus as one browsable page: the three corrections, the " +
        "source ledger, all 224 typed claims, and the bibliography.",
      kind: "static",
      href: "/companion/tricksters-table/sources-and-ledgers.html",
      meta: "HTML · one page",
    },
    {
      id: "corrections",
      title: "The three corrections",
      description:
        "Four of five Project Gutenberg identifiers guessed from memory returned " +
        "a completely different book; one download of a Chinese classic arrived " +
        "in Chinese; and an Internet Archive error page was found sitting in the " +
        "previous volume's source library. All three are printed in the book.",
      kind: "static",
      href: "/companion/tricksters-table/corrections.json",
      meta: "JSON · 3 records",
    },
    {
      id: "source-ledger",
      title: "Source ledger",
      description:
        "Every source behind the eighteen tales: work, author, edition, the file " +
        "it was read from, and that file's hash.",
      kind: "static",
      href: "/companion/tricksters-table/source-ledger.json",
      meta: "JSON · 18 records",
    },
    {
      id: "claim-ledger",
      title: "Claim ledger",
      description:
        "All 224 claims, each tagged as a primary or historical source, as " +
        "scholarship, or as this book's own editorial reading.",
      kind: "static",
      href: "/companion/tricksters-table/claim-ledger.json",
      meta: "JSON · 224 claims",
    },
    {
      id: "claims",
      title: "Claim ledger, as a spreadsheet",
      description:
        "The same 224 claims as a CSV, for anyone who would rather sort and " +
        "filter them somewhere else.",
      kind: "static",
      href: "/companion/tricksters-table/claims.csv",
      meta: "CSV · 224 rows",
    },
  ],
};

const COMPANIONS: readonly Companion[] = [
  HANGUL,
  WORLD_GAMES,
  DUDENEY,
  WORLD_MYTHS,
  CODEX_BESTIARIUM,
  CODEX_MYTHOLOGICA,
  MYTH_HUNTERS,
  EPICTETUS,
  GAMES_ANCIENT,
  KOREAN_GAMES,
  CHESS_AND_PLAYING_CARDS,
  MANCALA,
  TRADITIONAL_GAMES,
  CODEX_PUZZLES,
  SENECA,
  GREEK,
  CHINA_GODS,
  VEDIC_GODS,
  THE_DRAGON,
  KWAIDAN,
  SEA_MONSTERS_UNMASKED,
  BOOK_OF_WERE_WOLVES,
  BRITISH_GOBLINS,
  FAIRY_MYTHOLOGY_VOL_1,
  FAIRY_MYTHOLOGY_VOL_2,
  ETYMON,
  PLAY_ANYWHERE,
  UNDER_EVERY_SKY,
  TRICKSTERS_TABLE,
];

export function listCompanions(): readonly Companion[] {
  return COMPANIONS;
}

export function getCompanion(slug: string): Companion | undefined {
  return COMPANIONS.find((c) => c.slug === slug);
}

/** The companion for a book, if it has one. Keyed on the BOOK's slug. */
export function getCompanionForBook(bookSlug: string): Companion | undefined {
  return COMPANIONS.find((c) => c.bookSlug === bookSlug);
}

export function getCompanionAsset(
  companionSlug: string,
  assetId: string,
): CompanionAsset | undefined {
  return getCompanion(companionSlug)?.assets.find((a) => a.id === assetId);
}
