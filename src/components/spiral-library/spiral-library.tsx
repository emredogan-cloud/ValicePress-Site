"use client";

/**
 * The spiral library on `/books`: the catalogue as a monumental column of
 * shelves, one per collection, that the reader descends by scrolling the page.
 *
 * THIS IS THE HTML HALF, AND IT IS THE WHOLE STORE. The heading, the shelf
 * rail, every book's link, the hover card, the shelf controls and Quick View
 * are HTML; the column, the covers and the light are a WebGL picture of them
 * (`library-canvas.tsx`), loaded after the page is interactive and only on a
 * device `chooseRenderMode` gives it to. Without it — no WebGL 2, a reader
 * saving data, a context that died, or a reader who chose the list — the same
 * shelves are a list of covers, with the same links and the same Quick View.
 *
 * SCROLLING IS THE PAGE'S OWN. The section is a tall track with a sticky stage;
 * a passive scroll listener turns how far the track has scrolled into a shelf,
 * and the camera follows. No wheel or touch event is ever cancelled, so a
 * trackpad, the keyboard, the scrollbar and Find all work, and after the last
 * shelf the page simply goes on into the full catalogue.
 *
 * WHAT IS ON THE SHELVES is `buildLibraryShelves()`'s: the catalogue's own
 * items, one shelf per real collection, no filler. Quick View opens on the
 * book's first Amazon edition (`prefer="amazon"`) — the purchase path — and a
 * book with no Amazon edition gets no Amazon button, only its own way to buy.
 */
import dynamic from "next/dynamic";
import { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { CatalogItem } from "@/components/catalog/catalog-item";
import { QuickView } from "@/components/catalog/quick-view";
import { trackEvent } from "@/lib/analytics";
import { connectionIsExpensive } from "@/lib/connection";
import { useOverlayOpen } from "@/lib/overlay/use-overlay";

import { CollectionRail } from "./collection-rail";
import { HoverCard } from "./hover-card";
import type { Pointer, StageRect } from "./library-canvas";
import { LibraryBackdrop } from "./library-backdrop";
import {
  centreShowing,
  clampCentre,
  frameFor,
  frontWindow,
  initialCentre,
  progressAt,
  shelfCapacity,
  stopFor,
  turnedCentre,
} from "./library-geometry";
import { LibraryList, type OpenVia } from "./library-list";
import type { LibraryBook, LibraryShelves } from "./library-shelves";
import { paletteStyle } from "./palette";
import { canCreateWebGL2, chooseRenderMode } from "./render-mode";

const LibraryCanvas = dynamic(() => import("./library-canvas"), { ssr: false, loading: () => null });

/* -------------------------------------------------------------------------- */
/* Which library this visitor gets                                            */
/* -------------------------------------------------------------------------- */

const VIEW_KEY = "vp-library-view";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const COARSE_POINTER = "(pointer: coarse)";

/** Asked once per page: a probe spends a GPU context, and browsers ration them. */
let webgl2: boolean | null = null;
/** Set when the scene could not go on this visit; the list stands in until the page is reloaded. */
let failure: string | null = null;
const listeners = new Set<() => void>();

function notifyMode() {
  for (const l of listeners) l();
}

function chosenList(): boolean {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list";
  } catch {
    return false; // storage blocked: the default library
  }
}

/** `renderer:quality:motion:capable:failure` — a string, so React can compare snapshots. */
function readMode(): string {
  webgl2 ??= canCreateWebGL2(document);
  const capable = webgl2 && failure === null;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mode = chooseRenderMode(
    {
      webgl2: capable,
      prefersReducedMotion: window.matchMedia(REDUCED_MOTION).matches,
      saveData: connectionIsExpensive(),
      deviceMemoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
      logicalCores: navigator.hardwareConcurrency || null,
      coarsePointer: window.matchMedia(COARSE_POINTER).matches,
      viewportWidth: window.innerWidth,
    },
    chosenList() ? "list" : null,
  );
  return `${mode.renderer}:${mode.quality}:${mode.motion}:${capable ? "capable" : "incapable"}:${failure ?? ""}`;
}

function subscribeMode(notify: () => void): () => void {
  listeners.add(notify);
  const queries = [window.matchMedia(REDUCED_MOTION), window.matchMedia(COARSE_POINTER)];
  for (const q of queries) q.addEventListener("change", notify);
  window.addEventListener("resize", notify);
  return () => {
    listeners.delete(notify);
    for (const q of queries) q.removeEventListener("change", notify);
    window.removeEventListener("resize", notify);
  };
}

function chooseView(list: boolean) {
  try {
    if (list) window.localStorage.setItem(VIEW_KEY, "list");
    else window.localStorage.removeItem(VIEW_KEY);
  } catch {
    // Not remembered; it still applies to this visit through the notification below.
  }
  notifyMode();
}

const subscribeNever = () => () => {};
const readStats = () => /[?&]library-stats(=|&|$)/.test(window.location.search);

/** If the scene throws — the chunk would not load, the GPU refused a context — the list takes over. */
class SceneBoundary extends Component<{ onError: (reason: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    // Short, and without "@" (module paths): `/api/events` drops a value that looks like an address.
    const what = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    this.props.onError(`threw: ${what.replace(/[@:]/g, " ").slice(0, 90)}`);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* -------------------------------------------------------------------------- */
/* The island                                                                 */
/* -------------------------------------------------------------------------- */

/** Stage edge, in px, a hover card keeps clear of. */
const CARD_MARGIN = 16;

export function SpiralLibrary({ library }: { library: LibraryShelves }) {
  const { shelves, crossShelfCategories, unshelved } = library;
  const snapshot = useSyncExternalStore(subscribeMode, readMode, () => "pending");
  const pending = snapshot === "pending";
  const [renderer, quality, motion, capability, failed] = pending
    ? ["pending", "low", "reduced", "capable", ""]
    : snapshot.split(":");
  const webgl = renderer === "webgl";
  const listMode = renderer === "list";
  const reduced = motion === "reduced";
  const stats = useSyncExternalStore(subscribeNever, readStats, () => false);
  const overlayOpen = useOverlayOpen();

  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const invalidateRef = useRef<(() => void) | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sectionRef = useRef<HTMLElement>(null);
  const reportedRenderer = useRef<string | null>(null);
  const hashHandled = useRef(false);
  /** A shelf named in the address on arrival, waiting for the track to have its full height. */
  const arrivalRef = useRef<number | null>(null);
  const seenShelves = useRef(new Set<string>());
  const movedFromStart = useRef(false);

  const [stage, setStage] = useState<{ width: number; height: number } | null>(null);
  const [active, setActive] = useState(0);
  const [turns, setTurns] = useState<Record<number, number>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const frame = useMemo(() => (stage ? frameFor(stage.width, stage.height) : null), [stage]);
  const capacity = frame ? shelfCapacity(frame) : 5;
  const centres = useMemo(
    () =>
      shelves.map((s, i) =>
        clampCentre(s.books.length, capacity, turns[i] ?? initialCentre(s.books.length, capacity)),
      ),
    [shelves, capacity, turns],
  );

  /** Every book by slug, with the shelf it stands on and its place there. */
  const placed = useMemo(() => {
    const map = new Map<string, { book: LibraryBook; shelf: number; index: number }>();
    shelves.forEach((s, shelf) => s.books.forEach((book, index) => map.set(book.item.slug, { book, shelf, index })));
    return map;
  }, [shelves]);

  const total = placed.size + unshelved.length;
  const collections = useMemo(
    () =>
      crossShelfCategories.map((category) => ({
        category,
        count: [...placed.values()].filter((p) => p.book.categorySlugs.includes(category.slug)).length,
      })),
    [crossShelfCategories, placed],
  );

  // ---- the mode, reported once per renderer --------------------------------
  useEffect(() => {
    if (pending || reportedRenderer.current === renderer) return;
    reportedRenderer.current = renderer;
    trackEvent("library_mode", {
      renderer,
      quality,
      motion,
      ...(failure ? { reason: failure } : {}),
    });
  }, [pending, renderer, quality, motion]);

  // ---- scroll → shelf --------------------------------------------------------
  useEffect(() => {
    if (!webgl) return;
    const track = trackRef.current;
    const stageEl = stageRef.current;
    if (!track || !stageEl) return;
    const count = shelves.length;
    let trackTop = 0;
    let segment = 1;
    let stickyTop = 0;

    const update = () => {
      const p = progressAt(window.scrollY + stickyTop - trackTop, segment, count);
      progressRef.current = p;
      invalidateRef.current?.();
      setActive(Math.round(p));
    };
    // Measured by the observer — which also fires once as soon as it starts.
    const observer = new ResizeObserver(() => {
      stickyTop = parseFloat(getComputedStyle(stageEl).top) || 0;
      trackTop = track.getBoundingClientRect().top + window.scrollY;
      const travel = track.offsetHeight - stageEl.offsetHeight;
      segment = Math.max(1, travel / Math.max(1, count - 1));
      const width = stageEl.clientWidth;
      const height = stageEl.clientHeight;
      setStage((s) => (s && s.width === width && s.height === height ? s : { width, height }));
      // A shelf from the address goes in once the track is tall enough to have
      // a stop for it — which can be a frame after the track is told its height.
      const arrival = arrivalRef.current;
      if (arrival !== null && travel > 0) {
        arrivalRef.current = null;
        window.scrollTo({ top: trackTop - stickyTop + stopFor(arrival, segment), behavior: "instant" });
      }
      update();
    });
    observer.observe(track);
    observer.observe(stageEl);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, [webgl, shelves.length]);

  /** Scroll the page so shelf `i` is in front. */
  const goToShelf = useCallback(
    (i: number, smooth: boolean) => {
      const behavior: ScrollBehavior = smooth && !reduced ? "smooth" : "instant";
      if (listMode) {
        document.getElementById(`shelf-${shelves[i]?.category.slug}`)?.scrollIntoView({ behavior, block: "start" });
        return;
      }
      const track = trackRef.current;
      const stageEl = stageRef.current;
      if (!track || !stageEl) return;
      const stickyTop = parseFloat(getComputedStyle(stageEl).top) || 0;
      const segment = (track.offsetHeight - stageEl.offsetHeight) / Math.max(1, shelves.length - 1);
      const top = track.getBoundingClientRect().top + window.scrollY - stickyTop + stopFor(i, segment);
      window.scrollTo({ top, behavior });
    },
    [listMode, reduced, shelves],
  );

  /** A shelf chosen on the rail: go there, and put it in the address so the view can be shared. */
  const onShelf = useCallback(
    (i: number) => {
      goToShelf(i, true);
      const slug = shelves[i]?.category.slug;
      if (slug) window.history.replaceState(window.history.state, "", `#shelf-${slug}`);
    },
    [goToShelf, shelves],
  );

  // ---- a #shelf-<slug> typed or followed while the page is open --------------
  useEffect(() => {
    if (pending) return;
    const onHash = () => {
      const slug = decodeURIComponent(window.location.hash.replace(/^#shelf-/, ""));
      const i = shelves.findIndex((s) => s.category.slug === slug);
      if (i >= 0) goToShelf(i, true);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [pending, shelves, goToShelf]);

  // ---- arriving at /books#shelf-<slug> ----------------------------------------
  useEffect(() => {
    if (pending || hashHandled.current) return;
    hashHandled.current = true;
    const slug = decodeURIComponent(window.location.hash.replace(/^#shelf-/, ""));
    const i = shelves.findIndex((s) => s.category.slug === slug);
    if (i <= 0) return;
    if (listMode) goToShelf(i, false);
    else arrivalRef.current = i; // the track's observer takes it from here
  }, [pending, listMode, shelves, goToShelf]);

  // ---- arriving at a shelf: said aloud, and counted once ---------------------
  useEffect(() => {
    if (!webgl) return;
    if (active !== 0) movedFromStart.current = true;
    const shelf = shelves[active];
    if (!shelf) return;
    const t = setTimeout(() => {
      if (movedFromStart.current) {
        setAnnouncement(`${shelf.category.name}, ${shelf.books.length} ${shelf.books.length === 1 ? "book" : "books"}`);
      }
      if (!seenShelves.current.has(shelf.category.slug)) {
        seenShelves.current.add(shelf.category.slug);
        trackEvent("library_shelf_view", { shelf: shelf.category.slug, position: active + 1 });
      }
    }, 700);
    return () => clearTimeout(t);
  }, [active, webgl, shelves]);

  // ---- choosing a book -------------------------------------------------------
  const open = useCallback(
    (slug: string, via: Pointer | OpenVia) => {
      const entry = placed.get(slug);
      if (!entry) return;
      clearTimeout(hoverTimer.current);
      setHovered(null);
      // Chosen on the canvas: focus the book's own link first, so Quick View
      // hands focus back to it when it closes.
      if (via !== "keyboard") document.getElementById(`library-book-${slug}`)?.focus({ preventScroll: true });
      setSelected(entry.book.item);
      trackEvent("library_book_open", { slug, shelf: shelves[entry.shelf].category.slug, input: via });
    },
    [placed, shelves, setSelected],
  );

  const onHover = useCallback((slug: string | null, pointer: Pointer) => {
    if (pointer === "touch") return; // a finger has no hover; a tap opens the book
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(slug), slug ? 120 : 80);
  }, []);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  /** The scene says where the hovered cover is; the card stands beside it, on whichever side has room. */
  const onHoverRect = useCallback((rect: StageRect | null) => {
    const card = cardRef.current;
    const stageEl = stageRef.current;
    if (!card || !stageEl) return;
    if (!rect) {
      card.style.visibility = "hidden";
      return;
    }
    const sw = stageEl.clientWidth;
    const sh = stageEl.clientHeight;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    let left = rect.left + rect.width + CARD_MARGIN;
    if (left + cw > sw - CARD_MARGIN) left = rect.left - cw - CARD_MARGIN;
    left = Math.max(CARD_MARGIN, Math.min(sw - cw - CARD_MARGIN, left));
    const top = Math.max(CARD_MARGIN, Math.min(sh - ch - CARD_MARGIN, rect.top + rect.height / 2 - ch / 2));
    card.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    card.style.visibility = "visible";
  }, []);

  const onFocusBook = useCallback(
    (shelf: number, index: number, slug: string, visible: boolean) => {
      // Focus put back after a dialog, or after a click, is not the keyboard moving.
      if (!visible) return;
      setFocused(slug);
      const count = shelves[shelf].books.length;
      setTurns((t) => {
        const current = clampCentre(count, capacity, t[shelf] ?? initialCentre(count, capacity));
        const next = centreShowing(count, capacity, current, index);
        return next === current ? t : { ...t, [shelf]: next };
      });
      if (webgl && Math.round(progressRef.current) !== shelf) goToShelf(shelf, false);
    },
    [shelves, capacity, webgl, goToShelf],
  );
  const onBlurBook = useCallback(() => setFocused(null), []);

  const onTurn = useCallback((shelf: number, centre: number) => setTurns((t) => ({ ...t, [shelf]: centre })), []);

  const turnActive = (direction: 1 | -1) => {
    const count = shelves[active].books.length;
    setTurns((t) => ({ ...t, [active]: turnedCentre(count, capacity, centres[active], direction) }));
  };

  const onHighlight = (slug: string | null) => {
    setHighlight(slug);
    if (!slug) return;
    // To the first shelf, from the top, that holds one of its books; that book to the front.
    for (const [i, s] of shelves.entries()) {
      const j = s.books.findIndex((b) => b.categorySlugs.includes(slug));
      if (j === -1) continue;
      setTurns((t) => ({ ...t, [i]: centreShowing(s.books.length, capacity, centres[i], j) }));
      goToShelf(i, true);
      return;
    }
  };

  const onFailure = useCallback((reason: string) => {
    failure = reason;
    notifyMode();
  }, []);
  const onReady = useCallback(() => setReady(true), []);
  const onInvalidate = useCallback((invalidate: () => void) => {
    invalidateRef.current = invalidate;
  }, []);

  const railShelves = useMemo(() => shelves.map((s) => ({ category: s.category, count: s.books.length })), [shelves]);
  const activeShelf = shelves[active];
  const front = activeShelf ? frontWindow(activeShelf.books.length, capacity, centres[active]) : null;
  const turnable = webgl && activeShelf !== undefined && activeShelf.books.length > capacity;
  const hoveredBook = hovered ? (placed.get(hovered)?.book ?? null) : null;

  // On a phone the heading spans the top of the stage; once the reader has
  // gone down a shelf it steps out of the way (still read by a screen reader,
  // and back as soon as a keyboard reaches the view switch).
  const descended = webgl && active > 0;
  const header = (
    <div
      className={`pointer-events-auto flex items-start justify-between gap-4 lg:block ${
        descended ? "max-lg:sr-only max-lg:focus-within:not-sr-only" : ""
      }`}
    >
      <div>
        <p className="hidden text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--lib-brass)] sm:block sm:mb-2">
          The library
        </p>
        <h1 id="library-title" className="font-serif text-[26px] leading-none text-[var(--lib-gold)] sm:text-[34px]">
          All books
        </h1>
        <p className="mt-1.5 text-[12.5px] text-fg-mid sm:mt-2 sm:text-[13px]">
          {total} books on {shelves.length} shelves
        </p>
      </div>
      <div role="group" aria-label="Show the books as" className="inline-flex shrink-0 rounded-full border border-white/[0.12] bg-black/40 p-0.5 lg:mt-3">
        {[
          { label: "Library", list: false },
          { label: "List", list: true },
        ].map((option) => {
          const on = option.list === listMode;
          const unavailable = !option.list && capability === "incapable";
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={on}
              disabled={unavailable}
              onClick={() => {
                if (on) return;
                chooseView(option.list);
                // Once the other view has rendered, start it from its top.
                requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ block: "start" }));
              }}
              className={`min-h-9 rounded-full px-4 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                on ? "bg-[rgba(201,162,92,0.2)] text-[var(--lib-gold)]" : "text-fg-mid hover:text-fg-hi"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const quickView = (
    <QuickView
      key={selected?.slug ?? "library-quick-view-closed"}
      book={selected}
      onClose={() => setSelected(null)}
      prefer="amazon"
      source="library"
    />
  );

  const skipLink = (
    <a
      href="#all-books"
      className="sr-only z-40 rounded-full border border-[rgba(201,162,92,0.5)] bg-[var(--lib-ground)] text-sm font-medium text-fg-hi focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:px-5 focus:py-3"
    >
      Skip the library — go to the full catalogue
    </a>
  );

  if (listMode) {
    return (
      <section
        ref={sectionRef}
        aria-labelledby="library-title"
        data-holds-popup
        data-library="list"
        // Set when the scene failed on this visit and the list stood in: what happened, for the tests and the console.
        data-library-reason={failed || undefined}
        className="relative scroll-mt-16"
        style={paletteStyle()}
      >
        {skipLink}
        <div className="mx-auto max-w-[1440px] px-4 pb-2 pt-8 sm:px-6">{header}</div>
        <div className="mx-auto mt-4 max-w-[1440px] sm:px-2">
          <CollectionRail
            shelves={railShelves}
            collections={collections}
            active={null}
            highlight={highlight}
            onShelf={onShelf}
            onHighlight={setHighlight}
            collectionsAs="links"
            layout="chips"
          />
        </div>
        <LibraryList shelves={shelves} presentation="list" onOpen={open} />
        {quickView}
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby="library-title"
      data-holds-popup
      // What the library is doing, for the browser tests: pending (server HTML), loading or ready (the scene).
      data-library={pending ? "pending" : ready ? "ready" : "loading"}
      className="relative scroll-mt-16"
      style={paletteStyle()}
    >
      {skipLink}
      <div
        ref={trackRef}
        className="relative"
        style={{
          height: webgl
            ? `calc(100svh - 4rem + ${Math.max(0, shelves.length - 1)} * clamp(22rem, calc((100svh - 4rem) * 0.72), 44rem))`
            : "calc(100svh - 4rem)",
        }}
      >
        <div ref={stageRef} className="sticky top-16 h-[calc(100svh-4rem)] select-none overflow-hidden">
          <LibraryBackdrop />

          {webgl ? (
            <SceneBoundary onError={onFailure}>
              <LibraryCanvas
                shelves={shelves}
                quality={quality === "high" ? "high" : "low"}
                motion={reduced ? "reduced" : "full"}
                progress={progressRef}
                centres={centres}
                capacity={capacity}
                hovered={overlayOpen ? null : hovered}
                focused={focused}
                highlight={highlight}
                stats={stats}
                onHover={onHover}
                onOpen={open}
                onTurn={onTurn}
                onHoverRect={onHoverRect}
                onReady={onReady}
                onFailure={onFailure}
                onInvalidate={onInvalidate}
              />
            </SceneBoundary>
          ) : null}

          {/* The column fades into the dark above and below: it reads as endless. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[24%] bg-gradient-to-b from-[var(--lib-ground)] via-[rgba(16,15,13,0.7)] to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[14%] bg-gradient-to-t from-[var(--lib-ground)] to-transparent" />

          {/* Smaller than the heading on every screen: drawn after hydration, a
              larger line became the page's largest paint (LCP 4.1 s instead of
              the heading's 2.1 s, measured on the phone). */}
          {webgl && !ready ? (
            <p aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] tracking-[0.16em] text-[var(--lib-brass)] uppercase sm:text-[12px]">
              Opening the library…
            </p>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-4 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
            {header}
            <div className="-mx-4 sm:-mx-6 lg:hidden">
              <CollectionRail
                shelves={railShelves}
                collections={collections}
                active={pending ? null : active}
                highlight={highlight}
                onShelf={onShelf}
                onHighlight={onHighlight}
                layout="chips"
              />
            </div>
            <div className="hidden lg:block">
              <CollectionRail
                shelves={railShelves}
                collections={collections}
                active={pending ? null : active}
                highlight={highlight}
                onShelf={onShelf}
                onHighlight={onHighlight}
                layout="column"
              />
            </div>
          </div>

          {turnable && front ? (
            // Clear of the bottom 88 px a phone gives the assistant's launcher.
            <div className="absolute bottom-[6.5rem] left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/[0.1] bg-black/55 p-1 sm:bottom-5">
              <button
                type="button"
                onClick={() => turnActive(-1)}
                disabled={front.first === 0}
                aria-label={`Turn ${activeShelf.category.name} to earlier books`}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--lib-gold)] transition-colors hover:bg-white/[0.06] disabled:opacity-30"
              >
                <span aria-hidden>◀</span>
              </button>
              <p className="min-w-[6.5rem] text-center text-[12px] tabular-nums text-fg-mid" aria-live="polite">
                {front.first + 1}–{front.last + 1} of {activeShelf.books.length}
              </p>
              <button
                type="button"
                onClick={() => turnActive(1)}
                disabled={front.last === activeShelf.books.length - 1}
                aria-label={`Turn ${activeShelf.category.name} to later books`}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--lib-gold)] transition-colors hover:bg-white/[0.06] disabled:opacity-30"
              >
                <span aria-hidden>▶</span>
              </button>
            </div>
          ) : null}

          {webgl && active === 0 && !turnable ? (
            <p aria-hidden className="pointer-events-none absolute bottom-[6.75rem] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11.5px] tracking-[0.12em] text-fg-soft uppercase sm:bottom-6">
              Scroll to descend · {stage && stage.width < 768 ? "tap" : "click"} a cover
            </p>
          ) : null}

          <HoverCard ref={cardRef} book={overlayOpen ? null : hoveredBook} />

          <LibraryList
            shelves={shelves}
            presentation="index"
            onOpen={open}
            onFocusBook={onFocusBook}
            onBlurBook={onBlurBook}
          />
          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>
        </div>
      </div>
      {quickView}
    </section>
  );
}
