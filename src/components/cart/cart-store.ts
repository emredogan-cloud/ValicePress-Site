"use client";

import { useSyncExternalStore } from "react";

/**
 * What the browser knows about the cart: how many lines, and which books.
 *
 * ONE SOURCE, READ FROM THE SERVER. The cart lives in an httpOnly cookie the
 * page cannot read, so the only way to know what is in it is to ask
 * `/api/cart/count` — which reads the cookie, checks the books still exist, and
 * answers `{ count, ids }`. This module asks once per change and tells every
 * component that cares. Before it there were two copies of the fetch (the
 * hidden legacy header and the visible one) that could disagree, a refetch that
 * a slow, older response could overwrite, and no way for a "+" button to know
 * its book was already in the cart.
 *
 * THE NUMBERS COME FROM THE SERVER, NOT FROM THE CLICK. A control that adds a
 * book calls `syncCart()` and waits; it then shows whatever the server says the
 * cart holds. A button that guessed ("I pressed it, so it must be in there") is
 * how a store ends up telling a reader it sold them something it did not.
 *
 * The snapshot survives navigation (every page mounts its own header, so there
 * is a moment with no subscribers) and is re-read whenever the page comes back:
 * a tab you return to, a page restored from the back/forward cache.
 */

export const CART_CHANGED_EVENT = "cart-changed";

export interface CartSnapshot {
  /** Lines the cart page will list — books that still exist and are published. */
  count: number;
  /** Their ids, lower case, in the order they were added. */
  ids: readonly string[];
}

let snapshot: CartSnapshot | null = null;
let requested = 0; // the newest read that has been started
let applied = 0; // the newest read whose answer has been used
let inFlight = 0; // reads started and not yet finished
const listeners = new Set<() => void>();
let attached = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function same(a: CartSnapshot | null, b: CartSnapshot): boolean {
  return a !== null && a.count === b.count && a.ids.length === b.ids.length && a.ids.every((id, i) => id === b.ids[i]);
}

/** Pure: the body of `/api/cart/count`, made safe to trust. Exported for the unit test. */
export function parseCartSnapshot(data: unknown): CartSnapshot | null {
  if (!data || typeof data !== "object") return null;
  const { count, ids } = data as { count?: unknown; ids?: unknown };
  const list = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0) return null;
  return { count: Math.floor(count), ids: list };
}

/**
 * Ask the server what the cart holds and tell everyone. Resolves when the answer
 * has been applied (or the request failed — a failed read changes nothing, so a
 * flaky network cannot blank the badge).
 *
 * Reads can overlap; an older answer that arrives after a newer one is dropped.
 */
export async function syncCart(): Promise<void> {
  const mine = ++requested;
  inFlight++;
  try {
    const res = await fetch("/api/cart/count", { cache: "no-store" });
    if (!res.ok) return;
    const next = parseCartSnapshot(await res.json());
    if (!next || mine < applied) return;
    applied = mine;
    if (!same(snapshot, next)) {
      snapshot = next;
      emit();
    }
  } catch {
    // Keep what we had.
  } finally {
    inFlight--;
  }
}

/**
 * Call after ANY cart mutation. Re-reads the cart, waits for the answer, then
 * announces `cart-changed` on `window` for anything outside React that listens
 * (the on-device harness does). Our own listener ignores that announcement.
 */
export async function cartChanged(): Promise<void> {
  await syncCart();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT, { detail: { source: "cart-store" } }));
  }
}

const onExternalChange = (event: Event) => {
  if ((event as CustomEvent<{ source?: string }>).detail?.source === "cart-store") return;
  void syncCart();
};
const onPageShow = (event: PageTransitionEvent) => {
  if (event.persisted) void syncCart();
};
const onVisible = () => {
  if (document.visibilityState === "visible") void syncCart();
};

function attach(): void {
  attached = true;
  window.addEventListener(CART_CHANGED_EVENT, onExternalChange);
  window.addEventListener("pageshow", onPageShow);
  document.addEventListener("visibilitychange", onVisible);
}

function detach(): void {
  attached = false;
  window.removeEventListener(CART_CHANGED_EVENT, onExternalChange);
  window.removeEventListener("pageshow", onPageShow);
  document.removeEventListener("visibilitychange", onVisible);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!attached) attach();
  // A new subscriber re-reads, because the snapshot may be a page old — but a
  // page full of cards subscribes dozens of times in one tick, and one read
  // already on its way answers all of them.
  if (inFlight === 0) void syncCart();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) detach();
  };
}

/** Test seam: forget everything, as a fresh page load would. Not for application code. */
export function resetCartStoreForTests(): void {
  snapshot = null;
  requested = 0;
  applied = 0;
  inFlight = 0;
  listeners.clear();
  if (attached) detach();
}

const getSnapshot = (): CartSnapshot | null => snapshot;
const getServerSnapshot = (): CartSnapshot | null => null;

/** The whole snapshot, or null until the first answer arrives (and on the server). */
export function useCartSnapshot(): CartSnapshot | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The number of lines in the cart, or null while it is not yet known. */
export function useCartCount(): number | null {
  return useCartSnapshot()?.count ?? null;
}

/** Is this book in the cart? False while that is not yet known — never claims what it cannot know. */
export function useInCart(bookId: string): boolean {
  const snap = useCartSnapshot();
  return snap !== null && snap.ids.includes(bookId.toLowerCase());
}
