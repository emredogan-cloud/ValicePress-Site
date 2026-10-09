import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addToCart, createCheckoutSession, removeFromCart } from "@/app/cart/actions";
import { BookAddToCart } from "@/components/book-detail/book-add-to-cart";
import type { CatalogItem } from "@/components/catalog/catalog-item";
import { trackEvent } from "@/lib/analytics";
import { CHECKOUT_FAILED_MESSAGE, REMOVE_FAILED_MESSAGE } from "@/lib/cart-copy";

import { CartLine, type CartLineBook } from "./cart-line";
import { resetCartStoreForTests, syncCart } from "./cart-store";
import { RecommendationCard } from "./recommendation-card";

/**
 * The cart's controls, wired to the REAL cart store, with only the edges faked:
 * `fetch` (the server's cart, as `/api/cart/count` reports it) and the server
 * actions. What is held to account is what the reader SEES at each step — the
 * states between "pressed" and "done", which no unit test of a pure function can
 * reach and which the browser tests cannot reach for the one outcome that needs a
 * live payment provider (the redirect).
 */

vi.mock("@/app/cart/actions", () => ({
  addToCart: vi.fn(),
  removeFromCart: vi.fn(),
  clearCart: vi.fn(),
  createCheckoutSession: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("next/link", () => ({
  // `prefetch` is a next/link prop, not an <a> attribute: drop it before spreading.
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => {
    const { prefetch, ...anchor } = rest;
    void prefetch;
    return (
      <a href={href} {...anchor}>
        {children}
      </a>
    );
  },
}));
vi.mock("@/components/cinematic/cover-art", () => ({ CoverArt: ({ title }: { title: string }) => <span data-testid="cover">{title}</span> }));

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

/** What the server's cart currently holds; `fetch` reports it. */
let serverIds: string[] = [];
let entitlement = { owned: false };
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.startsWith("/api/entitlement")) return { ok: true, json: async () => entitlement } as Response;
  return { ok: true, json: async () => ({ count: serverIds.length, ids: [...serverIds] }) } as Response;
});

const addToCartMock = vi.mocked(addToCart);
const removeMock = vi.mocked(removeFromCart);
const checkoutMock = vi.mocked(createCheckoutSession);

function item(over: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: ID,
    slug: "test-book",
    title: "Test Book",
    author: "A. Author",
    priceCents: 999,
    rating: 0,
    category: "Games",
    editions: [],
    hasEpub: false,
    pageCount: 100,
    buyableHere: true,
    panels: [],
    subtitle: null,
    formats: [],
    cover: { gradient: "", accent: "" },
    coverSrc: null,
    ...over,
  };
}

function line(over: Partial<CartLineBook> = {}): CartLineBook {
  return { id: ID, slug: "test-book", title: "Test Book", authors: [{ name: "A. Author" }], priceCents: 999, currency: "USD", coverSrc: null, ...over };
}

const settle = () => act(async () => {});

beforeEach(() => {
  resetCartStoreForTests();
  serverIds = [];
  entitlement = { owned: false };
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  addToCartMock.mockReset();
  removeMock.mockReset();
  checkoutMock.mockReset();
  vi.mocked(trackEvent).mockClear();
  // The server adds the book, as the real action does, so the store's next read sees it.
  addToCartMock.mockImplementation(async (id) => {
    if (!serverIds.includes(id)) serverIds.push(id);
    return { ok: true, state: "added" };
  });
  removeMock.mockImplementation(async (id) => {
    serverIds = serverIds.filter((i) => i !== id);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------

describe("<RecommendationCard>", () => {
  it("is not interactive content inside a link — the title is the link, the plus is its sibling", () => {
    const { container } = render(<RecommendationCard book={item()} />);
    expect(container.querySelectorAll("a button, a a, button a, button button")).toHaveLength(0);
    const links = Array.from(container.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/books/test-book"]);
    expect(screen.getByRole("button", { name: "Add Test Book to cart" })).toBeTruthy();
    expect(screen.getByText("$9.99")).toBeTruthy();
    // the title heading is a level-3 heading (under the shelf's h2), not a skipped h4
    expect(screen.getByRole("heading", { level: 3, name: "Test Book" })).toBeTruthy();
  });

  it("press → adding → in your cart, and the tick is the SERVER's word", async () => {
    render(<RecommendationCard book={item()} />);
    await settle();
    const plus = screen.getByRole("button", { name: "Add Test Book to cart" });
    expect(plus.getAttribute("data-cart-state")).toBe("idle");

    let release!: () => void;
    addToCartMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => {
            serverIds.push(ID);
            resolve({ ok: true, state: "added" });
          };
        }),
    );
    fireEvent.click(plus);
    // in flight: says so, ignores presses
    const busy = await screen.findByRole("button", { name: "Adding Test Book to cart" });
    expect(busy.getAttribute("aria-disabled")).toBe("true");
    expect(busy.getAttribute("data-cart-state")).toBe("adding");
    fireEvent.click(busy);
    expect(addToCartMock).toHaveBeenCalledTimes(1);

    await act(async () => release());
    const done = await screen.findByRole("button", { name: "Test Book is in your cart" });
    expect(done.getAttribute("data-cart-state")).toBe("in-cart");
    expect(done.getAttribute("aria-disabled")).toBe("true");
    expect(trackEvent).toHaveBeenCalledWith("add_to_cart", { bookId: ID });
    expect(addToCartMock).toHaveBeenCalledTimes(1);

    // a tick is not a button: pressing it adds nothing
    fireEvent.click(done);
    await settle();
    expect(addToCartMock).toHaveBeenCalledTimes(1);
  });

  it("is already ticked when the server's cart already holds the book, and goes back to + when it does not", async () => {
    serverIds = [ID];
    render(<RecommendationCard book={item()} />);
    expect((await screen.findByRole("button", { name: "Test Book is in your cart" })).getAttribute("data-cart-state")).toBe("in-cart");

    // removed on the cart page
    serverIds = [];
    await act(async () => {
      await syncCart();
    });
    expect((await screen.findByRole("button", { name: "Add Test Book to cart" })).getAttribute("data-cart-state")).toBe("idle");
  });

  it("only counts an add as an add when the server added it", async () => {
    serverIds = [ID];
    addToCartMock.mockResolvedValue({ ok: true, state: "inCart" });
    render(<RecommendationCard book={item({ id: OTHER })} />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Add Test Book to cart" }));
    await settle();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it.each([
    ["unavailable", "Can't be bought here right now."],
    ["full", "Your cart is full."],
    ["unknown", "Couldn't add it — try again."],
  ] as const)("a refusal (%s) is said in words, nothing is ticked, and it can be tried again", async (reason, words) => {
    addToCartMock.mockResolvedValueOnce({ ok: false, reason });
    render(<RecommendationCard book={item()} />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Add Test Book to cart" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(words);
    // (the message is shown a beat before the button finishes going back to idle)
    const idle = await screen.findByRole("button", { name: "Add Test Book to cart" });
    expect(idle.getAttribute("data-cart-state")).toBe("idle");
    expect(serverIds).toEqual([]);

    // try again: the message goes away and the add goes through
    fireEvent.click(idle);
    await screen.findByRole("button", { name: "Test Book is in your cart" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a request that THROWS says so instead of blanking the page", async () => {
    addToCartMock.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<RecommendationCard book={item()} />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Add Test Book to cart" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't add it — try again.");
    expect(await screen.findByRole("button", { name: "Add Test Book to cart" })).toBeTruthy();
  });

  it.each([
    ["a book sold on Amazon (price 0)", { priceCents: 0, buyableHere: false }, "Not sold here"],
    ["a priced book with no live checkout", { priceCents: 999, buyableHere: false }, "$9.99"],
  ] as const)("%s gets no plus at all", async (_what, over, price) => {
    render(<RecommendationCard book={item(over)} />);
    await settle();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(price)).toBeTruthy();
    // but the card is still a way to the book page, where the real editions are listed
    expect(screen.getByRole("link", { name: "Test Book" }).getAttribute("href")).toBe("/books/test-book");
  });
});

// ---------------------------------------------------------------------------

describe("<CartLine>", () => {
  it("a buyable line: title, author, price, Buy, Remove", async () => {
    serverIds = [ID];
    render(<CartLine book={line()} />);
    await settle();
    expect(screen.getByRole("link", { name: "Test Book" })).toBeTruthy();
    expect(screen.getByText("A. Author")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Buy \$9\.99/ }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Remove Test Book from cart" })).toBeTruthy();
  });

  describe("Buy", () => {
    let assign: ReturnType<typeof vi.fn>;
    const realLocation = window.location;
    beforeEach(() => {
      assign = vi.fn();
      Object.defineProperty(window, "location", { configurable: true, value: { ...realLocation, assign } });
    });
    afterEach(() => {
      Object.defineProperty(window, "location", { configurable: true, value: realLocation });
    });

    it("on success it leaves for the payment page and STAYS busy, so a second press cannot open a second checkout", async () => {
      serverIds = [ID];
      checkoutMock.mockResolvedValue({ ok: true, url: "https://pay.example/checkout/abc" });
      render(<CartLine book={line()} />);
      await settle();
      const buy = screen.getByRole("button", { name: /^Buy \$9\.99/ });
      fireEvent.click(buy);
      await waitFor(() => expect(assign).toHaveBeenCalledWith("https://pay.example/checkout/abc"));
      await settle();

      // The transition has ended; the browser has not left yet. The button must still say so.
      const waiting = screen.getByRole("button", { name: /Opening checkout/ });
      expect(waiting.hasAttribute("disabled")).toBe(true);
      expect(waiting.getAttribute("aria-busy")).toBe("true");
      fireEvent.click(waiting);
      await settle();
      expect(checkoutMock).toHaveBeenCalledTimes(1);
      expect(assign).toHaveBeenCalledTimes(1);
      // Remove is not available mid-checkout either.
      expect(screen.getByRole("button", { name: "Remove Test Book from cart" }).hasAttribute("disabled")).toBe(true);
      expect(trackEvent).toHaveBeenCalledWith("begin_checkout", { itemCount: 1, totalCents: 999, currency: "USD" });
    });

    it("coming BACK from the payment page (page restored from cache) gives the button back", async () => {
      serverIds = [ID];
      checkoutMock.mockResolvedValue({ ok: true, url: "https://pay.example/checkout/abc" });
      render(<CartLine book={line()} />);
      await settle();
      fireEvent.click(screen.getByRole("button", { name: /^Buy \$9\.99/ }));
      await screen.findByRole("button", { name: /Opening checkout/ });

      const restored = new Event("pageshow") as Event & { persisted: boolean };
      Object.defineProperty(restored, "persisted", { value: true });
      await act(async () => {
        window.dispatchEvent(restored);
      });
      const buy = await screen.findByRole("button", { name: /^Buy \$9\.99/ });
      expect(buy.hasAttribute("disabled")).toBe(false);
    });

    it("a refusal is shown on the line, and the button works again", async () => {
      serverIds = [ID];
      checkoutMock.mockResolvedValueOnce({ ok: false, error: "Checkout is not configured yet." });
      render(<CartLine book={line()} />);
      await settle();
      fireEvent.click(screen.getByRole("button", { name: /^Buy \$9\.99/ }));
      expect((await screen.findByRole("alert")).textContent).toBe("Checkout is not configured yet.");
      expect(assign).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByRole("button", { name: /^Buy \$9\.99/ }).hasAttribute("disabled")).toBe(false));
    });

    it("a request that THROWS says so, and nothing was charged", async () => {
      serverIds = [ID];
      checkoutMock.mockRejectedValueOnce(new Error("network"));
      render(<CartLine book={line()} />);
      await settle();
      fireEvent.click(screen.getByRole("button", { name: /^Buy \$9\.99/ }));
      expect((await screen.findByRole("alert")).textContent).toBe(CHECKOUT_FAILED_MESSAGE);
      expect(assign).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByRole("button", { name: /^Buy \$9\.99/ }).hasAttribute("disabled")).toBe(false));
    });
  });

  describe("Remove", () => {
    it("asks the server, then the line steps aside — without waiting for the page to re-render", async () => {
      serverIds = [ID];
      const { container } = render(<CartLine book={line()} />);
      await settle();
      fireEvent.click(screen.getByRole("button", { name: "Remove Test Book from cart" }));
      await waitFor(() => expect(container.querySelector("[data-cart-line]")).toBeNull());
      expect(removeMock).toHaveBeenCalledWith(ID);
      expect(serverIds).toEqual([]);
      // announced, for people who cannot see it go
      expect(screen.getByRole("status").textContent).toBe("Test Book was removed from your cart.");
    });

    it("the SAME line comes back if the book is added again (a flag of its own would hide it for good)", async () => {
      serverIds = [ID];
      const { container } = render(<CartLine book={line()} />);
      await settle();
      fireEvent.click(screen.getByRole("button", { name: "Remove Test Book from cart" }));
      await waitFor(() => expect(container.querySelector("[data-cart-line]")).toBeNull());

      serverIds = [ID]; // re-added from the shelf below
      await act(async () => {
        await syncCart();
      });
      expect(container.querySelector("[data-cart-line]")).not.toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("a failed removal says so, and the line stays", async () => {
      serverIds = [ID];
      removeMock.mockRejectedValueOnce(new Error("offline"));
      const { container } = render(<CartLine book={line()} />);
      await settle();
      fireEvent.click(screen.getByRole("button", { name: "Remove Test Book from cart" }));
      expect((await screen.findByRole("alert")).textContent).toBe(REMOVE_FAILED_MESSAGE);
      expect(container.querySelector("[data-cart-line]")).not.toBeNull();
      await waitFor(() => expect(screen.getByRole("button", { name: "Remove Test Book from cart" }).hasAttribute("disabled")).toBe(false));
    });
  });

  it("a book the reader already owns offers the library, not a purchase", async () => {
    serverIds = [ID];
    render(<CartLine book={line()} owned />);
    await settle();
    expect(screen.queryByRole("button", { name: /^Buy/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Already in your library/ }).getAttribute("href")).toBe("/account/library");
    expect(screen.getByRole("button", { name: "Remove Test Book from cart" })).toBeTruthy();
  });

  it("a book demoted to Amazon-only says so — no 'Buy $0.00' over a button that can only fail", async () => {
    serverIds = [ID];
    render(<CartLine book={line({ priceCents: 0 })} sellable={false} />);
    await settle();
    expect(screen.queryByRole("button", { name: /^Buy/ })).toBeNull();
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
    expect(screen.getByText("Not sold here")).toBeTruthy();
    expect(screen.getByText(/no longer sold on this site/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "see where it is sold" }).getAttribute("href")).toBe("/books/test-book");
    expect(screen.getByRole("button", { name: "Remove Test Book from cart" })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------

describe("<BookAddToCart>", () => {
  it("add → the control BECOMES the way to the cart, and does not slide back", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<BookAddToCart bookId={ID} />);
      await settle();
      fireEvent.click(screen.getByRole("button", { name: "Add digital edition" }));
      const link = await screen.findByRole("link", { name: /In your cart — view cart/ });
      expect(link.getAttribute("href")).toBe("/cart");
      expect(screen.queryByRole("button", { name: "Add digital edition" })).toBeNull();
      expect(trackEvent).toHaveBeenCalledWith("add_to_cart", { bookId: ID });

      // the old button reverted to "Add" after four seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(screen.getByRole("link", { name: /In your cart — view cart/ })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Add digital edition" })).toBeNull();
      expect(addToCartMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows 'Adding…' while it works and ignores a second press", async () => {
    let release!: () => void;
    addToCartMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => {
            serverIds.push(ID);
            resolve({ ok: true, state: "added" });
          };
        }),
    );
    render(<BookAddToCart bookId={ID} />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Add digital edition" }));
    const busy = await screen.findByRole("button", { name: /Adding/ });
    expect(busy.hasAttribute("disabled")).toBe(true);
    fireEvent.click(busy);
    expect(addToCartMock).toHaveBeenCalledTimes(1);
    await act(async () => release());
    await screen.findByRole("link", { name: /In your cart/ });
  });

  it("already in the cart when the page loads → the link, straight away", async () => {
    serverIds = [ID];
    render(<BookAddToCart bookId={ID} />);
    expect(await screen.findByRole("link", { name: /In your cart — view cart/ })).toBeTruthy();
  });

  it.each([
    ["unavailable", /can't be bought on this site right now/i],
    ["full", /cart is full/i],
    ["unknown", /couldn't add this book just now/i],
  ] as const)("a refusal (%s) is said in a sentence, the cart is unchanged, and Try again works", async (reason, sentence) => {
    addToCartMock.mockResolvedValueOnce({ ok: false, reason });
    render(<BookAddToCart bookId={ID} />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Add digital edition" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(sentence);
    expect(serverIds).toEqual([]);
    expect(screen.queryByRole("link", { name: /In your cart/ })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await screen.findByRole("link", { name: /In your cart/ });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a request that THROWS is told in a sentence, not swallowed and not an error page", async () => {
    addToCartMock.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<BookAddToCart bookId={ID} />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Add digital edition" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/nothing was charged/i);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("a reader who owns the book is sent to the library instead", async () => {
    entitlement = { owned: true };
    render(<BookAddToCart bookId={ID} />);
    const link = await screen.findByRole("link", { name: "In your library" });
    expect(link.getAttribute("href")).toBe("/account/library");
    expect(screen.queryByRole("button", { name: "Add digital edition" })).toBeNull();
  });
});
