"use client";

/**
 * The spiral library's WebGL scene. Loaded only on `/books`, only after the page
 * is interactive, and only when `chooseRenderMode` says this device gets the
 * shelves (`spiral-library.tsx` imports it with `next/dynamic`, `ssr: false`).
 *
 * It renders ON DEMAND: a frame is drawn when the scroll moves, a shelf turns, a
 * cover arrives or the pointer changes what is lit — and nothing at all while
 * the reader is still, the page is scrolled past, or a dialog is open.
 *
 * EVERYTHING HERE IS `aria-hidden`. The canvas is a picture of the catalogue;
 * the catalogue itself — names, links, the way to buy — is the HTML around it.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { BoxGeometry, Float32BufferAttribute, MeshLambertMaterial, PlaneGeometry, setConsoleFunction } from "three";

import {
  BOOK_STEP,
  RADIUS,
  clampCentre,
  frameFor,
} from "./library-geometry";
import type { LibraryShelf } from "./library-shelves";
import { LIBRARY_PALETTE } from "./palette";
import { CameraRig } from "./scene/camera-rig";
import { FrameMonitor } from "./scene/frame-monitor";
import { type CoverHandle, SceneContext, type SceneShared, useScene } from "./scene/scene-context";
import { CoverShading, HoverBox, type Pointer, ShelfBooks, type StageRect } from "./scene/shelf-books";
import { Structure } from "./scene/structure";

export type { Pointer, StageRect };

export interface LibraryCanvasProps {
  shelves: readonly LibraryShelf[];
  quality: "high" | "low";
  motion: "full" | "reduced";
  /** The scroll's progress through the shelves, written by the page on every scroll event. */
  progress: { current: number };
  /** The book each shelf has in front. */
  centres: readonly number[];
  /** How many books a shelf fronts at once at this stage size. */
  capacity: number;
  hovered: string | null;
  focused: string | null;
  highlight: string | null;
  /** Record frame times for the measurement scripts (`?library-stats`). */
  stats: boolean;
  onHover: (slug: string | null, pointer: Pointer) => void;
  onOpen: (slug: string, pointer: Pointer) => void;
  onTurn: (shelf: number, centre: number) => void;
  onHoverRect: (rect: StageRect | null) => void;
  /** The first frame is on screen. */
  onReady: () => void;
  /** The canvas cannot go on (lost its GPU context and did not get it back). The page shows the list. */
  onFailure: (reason: string) => void;
  /** How the page asks for a frame after it moved something the scene reads. */
  onInvalidate: (invalidate: () => void) => void;
}

/**
 * three.js r183 deprecated `Clock`, and warns whenever one is made. React Three
 * Fiber 9 — every release up to 9.8.2 — still makes one inside its own store,
 * so every canvas printed the warning: a note about fiber's internals that
 * changes nothing at run time, which the desktop sweep would rightly fail as a
 * console warning. three's own hook for its console output drops exactly that
 * line; every other message three prints is passed through as it was.
 */
setConsoleFunction((type, message, ...params) => {
  if (type === "warn" && message.startsWith("THREE.Clock: This module has been deprecated")) return;
  console[type](message, ...params);
});

/** A unit cover. Its vertex colours are the cove light washing down from the band above. */
function coverPlane(): PlaneGeometry {
  const g = new PlaneGeometry(1, 1, 1, 6);
  const position = g.getAttribute("position");
  const colours: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const fromBottom = position.getY(i) + 0.5;
    const c = 0.58 + 0.42 * fromBottom ** 0.75;
    colours.push(c, c, c);
  }
  g.setAttribute("color", new Float32BufferAttribute(colours, 3));
  return g;
}

/** Turning a shelf by dragging across it: a finger on a phone, a mouse on a desktop. Vertical movement stays the page's. */
function DragToTurn({
  shelves,
  capacity,
  progress,
  onTurn,
}: {
  shelves: readonly LibraryShelf[];
  capacity: number;
  progress: { current: number };
  onTurn: (shelf: number, centre: number) => void;
}) {
  const { centresRef, dragRef } = useScene();
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const el = gl.domElement;
    const frame = frameFor(size.width, size.height);
    const visibleAtBooks = 2 * (frame.distance - RADIUS.books) * Math.tan((frame.fov * Math.PI) / 360);
    const pxPerBook = (BOOK_STEP * RADIUS.books * size.height) / visibleAtBooks;
    let start: { x: number; y: number; id: number; shelf: number; centre: number } | null = null;
    let turning = false;

    const down = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0) return;
      const shelf = Math.round(progress.current);
      const count = shelves[shelf]?.books.length ?? 0;
      if (count <= capacity) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId, shelf, centre: centresRef.current[shelf] ?? 0 };
      turning = false;
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!turning) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
          start = null; // the page is scrolling
          return;
        }
        if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        turning = true;
        el.setPointerCapture(e.pointerId);
      }
      const count = shelves[start.shelf].books.length;
      dragRef.current = { shelf: start.shelf, centre: clampCentre(count, capacity, start.centre - dx / pxPerBook) };
      invalidate();
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const drag = dragRef.current;
      if (turning && drag) {
        const count = shelves[drag.shelf].books.length;
        onTurn(drag.shelf, clampCentre(count, capacity, Math.round(drag.centre)));
        // Cleared after the click this release produces, so the click is not taken for a choice.
        setTimeout(() => {
          dragRef.current = null;
          invalidate();
        }, 0);
      }
      start = null;
      turning = false;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl, size.width, size.height, shelves, capacity, progress, centresRef, dragRef, onTurn, invalidate]);
  return null;
}

/** Tells the page when the first frame has been drawn. */
function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(() => onReady());
  });
  return null;
}

function Scene(props: LibraryCanvasProps) {
  const { shelves, quality, motion } = props;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const frame = useMemo(() => frameFor(size.width, size.height), [size.width, size.height]);
  const anisotropy = quality === "high" ? Math.min(4, gl.capabilities.getMaxAnisotropy()) : 1;

  const progress = useRef(0);
  const centres = useRef<number[]>([]);
  const covers = useRef(new Map<string, CoverHandle>());
  const drag = useRef<{ shelf: number; centre: number } | null>(null);
  const emphasis = useRef({ hovered: props.hovered, focused: props.focused, highlight: props.highlight });
  const target = props.progress;
  const resources = useMemo(
    () => ({
      plane: coverPlane(),
      block: new BoxGeometry(1, 1, 1),
      pages: new MeshLambertMaterial({ color: LIBRARY_PALETTE.pages }),
    }),
    [],
  );
  const shared = useMemo<SceneShared>(
    () => ({
      ...resources,
      coversRef: covers,
      progressRef: progress,
      centresRef: centres,
      dragRef: drag,
      targetRef: target,
      emphasisRef: emphasis,
    }),
    [resources, target],
  );
  useEffect(
    () => () => {
      resources.plane.dispose();
      resources.block.dispose();
      resources.pages.dispose();
    },
    [resources],
  );

  useEffect(() => {
    emphasis.current = { hovered: props.hovered, focused: props.focused, highlight: props.highlight };
    invalidate();
  }, [props.hovered, props.focused, props.highlight, invalidate]);

  // The bands are painted in the site's serif, once it is loaded.
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  useEffect(() => {
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-serif").trim() || "serif";
    let live = true;
    document.fonts
      .load(`600 32px ${family}`)
      .catch(() => undefined)
      .then(() => {
        if (live) setFontFamily(family);
      });
    return () => {
      live = false;
    };
  }, []);

  const names = useMemo(() => shelves.map((s) => s.category.name), [shelves]);
  const coverStats = () => {
    let bytes = 0;
    let loaded = 0;
    for (const c of covers.current.values()) {
      const image = c.material.map?.image as { width?: number; height?: number } | undefined;
      if (!image?.width || !image.height) continue;
      bytes += image.width * image.height * 4 * (4 / 3);
      loaded++;
    }
    return { bytes: Math.round(bytes), loaded };
  };

  return (
    <SceneContext.Provider value={shared}>
      <fog attach="fog" args={["#16110c", frame.distance - 0.5, frame.distance + 11]} />
      <CameraRig target={props.progress} frame={frame} motion={motion} />
      <Structure names={names} quality={quality} fontFamily={fontFamily} anisotropy={anisotropy} />
      {shelves.map((shelf, i) => (
        <ShelfBooks
          key={shelf.category.slug}
          index={i}
          books={shelf.books}
          centre={props.centres[i] ?? 0}
          motion={motion}
          anisotropy={anisotropy}
          quality={quality}
          onHover={props.onHover}
          onOpen={props.onOpen}
        />
      ))}
      <CoverShading motion={motion} />
      <HoverBox onRect={props.onHoverRect} />
      <DragToTurn shelves={shelves} capacity={props.capacity} progress={props.progress} onTurn={props.onTurn} />
      <FirstFrame onReady={props.onReady} />
      <FrameMonitor
        budgetMs={quality === "high" ? 20 : 34}
        minDpr={1}
        record={props.stats}
        covers={coverStats}
      />
    </SceneContext.Provider>
  );
}

/**
 * Memoised: the page re-renders as the reader passes from shelf to shelf (the
 * rail follows), and none of that is the scene's business — its props change
 * only when a shelf is turned or what is lit changes.
 */
export default memo(function LibraryCanvas(props: LibraryCanvasProps) {
  const { quality, onFailure, onInvalidate } = props;
  return (
    <Canvas
      className="!absolute inset-0"
      aria-hidden
      frameloop="demand"
      flat
      dpr={quality === "high" ? [1, 2] : [1, 1.5]}
      gl={{ alpha: true, antialias: quality === "high", powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 30, near: 1, far: 60, position: [0, 0, 12] }}
      // Pointer events are placed by their offset in the canvas, so fiber need not re-measure it on every scroll.
      resize={{ scroll: false }}
      style={{ touchAction: "pan-y", cursor: props.hovered ? "pointer" : "default" }}
      onCreated={(state) => {
        state.gl.setClearColor(0x000000, 0);
        onInvalidate(() => state.invalidate());
        const canvas = state.gl.domElement;
        let lost: ReturnType<typeof setTimeout> | undefined;
        canvas.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          lost = setTimeout(() => onFailure("context-lost"), 2500);
        });
        canvas.addEventListener("webglcontextrestored", () => {
          clearTimeout(lost);
          state.invalidate();
        });
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
});
