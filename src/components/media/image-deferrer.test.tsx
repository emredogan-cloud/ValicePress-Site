/* eslint-disable @next/next/no-img-element -- the component under test is plain <img> markup, on purpose */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFERRED_IMAGE_PLACEHOLDER, ImageDeferrer } from "./image-deferrer";

/**
 * The shelf's covers must not be asked for until they are about to be seen. The home page's hero photograph is its
 * largest paint, and twelve covers (~550 kB) requested beside it on a slow link delayed it by about a second
 * (measured on the phone: 4.96 s → 4.1 s without them). The file is asked for by swapping `data-src` into `src`.
 */

type Entry = { target: Element; isIntersecting: boolean };
let observers: Array<{ cb: (e: Entry[]) => void; observed: Element[]; unobserved: Element[]; disconnected: boolean; options: IntersectionObserverInit | undefined }> = [];

beforeEach(() => {
  observers = [];
  class FakeIO {
    private rec: (typeof observers)[number];
    constructor(cb: (e: Entry[]) => void, options?: IntersectionObserverInit) {
      this.rec = { cb, observed: [], unobserved: [], disconnected: false, options };
      observers.push(this.rec);
    }
    observe(el: Element) {
      this.rec.observed.push(el);
    }
    unobserve(el: Element) {
      this.rec.unobserved.push(el);
    }
    disconnect() {
      this.rec.disconnected = true;
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeIO);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function page() {
  return render(
    <div>
      <img data-testid="a" src={DEFERRED_IMAGE_PLACEHOLDER} data-src="/images/books/thumb/a.webp" alt="" />
      <img data-testid="b" src={DEFERRED_IMAGE_PLACEHOLDER} data-src="/images/books/thumb/b.webp" data-srcset="/b-1x.webp 1x, /b-2x.webp 2x" alt="" />
      <img data-testid="plain" src="/images/other.webp" alt="" />
      <ImageDeferrer />
    </div>,
  );
}

describe("<ImageDeferrer>", () => {
  it("asks for nothing until an image is about to be seen", () => {
    const { getByTestId } = page();
    expect(observers).toHaveLength(1);
    expect(observers[0].observed.map((e) => e.getAttribute("data-testid"))).toEqual(["a", "b"]);
    expect(getByTestId("a").getAttribute("src")).toBe(DEFERRED_IMAGE_PLACEHOLDER);
    expect(getByTestId("b").getAttribute("src")).toBe(DEFERRED_IMAGE_PLACEHOLDER);
    expect(getByTestId("plain").getAttribute("src")).toBe("/images/other.webp");
  });

  it("swaps the real address in for the image that comes near, and only that one", () => {
    const { getByTestId } = page();
    const a = getByTestId("a");
    const b = getByTestId("b");
    act(() => observers[0].cb([{ target: a, isIntersecting: false }]));
    expect(a.getAttribute("src")).toBe(DEFERRED_IMAGE_PLACEHOLDER);

    act(() => observers[0].cb([{ target: b, isIntersecting: true }]));
    expect(b.getAttribute("src")).toBe("/images/books/thumb/b.webp");
    expect(b.getAttribute("srcset")).toBe("/b-1x.webp 1x, /b-2x.webp 2x");
    expect(b.hasAttribute("data-src")).toBe(false);
    expect(observers[0].unobserved).toContain(b);
    expect(a.getAttribute("src"), "the one still far away is untouched").toBe(DEFERRED_IMAGE_PLACEHOLDER);
  });

  it("looks a little way past the edge of the screen, so a card is there before it slides in", () => {
    page();
    expect(observers[0].options?.rootMargin).toBe("250px 200px");
  });

  it("stops watching when the page goes", () => {
    const { unmount } = page();
    unmount();
    expect(observers[0].disconnected).toBe(true);
  });

  it("watches nothing on a page that defers nothing", () => {
    render(<ImageDeferrer />);
    expect(observers).toHaveLength(0);
  });

  it("gives a browser with no IntersectionObserver every image on the next tick: slower, never missing", () => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", undefined);
    delete (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
    const { getByTestId } = page();
    expect(getByTestId("a").getAttribute("src")).toBe(DEFERRED_IMAGE_PLACEHOLDER);
    act(() => {
      vi.advanceTimersByTime(5);
    });
    expect(getByTestId("a").getAttribute("src")).toBe("/images/books/thumb/a.webp");
    expect(getByTestId("b").getAttribute("src")).toBe("/images/books/thumb/b.webp");
  });
});
