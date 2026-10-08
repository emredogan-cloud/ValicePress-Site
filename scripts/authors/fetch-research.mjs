#!/usr/bin/env node
/**
 * Pull the raw research for every roster entry into scripts/tmp/authors/raw/<slug>.json (git-ignored scratch):
 * Wikipedia's plain-text article (intro + sections), the Wikidata entity's dates and places, and the lead
 * image's Commons licence metadata. Read-only against Wikimedia; polite pacing; a descriptive User-Agent.
 *
 *   node scripts/authors/fetch-research.mjs [slug ...]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ROSTER } from "./roster.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "scripts/tmp/authors/raw");
mkdirSync(OUT, { recursive: true });
const UA = "ValicePressSite/1.0 (https://valicepress.com; author-directory research; contact via site) node-fetch";
const only = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url) {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) { await sleep(1500 * (i + 1)); continue; }
    throw new Error(`${res.status} ${url}`);
  }
  throw new Error(`gave up ${url}`);
}

const api = (host, params) => `https://${host}/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params })}`;

for (const a of ROSTER) {
  if (only.length && !only.includes(a.slug)) continue;
  const raw = { slug: a.slug, wiki: a.wiki, fetchedAt: new Date().toISOString() };
  try {
    const q = await json(api("en.wikipedia.org", { action: "query", titles: a.wiki, redirects: "1", prop: "extracts|pageprops|pageimages|info", explaintext: "1", exsectionformat: "plain", piprop: "original|name", inprop: "url", ppprop: "wikibase_item" }));
    const page = q.query.pages[0];
    if (page.missing) throw new Error("wikipedia page missing");
    raw.title = page.title;
    raw.url = page.fullurl;
    raw.extract = page.extract;
    raw.wikidata = page.pageprops?.wikibase_item;
    raw.lead = page.pageimage ? { file: page.pageimage, original: page.original?.source } : null;

    if (raw.wikidata) {
      const wd = await json(`https://www.wikidata.org/wiki/Special:EntityData/${raw.wikidata}.json`);
      const e = wd.entities[raw.wikidata];
      const claim = (p) => (e.claims?.[p] ?? []).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);
      raw.wd = {
        label: e.labels?.en?.value,
        description: e.descriptions?.en?.value,
        born: claim("P569").map((v) => v.time),
        died: claim("P570").map((v) => v.time),
        birthPlace: claim("P19").map((v) => v.id),
        deathPlace: claim("P20").map((v) => v.id),
        citizenship: claim("P27").map((v) => v.id),
        image: claim("P18"),
      };
    }

    if (raw.lead?.file) {
      const c = await json(api("commons.wikimedia.org", { action: "query", titles: `File:${raw.lead.file}`, prop: "imageinfo", iiprop: "url|size|mime|sha1|extmetadata", iiurlwidth: "1000" }));
      const ii = c.query.pages[0]?.imageinfo?.[0];
      if (ii) {
        const m = ii.extmetadata ?? {};
        raw.lead.commons = {
          pageUrl: ii.descriptionurl,
          url: ii.url,
          thumb: ii.thumburl,
          width: ii.width,
          height: ii.height,
          mime: ii.mime,
          sha1: ii.sha1,
          licenceShort: m.LicenseShortName?.value,
          licenceUrl: m.LicenseUrl?.value,
          usage: m.UsageTerms?.value,
          attributionRequired: m.AttributionRequired?.value,
          artist: m.Artist?.value,
          credit: m.Credit?.value,
          date: m.DateTimeOriginal?.value,
          description: m.ImageDescription?.value,
          restrictions: m.Restrictions?.value,
        };
      }
    }
    console.log(`ok   ${a.slug.padEnd(24)} ${raw.title} · ${raw.extract?.length ?? 0} chars · lead: ${raw.lead?.file ?? "none"} · ${raw.lead?.commons?.licenceShort ?? ""}`);
  } catch (err) {
    raw.error = String(err);
    console.log(`FAIL ${a.slug.padEnd(24)} ${err}`);
  }
  writeFileSync(path.join(OUT, `${a.slug}.json`), JSON.stringify(raw, null, 2));
  await sleep(350);
}
