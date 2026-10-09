#!/usr/bin/env node
/**
 * Set each author's Wikidata source from what Wikipedia says the article's Wikidata item IS (`wikibase_item`),
 * instead of from anyone's memory. (Typed by hand, five of the first fifteen ids were wrong; a wrong id
 * points at somebody else, and the verifier would only catch it if the dates happened to differ.)
 *
 *   node scripts/authors/sync-wikidata.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = path.join(ROOT, "src/content/authors");
const UA = "ValicePressSite/1.0 (https://valicepress.com; author-directory research) node-fetch";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
  const a = JSON.parse(readFileSync(path.join(DIR, f), "utf8"));
  const wp = a.sources.find((s) => /^https:\/\/en\.wikipedia\.org\/wiki\//.test(s.url));
  if (!wp) { console.log(`skip ${a.slug}: no Wikipedia source`); continue; }
  const title = decodeURIComponent(wp.url.split("/wiki/")[1]);
  const q = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: "query", format: "json", formatversion: "2", prop: "pageprops", ppprop: "wikibase_item", titles: title, redirects: "1" })}`;
  const res = await fetch(q, { headers: { "User-Agent": UA } });
  const qid = (await res.json()).query.pages[0].pageprops?.wikibase_item;
  if (!qid) { console.log(`FAIL ${a.slug}: no wikibase_item`); continue; }
  const url = `https://www.wikidata.org/wiki/${qid}`;
  const label = `Wikidata — ${a.name} (${qid})`;
  const i = a.sources.findIndex((s) => s.url.includes("wikidata.org"));
  if (i === -1) a.sources.splice(1, 0, { label, url });
  else if (a.sources[i].url !== url) { console.log(`fix  ${a.slug}: ${a.sources[i].url.split("/").pop()} -> ${qid}`); a.sources[i] = { label, url }; }
  else a.sources[i].label = label;
  writeFileSync(path.join(DIR, f), JSON.stringify(a, null, 2) + "\n");
  await sleep(200);
}
console.log("done");
