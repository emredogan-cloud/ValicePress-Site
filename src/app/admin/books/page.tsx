import type { Metadata } from "next";
import Link from "next/link";

import { AdminBlocked } from "@/components/admin/admin-blocked";
import { AdminPageHeader } from "@/components/admin/stat-card";
import { loadAdminContext } from "@/lib/admin/context";
import { readStat } from "@/lib/admin/stat";
import { listBooksReadOnly, type BookStatus } from "@/lib/db/queries/admin-overview";
import { formatCatalogPrice } from "@/lib/format";

/**
 * /admin/books — the catalogue as the database holds it, READ-ONLY.
 *
 * There is no form here and no "Edit" link, on purpose. This page used to carry
 * a create-book form and per-book edit / publish / hard-delete actions that
 * wrote catalogue rows straight into the database, which (a) bypassed the
 * catalogue tests and the KDP-Select rule that keep a book from being sold here
 * when it must not be, and (b) was overwritten, or contradicted, by the next
 * catalogue load. Books are data: they are changed in
 * `scripts/catalog/valice-catalog.mjs` and applied with the loader, which demotes
 * as well as promotes.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Books" };

const STATUS_TONE: Record<BookStatus, string> = {
  published: "border-emerald-bright/30 bg-emerald-bright/10 text-emerald-bright",
  draft: "border-white/[0.14] bg-white/[0.04] text-fg-mid",
  archived: "border-[#ffce63]/30 bg-[#ffce63]/10 text-[#ffce63]",
};

const EDITION_LABEL: Record<string, string> = { ebook: "Ebook", paperback: "Paperback", hardcover: "Hardcover", large_print: "Large print" };

export default async function AdminBooksPage() {
  const ctx = await loadAdminContext();
  if (!ctx.ok) return <AdminBlocked ctx={ctx} />;

  const stat = await readStat("books", listBooksReadOnly);

  return (
    <div>
      <AdminPageHeader title="Books">
        Read-only. Books are edited in <code className="text-fg-hi">scripts/catalog/valice-catalog.mjs</code> and applied with <code className="text-fg-hi">load-catalog.mjs</code>; nothing on this page changes the database.
      </AdminPageHeader>

      {stat.state !== "ok" ? (
        <p role="alert" data-state={stat.state} className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-sm text-fg-mid">
          {stat.state === "unavailable" ? stat.reason : stat.message}
        </p>
      ) : stat.value.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-sm text-fg-mid">There are no books in this database.</p>
      ) : (
        <>
          <p className="mt-8 text-[12.5px] text-fg-soft" data-books-count={stat.value.length}>
            {stat.value.length} title{stat.value.length === 1 ? "" : "s"} · {stat.value.filter((b) => b.status === "published").length} published
          </p>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[0.06]">
            <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
              <caption className="sr-only">Every book in the database</caption>
              <thead>
                <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-[0.14em] text-fg-fade">
                  <th scope="col" className="px-4 py-3 font-medium">Title</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Price here</th>
                  <th scope="col" className="px-4 py-3 font-medium">Sold here</th>
                  <th scope="col" className="px-4 py-3 font-medium">Editions</th>
                  <th scope="col" className="px-4 py-3 font-medium">Shelf order</th>
                  <th scope="col" className="px-4 py-3 font-medium">Published</th>
                </tr>
              </thead>
              <tbody>
                {stat.value.map((b) => (
                  <tr key={b.id} data-book={b.slug} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-3">
                      {b.status === "published" ? (
                        <Link prefetch={false} href={`/books/${b.slug}`} className="inline-block py-3 font-medium text-fg-hi underline-offset-2 hover:text-emerald-bright hover:underline">
                          {b.title}
                        </Link>
                      ) : (
                        <span className="font-medium text-fg-hi">{b.title}</span>
                      )}
                      <code className="mt-0.5 block font-mono text-[11px] text-fg-fade">{b.slug}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] ${STATUS_TONE[b.status]}`}>{b.status}</span>
                    </td>
                    {/* "Not sold here", never "$0.00": a price of zero means this site does not sell it. */}
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-fg-mid">{formatCatalogPrice(b.priceCents, b.currency)}</td>
                    <td className="px-4 py-3 text-fg-mid">{b.buyableHere && b.priceCents > 0 ? "Yes" : "No"}</td>
                    <td className="px-4 py-3 text-fg-mid">{b.editions.length ? b.editions.map((e) => EDITION_LABEL[e] ?? e).join(", ") : "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-fg-mid">{b.pinRank === null ? "—" : `#${b.pinRank + 1}`}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-fg-mid">{b.publishedAt ? b.publishedAt.toISOString().slice(0, 10) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
