// @vitest-environment node
import { describe, expect, it } from "vitest";

import { AUTHORS, BOOKS, CATEGORIES } from "../../scripts/catalog/valice-catalog.mjs";

import { PUBLIC_EMAIL } from "./contact";
import { SHELF_COPY, STANDARDS } from "./about-copy";

/**
 * The About page makes claims about the catalogue — how many shelves, what is on each, what a book does.
 * Every one of them is checked here against the catalogue's own text, so the page cannot say "sixty-three
 * games" of a book that has sixty-four, or name a book that was withdrawn.
 */

interface Book {
  slug: string;
  title: string;
  description: string;
  onelinePromise: string;
  websiteStatus: string;
  series?: { name: string } | null;
  categories: string[];
}
const books = BOOKS as Book[];
const bySlug = (s: string) => books.find((b) => b.slug === s);
const published = books.filter((b) => b.websiteStatus === "published");
/** The title as a sentence would name it: before any subtitle, without a volume number. */
const short = (b: Book) => b.title.split(":")[0].replace(/,?\s+Volume\s+[IVX\d]+$/i, "").trim();
const text = (slug: string) => `${bySlug(slug)?.onelinePromise ?? ""} ${bySlug(slug)?.description ?? ""}`.toLowerCase();

describe("About copy: shelves", () => {
  it("has a sentence for every catalogue category that has a published book, and for no other", () => {
    const live = new Set(published.flatMap((b) => b.categories));
    expect(Object.keys(SHELF_COPY).sort()).toEqual([...live].sort());
    const defined = new Set((CATEGORIES as Array<{ slug: string }>).map((c) => c.slug));
    for (const slug of Object.keys(SHELF_COPY)) expect(defined.has(slug), slug).toBe(true);
  });

  it("names only published books, each of which the sentence mentions by title or by its series", () => {
    for (const [shelf, copy] of Object.entries(SHELF_COPY)) {
      expect(copy.blurb.length, shelf).toBeGreaterThan(60);
      for (const slug of copy.books) {
        const b = bySlug(slug);
        expect(b, `${shelf}: ${slug} is not in the catalogue`).toBeTruthy();
        expect(b!.websiteStatus, `${shelf}: ${slug}`).toBe("published");
        expect(b!.categories, `${slug} is not on the ${shelf} shelf`).toContain(shelf);
        const named = copy.blurb.includes(short(b!)) || (b!.series && copy.blurb.includes(b!.series.name.replace(/^The /, "")));
        expect(named, `${shelf}: the sentence does not mention ${b!.title}`).toBe(true);
      }
    }
  });

  it("names only authors the catalogue has", () => {
    const names = (AUTHORS as Array<{ name: string }>).map((a) => a.name);
    expect(SHELF_COPY.romance.blurb).toContain("Harper Hayes");
    expect(SHELF_COPY.romance.blurb).toContain("Quinn Gallagher");
    for (const n of ["Harper Hayes", "Quinn Gallagher"]) expect(names).toContain(n);
    // series named in the sentence exist
    const series = new Set(published.map((b) => b.series?.name));
    expect(series.has("The Larkspur Lake Novels")).toBe(true);
    expect(series.has("Bristlecone Emergency")).toBe(true);
  });

  it("states numbers the books themselves state", () => {
    expect(SHELF_COPY["games-and-play"].blurb).toMatch(/sixty-three traditional games/);
    expect(text("the-great-book-of-world-games")).toContain("sixty-three traditional games");
    expect(SHELF_COPY["puzzle-and-challenge"].blurb).toMatch(/a hundred myth puzzles/);
    expect(text("codex-mythologica-the-puzzle-book")).toContain("a hundred myth puzzles");
    expect(SHELF_COPY["young-explorers"].blurb).toMatch(/aged 8 to 12/);
    for (const s of ["the-great-book-of-world-myths", "the-myth-hunters-field-book"]) expect(text(s), s).toMatch(/ages 8[–-]12/);
    expect(text("korean-games")).toContain("culin");
    expect(text("games-ancient-and-oriental")).toContain("falkener");
    expect(text("words-from-the-gods")).toMatch(/everyday english words/);
    expect(text("the-myth-hunters-field-book")).toContain("something a real culture actually made");
  });
});

describe("About copy: the editorial standard", () => {
  it("ties each promise to a published book and quotes what that book says", () => {
    expect(STANDARDS).toHaveLength(3);
    for (const s of STANDARDS) {
      const b = bySlug(s.example.slug);
      expect(b, s.example.slug).toBeTruthy();
      expect(b!.websiteStatus).toBe("published");
      expect(s.example.label.startsWith(short(b!)), s.example.label).toBe(true);
    }
    expect(text("how-the-world-began")).toContain("thirty creation myths");
    expect(text("how-the-world-began")).toContain("source named, dated and taken apart");
    expect(text("words-from-the-gods")).toContain("a hundred and forty-five");
    expect(text("words-from-the-gods")).toContain("the evidence");
    expect(text("games-ancient-and-oriental")).toContain("the seam marked");
    expect(text("games-ancient-and-oriental")).toContain("what falkener supplied");
  });

  it("makes the 'game classics' claim only for editions whose own text separates evidence from theory", () => {
    expect(text("korean-games")).toMatch(/line drawn.*between what culin watched and what he concluded/);
    expect(text("chess-and-playing-cards")).toMatch(/read apart from the theory/);
  });
});

describe("contact", () => {
  it("the public address is the press's own", () => {
    expect(PUBLIC_EMAIL).toBe("hello@valicepress.com");
  });
});
