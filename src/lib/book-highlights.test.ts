import { describe, expect, it } from "vitest";

import { BOOKS } from "../../scripts/catalog/valice-catalog.mjs";

import highlights from "@/content/book-highlights.json";

/**
 * A chip on a book's page is a claim about the book, so each carries the words
 * of the book's own record that make it. This fails if the words are not there:
 * a chip cannot say "Slow Burn" because slow burn is what the genre does.
 */

interface CatalogBook {
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  idealReader?: string | null;
  websiteStatus: string;
}
const CATALOG = BOOKS as unknown as CatalogBook[];
const bySlug = new Map(CATALOG.map((b) => [b.slug, b]));

const norm = (t: string) =>
  t
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase();

const entries = Object.entries(highlights as Record<string, { label: string; evidence: string }[] | string>).filter(
  ([slug]) => !slug.startsWith("_"),
) as [string, { label: string; evidence: string }[]][];

describe("book-highlights.json — every chip is the book's own claim", () => {
  it("names only books in the catalogue", () => {
    for (const [slug] of entries) expect(bySlug.has(slug), `${slug} is not in the catalogue`).toBe(true);
  });

  it("covers every published book with at least four chips (no more than seven)", () => {
    const have = new Map(entries);
    for (const b of CATALOG.filter((x) => x.websiteStatus === "published")) {
      const chips = have.get(b.slug) ?? [];
      expect(chips.length, `${b.slug}`).toBeGreaterThanOrEqual(4);
      expect(chips.length, `${b.slug}`).toBeLessThanOrEqual(7);
    }
  });

  it.each(entries.map(([slug, chips]) => [slug, chips] as const))("%s: each chip's evidence is in its record", (slug, chips) => {
    const book = bySlug.get(slug)!;
    const record = norm([book.title, book.subtitle, book.description, book.idealReader].filter(Boolean).join(" \n "));
    const seen = new Set<string>();
    for (const chip of chips) {
      expect(chip.label.trim().length, `${slug}: empty label`).toBeGreaterThan(1);
      expect(chip.label.length, `${slug}: "${chip.label}" is too long for a chip`).toBeLessThanOrEqual(38);
      expect(seen.has(chip.label), `${slug}: duplicate chip "${chip.label}"`).toBe(false);
      seen.add(chip.label);
      expect(record.includes(norm(chip.evidence)), `${slug}: "${chip.label}" — evidence not in the record: “${chip.evidence}”`).toBe(true);
    }
  });
});
