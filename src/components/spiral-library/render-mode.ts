/**
 * Which library a visitor gets: the shelves drawn in WebGL, or the catalogue as
 * a list — and, for the shelves, how much detail and how much motion.
 *
 * Decided once, from facts about the device, by a function with no side
 * effects, so every branch can be tested without a GPU. The facts themselves
 * are read by the component that renders the library, through the helpers the
 * site already has — the reduced-motion query `campaign/use-campaign.ts` reads,
 * and `connectionIsExpensive` (`@/lib/connection`, shared with the ambient
 * film) for the connection — plus `canCreateWebGL2` below.
 *
 * THE LIST IS NOT AN ERROR PAGE. It is the same catalogue, the same Quick View
 * and the same links, without the canvas. A visitor who cannot have WebGL, who
 * asked to save data, or who chose the list, gets a complete store.
 *
 * Reduced motion does NOT mean the list. It means shelves that are reached by
 * a step rather than by a camera that follows the scroll, and no movement the
 * reader did not ask for. The 3D library stays available to them.
 *
 * The quality thresholds are a first setting, not a measurement. They are to be
 * calibrated on the Redmi Note 8 the project already tests on, and the scene
 * still lowers its resolution at run time if frames take too long.
 */

export interface RenderEnvironment {
  /** A WebGL 2 context could be created. three.js has required WebGL 2 since r163. */
  webgl2: boolean;
  /** `(prefers-reduced-motion: reduce)`. */
  prefersReducedMotion: boolean;
  /** The visitor asked to save data, or the connection is slow. */
  saveData: boolean;
  /** `navigator.deviceMemory` in GB — Chromium only; null where the browser does not say. */
  deviceMemoryGb: number | null;
  /** `navigator.hardwareConcurrency`; null where the browser does not say. */
  logicalCores: number | null;
  /** The primary pointer is a finger: `(pointer: coarse)`. */
  coarsePointer: boolean;
  /** CSS pixels. */
  viewportWidth: number;
}

export interface RenderMode {
  /** `"list"`: no canvas at all; the catalogue list is the library. */
  renderer: "webgl" | "list";
  /** `"low"`: smaller textures, a lower pixel-ratio cap, no post-processing. */
  quality: "high" | "low";
  /** `"reduced"`: step from shelf to shelf; nothing moves unless the reader moves it. */
  motion: "full" | "reduced";
}

/** Below this, a phone-sized layout: fewer covers in view, so less to draw. */
const NARROW_VIEWPORT = 768;

export function chooseRenderMode(
  env: RenderEnvironment,
  preference: "list" | null = null,
): RenderMode {
  const tinyMemory = env.deviceMemoryGb !== null && env.deviceMemoryGb < 2;
  const renderer =
    preference === "list" || !env.webgl2 || env.saveData || tinyMemory ? "list" : "webgl";

  const low =
    env.coarsePointer ||
    env.viewportWidth < NARROW_VIEWPORT ||
    (env.deviceMemoryGb !== null && env.deviceMemoryGb < 4) ||
    (env.logicalCores !== null && env.logicalCores < 4);

  return {
    renderer,
    quality: low ? "low" : "high",
    motion: env.prefersReducedMotion ? "reduced" : "full",
  };
}

/**
 * Can this browser give us a WebGL 2 context? Asked once per page, of a
 * one-pixel canvas that is then simply dropped.
 *
 * It used to hand the context straight back with `WEBGL_lose_context`, but
 * Firefox reports a lost context in the console as a warning — a page that
 * prints one fails the desktop sweep, and a reader opening the console would
 * see an error that is not one. A one-pixel context left to the garbage
 * collector costs nothing; with the scene's own, the page holds two, far under
 * any browser's limit.
 */
export function canCreateWebGL2(doc: Pick<Document, "createElement">): boolean {
  try {
    const canvas = doc.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.getContext("webgl2") !== null;
  } catch {
    return false;
  }
}
