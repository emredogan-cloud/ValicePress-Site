"use client";

/**
 * The architecture: the column's core, a band over every shelf with its name,
 * the boards the books stand on, the cove light under each band, the plinth and
 * the floor. Architecture only — nothing here is, or looks like, a book.
 *
 * Every repeated part is ONE merged geometry with one material, so the whole
 * column is a handful of draw calls however many shelves it has.
 */
import { useEffect, useMemo } from "react";
import {
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RingGeometry,
  TorusGeometry,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import {
  BAND_HEIGHT,
  RADIUS,
  TIER_PITCH,
  bandY,
  shelfAzimuth,
} from "../library-geometry";
import { LIBRARY_PALETTE } from "../palette";
import { type Quality, bandAtlas, coreTexture, coveGlowTexture, floorTexture } from "./textures";

/** How far the core rises above the top band, into the dark. */
const CORE_ABOVE = 2.8;
const PLINTH_HEIGHT = 0.42;
export const FLOOR_RADIUS = 16;

/** The height of the floor under a column of `shelfCount` shelves. */
export function floorY(shelfCount: number): number {
  return bandY(shelfCount) - BAND_HEIGHT / 2 - PLINTH_HEIGHT;
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const out = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!out) throw new Error("spiral library: could not merge geometry");
  return out;
}

export interface StructureProps {
  /** One name per shelf, top to bottom. */
  names: readonly string[];
  quality: Quality;
  /** The site's serif (`--font-serif`), loaded; null until it is, so a band is never painted in a stand-in face. */
  fontFamily: string | null;
  anisotropy: number;
}

export function Structure({ names, quality, fontFamily, anisotropy }: StructureProps) {
  const shelfCount = names.length;
  const segments = quality === "high" ? 160 : 96;

  const parts = useMemo(() => {
    const top = bandY(0) + BAND_HEIGHT / 2 + CORE_ABOVE;
    const bottom = floorY(shelfCount);
    const coreHeight = top - bottom;

    // The core. The texture is one tier tall and repeats down the column,
    // shifted so each repeat starts right under a band.
    const core = new CylinderGeometry(RADIUS.core, RADIUS.core, coreHeight, segments / 2, 1, true);
    core.translate(0, (top + bottom) / 2, 0);
    const coreMap = coreTexture(quality);
    coreMap.repeat.set(12, coreHeight / TIER_PITCH);
    const firstBandBottom = bandY(0) - BAND_HEIGHT / 2;
    coreMap.offset.set(0, -(((firstBandBottom - bottom) / TIER_PITCH) % 1));

    // The bands: band i hangs over shelf i; the last one is the last shelf's floor.
    const rows = [...names, null];
    const bands = merged(
      rows.map((_, i) => {
        const g = new CylinderGeometry(RADIUS.band, RADIUS.band, BAND_HEIGHT, segments, 1, true, Math.PI, Math.PI * 2);
        // Into this band's row of the atlas: row 0 is the canvas's top, which is v = 1.
        const uv = g.getAttribute("uv");
        for (let k = 0; k < uv.count; k++) {
          uv.setY(k, 1 - (i + 1 - uv.getY(k)) / rows.length);
        }
        g.rotateY(shelfAzimuth(Math.min(i, shelfCount - 1)));
        g.translate(0, bandY(i), 0);
        return g;
      }),
    );

    // The board on top of each band (what the books stand on), and its underside, lit by the cove.
    const boards = merged(
      rows.map((_, i) => {
        const g = new RingGeometry(RADIUS.core - 0.01, RADIUS.band, segments, 1);
        g.rotateX(-Math.PI / 2);
        g.translate(0, bandY(i) + BAND_HEIGHT / 2, 0);
        return g;
      }),
    );
    const soffits = merged(
      rows.map((_, i) => {
        const g = new RingGeometry(RADIUS.core - 0.01, RADIUS.band, segments, 1);
        g.rotateX(Math.PI / 2);
        g.translate(0, bandY(i) - BAND_HEIGHT / 2, 0);
        return g;
      }),
    );
    // The light strip along each band's lower lip.
    const strips = merged(
      rows.map((_, i) => {
        const g = new TorusGeometry(RADIUS.band - 0.015, 0.011, 4, segments);
        g.rotateX(Math.PI / 2);
        g.translate(0, bandY(i) - BAND_HEIGHT / 2 - 0.004, 0);
        return g;
      }),
    );

    const plinth = new CylinderGeometry(RADIUS.band + 0.12, RADIUS.band + 0.3, PLINTH_HEIGHT, segments / 2, 1, false);
    plinth.translate(0, bottom + PLINTH_HEIGHT / 2, 0);
    const floor = new CircleGeometry(FLOOR_RADIUS, segments / 2);
    floor.rotateX(-Math.PI / 2);
    floor.translate(0, bottom, 0);

    const wood = new MeshLambertMaterial({ map: coreMap });
    const board = new MeshLambertMaterial({ color: LIBRARY_PALETTE.woodDeep });
    const cove = new MeshBasicMaterial({ map: coveGlowTexture(), toneMapped: false });
    const strip = new MeshBasicMaterial({ color: LIBRARY_PALETTE.cove, toneMapped: false });
    const stone = new MeshLambertMaterial({ color: "#1c1611" });
    const marble = new MeshBasicMaterial({ map: floorTexture(quality, FLOOR_RADIUS), side: DoubleSide });

    return { core, bands, boards, soffits, strips, plinth, floor, wood, board, cove, strip, stone, marble };
  }, [names, shelfCount, quality, segments]);

  // The bands' material waits for the serif; until then they are plain wood.
  const bandMaterial = useMemo(
    () =>
      new MeshLambertMaterial({
        map: fontFamily ? bandAtlas([...names, null], fontFamily, quality, anisotropy) : null,
        color: fontFamily ? "#ffffff" : LIBRARY_PALETTE.wood,
      }),
    [names, fontFamily, quality, anisotropy],
  );

  useEffect(
    () => () => {
      for (const g of [parts.core, parts.bands, parts.boards, parts.soffits, parts.strips, parts.plinth, parts.floor]) g.dispose();
      for (const m of [parts.wood, parts.board, parts.cove, parts.strip, parts.stone, parts.marble]) {
        m.map?.dispose();
        m.dispose();
      }
    },
    [parts],
  );
  useEffect(
    () => () => {
      bandMaterial.map?.dispose();
      bandMaterial.dispose();
    },
    [bandMaterial],
  );

  return (
    <group>
      <mesh geometry={parts.core} material={parts.wood} />
      <mesh geometry={parts.bands} material={bandMaterial} />
      <mesh geometry={parts.boards} material={parts.board} />
      <mesh geometry={parts.soffits} material={parts.cove} />
      <mesh geometry={parts.strips} material={parts.strip} />
      <mesh geometry={parts.plinth} material={parts.stone} />
      <mesh geometry={parts.floor} material={parts.marble} />
    </group>
  );
}
