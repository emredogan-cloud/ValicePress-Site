/**
 * Google Search Console baseline, read through the Founder's service account.
 *
 * WHY IT MATTERS THAT THIS IS MEASURED
 * "Sitemap submitted" and "pages indexed" are different facts, and only the
 * second one can bring a customer. This script asks Search Console for both,
 * plus impressions and clicks per page and per query, so a later run can be
 * diffed against this one instead of against a memory.
 *
 * AUTH. Service-account JWT → OAuth token, signed with node's own crypto so
 * the repository does not grow a Google SDK for one read. The key file is
 * supplied by the Founder and is git-ignored; its path is passed in, never
 * hard-coded, and its contents are never printed.
 *
 * The service account must be added as a user on the Search Console property
 * (Settings → Users and permissions → Add user → Restricted). Until it is,
 * Google answers 403 and this script says so plainly rather than reporting
 * zero traffic, which is what an unauthorised read looks like from outside.
 *
 * Usage:
 *   node scripts/seo/gsc-export.mjs --key "$GOOGLE_SERVICE_ACCOUNT_KEY_FILE" \
 *     [--site sc-domain:valicepress.com] [--days 28] [--out docs/seo/baseline.json]
 */
import { createSign } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : fallback;
};

const keyPath = arg("key", process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ?? null);
if (!keyPath) {
  console.error("usage: gsc-export.mjs --key <service-account.json> [--site <property>] [--days N] [--out FILE]");
  console.error("       or set GOOGLE_SERVICE_ACCOUNT_KEY_FILE to the key's path outside this repository.");
  process.exit(2);
}
const days = Number(arg("days", "28"));
const out = arg("out");
const key = JSON.parse(readFileSync(keyPath, "utf8"));

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function accessToken(scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(key.private_key))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${JSON.stringify(json)}`);
  return json.access_token;
}

const token = await accessToken("https://www.googleapis.com/auth/webmasters.readonly");
console.log(`authenticated as ${key.client_email}\n`);

async function api(path, body) {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(`${path} → ${res.status} ${json?.error?.message ?? ""}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

let sites;
try {
  sites = (await api("/sites")).siteEntry ?? [];
} catch (err) {
  console.error(`Search Console refused the request: ${err.message}`);
  if (err.status === 403) {
    console.error(
      `\nThe service account is authenticated but has no access to any property.\n` +
        `Fix, once, in Search Console: Settings → Users and permissions → Add user →\n` +
        `  ${key.client_email}   permission: Restricted (read-only is enough)\n` +
        `Then re-run this command.`,
    );
  }
  process.exit(1);
}

console.log(`properties visible to this service account: ${sites.length}`);
for (const s of sites) console.log(`  ${s.siteUrl}  (${s.permissionLevel})`);
if (!sites.length) process.exit(1);

const site =
  arg("site") ??
  sites.find((s) => s.siteUrl.includes("valicepress.com"))?.siteUrl ??
  sites[0].siteUrl;
const enc = encodeURIComponent(site);
console.log(`\nproperty: ${site}\n`);

// Search Console data lags roughly two days; ending "today" would report a
// hole that looks like a traffic collapse.
const end = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
const start = new Date(Date.now() - (days + 2) * 86_400_000).toISOString().slice(0, 10);

const report = { takenAt: new Date().toISOString(), site, window: { start, end }, };

const totals = await api(`/sites/${enc}/searchAnalytics/query`, {
  startDate: start, endDate: end, dimensions: [], rowLimit: 1,
});
report.totals = totals.rows?.[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
console.log(`── ${start} → ${end} ──`);
console.log(`  clicks ${report.totals.clicks}   impressions ${report.totals.impressions}   ` +
  `CTR ${(report.totals.ctr * 100).toFixed(2)}%   avg position ${Number(report.totals.position).toFixed(1)}`);

for (const [dim, label] of [["page", "pages"], ["query", "queries"], ["country", "countries"]]) {
  const r = await api(`/sites/${enc}/searchAnalytics/query`, {
    startDate: start, endDate: end, dimensions: [dim], rowLimit: 25,
  });
  report[dim] = r.rows ?? [];
  console.log(`\n  top ${label} (${report[dim].length}):`);
  for (const row of report[dim].slice(0, 12))
    console.log(`    ${String(row.clicks).padStart(4)} clicks  ${String(row.impressions).padStart(6)} impr  pos ${Number(row.position).toFixed(1)}  ${row.keys[0]}`);
  if (!report[dim].length) console.log("    (none — no impressions recorded in this window)");
}

const sitemaps = await api(`/sites/${enc}/sitemaps`);
report.sitemaps = sitemaps.sitemap ?? [];
console.log(`\n  sitemaps (${report.sitemaps.length}):`);
for (const s of report.sitemaps) {
  const submitted = s.contents?.[0]?.submitted ?? "?";
  const indexed = s.contents?.[0]?.indexed ?? "—";
  console.log(
    `    ${s.path}\n      lastSubmitted=${s.lastSubmitted ?? "never"} lastDownloaded=${s.lastDownloaded ?? "never"} ` +
      `errors=${s.errors ?? 0} warnings=${s.warnings ?? 0} submittedUrls=${submitted} indexed=${indexed}`,
  );
}
if (!report.sitemaps.length) console.log("    (none submitted for this property)");

// ── URL inspection ─────────────────────────────────────────────────────────
// The one question the Search Analytics report cannot answer: is this page in
// the index? "Sitemap submitted: 23 URLs, indexed: 0" is the state a launch
// looks like from outside, and it is not the same as "we have no traffic".
const inspect = arg("inspect");
if (inspect) {
  const urls = inspect.split(",").map((u) => u.trim()).filter(Boolean);
  report.inspection = [];
  console.log(`\n  URL inspection (${urls.length}):`);
  for (const inspectionUrl of urls) {
    const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ inspectionUrl, siteUrl: site }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      console.log(`    ${inspectionUrl}\n      ERROR ${res.status} ${json?.error?.message ?? ""}`);
      report.inspection.push({ url: inspectionUrl, error: json?.error?.message ?? res.status });
      continue;
    }
    const r = json.inspectionResult?.indexStatusResult ?? {};
    console.log(
      `    ${inspectionUrl}\n      verdict=${r.verdict ?? "?"} coverage="${r.coverageState ?? "?"}" ` +
        `robots=${r.robotsTxtState ?? "?"} indexing=${r.indexingState ?? "?"} lastCrawl=${r.lastCrawlTime ?? "never"}`,
    );
    report.inspection.push({ url: inspectionUrl, ...r });
    await new Promise((r2) => setTimeout(r2, 400));
  }
}

if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\nbaseline → ${out}`);
}
