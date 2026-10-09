import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AmbientVideo } from "./ambient-video";
import { DEFERRED_IMAGE_PLACEHOLDER } from "./image-deferrer";

/**
 * The film's poster is 173 kB of picture far below the home page's first screen. It is asked for when the section is
 * about to be seen (the same 300 px runway the film itself uses), not when `loading="lazy"` — which a slow link
 * stretches to thousands of pixels — decides it is near, because it was sharing a 1.6 Mbps link with the hero photograph.
 */

type Cb = (e: Array<{ isIntersecting: boolean }>) => void;
let callbacks: Cb[] = [];
let margins: Array<string | undefined> = [];

beforeEach(() => {
  callbacks = [];
  margins = [];
  class FakeIO {
    constructor(cb: Cb, options?: IntersectionObserverInit) {
      callbacks.push(cb);
      margins.push(options?.rootMargin);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", FakeIO);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  // jsdom implements neither; the film starts playing as soon as its observer fires.
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const film = <AmbientVideo src1080="/v-1080.mp4" src720="/v-720.mp4" poster="/video/poster.webp" label="A film" />;

describe("<AmbientVideo> — the poster", () => {
  it("is a placeholder until the section is about to be seen", () => {
    const { container } = render(film);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(DEFERRED_IMAGE_PLACEHOLDER);
    expect(img.getAttribute("loading"), "loading=lazy would widen the reach on a slow link").toBeNull();
    expect(img.getAttribute("fetchpriority")).toBe("low");
  });

  it("becomes the real poster when the observer says the section is within reach — and stays", () => {
    const { container } = render(film);
    const img = container.querySelector("img")!;
    act(() => callbacks.forEach((cb) => cb([{ isIntersecting: false }])));
    expect(img.getAttribute("src")).toBe(DEFERRED_IMAGE_PLACEHOLDER);
    act(() => callbacks.forEach((cb) => cb([{ isIntersecting: true }])));
    expect(img.getAttribute("src")).toBe("/video/poster.webp");
    act(() => callbacks.forEach((cb) => cb([{ isIntersecting: false }])));
    expect(img.getAttribute("src"), "it does not go back").toBe("/video/poster.webp");
  });

  it("uses the film's own 300 px runway", () => {
    render(film);
    expect(margins).toContain("300px 0px");
  });
});
