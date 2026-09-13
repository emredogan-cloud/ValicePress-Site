import { statSync } from "node:fs";
import { join } from "node:path";

import { assetRecord, bookCoverSrc } from "@/lib/asset-map";
import type { Companion, CompanionAsset } from "@/lib/companions";

/**
 * The view model behind every companion page.
 *
 * WHY THIS EXISTS RATHER THAN MORE FIELDS ON `Companion`. Everything here is
 * DERIVED — from the companion's own assets, from the cover manifest, and from
 * the files on disk. None of it is a second place to hand-maintain a fact
 * about a book, which is the failure this project already has a scar from:
 * a companion's `state` field drifted out of agreement with the catalogue on
 * twenty of twenty-nine pages because it was written by hand next to each one.
 *
 * Server-only. It reads the filesystem at build time (the page is
 * `force-static`), so nothing here ships to the browser.
 */

const PUBLIC_DIR = join(process.cwd(), "public");

export interface CompanionResourceView extends CompanionAsset {
  /** The three tracked segments of the metadata row, split from `meta`. */
  metaParts: string[];
  /**
   * Real size on disk, formatted. `null` for a generated asset, whose size is
   * not known until the route runs — and a number nobody measured is worse
   * than no number. The reference mock-up prints "12 MB" beside a file that
   * is 0.5 MB on disk; that is exactly the kind of decorative figure this
   * field refuses to carry.
   */
  size: string | null;
}

export interface CompanionView {
  companion: Companion;
  /** The companion's OWN book cover. Never another book's. */
  coverSrc: string | null;
  coverAlt: string;
  /**
   * The cover's real width/height as a CSS `aspect-ratio`, so the hero frame
   * is cut to the picture rather than the picture to the frame.
   *
   * This is not a nicety. The first build of the hero used a fixed 3/4 box,
   * and these covers are 1.500–1.600 — so `object-cover` sliced the title off
   * the top of The Great Book of World Games and the author's name off the
   * bottom. Cropping away the title, author or imprint is the one thing the
   * directive says a companion hero may never do.
   *
   * Falls back to 2/3 for a book with no cover record, which is the ratio the
   * typographic stand-in is drawn for.
   */
  coverAspect: string;
  /** Gold rule under the title, in three tracked segments, all measured. */
  tagline: string[];
  resources: CompanionResourceView[];
  /** Total bytes a reader would download if they took everything. */
  totalBytes: number;
}

/** 1.8 MB, 940 KB — the shape the reference prints beside the button. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** PDF, CSV, JSON, HTML — from the extension, never guessed. */
function extensionOf(href: string): string | null {
  const ext = href.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
  return ext && ext.length <= 5 ? ext.toUpperCase() : null;
}

function sizeOnDisk(asset: CompanionAsset): string | null {
  // A generated asset has no file to measure; the route builds it on request.
  if (asset.kind !== "static") return null;
  try {
    return formatBytes(statSync(join(PUBLIC_DIR, asset.href)).size);
  } catch {
    // A missing file is not a reason to fail the page a printed QR code points
    // at. The audit script is what fails loudly; the page simply says nothing.
    return null;
  }
}

/**
 * The gold line under the title.
 *
 * Three segments, matching the reference's rhythm, and every one of them
 * MEASURED from the companion itself: how many pieces it holds, what formats
 * they are in, and the promise that governs the whole page. No book gets a
 * hand-written marketing triplet, because twenty-nine hand-written triplets
 * are twenty-nine chances to say something that is not true — and the one
 * thing every reader arriving from a printed QR code needs to know is that
 * nothing here is behind a wall.
 *
 * A companion may override it with `heroTagline` when there is something
 * specific and checkable to say.
 */
function deriveTagline(companion: Companion): string[] {
  if (companion.heroTagline?.length) return companion.heroTagline;

  const n = companion.assets.length;
  const formats = [
    ...new Set(
      companion.assets
        .map((a) => extensionOf(a.href))
        .filter((x): x is string => Boolean(x)),
    ),
  ];

  return [
    `${n} free ${n === 1 ? "download" : "downloads"}`,
    formats.length > 0 ? formats.join(" · ") : "Free material",
    "No sign-up",
  ];
}

/**
 * Alt text that describes the actual book, not the fact that an image exists.
 * "cover" and "hero image" are explicitly forbidden as the whole of an alt
 * string, and a reader on a screen reader should learn the title from it.
 */
function coverAltFor(companion: Companion): string {
  return `Front cover of ${companion.bookTitle}, published by Valice Press`;
}

export function buildCompanionView(companion: Companion): CompanionView {
  const resources: CompanionResourceView[] = companion.assets.map((asset) => ({
    ...asset,
    metaParts: asset.meta
      .split("·")
      .map((s) => s.trim())
      .filter(Boolean),
    size: sizeOnDisk(asset),
  }));

  let totalBytes = 0;
  for (const asset of companion.assets) {
    if (asset.kind !== "static") continue;
    try {
      totalBytes += statSync(join(PUBLIC_DIR, asset.href)).size;
    } catch {
      /* counted as zero; the audit reports the missing file */
    }
  }

  const coverSrc = bookCoverSrc(companion.bookSlug);
  const rec = coverSrc ? assetRecord(coverSrc) : null;

  return {
    companion,
    // Resolved from the companion's OWN bookSlug through the shared cover
    // manifest. There is no code path by which one book's page can show
    // another book's art: the slug is the key.
    coverSrc,
    coverAlt: coverAltFor(companion),
    coverAspect:
      rec?.width && rec.height ? `${rec.width} / ${rec.height}` : "2 / 3",
    tagline: deriveTagline(companion),
    resources,
    totalBytes,
  };
}
