import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import { AnalyticsGate } from "@/components/analytics/analytics-gate";
import { AssistantLauncher } from "@/components/assistant/assistant-launcher";
import { CampaignRibbon } from "@/components/campaign/campaign-ribbon";
import { WelcomePromoCard } from "@/components/campaign/welcome-promo-card";
import { NewsletterPopup } from "@/components/newsletter/newsletter-popup";
import { SiteHeader } from "@/components/site-header";
import { getSiteUrl } from "@/lib/site-url";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif display face for headings — typography-forward, calm-literary (Roadmap §7)
const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

// `metadataBase` absolutizes every relative URL emitted by per-page
// `generateMetadata` (canonicals, OG images, Twitter images, …). The origin
// comes from the single, validated, empty-safe resolver in `@/lib/site-url`
// (WS-A) — no ad-hoc `??`/`||` here, so an empty env can never `new URL("")`.
/**
 * Viewport + browser-chrome integration (Phase 2).
 *
 * Next's default is `width=device-width, initial-scale=1` and nothing else,
 * which left three things wrong on a phone, all measured on the Redmi:
 *
 *   - `env(safe-area-inset-*)` resolved to 0px everywhere, because the insets
 *     are inert without `viewport-fit=cover`. Any notch or gesture-bar padding
 *     was therefore a no-op.
 *   - No `theme-color`, so Chrome's address bar stayed light above a near-black
 *     page.
 *   - See globals.css for the third (`color-scheme`) and for the document
 *     background that fixes white overscroll.
 *
 * `#050705` is `--home-bg`, the cinematic ground the whole site sits on. Every
 * route renders inside `.cinematic-root`, so there is no light variant to
 * switch between and a single value is correct.
 *
 * `maximumScale` and `userScalable` are deliberately NOT set. Suppressing
 * pinch-zoom fails WCAG 2.2 SC 1.4.4; one of the reference sites surveyed for
 * this roadmap ships `maximum-scale=1` and it is the one thing from it we
 * explicitly do not copy.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050705",
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  // Google Search Console verification (WS-D). Set `GSC_VERIFICATION` in the
  // Vercel env to the token from GSC's "HTML tag" method; when unset, Next
  // omits the meta tag. The sitemap is already auto-discovered via robots.txt.
  ...(process.env.GSC_VERIFICATION
    ? { verification: { google: process.env.GSC_VERIFICATION } }
    : {}),
  title: {
    default: "Valice Press",
    template: "%s · Valice Press",
  },
  description:
    "Buy a digital book once, download a watermarked PDF, and read it online. Yours to keep — never locked.",
  // Per-page metadata extends these defaults via the App Router merge.
  openGraph: {
    siteName: "Valice Press",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /*
   * ROOT-LAYOUT RESILIENCE — why this conditional exists.
   *
   * `<ClerkProvider>` throws a HARD error during render when
   * `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is missing. Because it sits in the
   * root layout, that throw propagates as a 500 on **every** route —
   * including the public static pages like `/` that don't even need Clerk.
   *
   * On a freshly-deployed Vercel environment where the env hasn't been
   * pulled yet, that's a fully-broken site. The fix: only mount the
   * provider when the publishable key is actually present. When it isn't,
   * public pages render normally with their graceful empty states, and
   * auth-gated routes (`/admin`, future `/account`, `/read`) still surface
   * the `UnprovisionedNotice` they already render at the page level.
   *
   * In production with a real deploy, the key is set; this branch is a
   * no-op and `<ClerkProvider>` mounts exactly as before.
   *
   * `NEXT_PUBLIC_*` vars are inlined at build time on the client and
   * available via `process.env` on the server, so the conditional resolves
   * to the same value on both sides — no hydration mismatch.
   */
  const tree = (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/*
          Skip link — WCAG 2.2 SC 2.4.1 Bypass Blocks. First focusable element
          on every page, off-screen until focused. Every route's <main> carries
          id="main-content". `sr-only` keeps it out of the visual design;
          `focus:not-sr-only` brings it back for keyboard users only.
        */}
        <a
          href="#main-content"
          /* Padding is applied only on focus. With `px-5 py-3` in the base
             class, `sr-only` still produced a 41x25 clipped box instead of the
             1x1 it is meant to be — invisible, but a real element in every
             layout snapshot. Focus-only padding keeps it a true zero-footprint
             control until a keyboard user reaches it. */
          className="sr-only z-[100] rounded-full border border-emerald-bright/40 bg-[#0a1410] text-sm font-medium text-fg-hi focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:px-5 focus:py-3"
        >
          Skip to content
        </a>
        {/* Reveal-on-scroll hides its blocks until an IntersectionObserver
            promotes them. If JavaScript never arrives, nothing would ever be
            promoted — so without JS, show everything. */}
        <noscript>
          <style>{`[data-reveal],[data-reveal-stagger]>*{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <SiteHeader />
        {children}
        {/* The small campaign indicator. Mounted once; it decides which
            routes it belongs on and removes itself when the promotion is
            over. See <CampaignRibbon>. */}
        <CampaignRibbon />
        {/* Shown once per campaign, to a first-time visitor only, and it
            retires itself after a few seconds. See <WelcomePromoCard>. */}
        <WelcomePromoCard />
        {/* The storefront concierge. Ships a button; the panel's chunk is
            fetched on the first click. See <AssistantLauncher>. */}
        <AssistantLauncher />
        {/* The newsletter invitation. Mounted once at the root so its
            once-per-person state is genuinely site-wide rather than
            per-route; it decides for itself where it belongs, whether this
            visitor has met it, and when. See <NewsletterPopup>. */}
        <NewsletterPopup />
        {/*
          Vercel Analytics + Speed Insights, behind the `beforeSend` filter
          (see components/analytics/analytics-gate.tsx): a browser marked
          internal on /account/settings sends no beacon. Outside a Vercel
          deployment both no-op. Placed AFTER {children} so they render in
          both root-layout branches (conditional ClerkProvider below).
        */}
        <AnalyticsGate />
      </body>
    </html>
  );

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return tree;

  return (
    <ClerkProvider publishableKey={publishableKey}>{tree}</ClerkProvider>
  );
}
