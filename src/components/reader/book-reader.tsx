"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

import type { RenderTask } from "pdfjs-dist";

import {
  removeBookmarkAction,
  syncReadingProgress,
  toggleBookmarkAction,
} from "@/app/read/[bookId]/actions";

import "./reader.css";
import {
  buildSpreads,
  choosePerfMode,
  pagesToWarm,
  progressPercent,
  representativePage,
  spreadIndexForPage,
  type PerfMode,
  type ReaderLayout,
  type Spread,
} from "./reader-engine";
import {
  PageBitmapCache,
  readPageGeometry,
  renderPageToCache,
  usePdfDocument,
  type PdfOutlineEntry,
} from "./use-pdf-document";

export interface ReaderBookmark {
  page: number;
  label: string | null;
}

export interface BookReaderProps {
  bookId: string;
  bookTitle: string;
  /** Public cover path, or null — the volume falls back to a typographic plate. */
  coverSrc: string | null;
  /** Resume point from `reading_progress`; 1 when the book has never been opened. */
  initialPage: number;
  initialBookmarks: ReaderBookmark[];
}

type ReaderTheme = "paper" | "sepia" | "night";
type DrawerId = "contents" | "bookmarks" | null;

const PROGRESS_DEBOUNCE_MS = 1500;
const TURN_TIMEOUT_MS = 1400;
const SWIPE_THRESHOLD_PX = 56;
const ZOOM_STEPS = [1, 1.25, 1.5, 2] as const;
/** Below this, a two-page spread puts each page at postage-stamp size. */
const SPREAD_MIN_WIDTH = 880;
/** `.vp-stage` padding, both sides. Must match reader.css. */
const STAGE_PADDING = 32;
const PREFS_KEY = "valice:reader:prefs:v1";

interface ReaderPrefs {
  theme?: ReaderTheme;
  layout?: ReaderLayout | "auto";
}

/**
 * The Valice Press reader.
 *
 * ONE ENGINE, EVERY BOOK (Directive §25). Nothing below knows which of the
 * twenty-seven editions it is showing. The book arrives as three props — an id,
 * a title and a cover — and everything else is read from the PDF the customer
 * owns: its page count, its page geometry, its own embedded table of contents.
 * Adding the twenty-eighth title requires no code here.
 *
 * WHAT MAKES IT FEEL LIKE A BOOK
 * ------------------------------
 * A closed volume that opens (§22), page numbers that fall where a printed
 * recto/verso falls (`buildSpreads`), a leaf that lifts and turns with the
 * shadow it casts across itself, and a gutter between the leaves. The
 * mechanics are those studied in the reference audit; the palette, type and
 * restraint are the storefront's.
 *
 * WHAT MAKES IT SURVIVE A 435-PAGE BOOK
 * -------------------------------------
 * Pages are rendered on demand into a six-entry bitmap cache and the visible
 * leaves blit from it. Turning clones a bitmap rather than re-rendering one.
 * The bytes arrive as HTTP ranges against an authenticated route, so the book
 * is never downloaded whole — not at open, not at the end, not at all.
 *
 * WHAT IT NEVER DOES
 * ------------------
 * Decide access. Every gate in this file is presentational. The server decided
 * before this component existed, and it decides again on every single range
 * request the canvas below is painted from.
 */
export function BookReader({
  bookId,
  bookTitle,
  coverSrc,
  initialPage,
  initialBookmarks,
}: BookReaderProps) {
  const router = useRouter();
  const src = `/api/read/${bookId}/content`;
  const { doc, pageCount, outline, loading, loadPercent, error } =
    usePdfDocument(src);

  // ── Presentation state ────────────────────────────────────────────────────
  const [opened, setOpened] = useState(false);
  // The motion budget is a property of the DEVICE, not of this component, so it
  // is read as an external store rather than copied into state by an effect.
  // The practical payoff is that `prefers-reduced-motion` is live: a reader who
  // turns it on mid-book gets the crossfade on their next turn, without a
  // reload and without this component tracking a media query by hand.
  const perf = useSyncExternalStore(
    subscribeToMotionPreference,
    readPerfMode,
    () => "rich" as PerfMode,
  );
  const [theme, setTheme] = useState<ReaderTheme>(() => readStoredPrefs().theme);
  const [layoutPref, setLayoutPref] = useState<ReaderLayout | "auto">(
    () => readStoredPrefs().layout,
  );
  const [viewportWidth, setViewportWidth] = useState(1200);
  const [zoomStep, setZoomStep] = useState(0);
  const [drawer, setDrawer] = useState<DrawerId>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // ── Book state ────────────────────────────────────────────────────────────
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [geometry, setGeometry] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [bookmarks, setBookmarks] = useState<ReaderBookmark[]>(initialBookmarks);

  // ── DOM ───────────────────────────────────────────────────────────────────
  const stageRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<HTMLDivElement | null>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cacheRef = useRef<PageBitmapCache>(new PageBitmapCache());
  // One slot PER LEAF. The two leaves of a spread paint concurrently, so a
  // single shared slot means the right leaf's handle overwrites the left's and
  // the cleanup can only ever cancel one of the two in-flight renders.
  const leftTaskRef = useRef<RenderTask | null>(null);
  const rightTaskRef = useRef<RenderTask | null>(null);
  const turningRef = useRef(false);
  /** Bumped on every navigation; a render whose token is stale is discarded. */
  const paintTokenRef = useRef(0);

  const layout: ReaderLayout =
    layoutPref === "auto"
      ? viewportWidth >= SPREAD_MIN_WIDTH
        ? "spread"
        : "single"
      : layoutPref;

  const spreads = useMemo(
    () => buildSpreads(pageCount, layout),
    [pageCount, layout],
  );
  const currentSpread: Spread | undefined = spreads[spreadIndex];
  const currentPage = representativePage(currentSpread);
  const zoom = ZOOM_STEPS[zoomStep] ?? 1;
  const isBookmarked = bookmarks.some((b) => b.page === currentPage);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 2200);
  }, []);

  // Preferences are written back on every change. Only PRESENTATION lives in
  // the browser — page tone and one-page-or-two. Nothing here is an access
  // decision and nothing here is private to the customer (§80), which is
  // exactly why this is the one thing localStorage is used for.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ theme, layout: layoutPref } satisfies ReaderPrefs),
      );
    } catch {
      // Not worth telling the reader about.
    }
  }, [theme, layoutPref]);

  // ── Viewport tracking ─────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Page geometry, read once from page 1 ──────────────────────────────────
  // Every Valice edition is typeset at one trim size throughout, so page 1's
  // box is the book's box. Measuring per page would mean a layout reflow on
  // every turn for no gain.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    void readPageGeometry(doc, 1)
      .then((g) => {
        if (!cancelled) setGeometry(g);
      })
      .catch(() => {
        // Fall back to a 6×9 trim — the commonest in this catalogue — so the
        // leaves still have a sane aspect ratio rather than collapsing.
        if (!cancelled) setGeometry({ width: 432, height: 648 });
      });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  // ── Resume point, applied once the book's length is known ─────────────────
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || pageCount === 0) return;
    resumedRef.current = true;
    setSpreadIndex(spreadIndexForPage(initialPage, pageCount, layout));
  }, [pageCount, initialPage, layout]);

  // Changing layout mid-book must keep the reader on the same page rather than
  // on the same spread INDEX, which means something different in each layout.
  const lastLayoutRef = useRef(layout);
  useEffect(() => {
    if (lastLayoutRef.current === layout || pageCount === 0) {
      lastLayoutRef.current = layout;
      return;
    }
    const page = currentPage;
    lastLayoutRef.current = layout;
    setSpreadIndex(spreadIndexForPage(page, pageCount, layout));
  }, [layout, pageCount, currentPage]);

  // ── Leaf sizing ───────────────────────────────────────────────────────────
  const [stageBox, setStageBox] = useState({ width: 1200, height: 800 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStageBox({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const bookBox = useMemo(() => {
    if (!geometry) return null;
    const leaves = layout === "spread" ? 2 : 1;
    const naturalW = geometry.width * leaves;
    const naturalH = geometry.height;
    // Fit inside the stage, then apply the zoom step. At zoom 1 the whole
    // opening is visible and the stage does not scroll; above it, it does.
    //
    // STAGE_PADDING is subtracted on both axes and must match the CSS. It was
    // 24 against a 16px-per-side padding, which is 32 — so the book was eight
    // pixels too tall at zoom 1 and the stage grew a scrollbar on a reader that
    // had not zoomed anything.
    const fit = Math.min(
      (stageBox.width - STAGE_PADDING) / naturalW,
      (stageBox.height - STAGE_PADDING) / naturalH,
    );
    const scale = Math.max(0.1, fit) * zoom;
    return {
      width: Math.round(naturalW * scale),
      height: Math.round(naturalH * scale),
      leafWidth: Math.round(geometry.width * scale),
    };
  }, [geometry, layout, stageBox, zoom]);

  // ── Painting ──────────────────────────────────────────────────────────────

  /** Blit one cached page bitmap into a visible leaf's canvas. */
  const paintLeaf = useCallback(
    async (
      canvas: HTMLCanvasElement | null,
      page: number | null,
      leafWidth: number,
      token: number,
      taskRef: { current: RenderTask | null },
    ) => {
      if (!canvas || !doc) return;
      if (page === null) {
        // A leaf with nothing behind it. The canvas is removed from the paint
        // rather than merely emptied: a zero-pixel canvas still occupies its
        // CSS box and would paint its own white over the paper gradient that
        // is the whole point of a blank page.
        canvas.width = 0;
        canvas.height = 0;
        canvas.style.display = "none";
        return;
      }
      canvas.style.display = "";
      const rendered = await renderPageToCache({
        doc,
        page,
        cssWidth: leafWidth,
        cache: cacheRef.current,
        isStale: () => paintTokenRef.current !== token,
        renderTaskRef: taskRef,
      });
      if (!rendered || paintTokenRef.current !== token) return;

      canvas.width = rendered.canvas.width;
      canvas.height = rendered.canvas.height;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;
      ctx.drawImage(rendered.canvas, 0, 0);
    },
    [doc],
  );

  /** Paint the current opening, then quietly warm its neighbours. */
  useEffect(() => {
    if (!doc || !bookBox || !currentSpread) return;
    const token = ++paintTokenRef.current;

    void (async () => {
      await Promise.all([
        paintLeaf(
          leftCanvasRef.current,
          currentSpread.left,
          bookBox.leafWidth,
          token,
          leftTaskRef,
        ),
        paintLeaf(
          rightCanvasRef.current,
          currentSpread.right,
          bookBox.leafWidth,
          token,
          rightTaskRef,
        ),
      ]);
      if (paintTokenRef.current !== token) return;

      // Prefetch the adjacent opening so the next turn has nothing to wait for.
      // Errors are swallowed: a warm-up that fails costs a few milliseconds on
      // the turn, never a visible failure.
      for (const page of pagesToWarm(spreads, spreadIndex)) {
        if (paintTokenRef.current !== token) return;
        await renderPageToCache({
          doc,
          page,
          cssWidth: bookBox.leafWidth,
          cache: cacheRef.current,
          isStale: () => paintTokenRef.current !== token,
        }).catch(() => null);
      }
    })();
  }, [doc, bookBox, currentSpread, spreads, spreadIndex, paintLeaf]);

  // A zoom or layout change invalidates every bitmap in the cache — they are
  // keyed by width, so stale entries would simply never be hit, but holding
  // them would waste the budget the visible pages need.
  useEffect(() => {
    cacheRef.current.clear();
  }, [layout, zoomStep]);

  useEffect(() => {
    const cache = cacheRef.current;
    // The ref OBJECTS are captured, never their current values: the whole point
    // of the cleanup is to cancel whatever render is in flight at unmount,
    // which is by definition not the one that was in flight when the effect
    // ran. Both leaves, because both can be mid-render.
    const inFlight = [leftTaskRef, rightTaskRef];
    return () => {
      for (const ref of inFlight) ref.current?.cancel();
      cache.clear();
    };
  }, []);

  // ── Turning ───────────────────────────────────────────────────────────────

  const goToSpread = useCallback(
    (targetIndex: number, animate = true) => {
      if (turningRef.current) return;
      const target = Math.max(0, Math.min(spreads.length - 1, targetIndex));
      if (target === spreadIndex || spreads.length === 0) return;

      const direction = target > spreadIndex ? 1 : -1;
      const bookEl = bookRef.current;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches;

      // A jump of more than one opening is not a turn — nobody flips 80 leaves
      // to reach a chapter. It cuts.
      if (!animate || !bookEl || reduced || Math.abs(target - spreadIndex) > 1) {
        setSpreadIndex(target);
        return;
      }

      // The leaf that lifts is the one the reader's eye is leaving: the right
      // leaf going forward, the left leaf coming back. In single-page layout
      // there is only one leaf and it does both jobs.
      const sourceCanvas =
        direction === 1 || layout === "single"
          ? rightCanvasRef.current
          : leftCanvasRef.current;

      if (!sourceCanvas || sourceCanvas.width === 0) {
        setSpreadIndex(target);
        return;
      }

      // Copy the outgoing bitmap BEFORE the real leaf is repainted — the
      // repaint is what the clone exists to hide.
      const clone = document.createElement("div");
      // No direction class yet: the clone must first be laid out in its
      // STARTING state. Adding the trigger at creation would make the final
      // transform the initial value and there would be nothing to transition.
      clone.className = `vp-leaf ${
        direction === 1 || layout === "single" ? "vp-leaf--right" : "vp-leaf--left"
      } vp-leaf--turning`;
      // The hinge, set inline because it must be correct in the starting frame.
      clone.style.transformOrigin = direction === 1 ? "left center" : "right center";
      // Held only for the duration of the turn — see the CSS header on why a
      // permanent compositor layer per leaf is not affordable.
      clone.style.willChange = "transform, opacity";

      const cloneCanvas = document.createElement("canvas");
      cloneCanvas.className = "vp-leaf__canvas";
      cloneCanvas.width = sourceCanvas.width;
      cloneCanvas.height = sourceCanvas.height;
      cloneCanvas.getContext("2d")?.drawImage(sourceCanvas, 0, 0);
      clone.appendChild(cloneCanvas);

      const curl = document.createElement("div");
      curl.className = "vp-leaf__curl";
      clone.appendChild(curl);

      turningRef.current = true;
      bookEl.appendChild(clone);
      setSpreadIndex(target);

      // Two frames: one for the clone to be laid out with its start transform,
      // one for the class change to be seen as a transition rather than an
      // initial value. One frame is not reliably enough in any browser.
      // Two frames. One for the clone to be laid out at its starting transform,
      // one for the class change to be read as a transition rather than as an
      // initial value. A single frame is not reliably enough in any engine.
      //
      // The timeout is not belt-and-braces, it is the only path in a tab the
      // browser has backgrounded: `requestAnimationFrame` is SUSPENDED there,
      // so the callback above never runs, the leaf never gets its trigger, and
      // the clone sits on top of the new opening showing the old page until the
      // removal timeout. A reader who backgrounds the tab mid-turn and comes
      // back would find a stale leaf over their book. Whichever fires first
      // wins; the class add is idempotent.
      const trigger = () => {
        clone.classList.add(direction === 1 ? "is-forward" : "is-backward");
      };
      requestAnimationFrame(() => requestAnimationFrame(trigger));
      window.setTimeout(trigger, 64);

      const finish = () => {
        clone.style.willChange = "auto";
        clone.remove();
        turningRef.current = false;
      };
      // `transitionend` BUBBLES, and the curl inside the clone runs its own
      // opacity transition at 45% of the turn's duration. Without the target
      // check the curl's event would tear the leaf away a third of the way
      // through its rotation — a turn that visibly stops halfway.
      clone.addEventListener("transitionend", (event) => {
        if (event.target === clone && event.propertyName === "transform") {
          finish();
        }
      });
      // Belt and braces: a transition that never fires (a backgrounded tab, a
      // browser that skips it) must not leave the reader unable to turn again.
      window.setTimeout(() => {
        if (document.body.contains(clone)) finish();
      }, TURN_TIMEOUT_MS);
    },
    [spreadIndex, spreads.length, layout],
  );

  const next = useCallback(
    () => goToSpread(spreadIndex + 1),
    [goToSpread, spreadIndex],
  );
  const prev = useCallback(
    () => goToSpread(spreadIndex - 1),
    [goToSpread, spreadIndex],
  );
  const goToPage = useCallback(
    (page: number) => {
      goToSpread(spreadIndexForPage(page, pageCount, layout), false);
    },
    [goToSpread, pageCount, layout],
  );

  // ── Progress sync ─────────────────────────────────────────────────────────
  const firstSyncRef = useRef(true);
  useEffect(() => {
    if (pageCount === 0) return;
    if (firstSyncRef.current) {
      firstSyncRef.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      void syncReadingProgress({
        bookId,
        page: currentPage,
        percent: progressPercent(currentPage, pageCount),
      });
    }, PROGRESS_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [currentPage, pageCount, bookId]);

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  const toggleBookmark = useCallback(async () => {
    const page = currentPage;
    const wasMarked = bookmarks.some((b) => b.page === page);
    // Optimistic: a bookmark is a two-hundred-millisecond round trip and the
    // reader should see the ribbon move now. Reverted below if the server
    // disagrees.
    setBookmarks((list) =>
      wasMarked
        ? list.filter((b) => b.page !== page)
        : [...list, { page, label: null }].sort((a, b) => a.page - b.page),
    );

    const result = await toggleBookmarkAction({ bookId, page });
    if (!result.ok) {
      setBookmarks((list) =>
        wasMarked
          ? [...list, { page, label: null }].sort((a, b) => a.page - b.page)
          : list.filter((b) => b.page !== page),
      );
      showToast(result.message ?? "That page could not be marked.");
      return;
    }
    showToast(result.added ? `Page ${page} marked` : `Page ${page} unmarked`);
  }, [bookId, bookmarks, currentPage, showToast]);

  const dropBookmark = useCallback(
    async (page: number) => {
      setBookmarks((list) => list.filter((b) => b.page !== page));
      const result = await removeBookmarkAction({ bookId, page });
      if (!result.ok) showToast("That bookmark could not be removed.");
    },
    [bookId, showToast],
  );

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.().catch(() => {
        showToast("Fullscreen is unavailable here.");
      });
    } else {
      void document.exitFullscreen?.();
    }
  }, [showToast]);
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      // Never steal a key from a field: the contents search and the page jump
      // are both inputs inside this component.
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        if (e.key === "Escape") (target as HTMLElement).blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (!opened) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpened(true);
        }
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          prev();
          break;
        case "Home":
          e.preventDefault();
          goToSpread(0, false);
          break;
        case "End":
          e.preventDefault();
          goToSpread(spreads.length - 1, false);
          break;
        case "c":
        case "C":
          setDrawer((d) => (d === "contents" ? null : "contents"));
          break;
        case "b":
        case "B":
          void toggleBookmark();
          break;
        case "m":
        case "M":
          setDrawer((d) => (d === "bookmarks" ? null : "bookmarks"));
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "t":
        case "T":
          setTheme((t) =>
            t === "paper" ? "sepia" : t === "sepia" ? "night" : "paper",
          );
          break;
        case "Escape":
          if (drawer) setDrawer(null);
          else if (document.fullscreenElement) void document.exitFullscreen();
          else if (focusMode) setFocusMode(false);
          else router.push("/account/library");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    opened,
    next,
    prev,
    goToSpread,
    spreads.length,
    toggleBookmark,
    toggleFullscreen,
    drawer,
    focusMode,
    router,
  ]);

  // ── Swipe ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      // The vertical guard matters more than the horizontal one: a zoomed page
      // is scrolled with the same finger, and a scroll read as a page turn is
      // the single most irritating bug a touch reader can have.
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) next();
      else prev();
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [next, prev]);

  // ── Render ────────────────────────────────────────────────────────────────

  const chapterLabel = useMemo(
    () => currentChapter(outline, currentPage),
    [outline, currentPage],
  );
  const folio =
    currentSpread?.left && currentSpread.right
      ? `${currentSpread.left}–${currentSpread.right}`
      : String(currentSpread?.left ?? currentSpread?.right ?? "—");

  return (
    <div
      className="vp-reader"
      // `data-perf` and `data-theme` are read from the device and from the
      // reader's own saved preference, neither of which the server can know.
      // This is the sanctioned escape hatch for exactly that: the alternative
      // is a first paint in the wrong theme, corrected a frame later, which is
      // a visible flash on every single open.
      suppressHydrationWarning
      data-perf={perf}
      data-theme={theme}
      data-chrome={focusMode && !drawer ? "hidden" : "visible"}
    >
      {/* ── Top bar ── */}
      <header className="vp-bar vp-bar--top">
        <Link href="/account/library" className="vp-btn" aria-label="Back to your library">
          <span aria-hidden>←</span>
          <span className="vp-imprint">Valice Press</span>
        </Link>

        <h1 className="vp-title">{bookTitle}</h1>

        <button
          type="button"
          className="vp-btn"
          onClick={() => setDrawer((d) => (d === "contents" ? null : "contents"))}
          aria-label="Contents"
          aria-expanded={drawer === "contents"}
          title="Contents (C)"
        >
          <Glyph name="contents" />
        </button>
        <button
          type="button"
          className="vp-btn"
          onClick={() => void toggleBookmark()}
          aria-pressed={isBookmarked}
          aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this page"}
          title="Bookmark (B)"
        >
          <Glyph name={isBookmarked ? "bookmark-filled" : "bookmark"} />
        </button>
        <button
          type="button"
          className="vp-btn"
          onClick={() => setDrawer((d) => (d === "bookmarks" ? null : "bookmarks"))}
          aria-label="Your bookmarks"
          aria-expanded={drawer === "bookmarks"}
          title="Bookmarks (M)"
        >
          <Glyph name="list" />
        </button>
        <button
          type="button"
          className="vp-btn"
          onClick={() =>
            setTheme((t) =>
              t === "paper" ? "sepia" : t === "sepia" ? "night" : "paper",
            )
          }
          aria-label={`Page tone: ${theme}. Change.`}
          title="Page tone (T)"
        >
          <Glyph name="tone" />
        </button>
        <button
          type="button"
          className="vp-btn"
          onClick={() =>
            setLayoutPref((p) =>
              p === "single" ? "spread" : p === "spread" ? "auto" : "single",
            )
          }
          aria-label={`Layout: ${layoutPref}. Change.`}
          title="One page / two pages"
        >
          <Glyph name={layout === "spread" ? "spread" : "single"} />
        </button>
        <button
          type="button"
          className="vp-btn"
          onClick={toggleFullscreen}
          aria-pressed={isFullscreen}
          aria-label="Fullscreen"
          title="Fullscreen (F)"
        >
          <Glyph name="fullscreen" />
        </button>
      </header>

      {/* ── Stage ── */}
      <main
        ref={stageRef}
        className={`vp-stage${zoom > 1 ? " vp-stage--zoomed" : ""}`}
        onDoubleClick={() => setFocusMode((f) => !f)}
      >
        <div
          ref={bookRef}
          className="vp-book"
          data-layout={layout}
          style={
            bookBox
              ? { width: `${bookBox.width}px`, height: `${bookBox.height}px` }
              : { width: "60%", aspectRatio: "4 / 3" }
          }
          aria-roledescription="book"
          aria-label={`${bookTitle}, ${
            pageCount ? `page ${folio} of ${pageCount}` : "loading"
          }`}
        >
          {layout === "spread" && (
            <div className="vp-leaf vp-leaf--left vp-leaf--blank">
              <canvas
                ref={leftCanvasRef}
                className="vp-leaf__canvas"
                aria-hidden
              />
            </div>
          )}
          <div className="vp-leaf vp-leaf--right vp-leaf--blank">
            <canvas
              ref={rightCanvasRef}
              className="vp-leaf__canvas"
              aria-hidden
            />
          </div>

          <button
            type="button"
            className="vp-edge vp-edge--prev"
            onClick={prev}
            disabled={spreadIndex === 0}
            aria-label="Previous page"
          >
            <span className="vp-edge__glyph" aria-hidden>
              ‹
            </span>
          </button>
          <button
            type="button"
            className="vp-edge vp-edge--next"
            onClick={next}
            disabled={spreadIndex >= spreads.length - 1}
            aria-label="Next page"
          >
            <span className="vp-edge__glyph" aria-hidden>
              ›
            </span>
          </button>
        </div>

        {/* The page the screen reader actually reads. The canvas is a picture;
            this is the text layer, kept off-screen and updated as pages turn
            so a reader using assistive technology is not handed an image. */}
        <p className="vp-sr" aria-live="polite">
          {pageCount
            ? `Page ${folio} of ${pageCount}${chapterLabel ? `, ${chapterLabel}` : ""}`
            : ""}
        </p>
      </main>

      {/* ── Bottom bar ── */}
      <footer className="vp-bar vp-bar--bottom">
        <button
          type="button"
          className="vp-btn"
          onClick={prev}
          disabled={spreadIndex === 0}
          aria-label="Previous page"
        >
          <span aria-hidden>◂</span>
        </button>

        <div className="vp-progress">
          <span className="vp-progress__label">
            {chapterLabel || bookTitle}
          </span>
          <input
            className="vp-progress__range"
            type="range"
            min={1}
            max={Math.max(1, pageCount)}
            value={currentPage}
            onChange={(e) => goToPage(Number(e.target.value))}
            disabled={pageCount === 0}
            aria-label="Reading position"
            aria-valuetext={`Page ${currentPage} of ${pageCount}`}
            style={
              {
                "--vp-fill": `${progressPercent(currentPage, pageCount)}%`,
              } as CSSProperties
            }
          />
          <span className="vp-folio">
            {folio} <span aria-hidden>/</span> {pageCount || "—"}
          </span>
        </div>

        <button
          type="button"
          className="vp-btn"
          onClick={() => setZoomStep((z) => (z + 1) % ZOOM_STEPS.length)}
          aria-label={`Zoom, currently ${Math.round(zoom * 100)} percent`}
          title="Zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="vp-btn"
          onClick={next}
          disabled={spreadIndex >= spreads.length - 1}
          aria-label="Next page"
        >
          <span aria-hidden>▸</span>
        </button>
      </footer>

      {/* ── Drawers ── */}
      <ContentsDrawer
        open={drawer === "contents"}
        outline={outline}
        pageCount={pageCount}
        currentPage={currentPage}
        onClose={() => setDrawer(null)}
        onGo={(page) => {
          goToPage(page);
          setDrawer(null);
        }}
      />
      <BookmarksDrawer
        open={drawer === "bookmarks"}
        bookmarks={bookmarks}
        currentPage={currentPage}
        onClose={() => setDrawer(null)}
        onGo={(page) => {
          goToPage(page);
          setDrawer(null);
        }}
        onRemove={(page) => void dropBookmark(page)}
      />

      {/* ── Loading / failure veils ── */}
      {loading && !error && (
        <div className="vp-veil" role="status">
          <div className="vp-veil__inner">
            <p className="vp-veil__title">Opening your copy</p>
            <p className="vp-veil__text">{bookTitle}</p>
            <div className="vp-veil__bar">
              <div
                className="vp-veil__fill"
                style={{ width: `${loadPercent ?? 12}%` }}
              />
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="vp-veil" role="alert">
          <div className="vp-veil__inner">
            <p className="vp-veil__title">This book didn&rsquo;t open</p>
            <p className="vp-veil__text">{error}</p>
            <p className="vp-veil__text" style={{ marginTop: 18 }}>
              <Link href="/account/library" style={{ color: "#33f0aa" }}>
                Back to your library
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* ── The volume ── */}
      <CoverGate
        open={opened}
        title={bookTitle}
        coverSrc={coverSrc}
        onOpen={() => setOpened(true)}
      />

      {toast && <div className="vp-toast">{toast}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The closed volume
// ---------------------------------------------------------------------------

/**
 * The threshold (Directive §22).
 *
 * A closed book with real thickness, its own cover art, a spine and a ribbon.
 * Clicking it swings the cover open from the spine, turns the flyleaf a beat
 * later, lets light in, and only then clears — so what the reader sees is a
 * book being opened rather than a loading screen being dismissed.
 *
 * It sits ON TOP of the stage rather than before it, which is why the book
 * behind is already parsed and painted by the time the gate clears: the
 * animation is the loading time, spent rather than waited through.
 *
 * The cover is the book's OWN art — the same `/images/books/<slug>.webp` the
 * storefront, the library and the companion page use. One cover everywhere.
 */
function CoverGate({
  open,
  title,
  coverSrc,
  onOpen,
}: {
  open: boolean;
  title: string;
  coverSrc: string | null;
  onOpen: () => void;
}) {
  return (
    <div
      className={`vp-gate${open ? " is-open" : ""}`}
      aria-hidden={open || undefined}
    >
      <button
        type="button"
        className="vp-vol"
        onClick={onOpen}
        aria-label={`Open ${title}`}
        tabIndex={open ? -1 : 0}
      >
        <span className="vp-vol__block" aria-hidden />
        <span className="vp-vol__flyleaf" aria-hidden />
        <span className="vp-vol__cover">
          {coverSrc ? (
            // Deliberately a plain <img>: this is a 3D-transformed leaf inside
            // a fixed overlay, where next/image's fill/sizing wrapper fights
            // the transform. The file is a pre-sized webp already in `public/`,
            // so there is nothing for the optimizer to do.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="vp-vol__art"
              src={coverSrc}
              alt=""
              width={800}
              height={1200}
              decoding="async"
              fetchPriority="high"
            />
          ) : (
            <span className="vp-vol__plate">
              <span className="vp-vol__plate-imprint">Valice Press</span>
              <span className="vp-vol__plate-title">{title}</span>
            </span>
          )}
          <span className="vp-vol__spine" aria-hidden />
        </span>
        <span className="vp-vol__ribbon" aria-hidden />
      </button>

      <p className="vp-gate__cue">
        <svg
          viewBox="0 0 40 28"
          width="34"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M20 6C14 2 6 2 2 5v18c4-3 12-3 18 1 6-4 14-4 18-1V5c-4-3-12-3-18 1Z" />
          <path d="M20 6v18" />
        </svg>
        <span className="vp-gate__cue-text">Open</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawers
// ---------------------------------------------------------------------------

/**
 * Contents, read from the PDF's own bookmarks.
 *
 * Never invented. A book whose outline is empty gets the page-jump field
 * instead and is told so plainly — which is the honest answer, and the one
 * §24 requires.
 */
function ContentsDrawer({
  open,
  outline,
  pageCount,
  currentPage,
  onClose,
  onGo,
}: {
  open: boolean;
  outline: PdfOutlineEntry[];
  pageCount: number;
  currentPage: number;
  onClose: () => void;
  onGo: (page: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [jump, setJump] = useState("");

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const usable = outline.filter((e) => e.page !== null);
    return q ? usable.filter((e) => e.title.toLowerCase().includes(q)) : usable;
  }, [outline, query]);

  if (!open) return null;

  return (
    <div className="vp-drawer" role="dialog" aria-modal="true" aria-label="Contents">
      <button className="vp-drawer__scrim" onClick={onClose} aria-label="Close contents" />
      <div className="vp-drawer__panel">
        <header className="vp-drawer__head">
          <h2 className="vp-drawer__title">Contents</h2>
          <button type="button" className="vp-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div style={{ padding: "10px 12px", display: "grid", gap: 8 }}>
          {outline.length > 0 && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the contents…"
              aria-label="Search the contents"
              style={fieldStyle}
            />
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(jump);
              if (Number.isFinite(n) && n >= 1 && n <= pageCount) onGo(n);
              setJump("");
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              type="number"
              min={1}
              max={pageCount || 1}
              value={jump}
              onChange={(e) => setJump(e.target.value)}
              placeholder={`Go to page (1–${pageCount || "…"})`}
              aria-label="Go to page"
              style={{ ...fieldStyle, flex: 1 }}
            />
            <button type="submit" className="vp-btn" style={{ border: "1px solid rgba(255,255,255,.14)" }}>
              Go
            </button>
          </form>
        </div>

        <div className="vp-drawer__body">
          {entries.length === 0 ? (
            <p className="vp-drawer__empty">
              {outline.length === 0
                ? "This edition doesn't carry an embedded table of contents. Use the page field above, or the progress bar."
                : "Nothing in the contents matches that."}
            </p>
          ) : (
            entries.map((entry, i) => (
              <button
                key={`${entry.title}-${entry.page}-${i}`}
                type="button"
                className={`vp-entry${entry.page === currentPage ? " is-current" : ""}`}
                data-depth={entry.depth}
                onClick={() => entry.page && onGo(entry.page)}
              >
                <span className="vp-entry__title">{entry.title}</span>
                <span className="vp-entry__folio">{entry.page}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function BookmarksDrawer({
  open,
  bookmarks,
  currentPage,
  onClose,
  onGo,
  onRemove,
}: {
  open: boolean;
  bookmarks: ReaderBookmark[];
  currentPage: number;
  onClose: () => void;
  onGo: (page: number) => void;
  onRemove: (page: number) => void;
}) {
  if (!open) return null;
  return (
    <div
      className="vp-drawer vp-drawer--right"
      role="dialog"
      aria-modal="true"
      aria-label="Your bookmarks"
    >
      <button className="vp-drawer__scrim" onClick={onClose} aria-label="Close bookmarks" />
      <div className="vp-drawer__panel">
        <header className="vp-drawer__head">
          <h2 className="vp-drawer__title">Your bookmarks</h2>
          <button type="button" className="vp-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="vp-drawer__body">
          {bookmarks.length === 0 ? (
            <p className="vp-drawer__empty">
              No bookmarks yet. Press <kbd>B</kbd> — or the ribbon in the toolbar
              — to mark the page you&rsquo;re on. Bookmarks are saved to your
              account, so they follow you to your other devices.
            </p>
          ) : (
            bookmarks.map((b) => (
              <div key={b.page} style={{ display: "flex", alignItems: "center" }}>
                <button
                  type="button"
                  className={`vp-entry${b.page === currentPage ? " is-current" : ""}`}
                  onClick={() => onGo(b.page)}
                >
                  <span className="vp-entry__title">
                    {b.label ?? `Page ${b.page}`}
                  </span>
                  <span className="vp-entry__folio">{b.page}</span>
                </button>
                <button
                  type="button"
                  className="vp-entry__remove"
                  onClick={() => onRemove(b.page)}
                  aria-label={`Remove the bookmark on page ${b.page}`}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.04)",
  color: "#e6e6e0",
  font: "inherit",
  fontSize: 13,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The last outline entry at or before `page` — "where am I in the book". */
function currentChapter(
  outline: PdfOutlineEntry[],
  page: number,
): string | null {
  let best: PdfOutlineEntry | null = null;
  for (const entry of outline) {
    if (entry.page === null || entry.page > page) continue;
    if (!best || entry.page >= (best.page ?? 0)) best = entry;
  }
  return best?.title ?? null;
}


// ---------------------------------------------------------------------------
// External reads: device capability and saved preferences
// ---------------------------------------------------------------------------

/** Server render, and any browser without `matchMedia`, get the rich default. */
function readPerfMode(): PerfMode {
  if (typeof window === "undefined") return "rich";
  const nav = window.navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };
  return choosePerfMode({
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    coarsePointer: window.matchMedia("(any-pointer: coarse)").matches,
    viewportWidth: window.innerWidth,
    prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
  });
}

/**
 * Re-read the motion budget when the reader's own preference changes.
 *
 * Only `prefers-reduced-motion` is watched. Core count and memory do not change
 * under a running tab, and re-reading them on every resize would be noise.
 */
function subscribeToMotionPreference(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readStoredPrefs(): { theme: ReaderTheme; layout: ReaderLayout | "auto" } {
  const fallback = { theme: "paper" as ReaderTheme, layout: "auto" as const };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    const prefs = JSON.parse(raw) as ReaderPrefs;
    return {
      theme:
        prefs.theme === "sepia" || prefs.theme === "night" || prefs.theme === "paper"
          ? prefs.theme
          : fallback.theme,
      layout:
        prefs.layout === "spread" ||
        prefs.layout === "single" ||
        prefs.layout === "auto"
          ? prefs.layout
          : fallback.layout,
    };
  } catch {
    // A private window, storage disabled, or a value someone hand-edited.
    return fallback;
  }
}

/** Inline icons — no icon package pulled into the reader's bundle. */
function Glyph({ name }: { name: string }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    "aria-hidden": true,
  } as const;
  switch (name) {
    case "contents":
      return (
        <svg {...common}>
          <path fill="currentColor" d="M4 5h16v2H4zm0 6h16v2H4zm0 6h10v2H4z" />
        </svg>
      );
    case "bookmark":
      return (
        <svg {...common}>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            d="M6 3.8h12v16.4l-6-4.2-6 4.2z"
          />
        </svg>
      );
    case "bookmark-filled":
      return (
        <svg {...common}>
          <path fill="currentColor" d="M6 3h12v18l-6-4.2L6 21z" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            d="M5 3.8h6.5v16.4L8.25 17.6 5 20.2zM14 6h5M14 10h5M14 14h5"
          />
        </svg>
      );
    case "tone":
      return (
        <svg {...common}>
          <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A8 8 0 0 1 12 2z" />
        </svg>
      );
    case "spread":
      return (
        <svg {...common}>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            d="M3.5 5.5h7v13h-7zM13.5 5.5h7v13h-7z"
          />
        </svg>
      );
    case "single":
      return (
        <svg {...common}>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            d="M7 4.5h10v15H7z"
          />
        </svg>
      );
    case "fullscreen":
      return (
        <svg {...common}>
          <path
            fill="currentColor"
            d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z"
          />
        </svg>
      );
    default:
      return null;
  }
}
