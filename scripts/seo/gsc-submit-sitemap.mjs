/**
 * Ask Google to re-fetch the sitemap.
 *
 * Google downloaded https://valicepress.com/sitemap.xml once, at 07:10 UTC on
 * 2026-09-02, and had not fetched it again by the next morning. Re-submitting
 * through the Search Console API prompts a new fetch, so the pages added
 * since — Dudeney, four reference articles, seven companions — reach
 * Google's copy of the sitemap sooner. It does not index anything; only a
 * crawl does that, and the export script reports whether one happened.
 *
 * Same service-account JWT flow as gsc-export.mjs; the key file is supplied
 * by the Founder, git-ignored, and never printed.
 *
 *   node scripts/seo/gsc-submit-sitemap.mjs --key "$GOOGLE_SERVICE_ACCOUNT_KEY_FILE" \
 *     [--site sc-domain:valicepress.com] [--sitemap https://valicepress.com/sitemap.xml]
 */
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : fallback;
};
const keyPath = arg("key", process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ?? null);
if (!keyPath) {
  console.error("usage: gsc-submit-sitemap.mjs --key <service-account.json> [--site <property>] [--sitemap <url>]");
  console.error("       or set GOOGLE_SERVICE_ACCOUNT_KEY_FILE to the key's path outside this repository.");
  process.exit(2);
}
const site = arg("site", "sc-domain:valicepress.com");
const sitemap = arg("sitemap", "https://valicepress.com/sitemap.xml");
const key = JSON.parse(readFileSync(keyPath, "utf8"));

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function accessToken(scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: key.client_email, scope, aud: key.token_uri, iat: now, exp: now + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(key.private_key))}`;
  const res = await fetch(key.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`token: ${res.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

const token = await accessToken("https://www.googleapis.com/auth/webmasters");
const base = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(sitemap)}`;
const put = await fetch(base, { method: "PUT", headers: { authorization: `Bearer ${token}` } });
console.log(`submit ${sitemap} → ${put.status}${put.status === 204 ? " (accepted)" : ""}`);
if (!put.ok) {
  console.error((await put.text()).slice(0, 300));
  process.exit(1);
}
const get = await fetch(base, { headers: { authorization: `Bearer ${token}` } });
const j = await get.json();
console.log(`lastSubmitted=${j.lastSubmitted} lastDownloaded=${j.lastDownloaded} errors=${j.errors} warnings=${j.warnings}`);
for (const c of j.contents ?? []) console.log(`  ${c.type}: submitted=${c.submitted} indexed=${c.indexed}`);
