"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The admin area's one navigation: six places, one bar.
 *
 * It replaces a row of three plain links on the old dashboard that did not
 * include itself or the catalogue, and five pages that each had to be reached
 * by already knowing their address. Current page is marked with `aria-current`,
 * not just colour; on a phone the bar scrolls sideways instead of wrapping into
 * a second and third row.
 */
export const ADMIN_TABS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/books", label: "Books" },
  { href: "/admin/email", label: "Email" },
  { href: "/admin/free-books", label: "Free books" },
  { href: "/admin/support", label: "Reader support" },
  { href: "/admin/data", label: "Site data" },
] as const;

/** Is this tab the current one? `/admin` matches only itself; the others match their sub-pages too. */
export function isActiveTab(pathname: string, tab: { href: string; exact?: boolean }): boolean {
  if (tab.exact) return pathname === tab.href || pathname === `${tab.href}/`;
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function AdminNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Admin sections" className="border-b border-white/[0.06]">
      <ul className="mx-auto flex max-w-[1320px] gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {ADMIN_TABS.map((tab) => {
          const active = isActiveTab(pathname, tab);
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/60 ${
                  active ? "bg-emerald-bright/15 text-emerald-bright" : "text-fg-mid hover:bg-white/[0.04] hover:text-fg-hi"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
