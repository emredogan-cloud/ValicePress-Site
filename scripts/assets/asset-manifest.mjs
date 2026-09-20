#!/usr/bin/env node
/**
 * The storefront's image assets, as a committed manifest.
 *
 *   node scripts/assets/asset-manifest.mjs            # rewrite src/lib/asset-manifest.json
 *   node scripts/assets/asset-manifest.mjs --check    # exit 1 if the manifest is stale
 *   node scripts/assets/asset-manifest.mjs --inventory docs/execution/phase-4/ASSET_INVENTORY.csv
 *
 * WHY A MANIFEST AND NOT A FILESYSTEM CHECK
 * Until Phase 4 every surface decided for itself whether a real cover existed
 * by calling `existsSync` on `public/…` at render time. Three pages did; the
 * homepage, the library, the cart, the related-books shelves, search and the
 * order pages never did, so the same book showed its real cover on /ebooks
 * and a gradient on the home page. A single committed list of what exists —
 * read the same way by every route, on the server and in a client bundle,
 * at build time and inside an ISR regeneration — removes the question.
 *
 * Every entry carries the measured pixel size so a consumer can refuse an
 * asset that is the wrong shape (a 1:1 file in a 2:3 cover slot) instead of
 * stretching it. `--check` runs in the test suite: a file dropped into
 * public/images without regenerating the manifest fails CI rather than
 * silently never rendering.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { REPO_ROOT, parseArgs } from "../factory/lib/project.mjs";

export const PUBLIC_DIR = join(REPO_ROOT, "public");
export const IMAGES_DIR = join(PUBLIC_DIR, "images");
export const MANIFEST_PATH = join(REPO_ROOT, "src", "lib", "asset-manifest.json");
const IMAGE_RE = /\.(webp|png|jpe?g|svg|avif)$/i;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (IMAGE_RE.test(name)) out.push(full);
  }
  return out;
}

function dimensions(file) {
  try {
    const [w, h] = execFileSync("identify", ["-format", "%w %h", `${file}[0]`], { encoding: "utf8" })
      .trim()
      .split(" ")
      .map(Number);
    return { width: w, height: h };
  } catch {
    return { width: null, height: null };
  }
}

/** Classify a public path by the slot convention in src/lib/asset-map.ts. */
export function slotFor(publicPath) {
  const m = publicPath.match(/^\/images\/([a-z-]+)\/(.+)$/);
  if (!m) return { slot: "other", entity: null };
  const [, dir, rest] = m;
  const base = rest.replace(/\.[a-z0-9]+$/i, "");
  switch (dir) {
    case "books":
      // /images/books/thumb/<slug>.webp is the small copy the homepage
      // marquee swaps in (see book-marquee.tsx). It is a second rendition of
      // a cover, not a cover, and reporting it as one invents the book slug
      // "thumb/<slug>" — which is what made `has no cover file the catalogue
      // does not know about` fail the first time these files were manifested.
      if (base.startsWith("thumb/")) {
        return { slot: "book-thumb", entity: base.slice("thumb/".length) };
      }
      return { slot: "book-cover", entity: base };
    case "previews":
      return { slot: "book-preview", entity: rest.split("/")[0] };
    case "authors":
      return base === "authors_hero_atmosphere" || base === "authors_hero_bleed"
        ? { slot: "page-atmosphere", entity: "authors" }
        : { slot: "author-portrait", entity: base };
    case "categories":
      return { slot: "category-art", entity: base };
    case "blog":
      return { slot: "blog-image", entity: base };
    case "genres":
      return base === "genres_explore_scene"
        ? { slot: "page-atmosphere", entity: "genres" }
        : { slot: "legacy-genre-art", entity: base };
    default:
      return { slot: "page-atmosphere", entity: `${dir}/${base}` };
  }
}

export function buildManifest() {
  const files = existsSync(IMAGES_DIR) ? walk(IMAGES_DIR) : [];
  const assets = files.map((file) => {
    const publicPath = `/${relative(PUBLIC_DIR, file).split("\\").join("/")}`;
    const { width, height } = dimensions(file);
    return {
      path: publicPath,
      width,
      height,
      bytes: statSync(file).size,
      ...slotFor(publicPath),
    };
  });
  return { generatedBy: "scripts/assets/asset-manifest.mjs", assets };
}

export function readManifest() {
  return existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) : null;
}

/** Stable comparison: paths and sizes only, never the generation time. */
function same(a, b) {
  if (!a || !b) return false;
  const key = (m) => JSON.stringify(m.assets.map((x) => [x.path, x.width, x.height, x.bytes, x.slot, x.entity]));
  return key(a) === key(b);
}

function writeInventory(manifest, target) {
  const usage = usageIndex();
  const rows = [["path", "slot", "entity", "width", "height", "bytes", "referenced_by"]];
  for (const a of manifest.assets) {
    rows.push([a.path, a.slot, a.entity ?? "", a.width ?? "", a.height ?? "", a.bytes, (usage.get(a.path) ?? []).join(" ")]);
  }
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  writeFileSync(resolve(target), `${csv}\n`);
}

/** Which source files reference a public path or the directory convention. */
function usageIndex() {
  const index = new Map();
  const src = join(REPO_ROOT, "src");
  const files = [];
  (function w(d) {
    for (const n of readdirSync(d)) {
      const f = join(d, n);
      if (statSync(f).isDirectory()) w(f);
      else if (/\.(tsx?|mjs)$/.test(n) && !n.endsWith(".json")) files.push(f);
    }
  })(src);
  const texts = files.map((f) => [relative(REPO_ROOT, f), readFileSync(f, "utf8")]);
  const manifest = buildManifest();
  for (const a of manifest.assets) {
    const dir = a.path.replace(/\/[^/]+$/, "/");
    const hits = texts
      .filter(([, t]) => t.includes(a.path) || t.includes(dir))
      .map(([f]) => f);
    index.set(a.path, hits);
  }
  return index;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const fresh = buildManifest();
  if (args.check) {
    const current = readManifest();
    if (!same(current, fresh)) {
      console.error(`asset-manifest: STALE — ${MANIFEST_PATH} does not match public/images. Run: node scripts/assets/asset-manifest.mjs`);
      process.exit(1);
    }
    console.log(`asset-manifest: ok (${fresh.assets.length} assets)`);
    return;
  }
  if (args.inventory) {
    writeInventory(fresh, args.inventory);
    console.log(`asset-manifest: inventory → ${args.inventory}`);
    return;
  }
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(fresh, null, 2)}\n`);
  const bySlot = {};
  for (const a of fresh.assets) bySlot[a.slot] = (bySlot[a.slot] ?? 0) + 1;
  console.log(`asset-manifest: wrote ${fresh.assets.length} assets → ${relative(REPO_ROOT, MANIFEST_PATH)}`);
  for (const [k, v] of Object.entries(bySlot)) console.log(`  ${k.padEnd(18)} ${v}`);
}

if (process.argv[1] && process.argv[1].endsWith("asset-manifest.mjs")) main();
