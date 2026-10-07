import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { overlayCount } from "@/lib/overlay/overlay-stack";
import { isScrollLocked } from "@/lib/overlay/scroll-lock";

import { Dialog, DialogBody, DialogClose, DialogFooter } from "./dialog";

/** jsdom does no layout, so "is it visible" (used by the focus trap) is always false. Say it is. */
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(
    () => [{ width: 1, height: 1 }] as unknown as DOMRectList,
  );
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute("data-overlay-open");
});

function Harness({ initial = true, history = false }: { initial?: boolean; history?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <>
      <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>
        open
      </button>
      <Dialog open={open} onOpenChange={setOpen} labelledBy="t" history={history}>
        <DialogBody>
          <h2 id="t">Hello dialog</h2>
          <button type="button">inside</button>
        </DialogBody>
        <DialogFooter>
          <DialogClose aria-label="Close hello" />
        </DialogFooter>
      </Dialog>
    </>
  );
}

describe("Dialog — semantics and scroll lock", () => {
  it("is a modal dialog named by its heading", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog", { name: "Hello dialog" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("renders nothing while closed and does not lock the page", () => {
    render(<Harness initial={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(isScrollLocked()).toBe(false);
  });

  it("locks the page while open and releases it when closed", () => {
    render(<Harness />);
    expect(isScrollLocked()).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Close hello" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(isScrollLocked()).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("releases the lock when it is unmounted while open", () => {
    const { unmount } = render(<Harness />);
    expect(isScrollLocked()).toBe(true);
    unmount();
    expect(isScrollLocked()).toBe(false);
    expect(overlayCount()).toBe(0);
  });
});

describe("Dialog — closing", () => {
  it("closes on Escape", () => {
    render(<Harness />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(isScrollLocked()).toBe(false);
  });

  // Four copies of a document-level Escape handler used to close every open
  // overlay with one keypress, which is how the page got left locked.
  it("closes only the TOPMOST of two open dialogs on Escape", () => {
    function Two() {
      const [a, setA] = useState(true);
      const [b, setB] = useState(true);
      return (
        <>
          <Dialog open={a} onOpenChange={setA} label="first" history={false}>
            <DialogBody>first</DialogBody>
          </Dialog>
          <Dialog open={b} onOpenChange={setB} label="second" history={false}>
            <DialogBody>second</DialogBody>
          </Dialog>
        </>
      );
    }
    render(<Two />);
    expect(screen.getAllByRole("dialog")).toHaveLength(2);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "first" })).toBeTruthy();
    expect(isScrollLocked()).toBe(true); // the first is still open

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(isScrollLocked()).toBe(false);
  });

  it("closes on a press that begins on the backdrop, not on one inside the panel", () => {
    render(<Harness />);
    const panel = screen.getByRole("dialog");
    const backdrop = panel.parentElement as HTMLElement;

    // A click inside the panel: never closes.
    fireEvent.pointerDown(panel);
    fireEvent.click(panel);
    expect(screen.queryByRole("dialog")).not.toBeNull();

    // A drag that STARTS inside (selecting text) and ENDS on the backdrop: must not close.
    fireEvent.pointerDown(panel);
    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog")).not.toBeNull();

    // A press that starts and ends on the backdrop: closes.
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Dialog — focus and the app behind it", () => {
  it("moves focus into the panel, then returns it to the trigger", () => {
    render(<Harness initial={false} />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);

    const panel = screen.getByRole("dialog");
    expect(document.activeElement).toBe(panel);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
  });

  it("traps Tab inside the panel, in both directions", () => {
    render(<Harness />);
    const inside = screen.getByRole("button", { name: "inside" });
    const close = screen.getByRole("button", { name: "Close hello" });

    close.focus();
    fireEvent.keyDown(document, { key: "Tab" }); // last → first
    expect(document.activeElement).toBe(inside);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true }); // first → last
    expect(document.activeElement).toBe(close);
  });

  it("makes #app-root inert while open and restores it afterwards", () => {
    const root = document.createElement("div");
    root.id = "app-root";
    document.body.appendChild(root);

    render(<Harness />);
    expect(root.hasAttribute("inert")).toBe(true);
    expect(document.documentElement.hasAttribute("data-overlay-open")).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(root.hasAttribute("inert")).toBe(false);
    expect(document.documentElement.hasAttribute("data-overlay-open")).toBe(false);
  });
});

describe("Dialog — Android Back", () => {
  it("pushes one same-URL entry, and Back (a popstate without it) closes the dialog", () => {
    vi.useFakeTimers();
    const push = vi.spyOn(window.history, "pushState");
    render(<Harness history />);

    // Pushed on a timer, so a setup undone immediately never touches history.
    expect(push).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5);
    });
    expect(push).toHaveBeenCalledTimes(1);
    expect(window.history.state?.__vpOverlay).toBeTruthy();

    // Back: the entry is gone, a popstate fires.
    act(() => {
      window.history.replaceState(null, "");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(isScrollLocked()).toBe(false);
  });

  it("takes its own entry off the stack when closed some other way", () => {
    vi.useFakeTimers();
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(<Harness history />);
    act(() => {
      vi.advanceTimersByTime(5);
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("does not touch history at all if it is closed before the timer fires", () => {
    vi.useFakeTimers();
    const push = vi.spyOn(window.history, "pushState");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { unmount } = render(<Harness history />);
    unmount(); // Strict Mode's immediate setup→cleanup looks exactly like this
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(push).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
});
