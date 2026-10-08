#!/usr/bin/env -S npx tsx
/**
 * The master book matrix: one row per book, one column per thing the brief says a book must get right — and every
 * cell a measurement, not a statement.
 *
 *   npx tsx scripts/qa/book-matrix.mts                                   # the sandbox server on :3210
 *   npx tsx scripts/qa/book-matrix.mts --phone docs/execution/mobile/phase-15/books-phone.json \
 *       --out AUDIT/FINAL-BOOK-MATRIX.md --json AUDIT/data/final-book-matrix-2026-10-08.json
 *
 * It reads the same sources the site reads (the catalogue file, the preview-panel builder, the author records) and
 * asks the RUNNING site what it says about each book, then compares. Nothing is hand-entered:
 *
 *   Listing      the book is on /books (and on /ebooks exactly when the catalogue says an ebook can be had)
 *   Detail page  /books/<slug> answers 200, its <h1> is the title, its structured data is a Book with that name
 *   Cover        the hero picture is THIS book's file (/images/books/<slug>.webp), decodes, and is a cover's shape
 *   Back cover   present where the book has a printed edition AND a wrap to crop it from; the file decodes
 *   Preview      the four panels the quick view shows: every one is this book's file and names this title
 *   Amazon       the page links exactly the editions the catalogue gives it, and each ASIN was read off its live page
 *   Author       the page names the catalogue's author(s) and links their pages
 *   Mobile QA    the physical phone's sweep (scripts/mobile/books.mjs): popup and page, with a real finger
 *
 * A draft book is not a failure: its row must show it is ABSENT (404, not listed, not in the sitemap).
 */
import fs from "node:fs";
import path from "node:path";

// @ts-expect-error -- jsdom ships no type declarations in this project (the .mjs audits import it the same way)
import { JSDOM } from "jsdom";
import { chromium } from "@playwright/test";
import sharp from "sharp";

import { previewPanels } from "@/lib/book-media";

import { AUTHORS, BOOKS } from "../catalog/valice-catalog.mjs";

const argv = process.argv.slice(2);
const arg = (n: string, d: string | null = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const BASE = (arg("base", "http://localhost:3210") as string).replace(/\/$/, "");
const PHONE = arg("phone");
const OUT_MD = arg("out");
const OUT_JSON = arg("json");

interface Format {
  format: string;
  availability: string;
  amazonUrl?: string | null;
  amazonAsin?: string | null;
}
interface Book {
  slug: string;
  title: string;
  authors: string[];
  websiteStatus: string;
  formats: Format[];
}
const books = BOOKS as Book[];
const authorName = new Map((AUTHORS as Array<{ slug: string; name: string }>).map((a) => [a.slug, a.name]));
const PRIORITY = ["weather-permitting", "ridge-runner", "the-sweetest-season", "the-great-book-of-world-games", "codex-bestiarium", "the-long-way-back", "all-the-quiet-places"];

const verification = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/catalog/amazon-verification.json"), "utf8")) as Array<{ asin: string; state: string; status: number }>;
const verified = new Map(verification.map((v) => [v.asin, v]));

const phone: null | { popups: Array<{ slug: string; problems: string[]; panels: number }>; pages: Array<{ slug: string; problems: string[] }>; browser?: string } = PHONE ? JSON.parse(fs.readFileSync(PHONE, "utf8")) : null;

async function get(p: string, init?: RequestInit) {
  return fetch(`${BASE}${p}`, { redirect: "manual", ...init });
}
/**
 * Every book a listing offers, across its pages. The pages are drawn in the browser (the address bar says which one),
 * so a plain fetch of `?page=2` is page 1 again — this opens each in a real browser and reads the cards.
 */
async function listed(prefix: "/books" | "/ebooks"): Promise<Set<string>> {
  const out = new Set<string>();
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    for (let n = 1; n <= 8; n++) {
      await page.goto(`${BASE}${prefix}?page=${n}`, { waitUntil: "load" });
      await page.waitForSelector('ul a[href^="/books/"]');
      await page.waitForTimeout(600);
      const found = await page.$$eval('ul a[href^="/books/"]', (as) => as.map((a) => (a.getAttribute("href") ?? "").replace("/books/", "")));
      const fresh = found.filter((s) => !out.has(s));
      if (fresh.length === 0) break;
      for (const s of found) out.add(s);
    }
  } finally {
    await browser.close();
  }
  return out;
}
async function decodes(p: string): Promise<{ ok: boolean; w?: number; h?: number; why?: string }> {
  const res = await get(p.startsWith("/_next") ? p : `/_next/image?url=${encodeURIComponent(p)}&w=1080&q=75`);
  if (res.status !== 200) return { ok: false, why: `HTTP ${res.status}` };
  try {
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    return { ok: !!meta.width && !!meta.height, w: meta.width, h: meta.height };
  } catch (e) {
    return { ok: false, why: String((e as Error).message).slice(0, 60) };
  }
}
const imgPath = (src: string) => {
  const m = src.match(/[?&]url=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : src;
};

const [onBooks, onEbooks] = await Promise.all([listed("/books"), listed("/ebooks")]);
const sitemap = await (await get("/sitemap.xml")).text();
const inSitemap = (slug: string) => sitemap.includes(`/books/${slug}<`);

interface Cell {
  ok: boolean;
  text: string;
}
interface Row {
  slug: string;
  title: string;
  status: string;
  priority: boolean;
  listing: Cell;
  detail: Cell;
  cover: Cell;
  back: Cell;
  preview: Cell;
  amazon: Cell;
  author: Cell;
  mobile: Cell;
  pass: boolean;
  notes: string[];
}
const rows: Row[] = [];

for (const b of books) {
  const priority = PRIORITY.includes(b.slug);
  const notes: string[] = [];
  const cell = (ok: boolean, text: string): Cell => ({ ok, text });

  if (b.websiteStatus !== "published") {
    // a draft must be ABSENT: no page, no listing, not in the sitemap
    const res = await get(`/books/${b.slug}`);
    const absent = res.status === 404 && !onBooks.has(b.slug) && !onEbooks.has(b.slug) && !inSitemap(b.slug);
    const no = cell(true, "—");
    rows.push({
      slug: b.slug,
      title: b.title,
      status: b.websiteStatus,
      priority,
      listing: cell(absent, absent ? "absent (correct)" : "LISTED"),
      detail: cell(absent, absent ? `${res.status}` : `${res.status}`),
      cover: no,
      back: no,
      preview: no,
      amazon: cell(true, "none (no live edition)"),
      author: no,
      mobile: no,
      pass: absent,
      notes: [`${b.websiteStatus}: it has no live KDP edition, so it is not on the site. Publishing it is a catalogue edit.`],
    });
    continue;
  }

  const res = await get(`/books/${b.slug}`);
  const html = res.status === 200 ? await res.text() : "";
  const doc = html ? new JSDOM(html).window.document : null;

  // Listing
  const hasEbook = b.formats.some((f) => f.format === "ebook" && f.availability === "available");
  const listingOk = onBooks.has(b.slug) && onEbooks.has(b.slug) === hasEbook && inSitemap(b.slug);
  const listing = cell(listingOk, `/books ${onBooks.has(b.slug) ? "✓" : "✗"} · /ebooks ${onEbooks.has(b.slug) ? "✓" : "–"}${onEbooks.has(b.slug) === hasEbook ? "" : " ✗"} · sitemap ${inSitemap(b.slug) ? "✓" : "✗"}`);

  // Detail page
  let detailOk = false;
  let detailText = `HTTP ${res.status}`;
  let ldBook: { name?: string; author?: unknown } | null = null;
  if (doc) {
    const h1 = doc.querySelector("h1")?.textContent?.trim();
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const j = JSON.parse(s.textContent ?? "null");
        const all = Array.isArray(j) ? j : j?.["@graph"] ? j["@graph"] : [j];
        const hit = all.find((n: { "@type"?: string }) => n?.["@type"] === "Book");
        if (hit) ldBook = hit;
      } catch {
        /* not JSON-LD we can read */
      }
    }
    detailOk = h1 === b.title && ldBook?.name === b.title;
    detailText = `200 · h1 ${h1 === b.title ? "✓" : "✗"} · Book ${ldBook?.name === b.title ? "✓" : "✗"}`;
  }

  // Cover
  const panels = previewPanels({ slug: b.slug, title: b.title });
  const heroImg = doc?.querySelector<HTMLImageElement>('#overview img[alt^="Cover of "]');
  const heroPath = heroImg ? imgPath(heroImg.getAttribute("src") ?? "") : "";
  const front = panels.find((p) => p.kind === "front");
  const frontDecode = front ? await decodes(front.src) : { ok: false, why: "no front panel" };
  const coverOk = !!front && heroPath === front.src && front.src === `/images/books/${b.slug}.webp` && frontDecode.ok && Math.abs((frontDecode.w ?? 1) / (frontDecode.h ?? 1) - 2 / 3) < 0.12;
  const cover = cell(coverOk, coverOk ? `own file · ${frontDecode.w}×${frontDecode.h}` : `hero ${heroPath || "none"} vs ${front?.src ?? "none"} (${frontDecode.why ?? `${frontDecode.w}×${frontDecode.h}`})`);

  // Back cover
  const hasPrint = b.formats.some((f) => /paperback|hardcover|large/i.test(f.format) && f.availability === "available");
  const back = panels.find((p) => p.kind === "back");
  let backCell: Cell;
  if (back) {
    const d = await decodes(back.src);
    backCell = cell(back.src === `/images/books/back/${b.slug}.webp` && d.ok, back.src === `/images/books/back/${b.slug}.webp` && d.ok ? `own file · ${d.w}×${d.h}` : `${back.src} (${d.why ?? "not this book's"})`);
  } else if (hasPrint) {
    backCell = cell(true, "— a live print edition but no wrap to crop from");
    notes.push("has a live printed edition but no back-cover file: none is invented");
  } else {
    backCell = cell(true, "— no live printed edition, so no wrap");
  }

  // Preview panels
  const own = new RegExp(`/${b.slug.replace(/-/g, "\\-")}(\\.webp|/)`);
  const panelChecks = await Promise.all(panels.map(async (p) => ({ p, ownFile: own.test(p.src), named: p.alt.includes(b.title), d: await decodes(p.src) })));
  const previewOk = panels.length >= 3 && panelChecks.every((c) => c.ownFile && c.named && c.d.ok);
  const preview = cell(previewOk, `${panels.length} panels: ${panels.map((p) => p.kind).join("·")}${previewOk ? "" : " ✗"}`);

  // Look Inside row on the page: only this book's pictures
  const tiles = [...(doc?.querySelectorAll<HTMLImageElement>('ul[aria-label^="Pictures from"] img') ?? [])].map((i) => imgPath(i.getAttribute("src") ?? ""));
  const lookOwn = new RegExp(`/(lookinside|previews)/${b.slug.replace(/-/g, "\\-")}/|/books/back/${b.slug.replace(/-/g, "\\-")}\\.webp`);
  const lookOk = tiles.every((t) => lookOwn.test(t));
  if (!lookOk) notes.push(`Look Inside shows a picture that is not this book's: ${tiles.filter((t) => !lookOwn.test(t)).join(", ")}`);
  preview.ok = preview.ok && lookOk;
  preview.text += ` · Look Inside ${tiles.length}${lookOk ? "" : " ✗"}`;

  // Amazon links
  const want = new Set(b.formats.map((f) => f.amazonUrl).filter(Boolean) as string[]);
  const got = new Set([...(doc?.querySelectorAll<HTMLAnchorElement>('main a[href*="amazon.com"]') ?? [])].map((a) => a.getAttribute("href") ?? ""));
  const asins = b.formats.map((f) => f.amazonAsin).filter(Boolean) as string[];
  const verifiedOk = asins.filter((a) => verified.get(a)?.state === "ok").length;
  const amazonOk = got.size === want.size && [...got].every((u) => want.has(u)) && verifiedOk === asins.length;
  const amazon = cell(amazonOk, `${got.size}/${want.size} links · ${verifiedOk}/${asins.length} ASINs read off their live page`);

  // Author
  const names = b.authors.map((s) => authorName.get(s)).filter(Boolean) as string[];
  const linked = b.authors.every((s) => !!doc?.querySelector(`#overview a[href="/authors/${s}"]`));
  const ldAuthors = ([] as Array<{ name?: string }>).concat((ldBook?.author as { name?: string }) ?? []).map((a) => a.name);
  const authorOk = names.length === b.authors.length && linked && names.every((n) => ldAuthors.includes(n));
  const author = cell(authorOk, authorOk ? names.join(", ") : `page/JSON-LD do not agree with the catalogue (${names.join(", ")})`);

  // Mobile QA (the physical phone)
  let mobile = cell(false, "not run");
  if (phone) {
    const pop = phone.popups.find((r) => r.slug === b.slug);
    const pg = phone.pages.find((r) => r.slug === b.slug);
    const okPop = !!pop && pop.problems.length === 0;
    const okPg = !!pg && pg.problems.length === 0;
    mobile = cell(okPop && okPg, `popup ${pop ? (okPop ? "✓" : "✗") : "—"} · page ${pg ? (okPg ? "✓" : "✗") : "—"}`);
    if (pop?.problems.length) notes.push(`phone popup: ${pop.problems.join("; ")}`);
    if (pg?.problems.length) notes.push(`phone page: ${pg.problems.join("; ")}`);
  }

  const detailCell = cell(detailOk, detailText);
  const pass = [listing, detailCell, cover, backCell, preview, amazon, author, mobile].every((c) => c.ok);
  rows.push({ slug: b.slug, title: b.title, status: b.websiteStatus, priority, listing, detail: detailCell, cover, back: backCell, preview, amazon, author, mobile, pass, notes });
}

const mark = (c: Cell) => `${c.ok ? "PASS" : "**FAIL**"} — ${c.text}`;
const published = rows.filter((r) => r.status === "published");
const lines: string[] = [];
lines.push("# Final book matrix", "");
lines.push(`Generated by \`scripts/qa/book-matrix.mts\` from ${BASE} on ${new Date().toISOString().slice(0, 10)} (a production build on the sandbox database); every cell is a measurement.`);
lines.push(`Catalogue: **${books.length} books — ${published.length} published, ${rows.length - published.length} draft.** Published rows passing every column: **${published.filter((r) => r.pass).length} / ${published.length}**. Phone sweep: ${phone ? `${phone.browser ?? "Chrome"} on the attached Redmi Note 8 (2021), a real finger` : "not supplied"}.`, "");
lines.push("| Book | Listing | Detail Page | Cover | Back Cover | Preview | Amazon Links | Author | Mobile QA | Status |");
lines.push("|------|---------|-------------|-------|------------|---------|--------------|--------|-----------|--------|");
for (const r of [...rows].sort((a, b) => (PRIORITY.indexOf(a.slug) + 1 || 99) - (PRIORITY.indexOf(b.slug) + 1 || 99) || a.title.localeCompare(b.title))) {
  const status = r.status !== "published" ? (r.pass ? "HELD (draft, absent)" : "**FAIL**") : r.pass ? "PASS" : "**FAIL**";
  lines.push(`| ${r.priority ? "★ " : ""}${r.title} | ${mark(r.listing)} | ${mark(r.detail)} | ${mark(r.cover)} | ${mark(r.back)} | ${mark(r.preview)} | ${mark(r.amazon)} | ${mark(r.author)} | ${mark(r.mobile)} | ${status} |`);
}
lines.push("", "★ = a priority book (the pinned seven, in `src/lib/pinned-books.ts`).", "");
const noted = rows.filter((r) => r.notes.length);
if (noted.length) {
  lines.push("## Notes", "");
  for (const r of noted) for (const n of r.notes) lines.push(`- **${r.title}** — ${n}`);
  lines.push("");
}
const text = lines.join("\n");
if (OUT_MD) {
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, text);
}
if (OUT_JSON) {
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify({ base: BASE, at: new Date().toISOString(), rows }, null, 1));
}
console.log(text);
const failing = rows.filter((r) => !r.pass);
console.log(failing.length ? `\n${failing.length} row(s) failing: ${failing.map((r) => r.slug).join(", ")}` : "\nall rows pass");
process.exit(failing.length ? 1 : 0);
