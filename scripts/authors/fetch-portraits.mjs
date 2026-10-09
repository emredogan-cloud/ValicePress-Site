#!/usr/bin/env node
/**
 * Check, download and review the portraits chosen in portraits.mjs.
 *
 *   node scripts/authors/fetch-portraits.mjs [slug ...]
 *
 * For each: ask Commons for the file's licence and attribution, REFUSE anything that is not on the free
 * allowlist, and download it into scripts/tmp/authors/portraits/ (untrusted bytes: decoded and re-encoded
 * by sharp later, never executed). A contact sheet is written beside them for a human to look at before
 * anything is cropped or published.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { FREE_LICENCE, NON_FREE, PORTRAITS } from "./portraits.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "scripts/tmp/authors/portraits");
mkdirSync(path.join(OUT, "src"), { recursive: true });
const UA = "ValicePressSite/1.0 (https://valicepress.com; author-directory portraits) node-fetch";
const only = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (h) => (h ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const api = (p) => `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...p })}`;
const meta = {};
const rows = [];
for (const [slug, cfg] of Object.entries(PORTRAITS)) {
  if (only.length && !only.includes(slug)) continue;
  const title = `File:${cfg.file}`;
  const r = await (await fetch(api({ action: "query", titles: title, prop: "imageinfo", iiprop: "url|size|mime|sha1|extmetadata", iiurlwidth: "1600" }), { headers: { "User-Agent": UA } })).json();
  const page = r.query.pages[0];
  const ii = page.imageinfo?.[0];
  if (!ii) { console.log(`MISSING ${slug}: ${title}`); continue; }
  const m = ii.extmetadata ?? {};
  // The file page's own wikitext: the {{Information}} block names the real author and source, which the
  // structured fields sometimes replace with a graphics-lab banner.
  const wt = await (await fetch(api({ action: "query", titles: title, prop: "revisions", rvprop: "content", rvslots: "main" }), { headers: { "User-Agent": UA } })).json();
  const wikitext = (wt.query.pages[0].revisions?.[0]?.slots?.main?.content ?? "").slice(0, 4000);
  const licence = m.LicenseShortName?.value ?? "";
  const restrictions = strip(m.Restrictions?.value);
  const info = {
    slug,
    file: cfg.file,
    sourceUrl: ii.descriptionurl,
    licence,
    licenceUrl: m.LicenseUrl?.value ?? null,
    attributionRequired: m.AttributionRequired?.value === "true",
    creator: strip(m.Artist?.value),
    credit: strip(m.Credit?.value),
    dateCreated: strip(m.DateTimeOriginal?.value),
    description: strip(m.ImageDescription?.value).slice(0, 240),
    sourceWidth: ii.width,
    sourceHeight: ii.height,
    sourceSha1: ii.sha1,
    restrictions,
    wikitext,
  };
  const bad = !FREE_LICENCE.test(licence) || NON_FREE.test(`${licence} ${m.UsageTerms?.value ?? ""}`) || restrictions;
  if (bad) { console.log(`REFUSED ${slug.padEnd(24)} licence "${licence}" restrictions "${restrictions}"`); continue; }

  // Download at most 1600px wide (the thumb URL), never the 100-megapixel original of a museum scan.
  const url = ii.width > 1600 ? ii.thumburl : ii.url;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) { console.log(`DOWNLOAD FAILED ${slug}: ${res.status} ${url}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  const md = await sharp(buf).metadata(); // throws if the bytes are not an image
  const ext = md.format === "jpeg" ? "jpg" : md.format;
  const file = path.join(OUT, "src", `${slug}.${ext}`);
  writeFileSync(file, buf);
  info.downloaded = { url, width: md.width, height: md.height, format: md.format, sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length };
  meta[slug] = info;
  rows.push({ slug, file, w: md.width, h: md.height, licence });
  console.log(`ok   ${slug.padEnd(24)} ${String(md.width).padStart(5)}x${String(md.height).padEnd(5)} ${licence.padEnd(14)} ${info.creator.slice(0, 50)}`);
  await sleep(300);
}

// merge with earlier runs so a partial run does not forget the others
let all = {};
try { all = JSON.parse(readFileSync(path.join(OUT, "meta.json"), "utf8")); } catch { /* first run */ }
writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ ...all, ...meta }, null, 2));

// contact sheet: 6 across, each tile 260x340 with a caption
if (rows.length) {
  const TW = 260, TH = 340, CAP = 34, COLS = 6;
  const tiles = await Promise.all(rows.map(async (r) => ({ r, img: await sharp(r.file).rotate().resize(TW, TH, { fit: "contain", background: "#161616" }).png().toBuffer() })));
  const rowsN = Math.ceil(tiles.length / COLS);
  const comp = [];
  tiles.forEach((t, i) => {
    const x = (i % COLS) * TW, y = Math.floor(i / COLS) * (TH + CAP);
    comp.push({ input: t.img, left: x, top: y });
    const svg = Buffer.from(`<svg width="${TW}" height="${CAP}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0b0b0b"/><text x="6" y="14" font-family="DejaVu Sans" font-size="12" fill="#e8e8e0">${t.r.slug}</text><text x="6" y="28" font-family="DejaVu Sans" font-size="11" fill="#8fd">${t.r.w}x${t.r.h} · ${t.r.licence}</text></svg>`);
    comp.push({ input: svg, left: x, top: y + TH });
  });
  await sharp({ create: { width: COLS * TW, height: rowsN * (TH + CAP), channels: 3, background: "#0b0b0b" } }).composite(comp).png().toFile(path.join(OUT, "contact-sheet.png"));
  console.log(`contact sheet: ${path.relative(ROOT, path.join(OUT, "contact-sheet.png"))}`);
}
