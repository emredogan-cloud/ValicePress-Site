import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isScrollLocked } from "@/lib/overlay/scroll-lock";

import type { CatalogItem } from "./catalog-item";
import { QuickView } from "./quick-view";

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const KINDLE = "https://www.amazon.com/dp/B0AAAAAAA1";
const PAPERBACK = "https://www.amazon.com/dp/B0BBBBBBB2";

function book(over: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: "b1",
    slug: "test-book",
    title: "Test Book",
    author: "A. Author",
    priceCents: 0,
    rating: 0,
    category: "Romance",
    editions: [
      { format: "ebook", availability: "available", fulfillment: "amazon", priceCents: 99, currency: "USD", amazonUrl: KINDLE, pageCount: 292 },
      { format: "paperback", availability: "available", fulfillment: "amazon", priceCents: 1299, currency: "USD", amazonUrl: PAPERBACK, pageCount: 292 },
    ],
    hasEpub: false,
    pageCount: 292,
    buyableHere: false,
    previews: ["/p/1.webp", "/p/2.webp", "/p/3.webp"],
    subtitle: "A subtitle",
    formats: ["Kindle", "Paperback"],
    cover: { gradient: "", accent: "" },
    coverSrc: "/images/books/test-book.webp",
    ...over,
  };
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(
    () => [{ width: 1, height: 1 }] as unknown as DOMRectList,
  );
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("style");
});

describe("QuickView — it can always be left, and it always offers the right link", () => {
  it("is a dialog named by the book's title", () => {
    render(<QuickView book={book()} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Test Book" })).toBeTruthy();
  });

  // The phone bug: Close was in a clipped second row. It now sits in a header
  // that is outside the scroller, so it is a sibling of the body, not inside it.
  it("keeps Close in a header outside the scrolling body, and the offer in a pinned footer", () => {
    render(<QuickView book={book()} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "Close quick view" });
    const body = dialog.querySelector(".vp-dialog-body") as HTMLElement;
    const footer = dialog.querySelector(".vp-dialog-footer") as HTMLElement;

    expect(body.contains(close)).toBe(false);
    expect(footer.contains(close)).toBe(false);
    expect(close.className).toContain("h-11"); // 44px target
    expect(close.className).toContain("w-11");

    // The way to buy is not in the scroller either.
    const buy = within(footer).getByRole("link", { name: /Buy on Amazon/ });
    expect(body.contains(buy)).toBe(false);
  });

  it("locks the page while open and closes on Escape, calling onClose", () => {
    const onClose = vi.fn();
    render(<QuickView book={book()} onClose={onClose} />);
    expect(isScrollLocked()).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing, and holds no lock, for a null book", () => {
    render(<QuickView book={null} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(isScrollLocked()).toBe(false);
  });

  // Book A's title beside book B's link is the failure this site must never show.
  it("links Buy on Amazon to the SELECTED edition's own URL, and follows the selection", () => {
    render(<QuickView book={book()} onClose={() => {}} />);
    const buy = () => screen.getByRole("link", { name: /Buy on Amazon/ }) as HTMLAnchorElement;
    expect(buy().href).toBe(KINDLE);

    fireEvent.click(screen.getByRole("button", { name: /Paperback/ }));
    expect(buy().href).toBe(PAPERBACK);
    expect(buy().getAttribute("rel")).toContain("noopener");
  });

  it("offers only the editions that exist — no Hardcover chip for a book without one", () => {
    render(<QuickView book={book()} onClose={() => {}} />);
    const group = screen.getByRole("group", { name: "Editions" });
    const labels = within(group).getAllByRole("button").map((b) => b.textContent);
    expect(labels.some((t) => /Hardcover/i.test(t ?? ""))).toBe(false);
    expect(labels).toHaveLength(2);
  });

  it("steps through previews with buttons, announcing position, and disables at the ends", () => {
    render(<QuickView book={book()} onClose={() => {}} />);
    const prev = screen.getByRole("button", { name: "Previous preview" }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: "Next preview" }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(screen.getByText("1 / 3")).toBeTruthy();

    fireEvent.click(next);
    expect(screen.getByText("2 / 3")).toBeTruthy();
    fireEvent.click(next);
    expect(screen.getByText("3 / 3")).toBeTruthy();
    expect(next.disabled).toBe(true);
  });

  it("does not turn a vertical scroll into a page flip, but does flip on a clear horizontal swipe", () => {
    render(<QuickView book={book()} onClose={() => {}} />);
    const pane = screen.getByLabelText("Preview");

    // A thumb scrolling the dialog: mostly vertical, a little sideways.
    fireEvent.touchStart(pane, { touches: [{ clientX: 200, clientY: 400 }] });
    fireEvent.touchEnd(pane, { changedTouches: [{ clientX: 150, clientY: 250 }] });
    expect(screen.getByText("1 / 3")).toBeTruthy();

    // A deliberate swipe left.
    fireEvent.touchStart(pane, { touches: [{ clientX: 300, clientY: 300 }] });
    fireEvent.touchEnd(pane, { changedTouches: [{ clientX: 150, clientY: 310 }] });
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("falls back to the cover when a book has no previews, never to another book's art", () => {
    render(<QuickView book={book({ previews: [] })} onClose={() => {}} />);
    const img = screen.getByAltText("Cover of Test Book") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/images/books/test-book.webp");
    expect(screen.queryByRole("button", { name: "Next preview" })).toBeNull();
  });
});
