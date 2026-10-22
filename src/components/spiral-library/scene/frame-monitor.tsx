"use client";

/**
 * Frame pacing, measured where it happens.
 *
 * 1. When frames come slowly the canvas's pixel ratio is lowered a step —
 *    softer edges before a stutter — and never raised again in that visit, so
 *    it cannot oscillate.
 * 2. With `?library-stats` in the address, every frame interval and the
 *    renderer's counters are kept on `window.__libraryStats` for the
 *    measurement scripts. Off by default. Nothing is sent anywhere.
 *
 * Only intervals between CONSECUTIVE frames count. The scene renders on
 * demand, so a gap of seconds is the scene resting, not a slow frame.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

export interface LibraryStats {
  /** Milliseconds between consecutive frames. */
  frames: number[];
  dpr: number;
  dprSteps: number[];
  renderer: string;
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
  programs: number;
  /** Bytes of cover pixels on the GPU, estimated: width × height × 4, plus a third for the mipmaps. */
  coverBytes: number;
  /** Covers whose pixels have arrived. */
  coversLoaded: number;
}

declare global {
  interface Window {
    __libraryStats?: LibraryStats;
  }
}

const RESTING_MS = 250;
const WINDOW = 40;

export function FrameMonitor({
  budgetMs,
  minDpr,
  record,
  covers,
}: {
  /** A median frame slower than this lowers the pixel ratio. */
  budgetMs: number;
  minDpr: number;
  record: boolean;
  covers: () => { bytes: number; loaded: number };
}) {
  const setDpr = useThree((s) => s.setDpr);
  const gl = useThree((s) => s.gl);
  const last = useRef(0);
  const samples = useRef<number[]>([]);

  useEffect(() => {
    if (!record) return;
    const context = gl.getContext();
    const info = context.getExtension("WEBGL_debug_renderer_info");
    window.__libraryStats = {
      frames: [],
      dpr: gl.getPixelRatio(),
      dprSteps: [],
      renderer: String(info ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER)),
      drawCalls: 0,
      triangles: 0,
      textures: 0,
      geometries: 0,
      programs: 0,
      coverBytes: 0,
      coversLoaded: 0,
    };
  }, [record, gl]);

  useFrame((state) => {
    const now = performance.now();
    const gap = now - last.current;
    last.current = now;
    const stats = record ? window.__libraryStats : undefined;
    if (stats) {
      // Counters from the frame just drawn: three resets them as each render starts.
      stats.drawCalls = state.gl.info.render.calls;
      stats.triangles = state.gl.info.render.triangles;
      stats.textures = state.gl.info.memory.textures;
      stats.geometries = state.gl.info.memory.geometries;
      stats.programs = state.gl.info.programs?.length ?? 0;
      const c = covers();
      stats.coverBytes = c.bytes;
      stats.coversLoaded = c.loaded;
      stats.dpr = state.viewport.dpr;
    }
    if (!(gap > 0 && gap < RESTING_MS)) return;
    stats?.frames.push(Math.round(gap * 10) / 10);
    samples.current.push(gap);
    if (samples.current.length < WINDOW) return;
    const sorted = [...samples.current].sort((a, b) => a - b);
    samples.current = [];
    const median = sorted[WINDOW / 2];
    const dpr = state.viewport.dpr;
    if (median > budgetMs && dpr > minDpr) {
      const next = Math.max(minDpr, Math.round((dpr - 0.25) * 4) / 4);
      stats?.dprSteps.push(next);
      setDpr(next);
    }
  });
  return null;
}
