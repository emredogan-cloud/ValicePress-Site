#!/usr/bin/env -S npx tsx
/**
 * The two data tables the final reports are built on, printed as Markdown from the catalogue and the Amazon evidence.
 *
 *   npx tsx scripts/qa/report-tables.mts catalogue     > /tmp/catalogue-table.md
 *   npx tsx scripts/qa/report-tables.mts amazon [--live AUDIT/data/amazon-asins-FINAL-2026-10-08.json]
 *
 * `catalogue` — every book in the order the storefront draws it (the pins first, then newest first), with the facts
 *               the catalogue file holds: shelf, series, pages, each format and where it is sold, KDP Select, status.
 * `amazon`    — every ASIN the catalogue claims, with the URL it produces, what the live page says it is (title, format,
 *               ISBN-13, pages), whether those agree with the catalogue row, and when it was read.
 *
 * Read-only, offline: it reads files only (the live evidence is produced by `scripts/catalog/verify-amazon-asins.mjs`).
 */
import fs from "node:fs";
import path from "node:path";

import { withPinnedFirst } from "@/lib/pinned-books";

import { AUTHORS, BOOKS, CATEGORIES } from "../catalog/valice-catalog.mjs";

interface Format {
  format: string;
  availability: string;
  fulfillment: string;
  priceCents: number;
  pageCount?: number | null;
  isbn13?: string | null;
  amazonAsin?: string | null;
  amazonUrl?: string | null;
  kdp?: string;
}
interface Book {
  slug: string;
  title: string;
  authors: string[];
  categories: string[];
  series?: { name: string; volume?: number } | null;
  websiteStatus: string;
  publishedOn?: string | null;
  pageCount?: number | null;
  kdpSelect?: boolean;
  directSale?: boolean;
  formats: Format[];
}
const books = BOOKS as Book[];
const authorName = new Map((AUTHORS as Array<{ slug: string; name: string }>).map((a) => [a.slug, a.name]));
const shelfName = new Map((CATEGORIES as Array<{ slug: string; name: string }>).map((c) => [c.slug, c.name]));

const dollars = (c: number) => (c > 0 ? `$${(c / 100).toFixed(2)}` : "—");
const LABEL: Record<string, string> = { ebook: "ebook", paperback: "paperback", hardcover: "hardcover", large_print: "large print" };

function catalogue() {
  // The storefront's order: the pinned books first, then newest first (published date, then slug).
  const ordered = withPinnedFirst([...books].sort((a, b) => String(b.publishedOn ?? "").localeCompare(String(a.publishedOn ?? "")) || a.slug.localeCompare(b.slug)));
  console.log("| # | Book | Author | Shelf | Series | Formats and where they are sold | Pages | KDP Select | Status |");
  console.log("|---|------|--------|-------|--------|---------------------------------|-------|------------|--------|");
  ordered.forEach((b, i) => {
    const fmts = b.formats
      .map((f) => {
        const where = f.fulfillment === "direct" ? "sold here" : f.amazonAsin ? `Amazon ${f.amazonAsin}` : "Amazon";
        const live = f.availability === "available" ? "" : ` (${f.availability.replace("_", " ")})`;
        return `${LABEL[f.format] ?? f.format} ${dollars(f.priceCents)} ${where}${live}`;
      })
      .join("; ");
    const series = b.series ? `${b.series.name}${b.series.volume ? ` #${b.series.volume}` : ""}` : "—";
    const status = b.websiteStatus === "published" ? "published" : `**${b.websiteStatus}** (not on the site)`;
    console.log(
      `| ${i + 1} | ${b.title} (\`${b.slug}\`) | ${b.authors.map((s) => authorName.get(s) ?? s).join(", ")} | ${b.categories.map((c) => shelfName.get(c) ?? c).join(", ")} | ${series} | ${fmts} | ${b.pageCount ?? "—"} | ${b.kdpSelect ? "**yes**" : "no"} | ${status} |`,
    );
  });
}

interface Live {
  asin: string;
  slug?: string;
  title?: string;
  format?: string;
  isbn13?: string | null;
  pages?: number | null;
  state?: string;
  status?: number;
  checkedOn?: string;
  checkedAt?: string;
}
function amazon() {
  const i = process.argv.indexOf("--live");
  const livePath = i >= 0 ? process.argv[i + 1] : null;
  const read = (p: string): Live[] => JSON.parse(fs.readFileSync(path.join(process.cwd(), p), "utf8"));
  const before = new Map(read("data/catalog/amazon-verification.json").map((v) => [v.asin, v]));
  const now = livePath ? new Map(read(livePath).map((v) => [v.asin, v])) : null;
  const kind = (f: string | undefined) => String(f ?? "").toLowerCase().replace("kindle", "ebook");
  console.log("| ASIN | Book | Registry format | Link is `/dp/<ASIN>` | Live page: format · ISBN-13 · pages | Registry ISBN agrees | State 2026-10-07 | State now |");
  console.log("|------|------|-----------------|-----------------------|-------------------------------------|----------------------|------------------|-----------|");
  let n = 0;
  for (const b of books) {
    for (const f of b.formats) {
      if (!f.amazonAsin) continue;
      n++;
      const live = now?.get(f.amazonAsin) ?? before.get(f.amazonAsin);
      const urlOk = f.amazonUrl === `https://www.amazon.com/dp/${f.amazonAsin}`;
      // A Kindle page prints no ISBN-13, so for an ebook there is nothing to compare unless Amazon shows one.
      const isbnOk = f.format === "ebook" && !live?.isbn13 ? null : f.isbn13 ? (live?.isbn13 ? live.isbn13.replace(/-/g, "") === f.isbn13.replace(/-/g, "") : false) : null;
      const kindOk = kind(live?.format).replace("large_print", "paperback") === f.format.replace("large_print", "paperback");
      console.log(
        `| \`${f.amazonAsin}\` | ${b.title} | ${LABEL[f.format] ?? f.format} | ${urlOk ? "yes" : "**NO**"} | ${live ? `${live.format ?? "?"}${kindOk ? "" : " **≠ registry**"} · ${live.isbn13 ?? "—"} · ${live.pages ?? "—"}` : "**not read**"} | ${isbnOk === null ? "n/a" : isbnOk ? "yes" : "**NO**"} | ${before.get(f.amazonAsin)?.state ?? "—"} | ${now ? (now.get(f.amazonAsin)?.state ?? "**not read**") : "—"} |`,
      );
    }
  }
  console.log(`\n${n} ASINs.`);
}

const mode = process.argv[2];
if (mode === "catalogue") catalogue();
else if (mode === "amazon") amazon();
else {
  console.error("usage: report-tables.mts catalogue | amazon [--live <json>]");
  process.exit(2);
}
