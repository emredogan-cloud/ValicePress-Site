/**
 * Where a book's production repository actually is, today.
 *
 * WHY THIS FILE EXISTS
 * Three path tables in this repository — the digital-edition sources, the
 * preview sources and the print interiors — each hard-coded a full path into
 * `MY-DİGİTAL-BOOK/`. That directory has now been reorganised twice inside a
 * week: first into series folders (`CODEX-SERIES/`, `GAMES-PUZZLE/`,
 * `LANGUAGE-SERIES/`) — all of which were folded into `ROADMAP-BOOKS/` on
 * 2026-09-07, leaving two families: `ROADMAP-BOOKS/` and `PUBLIC-BOOKS/` —
 * `LANGUAGE-SERIES/`, `PHASE-1-BOOK/`), and then again into
 * `PUBLİC-PHASE-1-BOOK/`, `PUBLİC-PHASE-2-BOOK/` and `ROADMAP-BOOKS/`. Each
 * time, twenty-odd editions went BLOCKED and stayed blocked until somebody
 * ran the lint that reads them.
 *
 * So the parent is no longer written down. A book is named by its DIRECTORY
 * NAME, which has been stable through both moves, and this module finds which
 * parent it is under. It is deliberately strict: a name that matches nothing
 * throws, and a name that matches two places throws as well, because a build
 * that silently picks one of two candidate manuscripts is worse than a build
 * that stops.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const BOOKS_ROOT =
  process.env.VALICE_BOOKS_ROOT ?? "/home/emre/Downloads/MY-DİGİTAL-BOOK";

/**
 * Every directory under the books root that could hold a book project, to a bounded
 * depth. ONE LEVEL IS NOT ENOUGH: the tree was flat, then grouped into series folders,
 * then grouped again into PUBLİC-PHASE-1-BOOK and PUBLİC-PHASE-2-BOOK, and then those
 * two were moved inside a PUBLIC-BOOKS folder — three shapes in a week, the last one
 * while a build was running. A resolver that assumes a depth will be rewritten at the
 * next reorganisation, so this one searches instead.
 */
// 2026-09-10: raised 3 → 4. The tree grew another level when the original-book
// factory arrived — BOOK-SERIES/AJAN-A-BOOK/PHASE-3-SERIES/PLA-01 is four deep —
// which is the fourth shape in a month and exactly what this resolver exists for.
const MAX_DEPTH = 4;
// `Docs` joined the list on 2026-09-19. PUBLIC-BOOKS/PHASE-4-BOOK/Docs/ holds a
// per-book folder of QA records — epubcheck.txt, RIGHTS.md, print_qa.json — under
// the SAME directory name as the manuscript beside it. The resolver was right to
// refuse ("two candidate manuscripts is not something to pick between silently");
// it just needed to be told that one of the two is not a manuscript at all. This
// affects all five Phase-4 books, not only the one that surfaced it.
const SKIP = new Set(["reports", "BACKUP", "node_modules", "Docs"]);

function* walk(dir, depth = 0) {
  if (depth > MAX_DEPTH) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const full = join(dir, e.name);
    yield { name: e.name, path: full, depth };
    yield* walk(full, depth + 1);
  }
}

/**
 * The folders searched, named for the error message.
 *
 * THIS RUNS ONLY WHILE BUILDING AN ERROR, so it must not be able to raise one of its
 * own. It used to call readdirSync unguarded, so when the whole book tree was absent —
 * on any machine that is not the Founder's — the ENOENT from here escaped INSTEAD of the
 * "no book directory named X" message that was being assembled, and the caller was told
 * about a missing directory scan rather than about the book it asked for.
 */
function parents() {
  let entries;
  try {
    entries = readdirSync(BOOKS_ROOT);
  } catch {
    return [`(none — ${BOOKS_ROOT} is not present on this machine)`];
  }
  return entries
    .filter((d) => !d.startsWith(".") && !SKIP.has(d))
    .filter((d) => {
      try {
        return statSync(join(BOOKS_ROOT, d)).isDirectory();
      } catch {
        return false;
      }
    });
}

const cache = new Map();

/**
 * A directory matches a book name if it IS that name, or is that name with a
 * numeric prefix. The reorganisation of 2026-09-05 renamed
 * GREEK-ALPHABET-HANDWRITING-WORKBOOK to 02-GREEK-ALPHABET-HANDWRITING-WORKBOOK
 * while this file was being written, and a resolver that cannot survive a
 * two-digit prefix is a resolver that will need writing again next week.
 */
function matches(entry, dirName) {
  return entry === dirName || (/^\d+-/.test(entry) && entry.replace(/^\d+-/, "") === dirName);
}

/** Absolute path of the book project directory called `dirName`. */
export function bookDir(dirName) {
  if (cache.has(dirName)) return cache.get(dirName);
  const bare = dirName.replace(/^\d+-/, "");
  const hits = [];
  for (const c of walk(BOOKS_ROOT)) {
    if (matches(c.name, bare)) hits.push(c.path);
  }
  if (hits.length === 0) {
    throw new Error(
      `no book directory named ${bare} (with or without a numeric prefix) ` +
        `under ${BOOKS_ROOT} — it has been renamed, moved out, or never ` +
        `existed. Searched to depth ${MAX_DEPTH} from: ${parents().join(", ")}`,
    );
  }
  if (hits.length > 1) {
    // A project directory that also appears inside BACKUP is not ambiguity, but two
    // live copies are, and the caller must be told rather than given one of them.
    throw new Error(
      `${bare} exists in more than one place: ${hits.join(" · ")}. ` +
        `Two candidate manuscripts is not something to pick between silently.`,
    );
  }
  cache.set(dirName, hits[0]);
  return hits[0];
}

/** `bookDir(dirName)` joined with the rest of a path. */
export function bookPath(dirName, ...rest) {
  return join(bookDir(dirName), ...rest);
}
