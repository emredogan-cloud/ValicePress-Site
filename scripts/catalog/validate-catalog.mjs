#!/usr/bin/env node
/**
 * Website product QA (Gate 11) and the weekly catalogue integrity check.
 *
 *   node scripts/catalog/validate-catalog.mjs [--env scripts/tmp/.env.production]
 *        [--origin https://valicepress.com] [--slug <slug>] [--skip-network] [--json]
 *
 * Checks, per published book in scripts/catalog/valice-catalog.mjs:
 *   1. the catalogue test suite's invariants (re-derived here cheaply): a
 *      kdp:"live" format has an ASIN; a direct ebook has a providerPriceId
 *      and a master key; a Select-enrolled book is not for direct sale; any
 *      isbn13 is thirteen digits and passes its own check digit
 *   2. cover webp exists under public/images/books/ and is ≥ 1200 px tall
 *   3. preview pages exist under public/images/previews/<slug>/
 *   4. every live ASIN's /dp/ page answers 200 (network)
 *   5. production page /books/<slug> answers 200, carries a canonical on the
 *      configured origin, and its JSON-LD parses; an Offer appears only when a
 *      direct price > 0 exists (network)
 *   6. /sitemap.xml lists every published book and every companion (network)
 *   7. Lemon Squeezy: every direct providerPriceId names a published variant
 *      at the catalogue price (needs LEMONSQUEEZY_API_KEY in --env)
 *   8. R2: every direct master key exists (needs R2_* in --env; otherwise SKIPPED)
 *   9. ONE COVER EVERYWHERE (network): the production homepage, /ebooks,
 *      /books and each book page reference the book's canonical cover file
 *      (/images/books/<slug>.webp, through next/image) — the same file on
 *      every route. A gradient stand-in on a surface where the cover exists
 *      is the Phase 4 defect this check exists to catch.
 *  10. COMPANIONS (network): every companion in src/lib/companions.ts answers
 *      200 on production and every static asset it lists answers 200 — a
 *      printed QR code must never land on a 404.
 *  11. NO FABRICATION ON PRODUCTION (network): the public pages carry none of
 *      the strings that were once invented — the "10K+ authors" stats strip,
 *      the "Apply Now" link, the constant 4.7-star rating, the unauthorised
 *      biography — and /authors/<founder> prints the approved biography.
 * A check that cannot run is SKIPPED and listed — it never counts as passed.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

import { Report, finish } from "../factory/lib/lint.mjs";
import { REPO_ROOT, parseArgs } from "../factory/lib/project.mjs";
import { BOOKS } from "./valice-catalog.mjs";

function loadEnvFile(path) {
  const env = {};
  if (!path || !existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    // `vercel env pull` writes variables marked *sensitive* as a placeholder;
    // dropping them lets the Paddle/R2 checks report SKIPPED instead of a TypeError.
    if (value === "[SENSITIVE]") continue;
    env[m[1]] = value;
  }
  return env;
}

function imageHeight(path) {
  try {
    return Number(execFileSync("identify", ["-format", "%h", path], { encoding: "utf8" }).trim());
  } catch {
    return null;
  }
}

/**
 * One probe, retried, because a gate that cries wolf is not a gate.
 *
 * This check fires ~200 requests at a serverless origin at once. Cold starts and
 * large assets mean a few of them time out every run, and a timed-out fetch
 * surfaced as `status: 0` — indistinguishable in the report from a genuinely
 * missing page. On 2026-09-19 that produced two "errors" for a companion page
 * and a 160 KB claims file which both answer 200 every time you ask them singly.
 *
 * A transport failure is retried twice with a short backoff; an HTTP STATUS is
 * never retried, because a real 404 is an answer and retrying it would only
 * hide a fault. If all three attempts fail at the transport layer, the error
 * says so, so the reader can tell "unreachable" from "not found".
 */
async function fetchStatus(url, init = {}) {
  // Every probe is marked internal so it never lands in the analytics sink.
  const headers = { "x-valice-internal": "1", ...(init.headers ?? {}) };
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt));
    try {
      const res = await fetch(url, { redirect: "manual", ...init, headers });
      return {
        status: res.status,
        location: res.headers.get("location"),
        text: init.wantBody ? await res.text() : null,
      };
    } catch (e) {
      last = e.message;
    }
  }
  return { status: 0, error: `unreachable after 3 attempts: ${last}` };
}

export function localChecks(book, report) {
  const slug = book.slug;
  for (const f of book.formats) {
    if (f.kdp === "live" && !f.amazonAsin) report.error("asin", `${f.format} is kdp:live without an ASIN`, slug);
    // "publishing" carries an ASIN legitimately: Amazon issues one when it ACCEPTS a
    // title, not when the listing becomes purchasable. Third copy of this rule — the
    // test and the loader had it too, and all three said an ASIN means live.
    if (f.amazonAsin && f.kdp !== "live" && f.kdp !== "publishing") {
      report.error("asin", `${f.format} has an ASIN but kdp is ${f.kdp}`, slug);
    }
    if (f.fulfillment === "direct" && f.availability === "available") {
      // Was `book.paddlePriceId` until 2026-09-19. Paddle was retired on
      // 2026-09-13 and no catalogue entry has carried a Paddle id since, so
      // this line emitted one error per direct ebook — 27 identical errors —
      // and the gate has been red and unread ever since. A check that is
      // always wrong is worse than no check: it hides the ones that are right.
      if (!book.providerPriceId) report.error("provider", "direct ebook without providerPriceId", slug);
      if (!f.masterFileKey) report.error("master", "direct ebook without masterFileKey", slug);
      if (book.kdpSelect) report.error("select", "KDP Select-enrolled book flagged for direct sale", slug);
    }
    // ISBN, if the catalogue claims one. `load-catalog.mjs` bound `f.isbn`
    // while the field has always been `isbn13`, so four real print ISBNs were
    // written to production as NULL on every run and nothing noticed. The
    // shape is asserted here so the same class of silent drop is loud.
    if (f.isbn13 != null) {
      const digits = String(f.isbn13).replace(/[\s-]/g, "");
      if (!/^\d{13}$/.test(digits)) {
        report.error("isbn", `${f.format} isbn13 ${JSON.stringify(f.isbn13)} is not 13 digits`, slug);
      } else {
        const d = [...digits].map(Number);
        const cd = (10 - d.slice(0, 12).reduce((a, x, i) => a + x * (i % 2 ? 3 : 1), 0) % 10) % 10;
        if (cd !== d[12]) report.error("isbn", `${f.format} isbn13 ${f.isbn13} fails its check digit`, slug);
        else report.pass("isbn", `${f.format} ${digits}`, slug);
      }
    }
    if (f.isbn !== undefined) {
      report.error("isbn", `${f.format} uses the field name "isbn"; the catalogue field is "isbn13"`, slug);
    }
  }
  const cover = join(REPO_ROOT, "public", "images", "books", `${slug}.webp`);
  if (!existsSync(cover)) report.error("cover", `missing public/images/books/${slug}.webp`, slug);
  else {
    const h = imageHeight(cover);
    if (h != null && h < 1200) report.warn("cover", `cover height ${h} px (< 1200)`, slug);
  }
  const previews = join(REPO_ROOT, "public", "images", "previews", slug);
  if (!existsSync(previews) || !readdirSync(previews).length) report.warn("previews", "no preview pages", slug);
}

export async function networkChecks(book, origin, report) {
  const slug = book.slug;
  for (const f of book.formats) {
    if (f.amazonAsin) {
      const r = await fetchStatus(`https://www.amazon.com/dp/${f.amazonAsin}`, { headers: { "user-agent": "Mozilla/5.0" } });
      if (r.status !== 200) report.error("amazon", `${f.format} ASIN ${f.amazonAsin} → ${r.status}`, slug);
      await new Promise((r2) => setTimeout(r2, 800));
    }
  }
  const page = await fetchStatus(`${origin}/books/${slug}`, { wantBody: true });
  if (page.status !== 200) {
    report.error("page", `${origin}/books/${slug} → ${page.status}${page.location ? ` → ${page.location}` : ""}`, slug);
    return;
  }
  const canonical = (page.text.match(/<link rel="canonical" href="([^"]+)"/) ?? [])[1];
  if (!canonical || !canonical.startsWith(origin)) report.error("canonical", `canonical is ${canonical ?? "missing"}`, slug);
  const ld = [...page.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!ld.length) report.error("json-ld", "no JSON-LD on the book page", slug);
  let hasOffer = false;
  for (const block of ld) {
    try {
      const parsed = JSON.parse(block);
      const text = JSON.stringify(parsed);
      if (text.includes('"Offer"')) hasOffer = true;
    } catch {
      report.error("json-ld", "JSON-LD does not parse", slug);
    }
  }
  const direct = book.formats.find((f) => f.fulfillment === "direct" && f.availability === "available" && (f.priceCents ?? 0) > 0);
  if (direct && !hasOffer) report.warn("json-ld", "direct price exists but no Offer in JSON-LD", slug);
  if (!direct && hasOffer) report.error("json-ld", "an Offer is emitted for a book with no direct price (would advertise $0)", slug);
  if (!report.errors.some((e) => e.where === slug)) report.pass("page", `${origin}/books/${slug} 200, canonical ok, JSON-LD parses`, slug);
}

/** Every companion page and asset must answer 200 — a printed address cannot be patched. */
async function companionCheck(origin, report) {
  const src = readFileSync(join(REPO_ROOT, "src", "lib", "companions.ts"), "utf8");
  const slugs = [...src.matchAll(/^\s+slug:\s*"([a-z0-9-]+)",$/gm)].map((m) => m[1]);
  const hrefs = [...src.matchAll(/href:\s*"(\/companion\/[^"]+)"/g)].map((m) => m[1]);
  for (const slug of slugs) {
    const r = await fetchStatus(`${origin}/companion/${slug}`);
    if (r.status !== 200) report.error("companion", `${origin}/companion/${slug} → ${r.status}`, slug);
    else report.pass("companion", `/companion/${slug} 200`, slug);
  }
  let bad = 0;
  for (const href of hrefs) {
    const r = await fetchStatus(`${origin}${href}`, { method: "HEAD" });
    if (r.status !== 200) { bad++; report.error("companion-asset", `${href} → ${r.status}`); }
  }
  if (!bad) report.pass("companion-asset", `${hrefs.length} companion assets answer 200`);
}

/**
 * The same cover on every route. Each surface is fetched and must reference
 * the canonical cover file for every book it lists; a real cover that one
 * route shows and another hides is a data defect, not a style choice.
 */
async function coverConsistencyCheck(origin, published, report) {
  const surfaces = ["/", "/ebooks", "/books"];
  const html = {};
  for (const path of surfaces) {
    const r = await fetchStatus(`${origin}${path}`, { wantBody: true });
    if (r.status !== 200) { report.error("cover-route", `${path} → ${r.status}`); continue; }
    html[path] = r.text;
  }
  const direct = new Set(published.filter((b) => b.formats.some((f) => f.fulfillment === "direct" && f.availability === "available")).map((b) => b.slug));
  for (const b of published) {
    const needle = encodeURIComponent(`/images/books/${b.slug}.webp`);
    const plain = `/images/books/${b.slug}.webp`;
    // The homepage marquee renders the small copy instead
    // (book-marquee.tsx swaps /images/books/ for /images/books/thumb/), so the
    // full-size path never appears on "/" and this check reported every book
    // on the shelf as missing its cover. The thumb is still evidence the cover
    // resolved: the marquee derives it from bookCoverSrc() and emits nothing
    // when that returns null, so a book with no cover still fails.
    const thumb = `/images/books/thumb/${b.slug}.webp`;
    const shows = (path) =>
      html[path] &&
      (html[path].includes(needle) ||
        html[path].includes(plain) ||
        (path === "/" &&
          (html[path].includes(thumb) || html[path].includes(encodeURIComponent(thumb)))));
    // The homepage features the six newest; a book absent from it is not a
    // defect, but a book present WITHOUT its cover is.
    const onHome = html["/"] && html["/"].includes(`/books/${b.slug}`);
    if (onHome && !shows("/")) report.error("cover-route", `listed on / without its cover`, b.slug);
    if (html["/books"] && !shows("/books")) report.error("cover-route", `listed on /books without its cover`, b.slug);
    if (direct.has(b.slug) && html["/ebooks"] && !shows("/ebooks")) report.error("cover-route", `listed on /ebooks without its cover`, b.slug);
    const page = await fetchStatus(`${origin}/books/${b.slug}`, { wantBody: true });
    if (page.status === 200 && !(page.text.includes(needle) || page.text.includes(plain))) report.error("cover-route", `/books/${b.slug} does not reference its cover`, b.slug);
    if (!report.errors.some((e) => e.check === "cover-route" && e.where === b.slug)) report.pass("cover-route", "same cover on every surface", b.slug);
  }
}

/** Strings that were once invented must not reappear on production. */
const FABRICATED = [
  { re: /10K\+|50K\+|2M\+|120\+ *(<[^>]+>)*\s*Countries/i, what: "the invented authors/books/readers/countries stats" },
  { re: /Apply Now/i, what: "the dead 'Apply Now' author call" },
  { re: /puzzle designer, mythologist/i, what: "the unauthorised biography" },
  { re: /Atomic Habits|The Midnight Library|Psychology of Money/i, what: "other publishers' bestsellers as demo inventory" },
  { re: /founder_portrait\.webp/i, what: "the AI-generated founder portrait" },
];

async function fabricationCheck(origin, report) {
  const pages = ["/", "/authors", "/categories", "/blog", "/books", "/ebooks", "/cart", "/search?q=myth", "/about"];
  for (const path of pages) {
    const r = await fetchStatus(`${origin}${path}`, { wantBody: true });
    if (r.status !== 200) { report.warn("fabrication", `${path} → ${r.status} (not checked)`); continue; }
    for (const f of FABRICATED) if (f.re.test(r.text)) report.error("fabrication", `${path} carries ${f.what}`);
    if (path === "/search?q=myth" && /tabular-nums">4\.7</.test(r.text)) report.error("fabrication", "/search prints the constant 4.7 rating");
  }
  const founder = await fetchStatus(`${origin}/authors/emre-dogan`, { wantBody: true });
  if (founder.status === 200) {
    const ok = /stories that cultures tell themselves/.test(founder.text) && /He lives in Turkey/.test(founder.text);
    if (!ok) report.error("fabrication", "/authors/emre-dogan does not print the approved biography");
  } else report.warn("fabrication", `/authors/emre-dogan → ${founder.status}`);
  if (!report.errors.some((e) => e.check === "fabrication")) report.pass("fabrication", `${pages.length} public pages carry no invented figure, rating, biography or portrait`);
}

async function sitemapCheck(origin, published, report) {
  const r = await fetchStatus(`${origin}/sitemap.xml`, { wantBody: true });
  if (r.status !== 200) return report.error("sitemap", `${origin}/sitemap.xml → ${r.status}`);
  const locs = [...r.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const b of published) if (!locs.includes(`${origin}/books/${b.slug}`)) report.error("sitemap", `missing /books/${b.slug}`);
  for (const path of ["/ebooks", "/companion/hangul", "/companion/world-games", "/companion/dudeney", "/companion/world-myths", "/companion/codex-bestiarium", "/companion/codex-mythologica", "/companion/myth-hunters-field-book"]) if (!locs.includes(`${origin}${path}`)) report.warn("sitemap", `missing ${path} (deployed after the sitemap change?)`);
  if (!report.errors.some((e) => e.check === "sitemap")) report.pass("sitemap", `${locs.length} URLs`);
}

async function providerCheck(env, published, report) {
  // Replaced paddleCheck on 2026-09-19. Paddle is retired: its adapter is not
  // registered in src/lib/payments, its variables are gone from Vercel, and
  // its key is revoked. A validation gate must never be satisfied by reviving a
  // retired provider — so this asks the provider that actually takes the money.
  if (!env.LEMONSQUEEZY_API_KEY) {
    return report.skipped("provider", "no LEMONSQUEEZY_API_KEY in --env file");
  }
  const headers = {
    authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}`,
    accept: "application/vnd.api+json",
  };

  // IS THIS KEY EVEN LOOKING AT THE RIGHT STORE?
  //
  // Lemon Squeezy issues separate test-mode and live-mode keys, and a test-mode
  // key answers 404 for every live variant. Handed one, the loop below would
  // emit one error per direct ebook — 27 of them — which is precisely the shape
  // of the Paddle check this replaced: a gate that is always wrong, and so goes
  // unread. So ask the store first. A key that cannot see the store's products
  // is the wrong key, and that is a SKIP with a reason, not 27 findings.
  const storeId = env.LEMONSQUEEZY_STORE_ID;
  if (storeId && !/^\[/.test(storeId)) {
    const probe = await fetch(
      `https://api.lemonsqueezy.com/v1/products?filter[store_id]=${storeId}&page[size]=1`,
      { headers },
    );
    const pj = await probe.json().catch(() => ({}));
    const visible = pj?.meta?.page?.total ?? (pj?.data?.length ?? 0);
    if (probe.status !== 200 || visible === 0) {
      return report.skipped(
        "provider",
        `this LEMONSQUEEZY_API_KEY sees 0 products in store ${storeId} (HTTP ${probe.status}) — ` +
          "it is a test-mode key, or a key for another store. Supply the live-mode key to run this check.",
      );
    }
  }

  for (const b of published) {
    if (!b.providerPriceId) continue;
    const r = await fetch(`https://api.lemonsqueezy.com/v1/variants/${b.providerPriceId}`, { headers });
    const j = await r.json().catch(() => ({}));
    const v = j.data;
    if (r.status !== 200 || !v) {
      report.error("provider", `variant ${b.providerPriceId} → ${r.status}`, b.slug);
      continue;
    }
    const expected = b.formats.find((f) => f.fulfillment === "direct")?.priceCents;
    const amount = Number(v.attributes?.price);
    const status = v.attributes?.status;
    if (status !== "published") {
      report.error("provider", `variant ${b.providerPriceId} is ${status}`, b.slug);
    } else if (expected != null && Number.isFinite(amount) && amount !== expected) {
      report.error("provider", `Lemon Squeezy charges ${amount} but the catalogue says ${expected}`, b.slug);
    } else {
      report.pass("provider", `${b.providerPriceId} published, ${amount}`, b.slug);
    }
  }
}

async function r2Check(env, published, report) {
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ENDPOINT || !env.R2_BUCKET_MASTERS) return report.skipped("r2", "no R2_* credentials in --env file");
  const { S3Client, HeadObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({ region: "auto", endpoint: env.R2_ENDPOINT, credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } });
  for (const b of published) {
    const key = b.formats.find((f) => f.fulfillment === "direct" && f.masterFileKey)?.masterFileKey;
    if (!key) continue;
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET_MASTERS, Key: key }));
      const mb = (head.ContentLength ?? 0) / 1048576;
      if (mb > 20) report.warn("r2", `${key} is ${mb.toFixed(1)} MB (> 20 MB — is this the print interior?)`, b.slug);
      else report.pass("r2", `${key} ${mb.toFixed(2)} MB`, b.slug);
    } catch (e) {
      report.error("r2", `${key}: ${e.name}`, b.slug);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnvFile(args.env ? resolve(args.env) : null);
  const origin = (args.origin ?? env.NEXT_PUBLIC_APP_URL ?? "https://valicepress.com").replace(/\/$/, "");
  const published = BOOKS.filter((b) => b.websiteStatus === "published" && (!args.slug || b.slug === args.slug));
  const report = new Report("validate-catalog", origin);
  for (const b of published) localChecks(b, report);
  if (args["skip-network"]) report.skipped("network", "--skip-network");
  else {
    for (const b of published) await networkChecks(b, origin, report);
    await sitemapCheck(origin, published, report);
    await coverConsistencyCheck(origin, published, report);
    await companionCheck(origin, report);
    await fabricationCheck(origin, report);
    await providerCheck(env, published, report);
    await r2Check(env, published, report);
  }
  finish(report, { out: join(REPO_ROOT, "docs", "execution", "validate-catalog.json"), json: Boolean(args.json) });
}

if (process.argv[1] && process.argv[1].endsWith("validate-catalog.mjs")) {
  main().catch((e) => {
    console.error(`validate-catalog: ${e.message}`);
    process.exit(1);
  });
}
