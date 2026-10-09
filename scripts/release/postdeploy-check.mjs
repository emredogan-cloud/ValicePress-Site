#!/usr/bin/env node
/**
 * Read-only post-deploy verification of the live site. GET only; no credentials, no cookies, no POST.
 *
 *   node scripts/release/postdeploy-check.mjs --from <previously deployed commit> --to <commit now deployed>
 *        [--base https://valicepress.com] [--out evidence.json]
 *
 * Checks: key pages (status, title, canonical, robots meta), the sitemap against the catalogue file, the draft
 * book's absence, the World Games page's edition facts, the admin area refusing a stranger (pages and APIs),
 * robots.txt, response security headers, and — for every file the release added, changed or deleted under public/
 * between the two commits — the bytes the live site serves against the bytes in the repository at `--to` (this is
 * what shows a stale edge copy; the 2026-10-09 release found none).
 *
 * The live proxy rate-limits per IP (100 requests / 10 s): run this alone, not beside a crawl or a sweep.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const BASE = opt("base", "https://valicepress.com").replace(/\/$/, "");
const FROM = opt("from", null);
const TO = opt("to", null);
const OUT = opt("out", null);
if (!FROM || !TO) {
  console.error("usage: node scripts/release/postdeploy-check.mjs --from <previously deployed commit> --to <commit now deployed> [--base <origin>] [--out <file>]");
  process.exit(2);
}
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const UA = "Mozilla/5.0 (X11; Linux x86_64) valice-release-verify/1.0 (read-only; GET only)";

const checks = [];
let failures = 0;
function rec(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}
const get = (p, headers = {}) => fetch(BASE + p, { redirect: "manual", headers: { "user-agent": UA, accept: "text/html,*/*", ...headers } });
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
// The bytes the repository holds AT the deployed commit (not whatever is checked out).
const gitBytes = (rev, file) => execFileSync("git", ["-C", REPO, "show", `${rev}:${file}`], { maxBuffer: 256 * 1024 * 1024 });
const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ");

// ---------------------------------------------------------------------------------------------- catalogue (file)
const catalogue = await import(pathToFileURL(path.join(REPO, "scripts/catalog/valice-catalog.mjs")).href);
const published = catalogue.BOOKS.filter((b) => b.websiteStatus === "published").map((b) => b.slug);
const drafts = catalogue.BOOKS.filter((b) => b.websiteStatus !== "published").map((b) => b.slug);

// ---------------------------------------------------------------------------------------------- key pages
const PAGES = [
  ["/", true], ["/books", true], ["/ebooks", true], ["/categories", true], ["/authors", true], ["/about", true], ["/blog", true],
  ["/terms", true], ["/privacy", true], ["/refund", true], ["/kvkk", true],
  ["/bonus", true], ["/weather-permitting-bonus", true], ["/long-way-back-bonus", true],
  ["/cart", false], ["/search?q=moon", false],
];
for (const [p, indexable] of PAGES) {
  try {
    const res = await get(p);
    const html = await res.text();
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? "";
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;
    const robotsMeta = html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? "";
    const noindex = /noindex/i.test(robotsMeta);
    const canonicalOk = indexable ? canonical !== null && canonical.startsWith(BASE) : true;
    rec(
      `page ${p}`,
      res.status === 200 && title.length > 0 && canonicalOk && (indexable ? !noindex : true),
      `${res.status} · title ${title.length} chars · canonical ${canonical ?? "none"}${noindex ? " · noindex" : ""}`,
    );
  } catch (e) {
    rec(`page ${p}`, false, String(e));
  }
}

// ---------------------------------------------------------------------------------------------- sitemap
let sitemapPaths = [];
{
  const res = await get("/sitemap.xml");
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  sitemapPaths = locs.map((l) => (l.startsWith(BASE) ? l.slice(BASE.length) || "/" : l));
  rec("sitemap.xml answers 200 with URLs", res.status === 200 && locs.length > 0, `${res.status} · ${locs.length} URLs`);
  rec("every sitemap URL is on the canonical origin", locs.every((l) => l.startsWith(BASE + "/") || l === BASE), `${locs.filter((l) => !l.startsWith(BASE)).length} off-origin`);
  for (const p of ["/bonus", "/weather-permitting-bonus", "/long-way-back-bonus"]) rec(`sitemap lists ${p}`, sitemapPaths.includes(p));
  const bookPaths = sitemapPaths.filter((p) => /^\/books\/[^/]+$/.test(p)).map((p) => p.split("/")[2]);
  rec(`sitemap lists exactly the ${published.length} published books`, bookPaths.length === published.length && published.every((s) => bookPaths.includes(s)), `${bookPaths.length} book URLs; missing: ${published.filter((s) => !bookPaths.includes(s)).join(",") || "none"}; extra: ${bookPaths.filter((s) => !published.includes(s)).join(",") || "none"}`);
  for (const d of drafts) rec(`draft "${d}" is not in the sitemap`, !bookPaths.includes(d));
  const lm = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => Date.parse(m[1]));
  rec("every lastmod is a real date not in the future", lm.every((t) => !Number.isNaN(t) && t <= Date.now() + 60_000), `${lm.length} lastmod values`);
}

// ---------------------------------------------------------------------------------------------- book pages + drafts
{
  let bad = [];
  for (const slug of published) {
    const res = await get(`/books/${slug}`);
    const html = await res.text();
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
    if (res.status !== 200 || textOf(h1).trim().length === 0) bad.push(`${slug}:${res.status}`);
  }
  rec(`all ${published.length} published book pages answer 200 with an h1`, bad.length === 0, bad.join(" ") || "ok");
  for (const d of drafts) {
    const res = await get(`/books/${d}`);
    rec(`draft /books/${d} has no public page`, res.status === 404, `${res.status}`);
  }
}

// ---------------------------------------------------------------------------------------------- World Games facts
{
  const res = await get("/books/the-great-book-of-world-games");
  const txt = textOf(await res.text());
  rec("World Games page describes the 258-page edition", /258 pages/.test(txt) && /sixty-three/i.test(txt) && !/182 pages/.test(txt) && !/fifty-six/i.test(txt), `258 pages×${(txt.match(/258 pages/g) ?? []).length}; "182 pages"×${(txt.match(/182 pages/g) ?? []).length}`);
}

// ---------------------------------------------------------------------------------------------- Codex Bestiarium count
{
  const res = await get("/books/codex-bestiarium");
  const txt = textOf(await res.text());
  rec("Codex Bestiarium page says 112, never 120, creatures", /112/.test(txt) && !/120 (Legendary )?Creatures/i.test(txt), `"112"×${(txt.match(/112/g) ?? []).length}; "120 … Creatures"×${(txt.match(/120 (Legendary )?Creatures/gi) ?? []).length}`);
}

// ---------------------------------------------------------------------------------------------- admin: a stranger is refused
{
  const SIGNIN = /accounts\.valicepress\.com|\/sign-in|\/admin(\/|$|\?)/;
  const ADMIN_CONTENT = /Mailable|Contacts on file|Known contacts|Recent orders|Latest signups|Free-ebook requests|Direct revenue|Reader support|Possible duplicates|valice-catalog\.mjs/i;
  const PAGES_ADMIN = ["/admin", "/admin/books", "/admin/email", "/admin/email/export", "/admin/free-books", "/admin/support", "/admin/data", "/admin/contacts", "/admin/contacts/export", "/admin/books/some-book/edit"];
  for (const p of PAGES_ADMIN) {
    const res = await get(p);
    const loc = res.headers.get("location") ?? "";
    const body = res.status >= 300 && res.status < 400 ? "" : await res.text();
    const refused = [307, 308, 401, 403, 404].includes(res.status) && !ADMIN_CONTENT.test(body) && (res.status < 300 || res.status >= 400 || SIGNIN.test(loc));
    rec(`anonymous GET ${p} is refused`, refused, `${res.status}${loc ? " → " + loc.replace(/redirect_url=[^&]+/, "redirect_url=…") : ""}`);
  }
  for (const p of ["/api/admin/events", "/api/admin/storage-check", "/api/admin/fulfillment-check", "/api/admin/email-check", "/api/admin/sentry-check"]) {
    const res = await get(p, { accept: "application/json" });
    const body = res.status >= 300 && res.status < 400 ? "" : await res.text();
    rec(`anonymous GET ${p} is refused`, [401, 403, 307, 404].includes(res.status) && !/DATABASE_URL|postgres:|secret|token/i.test(body), `${res.status} ${body.slice(0, 80).replace(/\s+/g, " ")}`);
  }
  const rob = await (await get("/robots.txt")).text();
  rec("robots.txt keeps crawlers out of /admin and names the sitemap", /Disallow: \/admin\b/.test(rob) && new RegExp(`Sitemap: ${BASE.replace(/[.]/g, "\\.")}/sitemap\\.xml`).test(rob), rob.replace(/\s+/g, " ").slice(0, 160));
  rec("the admin area is not in the sitemap", !sitemapPaths.some((p) => p.startsWith("/admin")));
}

// ---------------------------------------------------------------------------------------------- security headers (home)
{
  const res = await get("/");
  const h = (n) => res.headers.get(n) ?? "";
  const csp = h("content-security-policy");
  rec("security headers present on /", /frame-ancestors 'none'/.test(csp) && /nosniff/i.test(h("x-content-type-options")) && h("strict-transport-security").length > 0, `csp ${csp.length} chars · nosniff ${h("x-content-type-options")} · hsts ${h("strict-transport-security") ? "yes" : "no"} · referrer ${h("referrer-policy")}`);
}

// ---------------------------------------------------------------------------------------------- assets: live bytes vs repo bytes
{
  const diff = execFileSync("git", ["-C", REPO, "diff", `${FROM}..${TO}`, "--name-status", "--", "public"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  const added = [], modified = [], deleted = [];
  for (const line of diff) {
    const [st, ...rest] = line.split("\t");
    const f = rest[rest.length - 1];
    (st.startsWith("A") ? added : st.startsWith("M") ? modified : st.startsWith("D") ? deleted : added).push(f);
  }
  async function compare(files, label) {
    const mismatch = [];
    const queue = [...files];
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        while (queue.length) {
          const f = queue.shift();
          const url = "/" + f.replace(/^public\//, "");
          try {
            const res = await fetch(BASE + url.split("/").map(encodeURIComponent).join("/"), { headers: { "user-agent": UA } });
            const buf = Buffer.from(await res.arrayBuffer());
            const want = sha(gitBytes(TO, f));
            if (res.status !== 200 || sha(buf) !== want) mismatch.push(`${url} (${res.status}, age ${res.headers.get("age") ?? "-"}, cf ${res.headers.get("cf-cache-status") ?? "-"})`);
          } catch (e) {
            mismatch.push(`${url} (${String(e)})`);
          }
        }
      }),
    );
    rec(`${label}: ${files.length} files — live bytes equal the repository's`, mismatch.length === 0, mismatch.length ? `${mismatch.length} differ: ${mismatch.slice(0, 12).join("; ")}` : "all identical");
    return mismatch;
  }
  await compare(added, "files ADDED under public/");
  await compare(modified, "files MODIFIED under public/ (same URL, new bytes: where an edge copy could be stale)");
  const gone = [];
  for (const f of deleted) {
    const res = await fetch(BASE + "/" + f.replace(/^public\//, ""), { headers: { "user-agent": UA } });
    if (res.status !== 404) gone.push(`${f} (${res.status})`);
  }
  rec(`files DELETED from public/ (${deleted.length}) are gone from the live site`, gone.length === 0, gone.join("; ") || "all 404");
}

console.log(`\n${checks.length - failures}/${checks.length} checks passed, ${failures} failed.`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), failures, checks }, null, 2));
process.exit(failures ? 1 : 0);
