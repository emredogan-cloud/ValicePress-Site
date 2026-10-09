import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryCoverStack } from "./category-cover-stack";

/**
 * The fan of covers on a shelf card. What a unit test can see is the contract the browser then lays out
 * (`e2e/shapes.pw.ts` measures the boxes themselves): each cover is a 2:3 box sized by the frame's HEIGHT,
 * never by its width, and `sizes` tells the browser the fraction the caller said.
 *
 * It matters because the box used to be `h-[68%] w-[38%]`: in the 16:9 frame on /about that is a square, so
 * `object-cover` cut a third off every cover and sliced the title through the middle.
 */

vi.mock("next/image", () => ({
  default: ({ src, sizes }: { src: string; sizes?: string }) => <span data-testid="cover" data-src={src} data-sizes={sizes} />,
}));

afterEach(() => cleanup());

const SRCS = ["/images/books/a.webp", "/images/books/b.webp", "/images/books/c.webp"];

function boxes(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-testid=cover]")].map((img) => img.parentElement as HTMLElement);
}

const left = (box: HTMLElement) => parseFloat(box.style.left);

describe("<CategoryCoverStack> — a cover keeps its own shape", () => {
  it("sizes each cover by the frame's height at 2:3, with no width of its own", () => {
    const { container } = render(<CategoryCoverStack coverSrcs={SRCS} name="Games" />);
    const all = boxes(container);
    expect(all).toHaveLength(3);
    for (const box of all) {
      expect(box.className).toContain("aspect-[2/3]");
      expect(box.className).toContain("h-[min(68%,57cqw)]");
      expect(box.className, "a width class would make the box the frame's shape and crop the cover").not.toMatch(/(^|\s)w-/);
    }
  });

  it("pulls each box back by half its own width, so `left` is where the cover's middle is", () => {
    const { container } = render(<CategoryCoverStack coverSrcs={SRCS} name="Games" />);
    for (const box of boxes(container)) expect(box.style.transform.startsWith("translateX(-50%)")).toBe(true);
  });

  it("fans three covers symmetrically about the middle one, which is in front", () => {
    const { container } = render(<CategoryCoverStack coverSrcs={SRCS} name="Games" />);
    const [leftCover, rightCover, middle] = boxes(container);
    expect(left(middle)).toBe(50);
    expect(left(leftCover) + left(rightCover), "the two outer covers are mirror images about 50%").toBe(100);
    expect(Number(middle.style.zIndex)).toBeGreaterThan(Number(leftCover.style.zIndex));
  });

  it("puts one cover in the middle", () => {
    const { container } = render(<CategoryCoverStack coverSrcs={SRCS.slice(0, 1)} name="Games" />);
    expect(boxes(container).map(left)).toEqual([50]);
  });

  it("promises the browser the fraction the caller gives, and 0.38 when it gives none", () => {
    const sizes = "(min-width: 1024px) 34vw, 90vw";
    const given = render(<CategoryCoverStack coverSrcs={SRCS} name="Games" sizes={sizes} coverFraction={0.27} />);
    expect(given.container.querySelector("[data-testid=cover]")?.getAttribute("data-sizes")).toBe("(min-width: 1024px) calc(34vw * 0.27), calc(90vw * 0.27)");
    cleanup();
    const plain = render(<CategoryCoverStack coverSrcs={SRCS} name="Games" sizes={sizes} />);
    expect(plain.container.querySelector("[data-testid=cover]")?.getAttribute("data-sizes")).toBe("(min-width: 1024px) calc(34vw * 0.38), calc(90vw * 0.38)");
  });

  it("draws a typographic stand-in when the shelf has no cover yet", () => {
    const { container, getByText } = render(<CategoryCoverStack coverSrcs={[]} name="Poetry" />);
    expect(boxes(container)).toHaveLength(0);
    expect(getByText("Poetry")).toBeTruthy();
  });
});
