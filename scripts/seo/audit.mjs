#!/usr/bin/env node
/**
 * Crawl-based SEO, structure and link audit of a RUNNING site.
 *
 *   node scripts/seo/audit.mjs                       # http://localhost:3210 (the sandbox e2e server)
 *   node scripts/seo/audit.mjs --base https://valicepress.com
 *   node scripts/seo/audit.mjs --json /tmp/audit.json  # every page's facts, for a report
 *
 * It reads the site the way a crawler does — it asks for the sitemap, fetches every URL in it
 * plus the routes that are public but deliberately not listed, parses the HTML (as Googlebot,
 * because Next streams metadata into the body for ordinary browsers but puts it in <head> for bots)
 * and checks, per page and across pages:
 *
 *   title · meta description · canonical · Open Graph · Twitter card · robots · <html lang> ·
 *   one <h1> and no skipped heading levels · every <img> has an alt attribute · JSON-LD parses
 *   and says the right thing for the page type · titles and descriptions are not shared between pages
 *   (the brief: "no duplicated generic title/description across every book") · the sitemap lists
 *   exactly the indexable pages · every internal link a crawler would follow answers · no public
 *   page links into the admin area · each Amazon ASIN belongs to one book.
 *
 * It does not know the catalogue. It checks what the pages say about themselves and about each
 * other, so a new book is audited by the same rules. Exit status 1 when any ERROR is found.
 */
import fs from "node:fs";

import { JSDOM } from "jsdom";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:3210").replace(/\/$/, "");
const JSON_OUT = arg("json", "");
const BOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

/** Public pages that are deliberately NOT in the sitemap (legal, utility, landing pages). */
const UNLISTED = ["/terms", "/privacy", "/refund", "/kvkk", "/search", "/cart", "/codex-enigmatica"];
/** A route that does not exist: it must be a real 404 and keep itself out of the index. */
const MISSING = "/this-page-does-not-exist-seo-audit";

const findings = [];
const add = (level, url, check, detail) => findings.push({ level, url, check, detail });
const E = (u, c, d) => add("ERROR", u, c, d);
const W = (u, c, d) => add("WARN", u, c, d);

async function get(url, init = {}) {
  const res = await fetch(url, { redirect: "manual", headers: { "user-agent": BOT_UA, accept: "text/html,*/*" }, ...init });
  return res;
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const n = i++;
        out[n] = await fn(items[n], n);
      }
    }),
  );
  return out;
}

// --------------------------------------------------------------------------- sitemap
const smRes = await get(`${BASE}/sitemap.xml`);
if (smRes.status !== 200) {
  console.error(`sitemap.xml answered ${smRes.status}`);
  process.exit(2);
}
const smXml = await smRes.text();
const locs = [...smXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
const siteOrigin = new URL(locs[0]).origin;
const pathOf = (u) => new URL(u).pathname;
const sitemapPaths = locs.map(pathOf);
if (new Set(locs).size !== locs.length) E("/sitemap.xml", "unique-urls", "the sitemap lists a URL twice");
for (const l of locs) if (new URL(l).origin !== siteOrigin) E("/sitemap.xml", "one-origin", `${l} is on another origin than ${siteOrigin}`);
for (const m of smXml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) if (Number.isNaN(Date.parse(m[1]))) E("/sitemap.xml", "lastmod", `bad lastmod ${m[1]}`);

const pagePaths = [...new Set([...sitemapPaths, ...UNLISTED])];

// --------------------------------------------------------------------------- pages
const kindOf = (p) => {
  if (p === "/") return "home";
  const m = p.match(/^\/(books|authors|companion|blog|categories)\/[^/]+$/);
  return m ? m[1].replace(/s$/, "").replace("companion", "companion") : "static";
};

function facts(path, html, res) {
  const doc = new JSDOM(html).window.document;
  const meta = (sel) => doc.querySelector(sel)?.getAttribute("content")?.trim() ?? null;
  const heads = [...doc.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => Number(h.tagName[1]));
  const imgs = [...doc.querySelectorAll("img")];
  const ld = [];
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      ld.push(JSON.parse(s.textContent ?? ""));
    } catch (e) {
      ld.push({ __parseError: String(e) });
    }
  }
  const links = [...doc.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") ?? "");
  // What a reader reads: the body without scripts, styles, templates (streamed fallbacks) and noscript.
  for (const n of doc.querySelectorAll("script,style,template,noscript,svg")) n.remove();
  const text = (doc.body?.textContent ?? "").replace(/\s+/g, " ");
  return {
    text,
    path,
    kind: kindOf(path),
    status: res.status,
    contentType: res.headers.get("content-type") ?? "",
    xRobots: res.headers.get("x-robots-tag") ?? "",
    lang: doc.documentElement.getAttribute("lang") ?? "",
    title: doc.title?.trim() ?? "",
    titleInHead: !!doc.head?.querySelector("title"),
    description: meta('meta[name="description"]'),
    canonical: [...doc.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute("href")),
    robots: meta('meta[name="robots"]'),
    og: Object.fromEntries(["title", "description", "url", "image", "type", "site_name"].map((k) => [k, meta(`meta[property="og:${k}"]`)])),
    tw: Object.fromEntries(["card", "title", "description", "image"].map((k) => [k, meta(`meta[name="twitter:${k}"]`)])),
    h1: heads.filter((h) => h === 1).length,
    h1Text: doc.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    headings: heads,
    imgNoAlt: imgs.filter((i) => !i.hasAttribute("alt")).length,
    imgCount: imgs.length,
    ld,
    links,
  };
}

const pages = await pool(pagePaths, 6, async (p) => {
  const res = await get(`${BASE}${p}`);
  const html = res.status < 400 || res.status === 404 ? await res.text() : "";
  return facts(p, html, res);
});
const missingRes = await get(`${BASE}${MISSING}`);
const missing = facts(MISSING, await missingRes.text(), missingRes);

const inSitemap = new Set(sitemapPaths);

// --------------------------------------------------------------------------- per-page checks
const originPath = (u) => {
  try {
    const x = new URL(u);
    return { origin: x.origin, path: x.pathname };
  } catch {
    return null;
  }
};

for (const f of pages) {
  const u = f.path;
  const listed = inSitemap.has(u);
  if (listed && f.status !== 200) E(u, "sitemap-url-answers", `listed in the sitemap, answers ${f.status}`);
  if (f.status >= 300 && f.status < 400) {
    W(u, "redirects", `answers ${f.status}`);
    continue;
  }
  if (f.status !== 200) continue;
  if (!/text\/html/.test(f.contentType)) E(u, "html", `content-type ${f.contentType}`);
  if (!f.lang) E(u, "html-lang", "<html> has no lang");

  const noindex = /noindex/i.test(`${f.robots ?? ""} ${f.xRobots}`);
  if (listed && noindex) E(u, "sitemap-vs-robots", "in the sitemap but marked noindex");
  if (!listed && !noindex && !/^\/(terms|privacy|refund|kvkk)$/.test(u)) W(u, "sitemap-vs-robots", "indexable but not in the sitemap");

  // title + description
  if (!f.title) E(u, "title", "no <title>");
  else {
    if (!f.titleInHead) W(u, "title-in-head", "the <title> is not in <head> for a crawler");
    if (f.title.length > 70) W(u, "title-length", `${f.title.length} chars: ${f.title}`);
    if (f.title.length < 10) W(u, "title-length", `${f.title.length} chars: ${f.title}`);
  }
  if (!f.description) E(u, "description", "no meta description");
  else if (f.description.length < 50 || f.description.length > 180) W(u, "description-length", `${f.description.length} chars`);

  // canonical — an indexable page names itself; a noindex page (search results, the cart) needs none
  if (f.canonical.length !== 1) {
    if (!noindex || f.canonical.length > 1) E(u, "canonical", `${f.canonical.length} canonical links`);
  } else {
    const c = originPath(f.canonical[0]);
    if (!c) E(u, "canonical", `not absolute: ${f.canonical[0]}`);
    else {
      if (c.origin !== siteOrigin) E(u, "canonical-origin", `${c.origin} ≠ ${siteOrigin}`);
      if (c.path !== u && !noindex) E(u, "canonical-path", `canonical path ${c.path} ≠ ${u}`);
    }
  }

  // Open Graph + Twitter — pages that are meant to be shared
  if (listed) {
    for (const k of ["title", "description", "url", "image", "type", "site_name"]) if (!f.og[k]) E(u, `og:${k}`, "missing");
    if (f.og.url && f.canonical[0] && f.og.url !== f.canonical[0]) E(u, "og:url", `${f.og.url} ≠ canonical ${f.canonical[0]}`);
    if (f.og.image && !originPath(f.og.image)) E(u, "og:image", `not absolute: ${f.og.image}`);
    if (!f.tw.card) E(u, "twitter:card", "missing");
    if (f.tw.card && !/summary/.test(f.tw.card)) W(u, "twitter:card", f.tw.card);
    if (!f.tw.image && !f.og.image) E(u, "twitter:image", "no image for the card");
  }

  // headings, images
  if (f.h1 !== 1) E(u, "h1", `${f.h1} <h1> elements`);
  let prev = 0;
  for (const h of f.headings) {
    if (prev && h > prev + 1) {
      W(u, "heading-skip", `h${prev} → h${h}`);
      break;
    }
    prev = h;
  }
  if (f.imgNoAlt) E(u, "img-alt", `${f.imgNoAlt} of ${f.imgCount} <img> have no alt attribute`);

  // JSON-LD
  for (const block of f.ld) if (block.__parseError) E(u, "jsonld-parse", block.__parseError);
  const nodes = f.ld.flatMap((b) => (b["@graph"] ? b["@graph"] : [b])).filter((n) => n && !n.__parseError);
  const types = nodes.flatMap((n) => (Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]]));
  const ids = nodes.map((n) => n["@id"]).filter(Boolean);
  if (new Set(ids).size !== ids.length) E(u, "jsonld-ids", `duplicate @id: ${ids.filter((x, i) => ids.indexOf(x) !== i).join(", ")}`);
  if (f.kind === "book") {
    const book = nodes.find((n) => n["@type"] === "Book");
    if (!book) E(u, "jsonld-book", "no Book node");
    else {
      if (f.h1Text && book.name && !f.h1Text.includes(book.name) && !book.name.includes(f.h1Text)) W(u, "jsonld-book-name", `"${book.name}" vs h1 "${f.h1Text}"`);
      if (!book.author?.length) E(u, "jsonld-book-author", "no author");
      if (!book.image) W(u, "jsonld-book-image", "no image");
    }
    if (!types.includes("BreadcrumbList")) E(u, "jsonld-breadcrumb", "no BreadcrumbList");
    const prod = nodes.find((n) => n["@type"] === "Product");
    const offer = prod?.offers;
    if (offer && !(Number(offer.price) > 0)) E(u, "jsonld-offer", `an Offer with price ${offer.price} (a book that is not sold here must carry none)`);
    if (nodes.some((n) => n.aggregateRating)) W(u, "jsonld-rating", "has an aggregateRating — only valid with real reviews");
  }
  if (f.kind === "author" && !types.includes("Person")) E(u, "jsonld-person", "no Person node");
  if (f.kind === "home" && !(types.includes("Organization") && types.includes("WebSite"))) E(u, "jsonld-home", `types: ${types.join(",")}`);
}

// --------------------------------------------------------------------------- text that should not be on a page
// A template that printed a missing value, a price that is really "not sold here", a host from a test
// environment, a draft marker. Each is a sentence a visitor would read.
const STALE_TEXT = [
  [/\bundefined\b/, "the word 'undefined'"],
  [/\[object Object\]/, "'[object Object]'"],
  [/\bNaN\b/, "'NaN'"],
  [/\$0\.00\b/, "a price of $0.00 (a book with no price is 'not sold here', not free)"],
  [/lorem ipsum/i, "lorem ipsum"],
  [/\blocalhost\b|\bloca\.lt\b|valice-rehearsal/i, "a host from a test environment"],
  [/\bTODO\b|\bFIXME\b|\bXXX\b/, "a draft marker"],
  [/Digital Bookstore/, "the mock-up's name ('Digital Bookstore')"],
];
for (const f of pages) {
  if (f.status !== 200) continue;
  for (const [re, what] of STALE_TEXT) if (re.test(f.text)) E(f.path, "stale-text", what);
}
for (const f of pages) {
  if (f.status !== 200) continue;
  for (const h of f.links) if (/localhost|loca\.lt|valice-rehearsal|127\.0\.0\.1/.test(h) && !/^\/|^#/.test(h)) E(f.path, "stale-link", `links to ${h.slice(0, 80)}`);
}

// --------------------------------------------------------------------------- across pages
const dup = (key, label, only) => {
  const by = new Map();
  for (const f of pages.filter((p) => p.status === 200 && inSitemap.has(p.path) && (!only || only(p)))) {
    const v = key(f);
    if (!v) continue;
    (by.get(v) ?? by.set(v, []).get(v)).push(f.path);
  }
  for (const [v, paths] of by) if (paths.length > 1) E(paths[0], `duplicate-${label}`, `${paths.length} pages share "${v.slice(0, 90)}": ${paths.slice(0, 5).join(", ")}${paths.length > 5 ? " …" : ""}`);
};
dup((f) => f.title, "title");
dup((f) => f.description, "description");

const SITE_DESCRIPTION_FRAGMENT = "Independent press: romance, world folklore, games and puzzles";
for (const f of pages.filter((p) => p.status === 200 && inSitemap.has(p.path) && p.kind !== "home" && p.description?.includes(SITE_DESCRIPTION_FRAGMENT))) {
  E(f.path, "generic-description", "carries the site-wide default description");
}
const siteName = (pages.find((p) => p.kind === "home")?.og.site_name ?? "").toLowerCase();
for (const f of pages.filter((p) => p.status === 200 && p.kind === "book")) {
  if (siteName && f.title.toLowerCase() === siteName) E(f.path, "generic-title", "the title is only the site name");
}

// The 404.
if (missing.status !== 404) E(MISSING, "404-status", `answers ${missing.status}`);
if (!/noindex/i.test(`${missing.robots ?? ""} ${missing.xRobots}`)) W(MISSING, "404-noindex", "the 404 page is not marked noindex");

// Sitemap exhaustiveness: published things the site links to must be listed.
const linkedBookPaths = new Set();
for (const f of pages) for (const h of f.links) if (/^\/(books|authors)\/[a-z0-9-]+$/.test(h)) linkedBookPaths.add(h);
for (const p of linkedBookPaths) if (!inSitemap.has(p)) W(p, "linked-not-in-sitemap", "a page the site links to is not in the sitemap");

// --------------------------------------------------------------------------- links
const internal = new Map(); // target path -> first page that links to it
const external = new Map();
for (const f of pages) {
  if (f.status !== 200) continue;
  for (const raw of f.links) {
    if (!raw || raw.startsWith("#") || /^(mailto:|tel:|javascript:)/.test(raw)) continue;
    let u;
    try {
      u = new URL(raw, `${siteOrigin}${f.path}`);
    } catch {
      E(f.path, "href", `unparseable href ${raw}`);
      continue;
    }
    if (u.origin === siteOrigin || u.origin === BASE) {
      const key = u.pathname.replace(/\/$/, "") || "/";
      // `/cdn-cgi/…` is Cloudflare's own namespace, not ours: with Email Address Obfuscation on, the edge rewrites every
      // mailto: link into `/cdn-cgi/l/email-protection#<hex>` and a script in the page turns it back. This crawl runs no
      // JavaScript and drops the fragment, so the bare path answers 404 — an artefact of the edge, not a broken link
      // in the site (checked in a real browser on 2026-10-09: every mailto: is restored and none is left undecoded).
      if (key.startsWith("/cdn-cgi/")) continue;
      if (!internal.has(key)) internal.set(key, f.path);
      if (/^\/admin(\/|$)/.test(key)) E(f.path, "link-to-admin", `links to ${key}`);
    } else {
      const key = u.href.split("#")[0];
      if (!external.has(key)) external.set(key, f.path);
    }
  }
}
const internalRes = await pool([...internal.keys()], 8, async (p) => {
  const r = await get(`${BASE}${p}`, { method: "GET" });
  return { p, status: r.status, location: r.headers.get("location") };
});
for (const r of internalRes) {
  if (r.status >= 400) E(internal.get(r.p), "broken-link", `${r.p} → ${r.status}`);
  else if (r.status >= 300) W(internal.get(r.p), "redirecting-link", `${r.p} → ${r.status} ${r.location}`);
}

// Amazon: one ASIN, one book.
const asinOwners = new Map();
for (const f of pages.filter((p) => p.kind === "book" && p.status === 200)) {
  for (const h of f.links) {
    const m = h.match(/amazon\.com\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    if (m) (asinOwners.get(m[1]) ?? asinOwners.set(m[1], new Set()).get(m[1])).add(f.path);
  }
}
for (const [asin, owners] of asinOwners) if (owners.size > 1) E([...owners][0], "asin-shared", `ASIN ${asin} appears on ${[...owners].join(", ")}`);
for (const h of external.keys()) if (/amazon\./.test(h) && !/\/(dp|gp\/product)\/[A-Z0-9]{10}/.test(h) && !/amazon\.com\/(s|stores|author|hz)/.test(h)) W(external.get(h), "amazon-link-shape", h);

// --------------------------------------------------------------------------- robots.txt
const robots = await (await get(`${BASE}/robots.txt`)).text();
if (!/^sitemap:\s*\S+/im.test(robots)) E("/robots.txt", "sitemap-line", "no Sitemap: line");
const smLine = robots.match(/^sitemap:\s*(\S+)/im)?.[1];
if (smLine && new URL(smLine).origin !== siteOrigin) E("/robots.txt", "sitemap-origin", `${smLine} is not on ${siteOrigin}`);
for (const p of ["/admin", "/api/", "/cart", "/account/"]) if (!robots.includes(`Disallow: ${p}`)) E("/robots.txt", "disallow", `does not disallow ${p}`);
for (const f of pages) {
  if (f.status === 200 && inSitemap.has(f.path) && /^Disallow:\s*(\/\S*)/im.test(robots)) {
    for (const m of robots.matchAll(/^Disallow:\s*(\/\S*)/gim)) if (f.path.startsWith(m[1])) E(f.path, "robots-blocks-sitemap-url", `robots.txt disallows ${m[1]}`);
  }
}

// --------------------------------------------------------------------------- image URLs (og:image of listed pages)
const imageUrls = new Map();
for (const f of pages.filter((p) => p.status === 200 && inSitemap.has(p.path))) for (const k of [f.og.image, f.tw.image]) if (k && !imageUrls.has(k)) imageUrls.set(k, f.path);
await pool([...imageUrls.keys()], 8, async (src) => {
  const u = new URL(src);
  const r = await get(`${BASE}${u.pathname}${u.search}`, { method: "GET" });
  if (r.status >= 300) E(imageUrls.get(src), "social-image", `${src} → ${r.status}`);
  else if (!/^image\//.test(r.headers.get("content-type") ?? "")) E(imageUrls.get(src), "social-image", `${src} is ${r.headers.get("content-type")}`);
  await r.arrayBuffer().catch(() => {});
});

// --------------------------------------------------------------------------- report
const byLevel = (l) => findings.filter((x) => x.level === l);
const byKind = {};
for (const f of pages) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
console.log(`\nSEO audit of ${BASE} — site origin ${siteOrigin}`);
console.log(`  sitemap: ${locs.length} URLs · pages fetched: ${pages.length} (${Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(", ")}) · internal link targets checked: ${internal.size} · external: ${external.size} · social images: ${imageUrls.size}`);
const groups = new Map();
for (const x of findings) {
  const k = `${x.level} ${x.check}`;
  (groups.get(k) ?? groups.set(k, []).get(k)).push(x);
}
for (const [k, xs] of [...groups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
  console.log(`\n${k}  ×${xs.length}`);
  for (const x of xs.slice(0, 8)) console.log(`    ${x.url}  ${x.detail}`);
  if (xs.length > 8) console.log(`    … ${xs.length - 8} more`);
}
console.log(`\n${byLevel("ERROR").length} errors · ${byLevel("WARN").length} warnings`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ base: BASE, siteOrigin, findings, pages: pages.map((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== "links" && k !== "text"))) }, null, 1));
process.exit(byLevel("ERROR").length ? 1 : 0);
