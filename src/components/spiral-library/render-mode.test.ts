import { describe, expect, it } from "vitest";

import { type RenderEnvironment, canCreateWebGL2, chooseRenderMode } from "./render-mode";

/** A capable desktop browser. Each test changes one fact about it. */
const desktop: RenderEnvironment = {
  webgl2: true,
  prefersReducedMotion: false,
  saveData: false,
  deviceMemoryGb: 8,
  logicalCores: 8,
  coarsePointer: false,
  viewportWidth: 1440,
};

describe("chooseRenderMode", () => {
  it("draws the shelves in full on a capable desktop", () => {
    expect(chooseRenderMode(desktop)).toEqual({ renderer: "webgl", quality: "high", motion: "full" });
  });

  it("gives the list to a browser without WebGL 2, a visitor saving data, or a device under 2 GB", () => {
    expect(chooseRenderMode({ ...desktop, webgl2: false }).renderer).toBe("list");
    expect(chooseRenderMode({ ...desktop, saveData: true }).renderer).toBe("list");
    expect(chooseRenderMode({ ...desktop, deviceMemoryGb: 1 }).renderer).toBe("list");
  });

  it("honours a visitor who chose the list", () => {
    expect(chooseRenderMode(desktop, "list").renderer).toBe("list");
  });

  it("keeps the shelves for reduced motion, and only takes the motion away", () => {
    expect(chooseRenderMode({ ...desktop, prefersReducedMotion: true })).toEqual({
      renderer: "webgl",
      quality: "high",
      motion: "reduced",
    });
  });

  it("lowers the quality for a finger, a narrow screen, little memory or few cores", () => {
    expect(chooseRenderMode({ ...desktop, coarsePointer: true }).quality).toBe("low");
    expect(chooseRenderMode({ ...desktop, viewportWidth: 767 }).quality).toBe("low");
    expect(chooseRenderMode({ ...desktop, deviceMemoryGb: 2 }).quality).toBe("low");
    expect(chooseRenderMode({ ...desktop, logicalCores: 2 }).quality).toBe("low");
  });

  // Safari and Firefox do not report memory; an unanswered question is not a "no".
  it("treats an unreported memory or core count as unknown, not as low", () => {
    expect(chooseRenderMode({ ...desktop, deviceMemoryGb: null, logicalCores: null })).toEqual({
      renderer: "webgl",
      quality: "high",
      motion: "full",
    });
  });

  it("reads the project's test phone (Redmi Note 8: 4 GB, 8 cores, 393 px, touch) as low-quality WebGL", () => {
    expect(
      chooseRenderMode({ ...desktop, coarsePointer: true, viewportWidth: 393, deviceMemoryGb: 4 }),
    ).toEqual({ renderer: "webgl", quality: "low", motion: "full" });
  });
});

describe("canCreateWebGL2", () => {
  const documentWith = (getContext: () => unknown, canvas: { width?: number; height?: number } = {}) =>
    ({ createElement: () => Object.assign(canvas, { getContext }) }) as unknown as Pick<Document, "createElement">;

  it("says yes from a one-pixel canvas, and never loses the context (Firefox reports that as a warning)", () => {
    let lost = false;
    const canvas: { width?: number; height?: number } = {};
    const doc = documentWith(
      () => ({ getExtension: () => ({ loseContext: () => (lost = true) }) }),
      canvas,
    );
    expect(canCreateWebGL2(doc)).toBe(true);
    expect(canvas).toMatchObject({ width: 1, height: 1 });
    expect(lost).toBe(false);
  });

  it("says no when the browser has no WebGL 2", () => {
    expect(canCreateWebGL2(documentWith(() => null))).toBe(false);
  });

  it("says no, rather than throwing, when the canvas refuses", () => {
    expect(
      canCreateWebGL2(
        documentWith(() => {
          throw new Error("blocked");
        }),
      ),
    ).toBe(false);
  });
});
