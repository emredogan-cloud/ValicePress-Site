/**
 * Companion page audit — every route, every claim, measured.
 *
 * Runs against a live server (dev or production) and checks the things that
 * can only be wrong once the page is rendered: which book's cover the hero
 * actually draws, whether every download resolves, whether the metadata is
 * this book's rather than the template's.
 *
 * WHY IT FETCHES RATHER THAN READS SOURCE. A source-level check compares the
 * configuration to itself and passes on the wrong thing — this project has a
 * scar from exactly that, a metadata lint that compared a config to a copy of
 * the same config while four live listings said something else. The only
 * question worth asking is what the server sends.
 *
 * Usage:
 *   node scripts/companion/audit.mjs                       # http://localhost:3001
 *   node scripts/companion/audit.mjs --base https://valicepress.com
 *   node scripts/companion/audit.mjs --json out.json
 */
import { readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const baseIdx = argv.indexOf("--base");
const BASE = (baseIdx >= 0 ? argv[baseIdx + 1] : "http://localhost:3001").replace(/\/+$/, "");
const jsonIdx = argv.indexOf("--json");
const JSON_OUT = jsonIdx >= 0 ? argv[jsonIdx + 1] : null;

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// What the registry says should exist
// ---------------------------------------------------------------------------
const src = readFileSync(`${ROOT}/src/lib/companions.ts`, "utf8");
const blocks = src.split(/const [A-Z_0-9]+: Companion = \{/).slice(1);
const companions = [];
for (const b of blocks) {
  const slug = (b.match(/^\s*slug:\s*"([^"]+)"/m) || [])[1];
  if (!slug) continue;
  const bookSlug = (b.match(/bookSlug:\s*"([^"]+)"/) || [])[1];
  const bookTitle = (b.match(/bookTitle:\s*"([^"]*)"/) || [])[1];
  const ai = b.indexOf("assets: [");
  const assets = ai < 0 ? [] : [...b.slice(ai).matchAll(
    /id:\s*"([^"]+)",[\s\S]*?kind:\s*"(static|generated)",\s*href:\s*"([^"]+)"/g,
  )].map((m) => ({ id: m[1], kind: m[2], href: m[3] }));
  companions.push({ slug, bookSlug, bookTitle, assets });
}

/**
 * Decode the entities the renderer emits before comparing anything to a
 * source string. Without this the audit reports "The Myth Hunter&#x27;s Field
 * Book" as a different book from "The Myth Hunter's Field Book" and fails
 * three correct pages — which is the failure mode that matters most in an
 * instrument, because a suite with expected red in it stops being read.
 */
const decode = (t) =>
  String(t)
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&amp;|&#38;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2019;|&rsquo;/g, "\u2019")
    .replace(/&#x2014;|&mdash;/g, "\u2014");

const strip = (h) => decode(h.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const attr = (tag, name) => {
  const v = (tag.match(new RegExp(`${name}="([^"]*)"`)) || [])[1];
  return v === undefined ? null : decode(v);
};

async function head(url) {
  try {
    const r = await fetch(url, { method: "GET", headers: { range: "bytes=0-0" } });
    return { status: r.status, type: r.headers.get("content-type") };
  } catch (e) {
    return { status: 0, type: null, error: String(e.message || e) };
  }
}

const rows = [];
for (const c of companions) {
  const url = `${BASE}/companion/${c.slug}`;
  const problems = [];
  const warnings = [];
  let html = "";
  let status = 0;

  try {
    const res = await fetch(url);
    status = res.status;
    html = await res.text();
  } catch (e) {
    problems.push(`fetch failed: ${e.message || e}`);
  }

  if (status !== 200) problems.push(`route returned ${status}`);

  // ---- exactly one meaningful H1 -----------------------------------------
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => strip(m[1]));
  if (h1s.length !== 1) problems.push(`${h1s.length} <h1> (want exactly 1)`);
  else if (h1s[0] !== c.bookTitle) {
    problems.push(`h1 is "${h1s[0]}" but the book is "${c.bookTitle}"`);
  }

  // ---- the hero draws THIS book's cover, and nobody else's ---------------
  const imgs = [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
  const heroImg = imgs.find((t) => (attr(t, "alt") || "").startsWith("Front cover of"));
  let coverSlugSeen = null;
  if (!heroImg) {
    warnings.push("no hero cover image (book has no cover asset?)");
  } else {
    const src = decodeURIComponent(attr(heroImg, "src") || "");
    const m = src.match(/\/images\/books\/([a-z0-9-]+)\.webp/);
    coverSlugSeen = m ? m[1] : null;
    if (!coverSlugSeen) problems.push(`hero image is not a book cover: ${src.slice(0, 80)}`);
    else if (coverSlugSeen !== c.bookSlug) {
      // The failure the directive names by name.
      problems.push(`CROSS-BOOK COVER: shows ${coverSlugSeen}, expected ${c.bookSlug}`);
    }
    const alt = attr(heroImg, "alt") || "";
    if (!alt || /^(image|cover|hero image)$/i.test(alt.trim())) {
      problems.push(`hero alt is placeholder text: "${alt}"`);
    } else if (!alt.includes(c.bookTitle)) {
      problems.push(`hero alt does not name the book: "${alt}"`);
    }
  }

  // ---- the book CTA points at THIS book -----------------------------------
  const bookLinks = [...html.matchAll(/href="\/books\/([a-z0-9-]+)"/g)].map((m) => m[1]);
  if (!bookLinks.includes(c.bookSlug)) {
    problems.push(`no link to /books/${c.bookSlug}`);
  }
  const foreign = [...new Set(bookLinks)].filter((s) => s !== c.bookSlug);
  if (foreign.length) problems.push(`links to another book: ${foreign.join(", ")}`);

  // ---- every download resolves -------------------------------------------
  const assetResults = [];
  for (const a of c.assets) {
    if (!html.includes(`href="${a.href}"`)) {
      problems.push(`asset ${a.id} is not linked on the page`);
    }
    const r = await head(`${BASE}${a.href}`);
    assetResults.push({ ...a, status: r.status, type: r.type });
    if (r.status !== 200 && r.status !== 206) {
      problems.push(`asset ${a.id} → HTTP ${r.status} (${a.href})`);
    }
    // A PDF button over an HTML error page is the decorative-button failure.
    if (a.href.endsWith(".pdf") && r.type && !r.type.includes("pdf")) {
      problems.push(`asset ${a.id} claims PDF but served ${r.type}`);
    }
  }

  // ---- SEO ---------------------------------------------------------------
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "");
  const desc = attr((html.match(/<meta name="description"[^>]*>/) || [])[0] || "", "content");
  const canonical = attr((html.match(/<link rel="canonical"[^>]*>/) || [])[0] || "", "href");
  const ogImg = attr((html.match(/<meta property="og:image"[^>]*>/) || [])[0] || "", "content");
  if (!title.includes(c.bookTitle)) problems.push(`<title> does not name the book: "${title}"`);
  if (!desc) problems.push("no meta description");
  if (!canonical || !canonical.endsWith(`/companion/${c.slug}`)) {
    problems.push(`canonical is "${canonical}"`);
  }
  if (ogImg && /\/images\/books\/([a-z0-9-]+)\.webp/.test(decodeURIComponent(ogImg))) {
    const og = decodeURIComponent(ogImg).match(/\/images\/books\/([a-z0-9-]+)\.webp/)[1];
    if (og !== c.bookSlug) problems.push(`CROSS-BOOK OG IMAGE: ${og}`);
  }

  rows.push({
    slug: c.slug,
    bookSlug: c.bookSlug,
    bookTitle: c.bookTitle,
    status,
    h1: h1s[0] ?? null,
    coverSlugSeen,
    assets: assetResults,
    title,
    description: desc,
    canonical,
    ogImage: ogImg,
    problems,
    warnings,
  });

  const mark = problems.length ? "FAIL" : warnings.length ? "WARN" : "ok  ";
  console.log(
    `${mark}  ${c.slug.padEnd(26)} ${String(status).padEnd(4)} cover=${(coverSlugSeen ?? "—").padEnd(38)} assets=${assetResults.filter((a) => a.status === 200 || a.status === 206).length}/${c.assets.length}`,
  );
  for (const p of problems) console.log(`        ✗ ${p}`);
  for (const w of warnings) console.log(`        ! ${w}`);
}

// ---- cross-page uniqueness (SEO §22) --------------------------------------
const dupTitles = new Map();
const dupDescs = new Map();
for (const r of rows) {
  dupTitles.set(r.title, [...(dupTitles.get(r.title) ?? []), r.slug]);
  dupDescs.set(r.description, [...(dupDescs.get(r.description) ?? []), r.slug]);
}
const sharedTitles = [...dupTitles.entries()].filter(([, s]) => s.length > 1);
const sharedDescs = [...dupDescs.entries()].filter(([, s]) => s.length > 1);

console.log("\n" + "=".repeat(72));
const failed = rows.filter((r) => r.problems.length);
console.log(`routes: ${rows.length}  ·  clean: ${rows.length - failed.length}  ·  with problems: ${failed.length}`);
console.log(`assets checked: ${rows.reduce((n, r) => n + r.assets.length, 0)}`);
console.log(`duplicate <title> across pages: ${sharedTitles.length}`);
for (const [t, s] of sharedTitles) console.log(`  "${String(t).slice(0, 50)}" → ${s.join(", ")}`);
console.log(`duplicate descriptions across pages: ${sharedDescs.length}`);
for (const [, s] of sharedDescs) console.log(`  → ${s.join(", ")}`);

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ base: BASE, generatedAt: new Date().toISOString(), rows }, null, 2));
  console.log(`\nwritten: ${JSON_OUT}`);
}

process.exit(failed.length || sharedTitles.length || sharedDescs.length ? 1 : 0);
