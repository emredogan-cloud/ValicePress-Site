import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import provenance from "@/content/book-art-provenance.json";
import media from "@/content/book-media.json";
import manifest from "@/lib/asset-manifest.json";

import { getBookPreview, previewPanels, TARGET_PANELS, type QuoteProof, type QuoteVisual } from "./book-media";

/**
 * A quotation on a book's preview is a claim about the book. These tests do not
 * re-read the manuscripts (they are not on a CI machine); they refuse a record that
 * has not been PROVED — `scripts/previews/verify-quotes.mjs --write` stores the proof —
 * and a card whose image is not the one that was made from that record.
 */

type Entry = { interior?: string; quoteVisuals: QuoteVisual[] };
const MEDIA = media as unknown as Record<string, Entry>;
const PROVENANCE = provenance as unknown as Record<string, { outputSha256: string; width: number; height: number; output: string }>;
const PUBLIC = path.join(process.cwd(), "public");
const records = Object.entries(MEDIA).flatMap(([slug, e]) => e.quoteVisuals.map((q, i) => ({ slug, n: i + 1, q, entry: e })));

const SHA256 = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function expectProof(proof: QuoteProof | undefined, label: string) {
  expect(proof, `${label}: no proof recorded`).toBeTruthy();
  expect(proof!.source, `${label}: source`).toMatch(/\.(md|pdf|json)$/i);
  expect(proof!.sourceSha256, `${label}: source SHA-256`).toMatch(SHA256);
  expect(proof!.checkedAt, `${label}: checkedAt`).toMatch(ISO_DATE);
  expect(proof!.method.length, `${label}: method`).toBeGreaterThan(20);
}

describe("book-media.json — every quotation is proved, not asserted", () => {
  it("has records to test", () => {
    expect(records.length).toBeGreaterThanOrEqual(14);
  });

  it.each(records.map((r) => [`${r.slug} quote ${r.n}`, r] as const))("%s carries the proof that it is the book's own text", (_label, { slug, n, q, entry }) => {
    const label = `${slug} quote ${n}`;
    expectProof(q.verification, label);
    // A book with a printed interior is checked against it as well as against the manuscript.
    if (entry.interior) {
      expectProof(q.verification.interior, `${label} (printed interior)`);
      expect(q.verification.interior!.source, label).toBe(entry.interior);
    }
  });

  it.each(records.map((r) => [`${r.slug} quote ${r.n}`, r] as const))("%s is set the way a book prints it", (_label, { q }) => {
    // typographic quotation marks and apostrophes, as the printed books use
    expect(q.quote, "straight quote marks").not.toMatch(/["']/);
    // no markdown emphasis left in a passage that is going to be typeset
    expect(q.quote, "markdown markers").not.toMatch(/[*_]/);
    expect(q.quote, "surrounding whitespace").toBe(q.quote.trim());
    expect(q.quote, "blank paragraph or double space").not.toMatch(/\n\s*\n|  /);
    expect(q.sourceLocation.trim().length, "where it is from").toBeGreaterThan(2);
    // long enough to be a passage, short enough to be read at a glance on a phone
    const words = q.quote.split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(15);
    expect(words).toBeLessThanOrEqual(95);
  });

  it("no two books share a quotation", () => {
    const seen = new Map<string, string>();
    for (const { slug, n, q } of records) {
      const owner = seen.get(q.quote);
      expect(owner, `${slug} quote ${n} is also ${owner}`).toBeUndefined();
      seen.set(q.quote, `${slug} quote ${n}`);
    }
  });

  it("every card lives under its own book's slug, in order, and is the file that was ingested", () => {
    for (const { slug, n, q } of records) {
      expect(q.image, `${slug} quote ${n}`).toBe(`/images/previews/${slug}/quote-${n}.webp`);
      const file = path.join(PUBLIC, q.image);
      expect(existsSync(file), `${q.image} is missing`).toBe(true);

      const rec = PROVENANCE[`${slug}:quote-${n}`];
      expect(rec, `${slug}:quote-${n} has no provenance`).toBeTruthy();
      expect(rec.output).toBe(q.image);
      expect(rec.outputSha256, `${q.image} is not the file that was ingested`).toBe(createHash("sha256").update(readFileSync(file)).digest("hex"));
      expect([rec.width, rec.height], q.image).toEqual([1000, 1500]);
    }
  });

  it("the asset manifest lists exactly these cards", () => {
    const inManifest = (manifest as { assets: { path: string; slot: string }[] }).assets.filter((a) => a.slot === "book-quote").map((a) => a.path).sort();
    expect(inManifest).toEqual(records.map((r) => r.q.image).sort());
  });
});

describe("previewPanels — front, back, two passages", () => {
  const withQuotes = Object.keys(MEDIA);
  /** The books the brief names first: each must open with exactly front, back, passage, passage. */
  const PRIORITY = ["weather-permitting", "ridge-runner", "the-sweetest-season", "the-great-book-of-world-games", "codex-bestiarium", "the-long-way-back", "all-the-quiet-places"];

  it("every published book has two verified passages", () => {
    expect(withQuotes.length).toBeGreaterThanOrEqual(37);
    for (const slug of withQuotes) expect(MEDIA[slug].quoteVisuals, slug).toHaveLength(2);
  });

  it.each(withQuotes)("%s opens with its own cover, its own passages, and nothing of another book's", (slug) => {
    const panels = previewPanels({ slug, title: "T" });
    const kinds = panels.map((p) => p.kind).join(",");
    // a book with no printed edition has no back cover: it is NOT padded with someone else's — its fourth panel is its own interior page
    expect(kinds, slug).toMatch(/^front(,back)?,quote,quote(,interior)*$/);
    expect(panels.length, slug).toBeGreaterThanOrEqual(3);
    expect(panels.length, slug).toBeLessThanOrEqual(TARGET_PANELS);
    for (const p of panels) expect(p.src, `${slug}: ${p.kind}`).toContain(slug);
    const preview = getBookPreview(slug);
    expect(preview.quoteVisuals.map((v) => v.image)).toEqual(panels.filter((p) => p.kind === "quote").map((p) => p.src));
  });

  it.each(PRIORITY)("%s shows exactly front, back, passage, passage", (slug) => {
    expect(previewPanels({ slug, title: "T" }).map((p) => p.kind)).toEqual(["front", "back", "quote", "quote"]);
  });

  it("a quote card's alt text carries the quotation, on one line", () => {
    const panels = previewPanels({ slug: "weather-permitting", title: "Weather Permitting" });
    const quote = panels.find((p) => p.kind === "quote")!;
    expect(quote.alt).toContain("Weather Permitting (Chapter 1)");
    expect(quote.alt).toContain("It’s not a definitive diagnosis.”");
    expect(quote.alt).not.toContain("\n");
  });

  it("a book with no records borrows nothing from another book", () => {
    const panels = previewPanels({ slug: "no-such-book", title: "None" });
    expect(panels.every((p) => p.kind === "interior" || p.src.includes("no-such-book"))).toBe(true);
    expect(panels.filter((p) => p.kind === "quote")).toHaveLength(0);
  });
});
