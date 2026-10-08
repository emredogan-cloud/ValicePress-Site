import { REFERENCE_AUTHOR_DATA } from "@/content/authors";

import verification from "../../data/authors/verification.json";

/**
 * The authors directory: who is on it, what is said about them, and how the people Valice Press
 * actually publishes are folded in without ever appearing twice.
 *
 * TWO KINDS OF PERSON, NEVER BLURRED.
 *   "published"  — at least one of their titles is on the Valice list (from the catalogue, through the
 *                  database): an edition of a public-domain work, or an original. These pages show
 *                  their books.
 *   "reference"  — an author of influence, shown for the reading context around the shelf. Valice Press
 *                  has no relationship with them, their publishers or their estates, and every page
 *                  says so in plain words. Nothing here implies otherwise: no endorsement, no
 *                  "partner", no follower counts. (An earlier version of this page listed Harari,
 *                  Austen and Orwell with invented roles and invented followings; that is the thing
 *                  this module exists to make impossible.)
 *
 * WHERE THE FACTS COME FROM. `src/content/authors/<slug>.json`, one file per person. Each lists its
 * sources; `scripts/authors/verify-sources.mjs` fetches them and checks that the dates agree across
 * Wikidata and the Library of Congress, that every year and every key claim appears in the sources,
 * and records the result in `data/authors/verification.json`. Portraits are only ever freely licensed
 * files from Wikimedia Commons, with the credit and licence recorded in the same JSON.
 */

export type AuthorCategory = "historical" | "game-puzzle" | "sapphic-romance" | "valice-original";

export interface ReferencePortrait {
  src: string;
  width: number;
  height: number;
  alt: string;
  credit: string;
  licence: string;
  licenceUrl: string | null;
  sourceUrl: string;
  sourceFile: string;
  sourceSha1: string;
  sourceSize: string;
  crop: [number, number, number, number];
  sha256: string;
  retrievedAt: string;
}

export interface ReferenceSource {
  label: string;
  url: string;
  expectDateMismatch?: boolean;
  identityOnly?: boolean;
}

export interface ReferenceAuthor {
  slug: string;
  name: string;
  category: Exclude<AuthorCategory, "valice-original">;
  /** "1850–1904", "born 1966". */
  years: string;
  born: string;
  bornYear: number;
  birthplace?: string;
  died?: string;
  diedYear?: number;
  deathplace?: string;
  nationality: string;
  /** One line, ≤ 120 characters. */
  knownFor: string;
  /** Paragraphs. Absent for authors Valice publishes: their approved biography is the catalogue's. */
  bio?: string[];
  works: Array<{ title: string; year?: number | string; note?: string }>;
  events: Array<{ year: number | string; text: string }>;
  relevance: string;
  influence: string;
  tags: string[];
  related: string[];
  /** Catalogue category slugs sharing a shelf with this author's world — thematic neighbours only. */
  shelf?: string[];
  sources: ReferenceSource[];
  evidence?: string[];
  dateDiscrepancy?: string;
  portrait: ReferencePortrait | null;
  portraitNote?: string;
}

export const REFERENCE_AUTHORS: readonly ReferenceAuthor[] = REFERENCE_AUTHOR_DATA;

const BY_SLUG = new Map(REFERENCE_AUTHORS.map((a) => [a.slug, a]));
export const getReferenceAuthor = (slug: string): ReferenceAuthor | null => BY_SLUG.get(slug) ?? null;

/** What each category is, in the directory's own words. */
export const CATEGORY_INFO: Record<AuthorCategory, { label: string; filter: string; blurb: string }> = {
  historical: {
    label: "Historical voices",
    filter: "Historical voices",
    blurb: "Writers the shelf stands on — myth, folklore, philosophy and the Gothic imagination.",
  },
  "game-puzzle": {
    label: "Games & puzzles",
    filter: "Games & puzzles",
    blurb: "Puzzle-makers, historians of games, and the writers who put play on the page.",
  },
  "sapphic-romance": {
    label: "Sapphic romance",
    filter: "Sapphic romance",
    blurb: "Novelists who made love between women a subject for fiction, from the pulps to the prize lists.",
  },
  "valice-original": {
    label: "Valice Press originals",
    filter: "Valice Press originals",
    blurb: "Contemporary authors Valice Press publishes.",
  },
};

export const CATEGORY_ORDER: readonly AuthorCategory[] = ["historical", "game-puzzle", "sapphic-romance", "valice-original"];

/**
 * Authors who are in the catalogue but have no researched file, and the category each belongs to. The
 * three public-domain folklorists are historical voices like the rest; the three living authors are
 * Valice's own. A catalogue author missing from this map is a test failure — a person should never
 * land in a category by default.
 */
export const CATALOGUE_AUTHOR_CATEGORY: Record<string, AuthorCategory> = {
  "emre-dogan": "valice-original",
  "harper-hayes": "valice-original",
  "quinn-gallagher": "valice-original",
  "wirt-sikes": "historical",
  "henry-lee": "historical",
  "t-h-thomas": "historical",
};

/** An author row as the catalogue's database holds it. */
export interface CatalogueAuthor {
  slug: string;
  name: string;
  bio: string | null;
  bookCount: number;
}

export interface DirectoryAuthor {
  slug: string;
  name: string;
  kind: "published" | "reference";
  category: AuthorCategory;
  years: string | null;
  /** One line under the name: the researched epithet, else the first sentence of the catalogue's biography. */
  blurb: string | null;
  /** What search reads. */
  haystack: string;
  bookCount: number;
  bornYear: number | null;
  portraitSrc: string | null;
  portraitAlt: string | null;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** First sentence of a stored biography, collapsed to one line and kept short. */
export function firstSentence(bio: string | null, max = 150): string | null {
  const flat = bio?.replace(/\s+/g, " ").trim();
  if (!flat) return null;
  const m = /^.{20,}?[.!?](?=\s|$)/.exec(flat);
  const sentence = m ? m[0] : flat;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trim()}…` : sentence;
}

function haystackOf(name: string, ref: ReferenceAuthor | null, bio: string | null): string {
  return fold(
    [
      name,
      ref?.knownFor,
      ref?.nationality,
      ref?.tags.join(" "),
      ref?.works.map((w) => w.title).join(" "),
      ref?.birthplace,
      ref?.bio?.[0],
      bio,
      ref ? CATEGORY_INFO[ref.category].label : null,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * The directory: every researched author plus every catalogue author, ONE entry per slug.
 * A person who is both (Hearn: researched, and Valice publishes Kwaidan) is a "published" author
 * with the researched details attached, and appears once.
 */
export function buildDirectory(catalogue: readonly CatalogueAuthor[]): DirectoryAuthor[] {
  const out = new Map<string, DirectoryAuthor>();

  for (const c of catalogue) {
    const ref = getReferenceAuthor(c.slug);
    out.set(c.slug, {
      slug: c.slug,
      name: c.name,
      kind: "published",
      category: ref?.category ?? CATALOGUE_AUTHOR_CATEGORY[c.slug] ?? "valice-original",
      years: ref?.years ?? null,
      blurb: ref?.knownFor ?? firstSentence(c.bio),
      haystack: haystackOf(c.name, ref, c.bio),
      bookCount: c.bookCount,
      bornYear: ref?.bornYear ?? null,
      portraitSrc: ref?.portrait?.src ?? null,
      portraitAlt: ref?.portrait?.alt ?? null,
    });
  }

  for (const ref of REFERENCE_AUTHORS) {
    if (out.has(ref.slug)) continue;
    out.set(ref.slug, {
      slug: ref.slug,
      name: ref.name,
      kind: "reference",
      category: ref.category,
      years: ref.years,
      blurb: ref.knownFor,
      haystack: haystackOf(ref.name, ref, null),
      bookCount: 0,
      bornYear: ref.bornYear,
      portraitSrc: ref.portrait?.src ?? null,
      portraitAlt: ref.portrait?.alt ?? null,
    });
  }

  return [...out.values()];
}

/** Every slug that has a page: the catalogue's and the researched ones, once each. */
export function allAuthorSlugs(catalogueSlugs: readonly string[]): string[] {
  return [...new Set([...catalogueSlugs, ...REFERENCE_AUTHORS.map((a) => a.slug)])];
}

/** "Born 1966" / "1850–1904" for a card or a line under a name. */
export const lifeLine = (a: Pick<ReferenceAuthor, "years">) => a.years;

/** schema.org birthDate/deathDate: a four-digit year, only when it is one (not for ancient authors). */
export const schemaYear = (y: number | undefined): string | undefined => (y != null && y >= 1000 ? String(y) : undefined);

/** Where an authority lives, for the "Sources" list: a short host label. */
export function sourceHost(url: string): string {
  const h = new URL(url).host.replace(/^www\./, "");
  if (h === "en.wikipedia.org") return "Wikipedia";
  if (h === "en.wikisource.org") return "Wikisource";
  if (h === "wikidata.org") return "Wikidata";
  if (h === "id.loc.gov") return "Library of Congress";
  return h;
}

/** The day this author's sources were last fetched and checked, "2026-10-08", or null if they have not been. */
export function verifiedOn(slug: string): string | null {
  const v = (verification.authors as Record<string, { ok?: boolean; gatheredAt?: string } | undefined>)[slug];
  return v?.ok && v.gatheredAt ? v.gatheredAt.slice(0, 10) : null;
}
