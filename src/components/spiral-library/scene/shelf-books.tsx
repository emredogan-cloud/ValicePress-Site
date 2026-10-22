"use client";

/**
 * The books: each shelf a ring of real covers that turns, and the light on them.
 *
 * A cover is the catalogue's own thumb on a plane of the cover's own shape, with
 * a page block behind it. Until its pixels arrive it is a plain panel of that
 * shape, so nothing moves when they do. Covers are drawn UNLIT — the artwork's
 * colours are the product — and shaded by arithmetic instead: a cover turning
 * away from the reader darkens with the angle, shelves away from the eye dim a
 * little, and the cove light washes down from the band above (vertex colours).
 */
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Color, type Group, type InstancedMesh, Matrix4, type Mesh, type MeshBasicMaterial, type Texture, Vector3 } from "three";

import {
  BOOK_DEPTH,
  BOOK_STEP,
  RADIUS,
  SLOT_WIDTH,
  SPIRAL_STEP,
  TIER_PITCH,
  shelfAzimuth,
  shelfY,
} from "../library-geometry";
import type { LibraryBook } from "../library-shelves";
import { useScene } from "./scene-context";
import { type Quality, coverTextureSrc, loadCover } from "./textures";

/** The panel a cover is drawn as before its pixels arrive: dark board, never a picture. */
const PLACEHOLDER = new Color("#3d3024");
/** How far a hovered or focused cover stands out from the ring: 3 % of its height, plus a hair. */
const LIFT = 0.045;

export type Pointer = "mouse" | "pen" | "touch";

export interface BookEvents {
  onHover: (slug: string | null, pointer: Pointer) => void;
  onOpen: (slug: string, pointer: Pointer) => void;
}

/** Exponential approach, framerate-independent; snaps when close enough to stop asking for frames. */
function approach(from: number, to: number, rate: number, dt: number, epsilon: number): number {
  const next = from + (to - from) * (1 - Math.exp(-rate * Math.min(dt, 0.05)));
  return Math.abs(to - next) < epsilon ? to : next;
}

const pointerOf = (e: ThreeEvent<PointerEvent | MouseEvent>): Pointer => {
  const t = (e.nativeEvent as PointerEvent).pointerType;
  return t === "touch" || t === "pen" ? t : "mouse";
};

interface CoverProps extends BookEvents {
  book: LibraryBook;
  shelf: number;
  index: number;
  anisotropy: number;
  quality: Quality;
}

function Cover({ book, shelf, index, anisotropy, quality, onHover, onOpen }: CoverProps) {
  const { coversRef, dragRef, plane, targetRef } = useScene();
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const slug = book.item.slug;
  const width = 1 / book.aspect;

  useLayoutEffect(() => {
    const m = mesh.current;
    const mat = material.current;
    if (!m || !mat) return;
    mat.color.copy(PLACEHOLDER);
    const covers = coversRef.current;
    covers.set(slug, { shelf, index, mesh: m, material: mat, categorySlugs: book.categorySlugs });
    return () => {
      covers.delete(slug);
    };
  }, [coversRef, slug, shelf, index, book.categorySlugs]);

  useEffect(() => {
    const src = coverTextureSrc(book, quality, window.devicePixelRatio);
    if (!src) return;
    const abort = new AbortController();
    let texture: Texture | null = null;
    loadCover(src, Math.abs(shelf - Math.round(targetRef.current)), abort.signal)
      .then((t) => {
        texture = t;
        t.anisotropy = anisotropy;
        const mat = material.current;
        if (!mat || !coversRef.current.has(slug)) return;
        // Up to the GPU now, while the reader is at the top, rather than on
        // the first frame the cover comes into view — which, mid-descent,
        // was a visible hitch on the phone.
        gl.initTexture(t);
        mat.map = t;
        mat.needsUpdate = true;
        invalidate();
      })
      .catch(() => {
        // A cover that cannot be fetched stays a plain panel; the HTML list and Quick View still show the book.
      });
    return () => {
      abort.abort();
      texture?.dispose();
    };
  }, [book, quality, shelf, targetRef, coversRef, slug, anisotropy, gl, invalidate]);

  return (
    <group rotation-y={index * BOOK_STEP}>
      <mesh
        ref={mesh}
        geometry={plane}
        position={[0, shelfY(shelf), RADIUS.books]}
        scale={[width, 1, 1]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(slug, pointerOf(e));
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onHover(null, pointerOf(e));
        }}
        onClick={(e) => {
          e.stopPropagation();
          // A drag that ended over a cover is a turn of the shelf, not a choice.
          if (e.delta > 8 || dragRef.current) return;
          onOpen(slug, pointerOf(e));
        }}
      >
        <meshBasicMaterial ref={material} vertexColors toneMapped={false} />
      </mesh>
    </group>
  );
}

export interface ShelfBooksProps extends BookEvents {
  index: number;
  books: readonly LibraryBook[];
  /** The book the island wants in front (may be fractional only while dragging). */
  centre: number;
  motion: "full" | "reduced";
  anisotropy: number;
  quality: Quality;
}

export function ShelfBooks({ index, books, centre, motion, anisotropy, quality, onHover, onOpen }: ShelfBooksProps) {
  const { centresRef, dragRef, block, pages } = useScene();
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef<Group>(null);
  const blocks = useRef<InstancedMesh>(null);
  const goal = useRef(centre);
  const started = useRef(false);

  useEffect(() => {
    goal.current = centre;
    invalidate();
  }, [centre, invalidate]);

  // The page blocks: one instanced draw for the whole shelf, set once.
  useLayoutEffect(() => {
    const m = blocks.current;
    if (!m) return;
    const turn = new Matrix4();
    const place = new Matrix4();
    const size = new Matrix4();
    books.forEach((b, j) => {
      const w = Math.min(SLOT_WIDTH, 1 / b.aspect) * 0.97;
      turn.makeRotationY(j * BOOK_STEP);
      place.makeTranslation(0, shelfY(index) - 0.004, RADIUS.books - BOOK_DEPTH / 2 - 0.003);
      size.makeScale(w, 0.985, BOOK_DEPTH);
      m.setMatrixAt(j, turn.multiply(place).multiply(size));
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    invalidate();
  }, [books, index, invalidate]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const drag = dragRef.current;
    const target = drag && drag.shelf === index ? drag.centre : goal.current;
    let c = started.current ? centresRef.current[index] : target;
    started.current = true;
    if (motion === "reduced" || (drag && drag.shelf === index)) c = target;
    else {
      c = approach(c, target, 9, dt, 1e-3);
      if (c !== target) state.invalidate();
    }
    centresRef.current[index] = c;
    g.rotation.y = shelfAzimuth(index) - c * BOOK_STEP;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={blocks} args={[block, pages, books.length]} />
      {books.map((b, j) => (
        <Cover
          key={b.item.slug}
          book={b}
          shelf={index}
          index={j}
          anisotropy={anisotropy}
          quality={quality}
          onHover={onHover}
          onOpen={onOpen}
        />
      ))}
    </group>
  );
}

/** −π…π */
function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * The light on every cover, once per frame, after the rig and the shelves have
 * moved. Thirty-six covers of arithmetic; no light, no shadow map.
 */
export function CoverShading({ motion }: { motion: "full" | "reduced" }) {
  const { coversRef, progressRef, centresRef, emphasisRef } = useScene();
  /** How far each cover stands out now, eased towards its goal. */
  const lifts = useRef(new Map<string, number>());
  useFrame((state, dt) => {
    const p = progressRef.current;
    const cameraAzimuth = p * SPIRAL_STEP;
    const eye = shelfY(p);
    const { hovered, focused, highlight } = emphasisRef.current;
    let moving = false;
    for (const [slug, c] of coversRef.current) {
      const azimuth = shelfAzimuth(c.shelf) + (c.index - centresRef.current[c.shelf]) * BOOK_STEP;
      const facing = Math.max(0, Math.cos(wrap(azimuth - cameraAzimuth)));
      const tiers = Math.min(2.5, Math.abs(shelfY(c.shelf) - eye) / TIER_PITCH);
      const lit = slug === hovered || slug === focused;
      let shade = (0.16 + 0.84 * facing ** 1.35) * (1 - 0.09 * tiers);
      if (highlight && !c.categorySlugs.includes(highlight)) shade *= 0.3;
      if (lit) shade = Math.min(1.08, shade * 1.14);
      if (c.material.map) c.material.color.setScalar(shade);
      else c.material.color.copy(PLACEHOLDER).multiplyScalar(shade);

      const goal = lit && motion === "full" ? LIFT : 0;
      const lift = motion === "full" ? approach(lifts.current.get(slug) ?? 0, goal, 14, dt, 5e-4) : goal;
      lifts.current.set(slug, lift);
      if (lift !== goal) moving = true;
      c.mesh.position.setZ(RADIUS.books + lift);
    }
    if (moving) state.invalidate();
  });
  return null;
}

/** A rectangle on the stage, in CSS pixels from its top-left corner. */
export interface StageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const CORNERS = [
  new Vector3(-0.5, -0.5, 0),
  new Vector3(0.5, -0.5, 0),
  new Vector3(-0.5, 0.5, 0),
  new Vector3(0.5, 0.5, 0),
];

/**
 * Where the hovered cover is on screen, so the HTML card can stand beside it.
 * Written straight to the card (the island's callback), never through React
 * state, because it changes every frame the camera moves.
 */
export function HoverBox({ onRect }: { onRect: (rect: StageRect | null) => void }) {
  const { coversRef, emphasisRef } = useScene();
  const last = useRef("");
  const v = useRef(new Vector3());
  useFrame((state) => {
    const slug = emphasisRef.current.hovered;
    const handle = slug ? coversRef.current.get(slug) : undefined;
    if (!handle) {
      if (last.current !== "") onRect(null);
      last.current = "";
      return;
    }
    state.camera.updateMatrixWorld();
    handle.mesh.updateWorldMatrix(true, false);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const corner of CORNERS) {
      const p = v.current.copy(corner).applyMatrix4(handle.mesh.matrixWorld).project(state.camera);
      const x = ((p.x + 1) / 2) * state.size.width;
      const y = ((1 - p.y) / 2) * state.size.height;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const rect = { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
    const key = `${slug}:${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}`;
    if (key !== last.current) onRect(rect);
    last.current = key;
  });
  return null;
}
