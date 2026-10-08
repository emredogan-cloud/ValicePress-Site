import Link from "next/link";
import { Moon } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { SocialLinks } from "@/components/brand/social-links";
import { PUBLIC_EMAIL } from "@/lib/contact";

/**
 * Minimal cinematic footer.
 *
 * The press's mark, its four networks (X, Instagram, Facebook, TikTok — read from
 * `@/lib/social`, the one place those addresses are written, and drawn by
 * `<SocialLinks />` with the shared `@/components/brand-icons` SVGs), and the nav.
 *
 * 4-column nav + social icons + dark-mode indicator chip.
 * Pure Server Component, no JS.
 */
export function HomeFooter() {
  /*
   * Phase 0.E — column structure realigned to the audit:
   *
   *   • Shop:    All Books + Bestsellers / New Releases (query-param
   *              variants of /books — the catalog already sorts by these
   *              keys client-side; URL sync lands in Phase 2.F) +
   *              Categories (index page lands in Phase 2.D — until then
   *              this is a known soft-404).
   *   • Discover: unchanged (all three already work).
   *   • Support:  + Contact (mailto) — closes the "where do I report a
   *              problem?" gap the audit flagged in §5.3.
   *   • Legal:   + KVKK for TR compliance. URLs stay "#" until the four
   *              real pages ship in Phase 1.A — the structure itself is
   *              now production-ready.
   */
  const columns = [
    {
      title: "Shop",
      links: [
        { label: "All Books", href: "/books" },
        { label: "Ebooks", href: "/ebooks" },
        { label: "New Releases", href: "/books?sort=newest" },
        { label: "Categories", href: "/categories" },
      ],
    },
    {
      title: "Discover",
      links: [
        { label: "About", href: "/about" },
        { label: "Authors", href: "/authors" },
        { label: "Bonus Scenes", href: "/bonus" },
        { label: "Blog", href: "/blog" },
        { label: "Reading Guides", href: "/blog/category/reading-guides" },
        { label: "Behind the Scenes", href: "/blog/category/behind-the-scenes" },
      ],
    },
    {
      title: "Support",
      links: [
        { label: "Library", href: "/account/library" },
        { label: "Orders", href: "/account/orders" },
        { label: "Settings", href: "/account/settings" },
        { label: "Contact", href: `mailto:${PUBLIC_EMAIL}` },
      ],
    },
    {
      title: "Legal",
      links: [
        // Phase 1.A — all four legal pages now ship with real content.
        // Phase 1.G wires the footer to point at them.
        { label: "Terms", href: "/terms" },
        { label: "Privacy", href: "/privacy" },
        { label: "Refund Policy", href: "/refund" },
        { label: "KVKK", href: "/kvkk" },
      ],
    },
  ];

  return (
    <footer id="about" className="relative border-t border-white/[0.06] px-6 py-10 sm:py-16">
      <div className="mx-auto max-w-7xl">
        {/* Below `sm:` the four link columns sit 2-up rather than stacking.
            Five blocks in a single column with 48px gaps made the footer 1086px
            — 1.5 screens on the Redmi — for content that fits in half that.
            The brand column spans both cells so its paragraph keeps its measure.
            `sm:` and `lg:` are restated at their existing values, so the 640px+
            and desktop compositions are byte-for-byte what they were. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-2 sm:gap-12 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center gap-3 text-base font-medium text-fg-hi"
            >
              <BrandMark size={44} />
              <span className="font-serif">Valice Press</span>
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-[#33f0aa] shadow-[0_0_8px_#33f0aa]"
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-fg-soft">
              An independent press: romance, world folklore, games and puzzles.
              Print and Kindle editions are on Amazon; many titles are also here
              as DRM-free PDFs — yours to keep.
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-mid">
                {col.title}
              </h3>
              <ul className="mt-5 space-y-3 text-sm">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      // `/account/*` is behind sign-in. Prefetching it as a
                      // signed-out visitor follows Clerk's redirect to another
                      // origin and fails as a CORS error on every page that has
                      // this footer. There is nothing to prefetch behind a login.
                      prefetch={link.href.startsWith("/account") ? false : undefined}
                      className="text-fg-soft transition-colors hover:text-fg-hi"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar — copyright, social, theme indicator */}
        <div className="mt-10 sm:mt-16 flex flex-col-reverse items-start justify-between gap-6 border-t border-white/[0.06] pt-8 sm:flex-row sm:items-center">
          {/* Left: copyright + social */}
          <div className="flex items-center gap-5">
            <p className="text-xs text-fg-fade">
              © {new Date().getFullYear()} Valice Press. All rights reserved.
            </p>
            <SocialLinks className="-ml-2" />
          </div>

          {/* Phase 3.L — was a pill-chromed div that looked clickable but
              wasn't. The cinematic site is intentionally single-themed
              (no light-mode toggle planned), so the chip's affordance
              was misleading. Reduced to a plain inline note: same icon,
              same tone, no fake button chrome. */}
          <span className="inline-flex items-center gap-1.5 text-[12px] lg:text-[11px] uppercase tracking-[0.12em] text-fg-fade">
            <Moon aria-hidden className="h-3 w-3 text-emerald-bright" />
            Dark theme
          </span>
        </div>
      </div>
    </footer>
  );
}
