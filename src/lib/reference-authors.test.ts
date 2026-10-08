// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { AUTHORS, BOOKS, CATEGORIES } from "../../scripts/catalog/valice-catalog.mjs";
import { FREE_LICENCE, NON_FREE } from "../../scripts/authors/portraits.mjs";
import verification from "../../data/authors/verification.json";

import {
  CATALOGUE_AUTHOR_CATEGORY,
  CATEGORY_INFO,
  REFERENCE_AUTHORS,
  buildDirectory,
  getReferenceAuthor,
  type CatalogueAuthor,
} from "./reference-authors";

/**
 * The authors directory's data is a claim about real people, so these tests are about what could make it
 * false or unlawful: a duplicate person, an invented book, a wrong date, an unsourced fact, a photograph
 * that is not freely licensed or not the file that was checked, and any suggestion that Valice Press has
 * a relationship it does not have. The network half — that the sources really say what the data says —
 * is `scripts/authors/verify-sources.mjs`; its recorded result is checked here.
 */

const ROOT = path.resolve(__dirname, "../..");
const DIR = path.join(ROOT, "src/content/authors");
const PUB = path.join(ROOT, "public/images/authors");

type Cat = { slug: string };
const catalogueCategories = new Set((CATEGORIES as Cat[]).map((c) => c.slug));
const catalogueAuthors: CatalogueAuthor[] = (AUTHORS as Array<{ slug: string; name: string; bio?: string }>).map((a) => ({
  slug: a.slug,
  name: a.name,
  bio: a.bio ?? null,
  bookCount: (BOOKS as Array<{ authors: string[]; websiteStatus: string }>).filter((b) => b.websiteStatus === "published" && b.authors.includes(a.slug)).length,
}));
const published = catalogueAuthors.filter((a) => a.bookCount > 0);

const fileSlugs = readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();

describe("the researched authors", () => {
  it("are at least 25, in the three required groups", () => {
    expect(REFERENCE_AUTHORS.length).toBeGreaterThanOrEqual(25);
    const n = (c: string) => REFERENCE_AUTHORS.filter((a) => a.category === c).length;
    expect(n("historical")).toBeGreaterThanOrEqual(10);
    expect(n("game-puzzle")).toBeGreaterThanOrEqual(5);
    expect(n("sapphic-romance")).toBeGreaterThanOrEqual(10);
  });

  it("are exactly the JSON files in the folder, each file named for its slug (nobody is forgotten, nobody appears twice)", () => {
    expect(REFERENCE_AUTHORS.map((a) => a.slug).sort()).toEqual(fileSlugs);
    for (const a of REFERENCE_AUTHORS) {
      expect(JSON.parse(readFileSync(path.join(DIR, `${a.slug}.json`), "utf8")).slug).toBe(a.slug);
      expect(a.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(REFERENCE_AUTHORS.map((a) => a.slug)).size).toBe(REFERENCE_AUTHORS.length);
    expect(new Set(REFERENCE_AUTHORS.map((a) => a.name.toLowerCase())).size).toBe(REFERENCE_AUTHORS.length);
  });

  describe.each(REFERENCE_AUTHORS.map((a) => [a.slug, a] as const))("%s", (_slug, a) => {
    it("has the fields the page prints, shaped sensibly", () => {
      expect(CATEGORY_INFO[a.category]).toBeTruthy();
      expect(a.knownFor.length).toBeGreaterThan(20);
      expect(a.knownFor.length).toBeLessThanOrEqual(120);
      expect(a.years).toMatch(/\d/);
      expect(Number.isInteger(a.bornYear)).toBe(true);
      if (a.diedYear != null) {
        expect(a.diedYear).toBeGreaterThan(a.bornYear);
        expect(a.diedYear - a.bornYear).toBeLessThan(110);
      } else {
        expect(a.years).toMatch(/^born /);
        expect(a.bornYear).toBeGreaterThan(1900);
      }
      expect(a.nationality.length).toBeGreaterThan(2);
      expect(a.relevance.length).toBeGreaterThan(80);
      expect(a.influence.length).toBeGreaterThan(60);
      expect(a.tags.length).toBeGreaterThanOrEqual(2);
      expect(a.works.length).toBeGreaterThanOrEqual(1);
      for (const w of a.works) expect(w.title.trim().length).toBeGreaterThan(2);
      expect(a.events.length).toBeGreaterThanOrEqual(3);
    });

    it("lists events in time order", () => {
      const numeric = a.events.map((e) => (typeof e.year === "number" ? e.year : Number(/\d+/.exec(String(e.year))?.[0])) * (/BC/.test(String(e.year)) ? -1 : 1));
      expect(numeric).toEqual([...numeric].sort((x, y) => x - y));
      for (const e of a.events) expect(e.text.length).toBeGreaterThan(10);
    });

    it("carries a biography only if Valice does not already hold an approved one", () => {
      const inCatalogue = catalogueAuthors.some((c) => c.slug === a.slug);
      if (inCatalogue) {
        expect(a.bio, "the catalogue's biography is the one that prints").toBeUndefined();
      } else {
        expect(a.bio!.length).toBeGreaterThanOrEqual(2);
        for (const p of a.bio!) {
          expect(p.length).toBeGreaterThan(150);
          expect(p.length).toBeLessThan(1200);
        }
      }
    });

    it("links only to authors in the directory, never to itself", () => {
      expect(a.related.length).toBeGreaterThanOrEqual(2);
      expect(new Set(a.related).size).toBe(a.related.length);
      for (const r of a.related) {
        expect(r).not.toBe(a.slug);
        expect(getReferenceAuthor(r) ?? catalogueAuthors.find((c) => c.slug === r), `${a.slug} → ${r}`).toBeTruthy();
      }
    });

    it("names only shelves that exist in the catalogue", () => {
      for (const s of a.shelf ?? []) expect(catalogueCategories.has(s), `${a.slug} → ${s}`).toBe(true);
      if (a.category === "sapphic-romance") expect(a.shelf).toContain("romance");
    });

    it("is backed by Wikipedia, Wikidata and the Library of Congress, and says what it relies on", () => {
      expect(a.sources.length).toBeGreaterThanOrEqual(3);
      for (const s of a.sources) {
        expect(s.url).toMatch(/^https:\/\//);
        expect(s.label.length).toBeGreaterThan(5);
      }
      expect(new Set(a.sources.map((s) => s.url)).size).toBe(a.sources.length);
      for (const host of ["en.wikipedia.org", "www.wikidata.org", "id.loc.gov"]) expect(a.sources.some((s) => new URL(s.url).host === host), host).toBe(true);
      expect((a.evidence ?? []).length).toBeGreaterThanOrEqual(3);
      // a source that is known to disagree must be explained; an explained uncertainty needs no disagreeing source
      if (a.sources.some((s) => s.expectDateMismatch)) expect(a.dateDiscrepancy, "a known disagreement must be written down").toBeTruthy();
    });

    it("says nothing about Valice Press, and uses no placeholder or follower-count language", () => {
      const text = JSON.stringify([a.knownFor, a.bio, a.works, a.events, a.relevance, a.influence, a.tags]);
      expect(text).not.toMatch(/valice/i);
      expect(text).not.toMatch(/lorem|placeholder|\bTBD\b|\bTODO\b|coming soon/i);
      expect(text).not.toMatch(/\bfollowers?\b|subscribers?/i);
    });

    it("was verified against its sources, and the sources it was verified against are the ones it lists now", () => {
      const v = (verification.authors as Record<string, { ok: boolean; sources: Array<{ url: string; status: number }>; problems: string[] }>)[a.slug];
      expect(v, "run `node scripts/authors/verify-sources.mjs`").toBeTruthy();
      expect(v.problems).toEqual([]);
      expect(v.ok).toBe(true);
      expect(v.sources.map((s) => s.url).sort()).toEqual(a.sources.map((s) => s.url).sort());
      for (const s of v.sources) expect(s.status).toBe(200);
    });

    it("has a portrait that is the file that was checked, freely licensed and credited — or says why not", async () => {
      const file = path.join(PUB, `${a.slug}.webp`);
      if (!a.portrait) {
        expect(a.portraitNote, "an author without a photograph must say why").toBeTruthy();
        expect(existsSync(file), "an unreferenced portrait file").toBe(false);
        return;
      }
      const p = a.portrait;
      expect(p.src).toBe(`/images/authors/${a.slug}.webp`);
      expect(existsSync(file)).toBe(true);
      const bytes = readFileSync(file);
      expect(createHash("sha256").update(bytes).digest("hex"), "the published file differs from the one recorded").toBe(p.sha256);
      const m = await sharp(bytes).metadata();
      expect(m.format).toBe("webp");
      expect([m.width, m.height]).toEqual([p.width, p.height]);
      expect(Math.abs(p.width / p.height - 0.75)).toBeLessThan(0.005);
      expect(p.width).toBeLessThanOrEqual(900);
      expect(p.licence, "licence").toMatch(FREE_LICENCE);
      expect(`${p.licence} ${p.credit}`).not.toMatch(NON_FREE);
      expect(p.credit.length).toBeGreaterThan(8);
      expect(p.alt.length).toBeGreaterThan(8);
      expect(p.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(p.sourceSha1).toMatch(/^[0-9a-f]{40}$/);
      // CC BY / BY-SA need the author named where the picture is; the credit line must name someone.
      if (/CC BY/i.test(p.licence)) expect(p.credit).toMatch(/CC BY/);
    });
  });

  it("have no orphan portrait files (every published face belongs to a listed author)", () => {
    const faces = readdirSync(PUB).filter((f) => f.endsWith(".webp") && !f.startsWith("authors_hero"));
    for (const f of faces) {
      const slug = f.replace(/\.webp$/, "");
      const ref = getReferenceAuthor(slug);
      expect(ref?.portrait, `${f} is published but no author lists it`).toBeTruthy();
    }
  });

  it("do not include anyone the catalogue is not entitled to claim — no Valice relationship is stated or implied", () => {
    // The only people marked "published" are those with a published catalogue book.
    const dir = buildDirectory(published);
    for (const d of dir) {
      const hasBook = published.some((p) => p.slug === d.slug);
      expect(d.kind === "published", d.slug).toBe(hasBook);
    }
  });
});

describe("the directory", () => {
  const dir = buildDirectory(published);

  it("lists everyone once: researched authors and catalogue authors together", () => {
    const slugs = dir.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(dir.map((d) => d.name.toLowerCase())).size).toBe(dir.length);
    const union = new Set([...REFERENCE_AUTHORS.map((a) => a.slug), ...published.map((a) => a.slug)]);
    expect(dir.length).toBe(union.size);
    expect(dir.length).toBeGreaterThanOrEqual(25);
  });

  it("puts every catalogue author in a category on purpose", () => {
    for (const a of catalogueAuthors) {
      const known = getReferenceAuthor(a.slug) ? true : a.slug in CATALOGUE_AUTHOR_CATEGORY;
      expect(known, `${a.slug} has neither a researched file nor an entry in CATALOGUE_AUTHOR_CATEGORY`).toBe(true);
    }
  });

  it("marks the people Valice publishes, and only them, as published", () => {
    for (const slug of ["lafcadio-hearn", "marcus-aurelius", "henry-dudeney", "thomas-keightley", "sabine-baring-gould"]) {
      expect(dir.find((d) => d.slug === slug)?.kind, slug).toBe("published");
    }
    for (const slug of ["sarah-waters", "edgar-allan-poe", "martin-gardner", "radclyffe"]) {
      const d = dir.find((x) => x.slug === slug)!;
      expect(d.kind, slug).toBe("reference");
      expect(d.bookCount).toBe(0);
    }
  });

  it("falls back to the researched authors alone when the database has nothing (a build with no data still has a directory)", () => {
    const only = buildDirectory([]);
    expect(only.length).toBe(REFERENCE_AUTHORS.length);
    expect(only.every((d) => d.kind === "reference")).toBe(true);
  });

  it("makes search find a person by a work, a place, a tag or an accent-free name", () => {
    const find = (q: string) => dir.filter((d) => d.haystack.includes(q.toLowerCase())).map((d) => d.slug);
    expect(find("fingersmith")).toContain("sarah-waters");
    expect(find("kwaidan")).toContain("lafcadio-hearn");
    expect(find("tulsa")).toContain("martin-gardner");
    expect(find("emre dogan")).toContain("emre-dogan");
  });
});
