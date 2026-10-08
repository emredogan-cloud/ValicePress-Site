"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { Search, ShoppingCart, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { useCartCount } from "@/components/cart/cart-store";
import { MobileNav } from "@/components/home/mobile-nav";

/**
 * Dark sticky header — shared by every cinematic-scoped route
 * (currently `/` and `/books`; available to any future page that
 * wraps itself in `.cinematic-root`).
 *
 * The root layout mounts no header of its own (a warm-theme `<SiteHeader>`
 * used to sit there, hidden by CSS on every route; it was removed) — every
 * route renders this one.
 *
 * Client Component because:
 *   - `⌘K` / `Ctrl-K` global keyboard shortcut routes to `/search`
 *   - The search-pill / cart / avatar all need to feel reactive at
 *     hover-time; doing the hover with CSS is fine but ergonomic to
 *     keep the whole thing in one Client component.
 *
 * `active` prop drives the underline + micro emerald glow under the
 * current section's nav link. Pass it from each page that mounts the
 * header.
 *
 * Phase 0.F — the avatar slot now hosts Clerk's `<UserButton>` (signed
 * in: real avatar + sign-out menu) / `<SignInButton>` (signed out:
 * pill). When the Clerk publishable key is missing (local dev before
 * `vercel env pull`), the slot falls back to the legacy avatar link so
 * the cinematic shell still renders on unprovisioned environments.
 */

// Inlined at build time. Used to short-circuit Clerk hook usage when no
// provider is mounted (see `<AccountSlot>` below).
const CLERK_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);
export type ActiveNavSection =
  | "home"
  | "books"
  | "ebooks"
  | "authors"
  | "genres"
  | "blog"
  | "library"
  | "search"
  | "about";

type NavItem = {
  key: ActiveNavSection;
  label: string;
  href: string;
  /**
   * `false` for a link whose target is behind sign-in. Next prefetches every
   * visible link in production; for a signed-out visitor that prefetch is
   * redirected by Clerk to `accounts.valicepress.com`, a different origin, and
   * the browser blocks it as a CORS failure — a console error on every page of
   * the site. There is nothing worth prefetching behind a login wall.
   */
  prefetch?: false;
};

const NAV_ITEMS: NavItem[] = [
  { key: "books", label: "All books", href: "/books" },
  // Ebooks get their own destination rather than living as a filter on
  // /books. They are the only format sold on this site — everything else
  // links out to Amazon — so the one thing a reader can actually buy here
  // should not be something they have to filter for.
  { key: "ebooks", label: "Ebooks", href: "/ebooks" },
  // `/authors` is the cinematic discovery page (SUB-PR — authors redesign).
  // Previously fell through to /books because no index existed.
  { key: "authors", label: "Authors", href: "/authors" },
  // Was `/genres`, a page of eight hard-coded genres with invented book
  // counts. Removed; `/categories` is the real, database-backed shelf list.
  // Previously fell through to /books because no index existed.
  { key: "genres", label: "Categories", href: "/categories" },
  { key: "blog", label: "Blog", href: "/blog" },
  // `/account/library` is the cinematic personal library (SUB-PR — library
  // redesign). Auth-gated server-side; the link itself is always visible.
  { key: "library", label: "Library", href: "/account/library", prefetch: false },
];

/**
 * The desktop row: the shelves, then About. About used to be a separate <Link> with
 * its own (unstyled) markup, which is why it rendered at 16px in sentence case beside
 * links at 10.5px in tracked capitals. One list, one markup, one style.
 */
const DESKTOP_NAV_ITEMS: NavItem[] = [
  ...NAV_ITEMS,
  // Phase 1.B — was `<a href="#about">` (an anchor hack to the footer's id="about";
  // only worked on the homepage). Points at the real /about page.
  { key: "about", label: "About", href: "/about" },
];

/** What the drawer offers: the same list, with Search in front. */
const MOBILE_NAV_ITEMS: NavItem[] = [
  // Search first: below 340px the header has no room for the search icon, and
  // the drawer is where a reader looks for anything that is not on screen.
  { key: "search", label: "Search", href: "/search" },
  ...DESKTOP_NAV_ITEMS,
];

export function CinematicHeader({
  active,
  overlay = false,
}: {
  active?: ActiveNavSection;
  /** Float transparently over a full-bleed hero. Homepage only. */
  overlay?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const cmdK = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k";
      if (cmdK) {
        e.preventDefault();
        router.push("/search");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <header
      /**
       * `overlay` is opt-in and only the homepage passes it.
       *
       * This header is site-wide chrome for every `.cinematic-root` route —
       * books, ebooks, categories, authors, admin. Making it transparent
       * everywhere would put the shelves' own content behind a floating bar
       * with nothing under it. The homepage is the only page with a full-bleed
       * photograph for it to float over.
       */
      className={
        overlay
          ? "absolute inset-x-0 top-0 z-50"
          : "sticky top-0 z-50 border-b border-white/[0.06] bg-[#07110b]/80 backdrop-blur-xl"
      }
    >
      {/* Phase 2 — safe-area gutters. `viewport-fit=cover` makes the insets
          live; max() keeps the existing 1.5rem where there is no cutout, so
          this is a no-op on desktop and on phones without one. Landscape on a
          notched device is where it earns its keep. */}
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:gap-6 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
        {/* Logo */}
        <Link
          href="/"
          /* min-h-11 gives the wordmark a 44px hit area inside the 64px
             header. It is the "go home" control, and at 23px tall it was the
             last sub-44px target left in the header. The header is a centred
             flex row, so nothing moves.

             THE BRAND IS COMPACT BELOW 430px — a 36px tile, a 15px wordmark, no
             dot. Measured: the full brand is 163px wide, and beside four 44px
             controls a 360px screen has room for 132 of them; at 393px (the
             Redmi) the hamburger ended 3px from the screen edge. Compact it is
             131px, and the right-hand gutter is back to 16px. */
          className="group flex min-h-11 shrink-0 items-center gap-2 text-[15px] font-medium tracking-tight text-fg-hi min-[430px]:gap-2.5 sm:min-h-0"
        >
          {/* The mark from the supplied logo, on its own cream tile (the artwork's
              ground — it is dark green and would vanish on this header). */}
          <BrandMark size={40} priority className="!h-9 !w-9 min-[430px]:!h-10 min-[430px]:!w-10" />
          <span className="flex flex-col justify-center">
            <span className="flex items-center gap-2">
              <span className="font-serif text-[15px] min-[430px]:text-[17px] sm:text-[18px]">Valice Press</span>
              <span
                aria-hidden
                className="hidden h-1.5 w-1.5 rounded-full bg-[#33f0aa] shadow-[0_0_8px_#33f0aa] transition-shadow group-hover:shadow-[0_0_14px_#33f0aa] min-[430px]:block"
              />
            </span>
            {/* The imprint line. Desktop only — at 8px it is a texture, and on a
                phone it is two more lines of noise beside a hamburger. */}
            <span
              aria-hidden
              className="mt-0.5 hidden text-[7.5px] font-medium uppercase leading-[1.5] tracking-[0.24em] text-fg-soft lg:block"
            >
              Independent Ideas
              <br />
              A Longer Tomorrow
            </span>
          </span>
        </Link>

        {/* Center nav — hidden below xl.
            PHASE 9, P2-5: this was `md:flex`, and the 768-1023px band had
            never been measured. It does not fit there. Measured on the Redmi
            at an emulated 768px: wordmark + seven nav links + the 256px search
            pill + cart + account need 987px, so the document went 219px wider
            than the viewport and the browser shrank the whole page to
            compensate — on all 32 routes, since this is site-wide chrome.
            That left 1024px as the first width where the row fitted — with 37px
            to spare. The logo tile (44px + its gap) took those 37px and then
            some: at 1024px the row was 159px wider than the screen. 1280px is
            the first width where it fits again, so that is where the row
            appears; between 640 and 1279px the drawer is the navigation, with
            search, cart and account still beside it.

            AND THE ROW HAS TO FIT WITH THE WIDEST ACCOUNT CONTROL, which is the
            99px "Sign in" pill a signed-out visitor gets — not the 36px circle
            the control is while Clerk loads (and permanently, in a sandbox with
            no Clerk). It did not: with the tile and the old spacing the header
            was 18px wider than a 1280px screen. `ml-8` -> `ml-6`, `gap-7` ->
            `gap-6`, a 40px tile and an 18px wordmark take back 44px. The loading
            placeholder now reserves the pill's width, so everything that measures
            this header measures the widest state. */}
        <nav
          aria-label="Primary"
          className="ml-6 hidden items-center gap-6 xl:flex"
        >
          {DESKTOP_NAV_ITEMS.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                prefetch={item.prefetch}
                // Phase 3.M — aria-current announces the active page to
                // assistive tech (the underline is purely visual).
                aria-current={isActive ? "page" : undefined}
                /* Uppercase with wide tracking, per the reference. The labels
                   themselves are unchanged — this is letter-spacing, not new
                   wording, so nothing about the information architecture moves. */
                className={`relative whitespace-nowrap text-[10.5px] font-medium uppercase tracking-[0.14em] transition-colors xl:text-[11px] ${
                  isActive ? "text-fg-hi" : "text-fg-mid hover:text-fg-hi"
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute -bottom-[22px] left-0 right-0 h-[2px] rounded-full bg-[#33f0aa] shadow-[0_0_10px_#33f0aa]"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right cluster */}
        {/* MEASURED, not guessed: at 390px this cluster was 252px wide and the
            hamburger ended at x=413 (23px off-screen; 93px at 320px), on every
            route, because the chrome is shared. It needs, at 44px per target:
            4 controls + 3 gaps. The gap tightens below 380px, the account
            control is icon-only below `sm`, and the search icon yields below
            340px (the drawer has a Search entry). */}
        <div className="ml-auto flex items-center gap-1 min-[380px]:gap-2 sm:gap-3">
          {/* Search pill — from 768px. Between 640 and 767 the 256px pill plus the
              99px Sign-in pill does not fit (53px over at 640), so those widths get
              the icon below, as phones do. */}
          <Link
            href="/search"
            className="group hidden h-9 w-64 items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 text-sm text-fg-soft transition-colors hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-fg-hi md:flex"
          >
            <Search aria-hidden className="h-4 w-4" />
            <span className="flex-1 text-left">Search books, authors…</span>
            <kbd className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[12px] lg:text-[10px] text-fg-mid">
              ⌘K
            </kbd>
          </Link>

          {/* Search icon (compact: phones and tablets). It yields below 370px, where four
              controls and the brand do not fit; the drawer has a Search entry. */}
          <Link
            href="/search"
            aria-label="Search"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-fg-mid transition-colors hover:text-fg-hi max-[369px]:hidden md:hidden"
          >
            <Search aria-hidden className="h-4 w-4" />
          </Link>

          {/* Cart — badge dot is state-driven (Phase 1.H). Was always-on
              before; now read from the shared cart store, which re-reads the
              server after every change RecommendationCard, CartLine and
              AddToCart make. */}
          <CartTriggerWithBadge />

          {/* Account slot — Clerk-aware. Renders sign-in pill when signed
              out, UserButton (real avatar + menu + sign-out) when signed
              in, and falls back to the legacy avatar link when no Clerk
              provider is mounted (e.g. unprovisioned local dev). */}
          <AccountSlot />

          {/* The drawer: the navigation below 1280px. `xl:hidden` inside the
              component, so the desktop cluster is unchanged. */}
          <MobileNav items={MOBILE_NAV_ITEMS} active={active} />
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cart trigger with state-driven badge (Phase 1.H).
//
// Replaces the previous always-on dot. The dot now reflects whether the
// cart has any items, read from the shared cart store (`cart-store.ts`), which
// asks `/api/cart/count` on load and again after every cart change. A failed
// read keeps the last known value; before the first answer there is no dot.
// ─────────────────────────────────────────────────────────────────────────

function CartTriggerWithBadge() {
  const count = useCartCount();

  const hasItems = count !== null && count > 0;

  return (
    <Link
      href="/cart"
      aria-label={
        count === null
          ? "Cart"
          : count === 0
            ? "Cart, empty"
            : `Cart, ${count} ${count === 1 ? "item" : "items"}`
      }
      className="relative flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-fg-mid transition-colors hover:text-fg-hi"
    >
      <ShoppingCart aria-hidden className="h-4 w-4" />
      {hasItems && (
        // The number, not just a dot: a dot says "something", and the reader
        // has just pressed "+" to find out whether it said "one more". The
        // aria-label on the link already carries the count for screen readers.
        <span
          aria-hidden
          data-cart-badge={count}
          className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#33f0aa] px-1 text-[11px] font-bold leading-none text-[#032015] shadow-[0_0_8px_rgba(51,240,170,0.7)]"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Account slot — encapsulates the Clerk vs unprovisioned-fallback branch.
//
// Rules-of-hooks safety: each leaf component consistently calls (or does
// not call) `useAuth`. The outer `<AccountSlot>` picks the leaf without
// ever conditionally toggling a hook itself.
// ─────────────────────────────────────────────────────────────────────────

function AccountSlot() {
  if (!CLERK_CONFIGURED) return <LegacyAccountFallback />;
  return <ClerkAccountSlot />;
}

/** Legacy avatar link — used when Clerk isn't configured. Keeps the
 * cinematic shell renderable on unprovisioned environments. */
function LegacyAccountFallback() {
  return (
    <Link
      href="/account/library"
      prefetch={false}
      aria-label="Account"
      className="flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#1ddf8f] to-[#0e7f54] text-[#032015] transition-transform hover:scale-105"
    >
      <User aria-hidden className="h-4 w-4" />
    </Link>
  );
}

/** Cinematic-themed UserButton appearance. Tuned to read against the
 * dark sticky header without dragging in `@clerk/themes`. */
const USER_BUTTON_APPEARANCE = {
  variables: {
    colorPrimary: "#1ddf8f",
    colorBackground: "#0c1813",
    colorText: "#e6e6e0",
    colorTextSecondary: "#a7a7a0",
    colorInputBackground: "rgba(255, 255, 255, 0.03)",
    colorInputText: "#e6e6e0",
    borderRadius: "0.75rem",
  },
  elements: {
    avatarBox:
      "h-11 w-11 sm:h-9 sm:w-9 ring-1 ring-white/[0.08] shadow-[0_0_0_1px_rgba(51,240,170,0.15)]",
    userButtonPopoverCard:
      "bg-[#0c1813] border border-white/[0.08] shadow-[0_28px_60px_-22px_rgba(0,0,0,0.8)]",
    userButtonPopoverActionButton:
      "text-fg-mid hover:text-fg-hi hover:bg-white/[0.04]",
    userButtonPopoverActionButtonText: "text-fg-hi",
    userButtonPopoverFooter: "hidden",
  },
} as const;

function ClerkAccountSlot() {
  const { isLoaded, isSignedIn } = useAuth();

  // First paint while Clerk is hydrating — show a calm neutral placeholder
  // (NOT the emerald gradient avatar, which would flash and then morph
  // into a different shape once isSignedIn resolves).
  //
  // It is 99px wide from `sm`, the width of the "Sign in" pill a signed-out visitor
  // is about to get (measured). At 36px the cluster jumped 63px to the left when
  // Clerk loaded — a layout shift on every page — and, worse, every measurement of
  // this header in a sandbox without Clerk was of a header 63px narrower than the
  // one people use.
  if (!isLoaded) {
    return (
      <div
        aria-hidden
        className="h-11 w-11 rounded-full border border-white/[0.08] bg-white/[0.03] sm:h-9 sm:w-[99px]"
      />
    );
  }

  if (isSignedIn) {
    // After-sign-out redirect is configured at the <ClerkProvider> level
    // (defaults to "/"); not a UserButton prop in Clerk v7+.
    return <UserButton appearance={USER_BUTTON_APPEARANCE} />;
  }

  // Signed-out: small cinematic "Sign in" pill that triggers the modal.
  return (
    <SignInButton mode="modal">
      <button
        type="button"
        aria-label="Sign in"
        className="inline-flex h-11 w-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/[0.1] bg-white/[0.03] text-sm text-fg-hi transition-colors hover:border-emerald-bright/40 hover:bg-emerald-bright/10 sm:h-9 sm:w-auto sm:px-4"
      >
        <User aria-hidden className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        {/* Icon-only on a phone (the label wrapped onto two lines at 390px and
            pushed the hamburger off-screen); the words return from `sm`. */}
        <span className="hidden sm:inline">Sign in</span>
      </button>
    </SignInButton>
  );
}
