import Link from "next/link";
import { BookOpen, ShoppingCart } from "lucide-react";

/**
 * Empty cart focal card — the visual anchor of the page when the cookie
 * is empty.
 *
 * Per the brief: large glass panel, rounded ~32px, soft emerald edge
 * glow. Inside, a cart icon enclosed in a thin glassy circular ring
 * (with subtle emerald glow), a serif headline, muted body, and the
 * primary "Browse the catalog" CTA with book icon + arrow.
 *
 * Pure Server Component; the breathing glow on the ring uses the
 * existing `home-hero-pedestal` keyframe family for consistency.
 */
export function EmptyCartCard() {
  return (
    <div className="mx-auto mt-10 max-w-2xl px-6 sm:mt-12">
      <div className="home-glass relative overflow-hidden rounded-[32px] px-8 py-14 text-center sm:px-14 sm:py-16">
        {/* Top emerald edge line */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#33f0aa]/45 to-transparent"
        />

        {/* Card-internal radial bloom backdrop */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(22, 199, 132, 0.12) 0%, transparent 60%)",
          }}
        />

        {/* The cart icon ring — circular glass with subtle pulsing aura */}
        <div className="relative mx-auto h-[88px] w-[88px]">
          {/* Outer pulsing aura */}
          <div
            aria-hidden
            className="home-hero-aura absolute left-1/2 top-1/2 h-[140px] w-[140px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(51, 240, 170, 0.45) 0%, transparent 65%)",
            }}
          />
          {/* The thin glass ring */}
          <div
            className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full border border-emerald-bright/30 bg-white/[0.025] backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_24px_-6px_rgba(51,240,170,0.4)]"
          >
            <ShoppingCart
              aria-hidden
              className="h-9 w-9 text-emerald-bright"
              strokeWidth={1.4}
            />
          </div>
        </div>

        {/* Headline */}
        <h2 className="mt-9 font-serif text-[28px] font-medium leading-tight tracking-tight text-fg-hi sm:text-[32px]">
          Nothing in here yet.
        </h2>

        {/* Body */}
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-[1.65] text-fg-mid">
          Browse the catalog to add books. They stay in this browser&apos;s cart
          until you buy them or take them out.
        </p>

        {/* Primary CTA */}
        <div className="mt-9 flex justify-center">
          <Link
            href="/books"
            className="home-cta-primary group inline-flex h-12 items-center gap-2.5 rounded-full px-6 text-sm font-semibold tracking-tight"
          >
            <BookOpen aria-hidden className="h-4 w-4" />
            <span>Browse the catalog</span>
            <span
              aria-hidden
              className="inline-block transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
