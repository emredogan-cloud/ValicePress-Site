"use client";

import { useEffect, useState } from "react";

import type {
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "pdfjs-dist";

import { PAGE_CACHE_LIMIT } from "./reader-engine";

/**
 * The document layer: opening a purchased edition and painting its pages.
 *
 * WHERE THE BYTES COME FROM. `src` is always `/api/read/<bookId>/content` — a
 * same-origin route that checks the session and the entitlement on every hit.
 * pdf.js is given a URL, not a file: it fetches the tail, reads the
 * cross-reference table, and then asks for only the byte ranges backing the
 * pages on screen. A 435-page book therefore opens after tens of kilobytes,
 * and a reader who never reaches chapter nine never downloads chapter nine.
 * That is a performance property (§48) and a security one (§11) at the same
 * time: there is no moment at which the whole book sits in the browser.
 *
 * WHY A TOKEN IS RETURNED FROM `renderPage`. Page turns cancel each other.
 * A reader holding the arrow key fires renders faster than they complete, and
 * a late render finishing after a newer one has painted will overwrite the
 * correct page with a stale one — the classic canvas-tearing bug. Every render
 * therefore reports which page it drew, and the caller discards anything that
 * no longer matches what it asked for.
 */

export interface PdfOutlineEntry {
  title: string;
  /** Resolved 1-indexed page, or null when the destination cannot be resolved. */
  page: number | null;
  depth: number;
}

export interface PdfDocumentState {
  doc: PDFDocumentProxy | null;
  pageCount: number;
  outline: PdfOutlineEntry[];
  loading: boolean;
  /** Progress of the initial fetch, 0–100, or null while indeterminate. */
  loadPercent: number | null;
  error: string | null;
}

/** A page's intrinsic size in PDF units, needed to lay the leaves out. */
export interface PageGeometry {
  width: number;
  height: number;
}

const MAX_OUTLINE_ENTRIES = 500;
const MAX_OUTLINE_DEPTH = 3;

export function usePdfDocument(src: string): PdfDocumentState {
  const [state, setState] = useState<PdfDocumentState>({
    doc: null,
    pageCount: 0,
    outline: [],
    loading: true,
    loadPercent: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let handle: PDFDocumentProxy | null = null;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // Same-origin worker, copied into `public/` at install time. Keeping it
        // off a CDN is what lets the site's CSP stay at `worker-src 'self'`.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const task = pdfjs.getDocument({
          url: src,
          // The asset route authenticates by cookie; without this the fetch is
          // cross-origin-shaped and the session never arrives.
          withCredentials: true,
          // ── The three flags that decide whether this is a reader or a
          //    109-megabyte download, and they only work as a set. ──
          //
          // `disableRange: false` permits byte-range requests.
          //
          // `disableStream: TRUE` is the one that is easy to get wrong, and
          // getting it wrong is invisible until a big book meets a real
          // network. With streaming left on, pdf.js opens a read of the file
          // from byte 0 and pulls it to the end IN PARALLEL with the range
          // requests it makes for the pages on screen. Measured on production
          // before this was set: Codex Bestiarium issued its range requests
          // correctly — 64 KB, 62 KB — while a fourth request quietly
          // transferred 104 MB over 89 seconds. Both were happening at once,
          // so the reader looked like it was working and the book was being
          // downloaded whole behind it.
          //
          // `disableAutoFetch: true` stops the speculative pre-fetch of
          // everything not yet needed. pdf.js only honours it when streaming
          // is off, which is why the two must be set together; on its own it
          // does nothing at all.
          disableRange: false,
          disableStream: true,
          disableAutoFetch: true,
          // pdf.js defaults to 64 KB chunks, which is right when a range costs
          // one round trip to a static host. Here each range costs a serverless
          // invocation plus an R2 round trip, so the fixed cost dominates and
          // fewer, larger chunks win: 256 KB is still four ten-thousandths of
          // the largest book in the catalogue.
          rangeChunkSize: 256 * 1024,
        });

        task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
          if (cancelled || !total) return;
          setState((s) =>
            s.loading
              ? { ...s, loadPercent: Math.min(100, (loaded / total) * 100) }
              : s,
          );
        };

        const doc = await task.promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        handle = doc;

        const outline = await readOutline(doc);
        if (cancelled) return;

        setState({
          doc,
          pageCount: doc.numPages,
          outline,
          loading: false,
          loadPercent: 100,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        // The message is for the customer, so it never carries the URL, the
        // status code, or anything about storage (§37, §72).
        setState({
          doc: null,
          pageCount: 0,
          outline: [],
          loading: false,
          loadPercent: null,
          error: describeLoadFailure(err),
        });
      }
    })();

    return () => {
      cancelled = true;
      void handle?.destroy();
    };
  }, [src]);

  return state;
}

/**
 * Map a load failure onto something a reader can act on.
 *
 * pdf.js reports our 404 as a `MissingPDFException` and our 429 as an
 * `UnexpectedResponseException`. Both are states a real customer can reach —
 * the first by keeping a reader tab open across a sign-out, the second by
 * hammering reload — and each deserves a different sentence.
 */
function describeLoadFailure(err: unknown): string {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name?: unknown }).name)
      : "";
  if (name === "MissingPDFException") {
    return "Your session has ended, or this book is no longer in your library. Sign in and open it again from your library.";
  }
  if (name === "UnexpectedResponseException") {
    return "This book could not be opened just now. Wait a moment and try again.";
  }
  return "We could not open this book. Please try again in a moment.";
}

/**
 * Read the PDF's own table of contents.
 *
 * These editions carry real bookmarks — the typesetting pipeline writes them —
 * so the reader's contents drawer is the book's own structure rather than
 * anything invented here, which is what §24 requires. A book without an
 * outline simply gets an empty drawer and the page-jump control instead; there
 * is no fabricated chapter list.
 *
 * Destination resolution is per-entry and individually guarded, because one
 * unresolvable destination in a 300-entry outline must cost that one entry, not
 * the whole contents list.
 */
async function readOutline(doc: PDFDocumentProxy): Promise<PdfOutlineEntry[]> {
  try {
    const raw = await doc.getOutline();
    if (!raw || raw.length === 0) return [];

    const out: PdfOutlineEntry[] = [];

    const walk = async (
      items: Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>,
      depth: number,
    ): Promise<void> => {
      if (!items || depth > MAX_OUTLINE_DEPTH) return;
      for (const item of items) {
        if (out.length >= MAX_OUTLINE_ENTRIES) return;
        out.push({
          title: String(item.title ?? "").slice(0, 160) || "Untitled",
          page: await resolvePage(doc, item.dest),
          depth,
        });
        if (item.items?.length) await walk(item.items, depth + 1);
      }
    };

    await walk(raw, 0);
    return out;
  } catch {
    return [];
  }
}

async function resolvePage(
  doc: PDFDocumentProxy,
  dest: string | unknown[] | null,
): Promise<number | null> {
  try {
    const resolved =
      typeof dest === "string" ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(resolved) || resolved.length === 0) return null;
    const index = await doc.getPageIndex(resolved[0] as Parameters<
      PDFDocumentProxy["getPageIndex"]
    >[0]);
    return index + 1;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page rendering
// ---------------------------------------------------------------------------

/**
 * A bounded pool of rendered page bitmaps.
 *
 * `OffscreenCanvas` where the browser has it, a detached `<canvas>` otherwise.
 * Either way the pool owns the pixels and the visible leaves only ever blit
 * from it, which is what makes the turning animation cheap: cloning a leaf is a
 * `drawImage`, not a re-render.
 *
 * Eviction is plain insertion-order LRU against `PAGE_CACHE_LIMIT` — see the
 * note there for why the number is small.
 */
export class PageBitmapCache {
  private readonly entries = new Map<
    string,
    { canvas: HTMLCanvasElement; width: number; height: number }
  >();

  private key(page: number, width: number): string {
    // Width is part of the key: the same page at a new zoom level is a
    // different bitmap, and returning the old one would show a blurred page.
    return `${page}@${Math.round(width)}`;
  }

  get(page: number, width: number) {
    const k = this.key(page, width);
    const hit = this.entries.get(k);
    if (!hit) return null;
    // Refresh recency.
    this.entries.delete(k);
    this.entries.set(k, hit);
    return hit;
  }

  set(
    page: number,
    width: number,
    canvas: HTMLCanvasElement,
    height: number,
  ): void {
    this.entries.set(this.key(page, width), { canvas, width, height });
    while (this.entries.size > PAGE_CACHE_LIMIT) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      const evicted = this.entries.get(oldest);
      this.entries.delete(oldest);
      // Zeroing the backing store releases the pixels immediately rather than
      // at the GC's convenience — the difference between a phone that survives
      // a long book and one that is killed by the OS partway through.
      if (evicted) {
        evicted.canvas.width = 0;
        evicted.canvas.height = 0;
      }
    }
  }

  clear(): void {
    for (const { canvas } of this.entries.values()) {
      canvas.width = 0;
      canvas.height = 0;
    }
    this.entries.clear();
  }
}

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/**
 * Render one page at `cssWidth` CSS pixels wide, at device resolution.
 *
 * Returns the bitmap and its size. Throws only on a genuine pdf.js failure; a
 * cancelled render resolves to `null` so the caller can ignore it without a
 * try/catch at every site.
 */
export async function renderPageToCache(args: {
  doc: PDFDocumentProxy;
  page: number;
  cssWidth: number;
  cache: PageBitmapCache;
  /** Set by the caller and checked after every await — see the header. */
  isStale: () => boolean;
  renderTaskRef?: { current: RenderTask | null };
}): Promise<RenderedPage | null> {
  const { doc, page, cssWidth, cache, isStale } = args;

  const cached = cache.get(page, cssWidth);
  if (cached) {
    return { canvas: cached.canvas, width: cached.width, height: cached.height };
  }

  let proxy: PDFPageProxy | null = null;
  try {
    proxy = await doc.getPage(page);
    if (isStale()) return null;

    const unscaled = proxy.getViewport({ scale: 1 });
    const scale = cssWidth / unscaled.width;
    const viewport = proxy.getViewport({ scale });

    // Cap the device pixel ratio. A 3× phone rendering a full-bleed page
    // produces a bitmap four times the area of a 1.5× one for no visible gain
    // on a 5-inch screen, and it is memory we have already said we cannot
    // spend on a 435-page book.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
    canvas.height = Math.max(1, Math.floor(viewport.height * dpr));

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;
    // Paper, not transparency: `alpha: false` above is a real speed-up, but it
    // leaves the canvas black until something paints it.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const task = proxy.render({ canvas, canvasContext: ctx, viewport });
    if (args.renderTaskRef) args.renderTaskRef.current = task;
    await task.promise;
    if (args.renderTaskRef) args.renderTaskRef.current = null;

    if (isStale()) {
      canvas.width = 0;
      canvas.height = 0;
      return null;
    }

    cache.set(page, cssWidth, canvas, viewport.height);
    return { canvas, width: viewport.width, height: viewport.height };
  } catch (err) {
    // Cancelling a render is routine — it happens on every fast page turn.
    if (
      err &&
      typeof err === "object" &&
      "name" in err &&
      (err as { name?: string }).name === "RenderingCancelledException"
    ) {
      return null;
    }
    throw err;
  } finally {
    proxy?.cleanup();
  }
}

/** Ask a page how big it is without paying to render it. */
export async function readPageGeometry(
  doc: PDFDocumentProxy,
  page: number,
): Promise<PageGeometry> {
  const proxy = await doc.getPage(page);
  try {
    const vp = proxy.getViewport({ scale: 1 });
    return { width: vp.width, height: vp.height };
  } finally {
    proxy.cleanup();
  }
}

/** Convenience ref type for callers that hold an in-flight render. */
export type RenderTaskRef = { current: RenderTask | null };
