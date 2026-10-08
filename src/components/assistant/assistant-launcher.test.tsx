import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantLauncher } from "./assistant-launcher";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/books" }));

/**
 * On a phone the launcher slides out of the way while the page is read: scrolling DOWN tucks it off the right
 * edge, scrolling UP or being near the top brings it back. It is moved, never removed — it stays in the DOM, in the
 * tab order and in the accessibility tree.
 */

const TUCK = "max-md:translate-x-[calc(100%+1.5rem)]";

/** Scroll to `y` and let the animation frame the component waits for run. */
async function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  await act(async () => {
    window.dispatchEvent(new Event("scroll"));
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  // A frame that comes AFTER the call returns, as a real one does.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("<AssistantLauncher> — out of the reader's way on a phone", () => {
  const button = () => screen.getByRole("button", { name: "Ask about our books" });

  it("is in view at the top of the page", () => {
    render(<AssistantLauncher />);
    expect(button().className).not.toContain(TUCK);
  });

  it("tucks away when the page is scrolled down, and comes back when it is scrolled up", async () => {
    render(<AssistantLauncher />);
    await scrollTo(300);
    await scrollTo(420);
    expect(button().className, "scrolled down 120px past the top zone").toContain(TUCK);
    await scrollTo(380);
    await scrollTo(330);
    expect(button().className, "scrolled back up 90px").not.toContain(TUCK);
  });

  it("is always back near the top of the page", async () => {
    render(<AssistantLauncher />);
    await scrollTo(500);
    await scrollTo(700);
    expect(button().className).toContain(TUCK);
    await scrollTo(100);
    expect(button().className).not.toContain(TUCK);
  });

  it("is moved, not removed: still a labelled button that keyboard focus brings back into view", async () => {
    render(<AssistantLauncher />);
    await scrollTo(300);
    await scrollTo(600);
    const b = button();
    expect(b.tagName).toBe("BUTTON");
    expect(b.getAttribute("aria-label")).toBe("Ask about our books");
    expect(b.className).toContain("max-md:focus-visible:translate-x-0");
    expect(b.className).toContain("max-md:focus-visible:opacity-100");
  });

  it("a small wobble does not make it flicker: once tucked it stays tucked until a real scroll back up", async () => {
    render(<AssistantLauncher />);
    await scrollTo(400);
    expect(button().className).toContain(TUCK);
    await scrollTo(420);
    await scrollTo(410);
    await scrollTo(430);
    await scrollTo(415);
    expect(button().className, "±20px of jitter").toContain(TUCK);
  });

  it("never tucks within the top zone", async () => {
    render(<AssistantLauncher />);
    await scrollTo(60);
    await scrollTo(140);
    expect(button().className).not.toContain(TUCK);
  });
});
