import { act, cleanup, render, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CART_CHANGED_EVENT,
  cartChanged,
  parseCartSnapshot,
  resetCartStoreForTests,
  syncCart,
  useCartCount,
  useCartSnapshot,
  useInCart,
} from "./cart-store";

/**
 * The browser's view of the cart. What these hold the store to:
 *  - it believes the SERVER and only the server, and only the NEWEST answer;
 *  - a failed read changes nothing;
 *  - a page full of cards asks once, not once per card;
 *  - it re-reads when the page comes back (a returning tab, a restored page).
 */

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const fetchMock = vi.fn();
const answer = (body: unknown, ok = true) => Promise.resolve({ ok, json: async () => body } as Response);

/** A reply that is held back until the test lets it go — to make answers arrive out of order. */
function deferred() {
  let release!: (body: unknown) => void;
  const promise = new Promise<Response>((resolve) => {
    release = (body) => resolve({ ok: true, json: async () => body } as Response);
  });
  return { promise, release };
}

beforeEach(() => {
  resetCartStoreForTests();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("parseCartSnapshot", () => {
  it("accepts the endpoint's shape", () => {
    expect(parseCartSnapshot({ count: 2, ids: [A, B] })).toEqual({ count: 2, ids: [A, B] });
    expect(parseCartSnapshot({ count: 0, ids: [] })).toEqual({ count: 0, ids: [] });
  });

  it("refuses anything that is not a count", () => {
    for (const bad of [null, undefined, "x", 3, [], {}, { count: "2" }, { count: -1 }, { count: NaN }, { count: Infinity }]) {
      expect(parseCartSnapshot(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("keeps only string ids, and tolerates a missing list", () => {
    expect(parseCartSnapshot({ count: 2, ids: [A, 7, null, B] })).toEqual({ count: 2, ids: [A, B] });
    expect(parseCartSnapshot({ count: 1 })).toEqual({ count: 1, ids: [] });
    expect(parseCartSnapshot({ count: 1, ids: "nope" })).toEqual({ count: 1, ids: [] });
  });
});

describe("what the hooks report", () => {
  it("knows nothing until the server has answered — and claims nothing", () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never answers
    const { result } = renderHook(() => ({ n: useCartCount(), inCart: useInCart(A), snap: useCartSnapshot() }));
    expect(result.current).toEqual({ n: null, inCart: false, snap: null });
  });

  it("reports the server's count and which books are in", async () => {
    fetchMock.mockReturnValue(answer({ count: 2, ids: [A, B] }));
    const { result } = renderHook(() => ({ n: useCartCount(), a: useInCart(A), b: useInCart(B), c: useInCart("33333333-3333-4333-8333-333333333333") }));
    await act(async () => {});
    expect(result.current).toEqual({ n: 2, a: true, b: true, c: false });
  });

  it("matches an id however it is cased", async () => {
    fetchMock.mockReturnValue(answer({ count: 1, ids: [A] }));
    const { result } = renderHook(() => useInCart(A.toUpperCase()));
    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it("follows the cart as it changes", async () => {
    fetchMock.mockReturnValueOnce(answer({ count: 0, ids: [] })).mockReturnValueOnce(answer({ count: 1, ids: [A] }));
    const { result } = renderHook(() => ({ n: useCartCount(), a: useInCart(A) }));
    await act(async () => {});
    expect(result.current).toEqual({ n: 0, a: false });
    await act(async () => {
      await cartChanged();
    });
    expect(result.current).toEqual({ n: 1, a: true });
  });
});

describe("one source of truth", () => {
  it("a page of cards asks the server once, not once per card", async () => {
    fetchMock.mockReturnValue(answer({ count: 0, ids: [] }));
    const Card = () => {
      useInCart(A);
      return null;
    };
    const Header = () => {
      useCartCount();
      return null;
    };
    render(
      createElement(
        "div",
        null,
        ...Array.from({ length: 12 }, (_, i) => createElement(Card, { key: i })), // twelve cards
        createElement(Header, { key: "header" }), // the header
        createElement(Header, { key: "legacy" }), // and the hidden legacy header
      ),
    );
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("an older answer arriving AFTER a newer one is dropped", async () => {
    const first = deferred();
    const second = deferred();
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useCartCount());
    // read #1 is in flight (the mount); read #2 starts (a change was made)
    const sync2 = syncCart();
    // the NEWER read answers first...
    await act(async () => {
      second.release({ count: 3, ids: [A] });
      await sync2;
    });
    expect(result.current).toBe(3);
    // ...then the OLDER one limps in with stale data. It must not win.
    await act(async () => {
      first.release({ count: 0, ids: [] });
      await first.promise;
    });
    expect(result.current).toBe(3);
  });

  it("a read that fails changes nothing — a flaky network cannot blank the badge", async () => {
    fetchMock.mockReturnValueOnce(answer({ count: 2, ids: [A, B] }));
    const { result } = renderHook(() => useCartCount());
    await act(async () => {});
    expect(result.current).toBe(2);

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      await syncCart();
    });
    expect(result.current).toBe(2);

    fetchMock.mockReturnValueOnce(answer({ nope: true }, false));
    await act(async () => {
      await syncCart();
    });
    expect(result.current).toBe(2);

    fetchMock.mockReturnValueOnce(answer("garbage"));
    await act(async () => {
      await syncCart();
    });
    expect(result.current).toBe(2);
  });
});

describe("announcing and re-reading", () => {
  it("cartChanged re-reads, waits for the answer, then announces on window", async () => {
    fetchMock.mockReturnValue(answer({ count: 1, ids: [A] }));
    const heard: Array<{ source?: string } | null> = [];
    const listener = (e: Event) => heard.push((e as CustomEvent).detail);
    window.addEventListener(CART_CHANGED_EVENT, listener);
    await act(async () => {
      await cartChanged();
    });
    window.removeEventListener(CART_CHANGED_EVENT, listener);
    expect(heard).toEqual([{ source: "cart-store" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not answer its own announcement with a second read", async () => {
    fetchMock.mockReturnValue(answer({ count: 1, ids: [A] }));
    renderHook(() => useCartCount());
    await act(async () => {});
    fetchMock.mockClear();
    await act(async () => {
      await cartChanged();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // the read cartChanged asked for — and no echo
  });

  it("a cart-changed event from anywhere else (the on-device harness, old code) triggers a re-read", async () => {
    fetchMock.mockReturnValue(answer({ count: 0, ids: [] }));
    renderHook(() => useCartCount());
    await act(async () => {});
    fetchMock.mockClear().mockReturnValue(answer({ count: 4, ids: [A] }));
    await act(async () => {
      window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("re-reads when a hidden tab comes back, and when a page is restored from the back/forward cache", async () => {
    fetchMock.mockReturnValue(answer({ count: 0, ids: [] }));
    const { result } = renderHook(() => useCartCount());
    await act(async () => {});
    fetchMock.mockClear().mockReturnValue(answer({ count: 5, ids: [A] }));

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(5);

    // going HIDDEN is not a reason to ask
    fetchMock.mockClear();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });

    // a normal page show is not a restore; a persisted one is
    const pageshow = (persisted: boolean) => {
      const e = new Event("pageshow") as Event & { persisted: boolean };
      Object.defineProperty(e, "persisted", { value: persisted });
      return e;
    };
    await act(async () => {
      window.dispatchEvent(pageshow(false));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockReturnValue(answer({ count: 6, ids: [A] }));
    await act(async () => {
      window.dispatchEvent(pageshow(true));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(6);
  });

  it("stops listening when the last component goes away", async () => {
    fetchMock.mockReturnValue(answer({ count: 0, ids: [] }));
    const { unmount } = renderHook(() => useCartCount());
    await act(async () => {});
    unmount();
    fetchMock.mockClear();
    await act(async () => {
      window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
