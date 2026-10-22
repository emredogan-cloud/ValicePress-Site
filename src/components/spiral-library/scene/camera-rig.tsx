"use client";

/**
 * The reader's eye. It goes where the page's own scroll says — never anywhere
 * else, and never on its own.
 *
 * FULL MOTION: it eases towards the shelf the scroll has reached, and turns
 * round the column with the spiral. The approach is exponential, so it slows
 * into a shelf and cannot overshoot; it is capped at a few shelves a second, so
 * a flung trackpad cannot whip the room past.
 *
 * REDUCED MOTION: it does not travel. It cuts to the nearest shelf, and stays
 * there until the scroll reaches the next one.
 *
 * The key light rides with it, above and to its left, so the column's round
 * reads the same from every shelf.
 */
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { DirectionalLight, PerspectiveCamera } from "three";

import { type CameraFrame, cameraAt } from "../library-geometry";
import { useScene } from "./scene-context";

const RATE = 6.5;
/** Shelves per second, at most. */
const TOP_SPEED = 3.2;

export function CameraRig({
  target,
  frame,
  motion,
}: {
  /** The scroll's progress through the shelves, written by the page. */
  target: { current: number };
  frame: CameraFrame;
  motion: "full" | "reduced";
}) {
  const { progressRef } = useScene();
  const key = useRef<DirectionalLight>(null);
  const started = useRef(false);
  const lens = useRef<CameraFrame | null>(null);

  useFrame((state, dt) => {
    const camera = state.camera as PerspectiveCamera;
    if (lens.current !== frame) {
      camera.fov = frame.fov;
      // Near enough that the floor passing under the camera at the last shelf
      // is never cut off (distance − 7 was: a hard edge across the floor).
      camera.near = 0.3;
      camera.far = frame.distance + 30;
      camera.updateProjectionMatrix();
      lens.current = frame;
    }

    const goal = target.current;
    let p = started.current ? progressRef.current : goal;
    started.current = true;
    if (motion === "reduced") {
      p = Math.round(goal);
    } else if (p !== goal) {
      const step = dt > 0 ? Math.min(dt, 0.05) : 1 / 60;
      const eased = p + (goal - p) * (1 - Math.exp(-RATE * step));
      const capped = p + Math.max(-TOP_SPEED * step, Math.min(TOP_SPEED * step, eased - p));
      // A thousandth of a shelf is a fifth of a pixel: close enough to stop asking for frames.
      p = Math.abs(goal - capped) < 1e-3 ? goal : capped;
      if (p !== goal) state.invalidate();
    }
    progressRef.current = p;

    const at = cameraAt(p, frame);
    camera.position.set(at.x, at.y, at.z);
    camera.lookAt(0, at.lookY, 0);

    const light = key.current;
    if (light) {
      light.position.set(at.x * 0.8 - at.z * 0.35, at.y + 4.5, at.z * 0.8 + at.x * 0.35);
      light.target.position.set(0, at.lookY - 0.5, 0);
      light.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <hemisphereLight args={["#ffd9a8", "#140c07", 1.15]} />
      <directionalLight ref={key} color="#ffe4bc" intensity={1.9} />
    </>
  );
}
