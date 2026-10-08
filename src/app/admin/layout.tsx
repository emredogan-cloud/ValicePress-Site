import type { Metadata } from "next";
import Link from "next/link";

import { AdminBlocked } from "@/components/admin/admin-blocked";
import { AdminNav } from "@/components/admin/admin-nav";
import { BrandMark } from "@/components/brand/brand-mark";
import { loadAdminContext } from "@/lib/admin/context";

/**
 * The admin area: ONE shell, six places.
 *
 * Before this there was no layout. Five pages each rebuilt their own gate (two
 * with their own copy of the error mapper), their own header and footer — the
 * public site's, with its shop navigation and newsletter — and reached each
 * other only through three links on the dashboard. Now the shell is here, once:
 * a plain bar, the navigation, and `<main>`.
 *
 * THE GATE IS NOT ONLY HERE. This layout decides what to DRAW for someone who
 * is not an administrator — a calm notice instead of the page — but a layout is
 * not a security boundary (on a client-side navigation between tabs it is not
 * re-run, and a page's own data fetching does not wait for it). Access is
 * enforced where the data is: the proxy gates every `/admin` request, every page
 * resolves the same context before it renders, and every query, server action
 * and route handler under here calls `requireAdmin()` first. The layout is the
 * polite layer, not the locked door.
 *
 * Never indexed, never cached: it reads the session and live rows.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await loadAdminContext();

  return (
    <div className="cinematic-root min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-emerald-bright focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#032015]"
      >
        Skip to content
      </a>

      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/admin" prefetch={false} className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/60">
            <BrandMark size={32} priority />
            <span className="hidden font-serif text-[17px] text-fg-hi sm:inline">Valice Press</span>
            <span className="rounded-full border border-emerald-bright/30 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-bright">Admin</span>
          </Link>
          <div className="flex items-center gap-4 text-[13px]">
            {ctx.ok && <span className="hidden text-fg-soft sm:inline">Signed in as <span className="text-fg-hi">{ctx.email}</span></span>}
            <Link prefetch={false} href="/" className="inline-flex min-h-11 items-center text-fg-mid underline-offset-4 hover:text-fg-hi hover:underline">
              View site →
            </Link>
          </div>
        </div>
      </header>

      {ctx.ok && <AdminNav />}

      <main id="main-content" className="relative z-10 mx-auto max-w-[1320px] px-4 py-10 sm:px-6 sm:py-12">
        {ctx.ok ? children : <AdminBlocked ctx={ctx} />}
      </main>
    </div>
  );
}
