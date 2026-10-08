"use client";

import Link from "next/link";

import { useCartCount } from "@/components/cart/cart-store";

/**
 * Cart count badge for the legacy global header (hidden by CSS today; Phase 12
 * removes the component).
 *
 * The count is not fetched here any more. Two headers are mounted on every page
 * — this one and the visible `CinematicHeader` — and each used to run its own
 * `/api/cart/count` fetch and its own `cart-changed` listener, so a change was
 * read twice and a slow older answer could overwrite a newer one. Both now read
 * the one store in `cart-store.ts`, which reads the server once per change.
 */
export function CartIndicator() {
  const count = useCartCount();

  return (
    <Link
      href="/cart"
      className="relative inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      aria-label={
        count !== null && count > 0
          ? `Cart — ${count} item${count === 1 ? "" : "s"}`
          : "Cart"
      }
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      <span className="hidden sm:inline">Cart</span>
      {count !== null && count > 0 && (
        <span className="ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[12px] lg:text-[10px] font-semibold leading-none text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}
