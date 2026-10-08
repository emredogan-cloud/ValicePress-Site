import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogItem } from "./catalog-item";
import { CatalogShell } from "./catalog-shell";

/**
 * The catalogue keeps its filters in the address bar. What these tests pin is
 * the part that is easy to get wrong: it must write the address ONLY when the
 * address would change.
 *
 * It used to write unconditionally, ~300 ms after mounting, so every visit to
 * /books fired a `router.replace` to the page it was already on. That is a
 * server round trip for nothing — and when the visitor left in that window the
 * aborted fetch made Next fall back to a browser navigation to /books, which in
 * Firefox turned a hard navigation away into one back to the catalogue.
 */

const replace = vi.fn();
const router = { replace };
let query = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/books",
  useSearchParams: () => query,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <span data-src={src} role="img" aria-label={alt} />,
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

function book(): CatalogItem {
  return {
    id: "b1",
    slug: "test-book",
    title: "Test Book",
    author: "A. Author",
    priceCents: 0,
    rating: 0,
    category: "Romance",
    editions: [
      { format: "ebook", availability: "available", fulfillment: "amazon", priceCents: 99, currency: "USD", amazonUrl: "https://www.amazon.com/dp/B0AAAAAAA1", pageCount: 292 },
    ],
    hasEpub: false,
    pageCount: 292,
    buyableHere: false,
    panels: [{ kind: "front", src: "/images/books/test-book.webp", alt: "Front cover of Test Book", caption: "Front cover" }],
    subtitle: "A subtitle",
    formats: ["Kindle"],
    cover: { gradient: "", accent: "" },
    coverSrc: "/images/books/test-book.webp",
  };
}

const settle = (ms = 1000) => act(() => void vi.advanceTimersByTime(ms));
const sortSelect = (root: HTMLElement) => root.querySelector<HTMLSelectElement>("#catalog-sort")!;

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockClear();
  query = new URLSearchParams();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  // jsdom has no matchMedia; the campaign gift box on the page asks for prefers-reduced-motion.
  window.matchMedia = ((media: string) => ({
    matches: false,
    media,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CatalogShell — the address bar", () => {
  it("writes nothing on a plain visit", () => {
    render(<CatalogShell books={[book()]} />);
    settle();
    expect(replace).not.toHaveBeenCalled();
  });

  it("writes nothing when the address already says what the page shows", () => {
    query = new URLSearchParams("cat=Romance&sort=price-low");
    render(<CatalogShell books={[book()]} />);
    settle();
    expect(replace).not.toHaveBeenCalled();
  });

  it("writes the address once, after a pause, when the visitor changes something", () => {
    const { container } = render(<CatalogShell books={[book()]} />);
    fireEvent.change(sortSelect(container), { target: { value: "price-high" } });
    settle(299);
    expect(replace).not.toHaveBeenCalled();
    settle(1);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/books?sort=price-high", { scroll: false });
    settle();
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the visitor changes something and changes it straight back", () => {
    const { container } = render(<CatalogShell books={[book()]} />);
    fireEvent.change(sortSelect(container), { target: { value: "price-high" } });
    settle(100);
    fireEvent.change(sortSelect(container), { target: { value: "newest" } });
    settle();
    expect(replace).not.toHaveBeenCalled();
  });

  it("follows a change that came from outside (Back/Forward) without writing it back", () => {
    query = new URLSearchParams("sort=price-low");
    const { container, rerender } = render(<CatalogShell books={[book()]} />);
    settle();

    query = new URLSearchParams("sort=price-high");
    rerender(<CatalogShell books={[book()]} />);
    settle();

    expect(sortSelect(container).value).toBe("price-high");
    expect(replace).not.toHaveBeenCalled();
  });

  it("still writes after an outside change, when the visitor then changes something themselves", () => {
    query = new URLSearchParams("sort=price-low");
    const { container, rerender } = render(<CatalogShell books={[book()]} />);
    settle();
    query = new URLSearchParams("sort=price-high");
    rerender(<CatalogShell books={[book()]} />);
    settle();

    fireEvent.change(sortSelect(container), { target: { value: "rating" } });
    settle();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/books?sort=rating", { scroll: false });
  });
});
