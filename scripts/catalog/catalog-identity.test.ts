/**
 * BOOK IDENTITY — no book may ever show another book's cover, preview, author or
 * Amazon link.
 *
 * `valice-catalog.test.ts` checks the rules a single record must obey. These
 * checks look ACROSS records and at the files on disk, because the way one book
 * ends up wearing another's face is never a bad field: it is two records that
 * point at the same image, an ASIN pasted under the wrong title, a preview folder
 * named for a sibling, a cover file nobody owns any more.
 *
 * Each assertion names the book that breaks it. Nothing here touches the network:
 * what Amazon says an ASIN is lives in `data/catalog/amazon-verification.json`,
 * written by `node scripts/catalog/verify-amazon-asins.mjs --catalog --out …`, and
 * is read as evidence. A new ASIN without a verification record FAILS this suite —
 * which is how "I pasted it from an email" stops being a way to add a link
 * (B0HG44FH1B was once given as The Sweetest Season's Kindle; it is World Games').
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AUTHORS, BOOKS } from "./valice-catalog.mjs";

interface Format {
  format: string;
  availability: string;
  fulfillment: string;
  amazonAsin?: string | null;
  amazonUrl?: string | null;
  isbn13?: string | null;
}
interface Book {
  slug: string;
  title: string;
  websiteStatus: "published" | "draft";
  authors: string[];
  series?: { name: string; volume?: number } | null;
  formats: Format[];
}

const books = BOOKS as unknown as Book[];
const authors = AUTHORS as unknown as Array<{ slug: string }>;
const ROOT = path.resolve(__dirname, "../..");
const PUBLIC = path.join(ROOT, "public");
const published = books.filter((b) => b.websiteStatus === "published");

const sha = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const ls = (dir: string) => (existsSync(dir) ? readdirSync(dir) : []);
const asinsOf = (b: Book) => b.formats.filter((f) => f.amazonAsin).map((f) => f.amazonAsin as string);

/**
 * ASINs that must never appear in the catalogue or in any shipped source file.
 * Each one was, at some point, wrongly believed to be a Valice Press link.
 */
const SUPERSEDED_OR_FOREIGN: Record<string, string> = {
  B0HG3KMK9L: "World Games, first-printing paperback (56 games) — replaced by B0HLLMNFTL",
  B0HG41F21F: "World Games, first-printing hardcover (56 games, 172 pp) — replaced by B0HLKPSLHH",
  B0HG44FH1B: "World Games Kindle — Amazon answers Page Not Found; there is no Kindle edition",
  B0FSDB21Q9: "another author named Quinn Gallagher",
  B0FS6L2ZQG: "another author named Quinn Gallagher",
  B0HMCK3L7B: "the wrong 'Kindle ASIN' in The Long Way Back's hardcover manifest",
};

describe("Amazon links", () => {
  it("never assigns one ASIN to two books, or to two formats", () => {
    const owner = new Map<string, string>();
    for (const b of books) {
      for (const f of b.formats) {
        if (!f.amazonAsin) continue;
        const where = `${b.slug}/${f.format}`;
        expect(owner.has(f.amazonAsin), `${f.amazonAsin} is on both ${owner.get(f.amazonAsin)} and ${where}`).toBe(false);
        owner.set(f.amazonAsin, where);
      }
    }
  });

  it("points every Amazon URL at its own ASIN's /dp/ page", () => {
    for (const b of books) {
      for (const f of b.formats) {
        if (!f.amazonUrl) continue;
        expect(f.amazonAsin, `${b.slug}/${f.format}: a URL with no ASIN`).toBeTruthy();
        const u = new URL(f.amazonUrl); // throws on a malformed URL
        expect(u.protocol, `${b.slug}/${f.format}`).toBe("https:");
        expect(u.hostname, `${b.slug}/${f.format}`).toBe("www.amazon.com");
        expect(u.pathname, `${b.slug}/${f.format}: the URL names a different ASIN than the row`).toBe(`/dp/${f.amazonAsin}`);
      }
    }
  });

  it("carries none of the ASINs that were once wrongly believed to be ours", () => {
    const all = new Set(books.flatMap(asinsOf));
    for (const [asin, why] of Object.entries(SUPERSEDED_OR_FOREIGN)) {
      expect(all.has(asin), `${asin} (${why}) is in the catalogue`).toBe(false);
    }
  });

  it("hard-codes no Amazon ASIN outside the catalogue", () => {
    // Every ASIN in a shipped source file must be one the catalogue owns, or one
    // of the deny-listed ASINs inside a comment explaining why it is banned.
    const owned = new Set(books.flatMap(asinsOf));
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const name of ls(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
          for (const m of readFileSync(full, "utf8").matchAll(/\bB0[A-Z0-9]{8}\b/g)) {
            if (!owned.has(m[0]) && !(m[0] in SUPERSEDED_OR_FOREIGN)) found.push(`${path.relative(ROOT, full)}: ${m[0]}`);
          }
        }
      }
    };
    walk(path.join(ROOT, "src"));
    for (const m of readFileSync(path.join(ROOT, "next.config.ts"), "utf8").matchAll(/\bB0[A-Z0-9]{8}\b/g)) {
      if (!owned.has(m[0])) found.push(`next.config.ts: ${m[0]}`);
    }
    expect(found, `ASINs not in the catalogue:\n${found.join("\n")}`).toEqual([]);
  });

  /**
   * THE IDENTITY CHECK. What Amazon prints at /dp/<ASIN> — title, selected format,
   * ISBN-13 — must be the book and format the catalogue says it is. Read from the
   * committed verification record, not from the network.
   */
  it("matches every ASIN to the right title, format and ISBN on the live Amazon page", () => {
    const file = path.join(ROOT, "data/catalog/amazon-verification.json");
    expect(existsSync(file), "run: node scripts/catalog/verify-amazon-asins.mjs --catalog --out data/catalog/amazon-verification.json").toBe(true);
    const records = JSON.parse(readFileSync(file, "utf8")) as Array<{
      asin: string;
      slug: string;
      state: string;
      title?: string;
      titleMatches?: boolean;
      formatMatches?: boolean;
      isbnMatches?: boolean | null;
    }>;
    const byAsin = new Map(records.map((r) => [r.asin, r]));
    for (const b of books) {
      for (const f of b.formats) {
        if (!f.amazonAsin) continue;
        const r = byAsin.get(f.amazonAsin);
        expect(r, `${b.slug}/${f.format} ${f.amazonAsin} has no verification record — run the verifier`).toBeDefined();
        expect(r!.slug, `${f.amazonAsin} was verified for a different book`).toBe(b.slug);
        expect(r!.state, `${b.slug}/${f.format} ${f.amazonAsin}: Amazon says ${r!.state}`).toBe("ok");
        expect(r!.titleMatches, `${b.slug}/${f.format} ${f.amazonAsin}: Amazon's title is "${r!.title}"`).toBe(true);
        expect(r!.formatMatches, `${b.slug}/${f.format} ${f.amazonAsin}: Amazon lists a different format`).toBe(true);
        expect(r!.isbnMatches, `${b.slug}/${f.format} ${f.amazonAsin}: the ISBN differs from Amazon's`).not.toBe(false);
      }
    }
  });

  it("gives every ISBN-13 a valid check digit", () => {
    for (const b of books) {
      for (const f of b.formats) {
        if (!f.isbn13) continue;
        const digits = f.isbn13.replace(/\D/g, "");
        expect(digits, `${b.slug}/${f.format}: ISBN ${f.isbn13}`).toMatch(/^\d{13}$/);
        const sum = [...digits].slice(0, 12).reduce((n, d, i) => n + Number(d) * (i % 2 ? 3 : 1), 0);
        expect((10 - (sum % 10)) % 10, `${b.slug}/${f.format}: ISBN ${f.isbn13} check digit`).toBe(Number(digits[12]));
      }
    }
  });
});

describe("authors and series", () => {
  it("names only authors that exist, and uses every author it defines", () => {
    const known = new Set(authors.map((a) => a.slug));
    const used = new Set<string>();
    for (const b of books) {
      expect(b.authors.length, `${b.slug} has no author`).toBeGreaterThan(0);
      for (const a of b.authors) {
        expect(known.has(a), `${b.slug} names an unknown author "${a}"`).toBe(true);
        used.add(a);
      }
    }
    for (const a of known) expect(used.has(a), `author "${a}" has no book`).toBe(true);
  });

  it("never puts two books in the same slot of a series", () => {
    const seen = new Map<string, string>();
    for (const b of books) {
      if (!b.series?.volume) continue;
      const key = `${b.series.name} #${b.series.volume}`;
      // The Great Book of… is a series of unrelated titles; its volumes are all distinct anyway.
      expect(seen.has(key), `${b.slug} and ${seen.get(key)} are both "${key}"`).toBe(false);
      seen.set(key, b.slug);
    }
  });
});

describe("images belong to exactly one book", () => {
  const coverDir = path.join(PUBLIC, "images/books");

  it("gives every published book its own front cover and thumbnail", () => {
    for (const b of published) {
      expect(existsSync(path.join(coverDir, `${b.slug}.webp`)), `${b.slug}: no cover`).toBe(true);
      expect(existsSync(path.join(coverDir, "thumb", `${b.slug}.webp`)), `${b.slug}: no thumbnail`).toBe(true);
    }
  });

  it("never lets two books share a front cover, a back cover or a thumbnail (compared by bytes)", () => {
    for (const dir of [coverDir, path.join(coverDir, "back"), path.join(coverDir, "thumb")]) {
      const seen = new Map<string, string>();
      for (const name of ls(dir).filter((n) => n.endsWith(".webp"))) {
        const h = sha(path.join(dir, name));
        expect(seen.has(h), `${path.relative(PUBLIC, path.join(dir, name))} is byte-identical to ${seen.get(h)}`).toBe(false);
        seen.set(h, path.relative(PUBLIC, path.join(dir, name)));
      }
    }
  });

  it("leaves no orphaned cover, back cover, thumbnail or preview folder", () => {
    const slugs = new Set(books.map((b) => b.slug));
    const orphans: string[] = [];
    for (const [dir, label] of [
      [coverDir, "cover"],
      [path.join(coverDir, "back"), "back cover"],
      [path.join(coverDir, "thumb"), "thumbnail"],
    ] as const) {
      for (const name of ls(dir).filter((n) => n.endsWith(".webp"))) {
        if (!slugs.has(name.replace(/\.webp$/, ""))) orphans.push(`${label}: ${name}`);
      }
    }
    for (const name of ls(path.join(PUBLIC, "images/previews"))) {
      if (!slugs.has(name)) orphans.push(`preview folder: ${name}`);
    }
    expect(orphans, orphans.join("\n")).toEqual([]);
  });

  it("keeps every preview page in its own book's folder, and never reuses one across books", async () => {
    const { previewSlugs, getPreview } = await import("../../src/lib/previews/index.js");
    const seen = new Map<string, string>();
    for (const slug of previewSlugs()) {
      for (const page of getPreview(slug)!.pages) {
        expect(page.src.startsWith(`/images/previews/${slug}/`), `${slug} previews ${page.src}`).toBe(true);
        const file = path.join(PUBLIC, page.src);
        expect(existsSync(file), `${slug}: ${page.src} was never rendered`).toBe(true);
        const h = sha(file);
        expect(seen.has(h), `${slug}'s ${page.src} is byte-identical to ${seen.get(h)}`).toBe(false);
        seen.set(h, `${slug}:${page.src}`);
      }
    }
  });
});

describe("art provenance", () => {
  const file = path.join(ROOT, "src/content/book-art-provenance.json");
  const records: Record<string, { output: string; outputSha256: string; source: string; sourceSha256: string; width: number; height: number }> = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : {};

  it("traces every ingested image to the file it was made from", () => {
    expect(Object.keys(records).length, "no provenance records").toBeGreaterThan(0);
    for (const [key, r] of Object.entries(records)) {
      const slug = key.split(":")[0];
      expect(books.some((b) => b.slug === slug), `${key}: not a catalogue book`).toBe(true);
      // the output path is the slug's own, by construction of the slot convention
      expect(r.output, `${key} → ${r.output}`).toContain(`/${slug}`);
      const out = path.join(PUBLIC, r.output);
      expect(existsSync(out), `${key}: ${r.output} is missing`).toBe(true);
      expect(sha(out), `${key}: ${r.output} changed since it was ingested — re-run scripts/covers/ingest-art.mjs`).toBe(r.outputSha256);
      expect(r.sourceSha256, `${key}: no source hash`).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
