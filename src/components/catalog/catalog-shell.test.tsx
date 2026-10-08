import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
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
/** What reading the address bar does: the browser answers; the server, in a static page, bails out. */
let readAddress: () => URLSearchParams = () => query;

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/books",
  useSearchParams: () => readAddress(),
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

function book(over: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: "b1",
    slug: "test-book",
    title: "Test Book",
    author: "A. Author",
    priceCents: 499,
    rating: 4.5,
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
    ...over,
  };
}

/**
 * Two priced books, one of them rated: enough for every sort to be on offer.
 * (A catalogue with fewer than two prices or no ratings does not list the sorts
 * that would order nothing — see catalog-sort.test.ts.)
 */
const shelf = () => [book(), book({ id: "b2", slug: "second-book", title: "Second Book", priceCents: 899, rating: 0 })];

const settle = (ms = 1000) => act(() => void vi.advanceTimersByTime(ms));
const sortSelect = (root: HTMLElement) => root.querySelector<HTMLSelectElement>("#catalog-sort")!;

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockClear();
  query = new URLSearchParams();
  readAddress = () => query;
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
    render(<CatalogShell books={shelf()} />);
    settle();
    expect(replace).not.toHaveBeenCalled();
  });

  it("writes nothing when the address already says what the page shows", () => {
    query = new URLSearchParams("cat=Romance&sort=price-low");
    render(<CatalogShell books={shelf()} />);
    settle();
    expect(replace).not.toHaveBeenCalled();
  });

  it("writes the address once, after a pause, when the visitor changes something", () => {
    const { container } = render(<CatalogShell books={shelf()} />);
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
    const { container } = render(<CatalogShell books={shelf()} />);
    fireEvent.change(sortSelect(container), { target: { value: "price-high" } });
    settle(100);
    fireEvent.change(sortSelect(container), { target: { value: "newest" } });
    settle();
    expect(replace).not.toHaveBeenCalled();
  });

  it("follows a change that came from outside (Back/Forward) without writing it back", () => {
    query = new URLSearchParams("sort=price-low");
    const { container, rerender } = render(<CatalogShell books={shelf()} />);
    settle();

    query = new URLSearchParams("sort=price-high");
    rerender(<CatalogShell books={shelf()} />);
    settle();

    expect(sortSelect(container).value).toBe("price-high");
    expect(replace).not.toHaveBeenCalled();
  });

  it("still writes after an outside change, when the visitor then changes something themselves", () => {
    query = new URLSearchParams("sort=price-low");
    const { container, rerender } = render(<CatalogShell books={shelf()} />);
    settle();
    query = new URLSearchParams("sort=price-high");
    rerender(<CatalogShell books={shelf()} />);
    settle();

    fireEvent.change(sortSelect(container), { target: { value: "rating" } });
    settle();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/books?sort=rating", { scroll: false });
  });
});

describe("CatalogShell — only the sorts that order something are offered", () => {
  const optionsOf = (root: HTMLElement) => [...root.querySelectorAll("#catalog-sort option")].map((o) => o.textContent);

  it("lists Top Rated only once a book has a rating, and the price sorts only when two books have a price", () => {
    const unrated = [book({ rating: 0 }), book({ id: "b2", slug: "b2", priceCents: 899, rating: 0 })];
    const { container, unmount } = render(<CatalogShell books={unrated} />);
    expect(optionsOf(container)).toEqual(["Newest", "Price: Low → High", "Price: High → Low"]);
    unmount();

    const rated = render(<CatalogShell books={shelf()} />);
    expect(optionsOf(rated.container)).toContain("Top Rated");
    rated.unmount();

    const oneUnpriced = render(<CatalogShell books={[book({ priceCents: 0, rating: 0 }), book({ id: "b2", slug: "b2", priceCents: 899, rating: 0 })]} />);
    expect(optionsOf(oneUnpriced.container)).toEqual(["Newest"]);
  });

  it("a link that asks for a sort that is not on offer shows the default, and does not rewrite the address", () => {
    query = new URLSearchParams("sort=rating");
    const unrated = [book({ rating: 0 }), book({ id: "b2", slug: "b2", priceCents: 899, rating: 0 })];
    const { container } = render(<CatalogShell books={unrated} />);
    settle();
    expect(sortSelect(container).value).toBe("newest");
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("CatalogShell — what the server sends", () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => book({ id: `b${i + 1}`, slug: `book-${i + 1}`, title: `Book ${i + 1}`, priceCents: 499 + i }));

  it("puts the default view's cards and their links in the HTML, though the address bar cannot be read on the server", () => {
    // In a statically generated page `useSearchParams()` throws on the server (Next bails that subtree out to the
    // client). When the shell itself called it, the whole shell went with it and the HTML held an empty panel.
    readAddress = () => {
      throw new Error("BAILOUT_TO_CLIENT_SIDE_RENDERING");
    };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const html = renderToString(<CatalogShell books={many(15)} />);
    quiet.mockRestore();

    // page one of a 12-per-page grid: twelve cards, each a real link to its book, the thirteenth not there
    expect(html.match(/<article/g)).toHaveLength(12);
    for (let i = 1; i <= 12; i++) expect(html).toContain(`href="/books/book-${i}"`);
    expect(html).not.toContain('href="/books/book-13"');
    // and the toolbar and filters are there too, not a placeholder
    expect(html).toContain("Showing");
    expect(html).toContain("Catalog filters");
  });
});
