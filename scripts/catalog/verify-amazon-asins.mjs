#!/usr/bin/env node
/**
 * Read what Amazon actually says an ASIN is.
 *
 *   node scripts/catalog/verify-amazon-asins.mjs B0HLLMNFTL B0HLKPSLHH
 *   node scripts/catalog/verify-amazon-asins.mjs --catalog            # every ASIN in the catalogue
 *   node scripts/catalog/verify-amazon-asins.mjs --catalog --out AUDIT/data/amazon-asins.json
 *
 * WHY THIS EXISTS
 * `validate-catalog.mjs` only checks that /dp/<ASIN> answers 200. A 200 does not
 * say WHOSE page it is, so an ASIN pasted under the wrong book passes. This reads
 * the page and records the title, the selected format, the ISBN-13, the page
 * count, the author line, the price and the sibling editions the format switcher
 * links — the fields that identify a listing — and, with --catalog, compares them
 * to the catalogue row that claims the ASIN.
 *
 * It is READ-ONLY (plain GETs) and deliberately slow: one request per --delay ms
 * (default 6000). Amazon answers a too-fast client with a ~2 KB stub, which this
 * reports as `throttled` and never as a verdict. A genuinely missing ASIN answers
 * a "Page Not Found" page, reported as `notFound`. Run it by hand; it is not part
 * of CI and must not be, since it depends on a third party's mood.
 *
 * Method and traps: see memory note "Amazon /dp/ page verification" — use
 * `--compressed` (here: fetch decodes it), a desktop UA, US cookies; Kindle
 * Unlimited titles show "$0.00" in the swatch, the real price is the buy box's
 * "or $X to buy"; a KDP large-print edition is a Paperback whose title may not
 * say so, so the ISBN, not the title, identifies it.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&rlm;|&lrm;/g, "")
    .replace(/&nbsp;/g, " ");
const text = (html) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Pull one labelled value out of Amazon's "Product details" bullets. */
function detail(body, label) {
  const re = new RegExp(
    `${label}\\s*(?:</span>)?\\s*(?:<[^>]+>\\s*)*:?\\s*(?:&rlm;|&lrm;|\\s)*(?:</span>\\s*)?<span[^>]*>\\s*(?:&rlm;|&lrm;|\\s)*([^<]+)`,
  );
  const m = body.match(re);
  return m ? decode(m[1]).trim() : null;
}

/** Parse one /dp/ page into the fields that identify the listing. */
export function parseDpPage(asin, body) {
  const out = { asin, bytes: body.length };
  if (body.length < 20000) {
    out.state = /Page Not Found|looking for something/i.test(body) ? "notFound" : "throttled";
    return out;
  }
  out.state = "ok";
  const t = body.match(/id="productTitle"[^>]*>([\s\S]*?)<\/span>/);
  out.title = t ? text(t[1]) : null;
  const by = body.match(/id="bylineInfo"[\s\S]*?<\/div>/);
  out.byline = by ? text(by[0]).replace(/^.*?\bby\b\s*/i, "").slice(0, 120) : null;

  // The format switcher. Each swatch is a `<div id="tmm-grid-swatch-KIND" class="… swatchElement
  // selected|unselected …">`. Find the id, walk back to its opening tag, and read the class from
  // there. The selected swatch links to `javascript:void(0)` rather than a /dp/ URL, which is
  // how it differs from its siblings.
  const swatches = [];
  const marks = [...body.matchAll(/id="tmm-grid-swatch-([A-Z_]+)"/g)];
  marks.forEach((mark, i) => {
    const start = body.lastIndexOf("<div", mark.index);
    const nextStart = i + 1 < marks.length ? body.lastIndexOf("<div", marks[i + 1].index) : mark.index + 2500;
    const chunk = body.slice(start, nextStart > start ? nextStart : start + 2500);
    const tag = chunk.slice(0, chunk.indexOf(">") + 1);
    const cls = (tag.match(/class="([^"]*)"/) ?? [])[1] ?? "";
    const href = chunk.match(/\/dp\/(B0[A-Z0-9]{8})/);
    const price = chunk.match(/\$\s?(\d+(?:\.\d{2})?)/);
    swatches.push({
      kind: mark[1],
      selected: /\bselected\b/.test(cls) && !/\bunselected\b/.test(cls),
      asin: href ? href[1] : null,
      price: price ? price[1] : null,
    });
  });
  out.swatches = swatches;
  const sel = swatches.find((s) => s.selected);
  out.format = sel ? sel.kind : null;
  out.selectedPrice = sel ? sel.price : null;
  out.siblings = Object.fromEntries(swatches.filter((s) => !s.selected && s.asin).map((s) => [s.kind, s.asin]));

  out.isbn13 = detail(body, "ISBN-13");
  out.isbn10 = detail(body, "ISBN-10");
  out.printLength = detail(body, "Print length");
  out.publicationDate = detail(body, "Publication date");
  out.dimensions = detail(body, "Dimensions");
  out.language = detail(body, "Language");
  const og = body.match(/<meta name="title" content="([^"]+)"/);
  out.metaTitle = og ? decode(og[1]).slice(0, 220) : null;

  // Only meaningful on a Kindle page: the buy box offers "Read for Free" under Kindle Unlimited.
  out.kindleUnlimited =
    out.format === "KINDLE" || /Kindle Edition/.test(out.byline ?? "")
      ? /Read for Free|Kindle Unlimited/.test(body.slice(body.indexOf('id="buybox"') >= 0 ? body.indexOf('id="buybox"') : 0, body.indexOf('id="buybox"') + 15000))
      : null;
  const img = body.match(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/);
  out.coverImage = img ? img[1] : null;
  return out;
}

export async function fetchDp(asin) {
  const res = await fetch(`https://www.amazon.com/dp/${asin}`, {
    redirect: "follow",
    headers: {
      "user-agent": UA,
      "accept-language": "en-US,en;q=0.9",
      cookie: "i18n-prefs=USD; lc-main=en_US",
      accept: "text/html,application/xhtml+xml",
    },
  });
  const body = await res.text();
  return { status: res.status, ...parseDpPage(asin, body) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KIND_OF = { ebook: "KINDLE", paperback: "PAPERBACK", hardcover: "HARDCOVER", large_print: "PAPERBACK" };

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => argv.includes(`--${n}`);
  const opt = (n, d) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
  };
  const delay = Number(opt("delay", 6000));
  const outFile = opt("out", null);
  let jobs = argv.filter((a) => /^B0[A-Z0-9]{8}$/.test(a)).map((asin) => ({ asin }));

  if (flag("catalog")) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const { BOOKS } = await import(pathToFileURL(path.join(here, "valice-catalog.mjs")).href);
    jobs = [];
    for (const b of BOOKS) {
      for (const f of b.formats ?? []) {
        if (f.amazonAsin) jobs.push({ asin: f.amazonAsin, slug: b.slug, title: b.title, format: f.format, isbn13: f.isbn13 ?? null, pages: f.pageCount ?? b.pageCount ?? null });
      }
    }
  }
  if (!jobs.length) {
    console.error("Give ASINs, or --catalog.");
    process.exit(2);
  }

  const results = [];
  for (const [i, job] of jobs.entries()) {
    let r = await fetchDp(job.asin);
    if (r.state === "throttled") {
      await sleep(delay * 2);
      r = await fetchDp(job.asin);
    }
    const row = { ...job, ...r, checkedAt: new Date().toISOString() };
    // Compare against the catalogue's claim, when there is one.
    if (job.slug && r.state === "ok") {
      const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      row.titleMatches = norm(r.title).includes(norm(job.title).slice(0, 24));
      row.formatMatches = r.format === KIND_OF[job.format];
      row.isbnMatches = job.isbn13 && r.isbn13 ? job.isbn13.replace(/\D/g, "") === r.isbn13.replace(/\D/g, "") : null;
    }
    results.push(row);
    console.log(
      `${job.asin}  ${r.state.padEnd(9)} ${String(r.format ?? "-").padEnd(9)} ${String(r.printLength ?? "-").padEnd(10)} ${String(r.isbn13 ?? "-").padEnd(15)} ${(r.title ?? "").slice(0, 70)}`,
    );
    if (i < jobs.length - 1) await sleep(delay);
  }

  if (outFile) {
    await mkdir(path.dirname(outFile), { recursive: true });
    await writeFile(outFile, JSON.stringify(results, null, 2));
    console.log(`\nWrote ${outFile}`);
  }
  const bad = results.filter((r) => r.state !== "ok" || r.titleMatches === false || r.formatMatches === false || r.isbnMatches === false);
  if (bad.length) console.log(`\n${bad.length} need a look: ${bad.map((b) => `${b.asin}(${b.state})`).join(", ")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
