"use client";

import { createContext, useContext } from "react";
import type { BoxGeometry, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry } from "three";

/** One cover the scene has drawn, so the shading, the hover box and the loader can find it. */
export interface CoverHandle {
  shelf: number;
  /** Its place on the shelf. */
  index: number;
  mesh: Mesh;
  material: MeshBasicMaterial;
  /** Until its pixels arrive (`material.map`), a cover is a plain panel of its own shape. */
  categorySlugs: readonly string[];
}

/** What the parts of the scene share. Created once per canvas; mutated only inside frames and effects. */
export interface SceneShared {
  /** The unit cover, its cove-light wash in vertex colours. Scaled to each cover's width. */
  plane: PlaneGeometry;
  block: BoxGeometry;
  pages: MeshLambertMaterial;
  coversRef: { current: Map<string, CoverHandle> };
  /** Where the camera is now, in shelves — eased towards the scroll's target by the rig. */
  progressRef: { current: number };
  /** Which book each shelf has in front now, eased towards the island's choice. */
  centresRef: { current: number[] };
  /** A horizontal drag in progress: the shelf, and the centre it has dragged to. */
  dragRef: { current: { shelf: number; centre: number } | null };
  /** The scroll's progress through the shelves (the page's): covers load from the shelf it is at, outwards. */
  targetRef: { current: number };
  /** Lit or picked out: the hovered and the keyboard-focused book, and a cross-shelf collection. */
  emphasisRef: { current: { hovered: string | null; focused: string | null; highlight: string | null } };
}

export const SceneContext = createContext<SceneShared | null>(null);

export function useScene(): SceneShared {
  const shared = useContext(SceneContext);
  if (!shared) throw new Error("spiral library: scene part rendered outside <LibraryCanvas>");
  return shared;
}
