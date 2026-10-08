import type { Metadata } from "next";
import Link from "next/link";

import { AdminBlocked } from "@/components/admin/admin-blocked";
import { AdminPageHeader, AdminSection, StatCard } from "@/components/admin/stat-card";
import { loadAdminContext } from "@/lib/admin/context";
import { readStat, unavailable, type Stat } from "@/lib/admin/stat";
import {
  getAccountCount,
  getCatalogueOverview,
  getDownloadCount,
  getEventOverview,
  getFeaturedBooks,
  getLatestSignups,
  getPopupOverview,
  getRecentOrders,
  getSalesOverview,
  type OrderStatus,
  type RecentOrder,
} from "@/lib/db/queries/admin-overview";
import { getContactSummary } from "@/lib/db/queries/contacts-admin";
import { getFreeBookRequestCounts } from "@/lib/db/queries/free-books";
import { formatPrice } from "@/lib/format";

/**
 * /admin — what the press can say it knows, and plainly what it cannot.
 *
 * REAL DATA ONLY. Every figure is read from a table this site writes, and each is
 * read on its own (`readStat`): a failed read is an error card, a missing table
 * is an "unavailable" card, and a zero is a zero. The dashboard this replaces
 * turned an outage into "0 orders · 0 users". Where there is no source at all —
 * Amazon and KDP sales, page views — the card says so in words instead of
 * showing a number.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Overview" };

const NO_SALES_SOURCE = "Sales data unavailable — no connected sales source";
const NO_PAGEVIEW_SOURCE = "Page views are not recorded in this database — Vercel Analytics is not connected to this dashboard.";

const n = (v: number) => v.toLocaleString("en-US");

export default async function AdminOverviewPage() {
  const ctx = await loadAdminContext();
  if (!ctx.ok) return <AdminBlocked ctx={ctx} />;

  const [catalogue, featured, contacts, signups, freeBooks, sales, orders, accounts, events, downloads, popup] = await Promise.all([
    readStat("catalogue", getCatalogueOverview),
    readStat("featured", getFeaturedBooks),
    readStat("contacts", getContactSummary),
    readStat("signups", () => getLatestSignups(5)),
    readStat("free-books", getFreeBookRequestCounts),
    readStat("sales", getSalesOverview),
    readStat("orders", () => getRecentOrders(8)),
    readStat("accounts", getAccountCount),
    readStat("events", () => getEventOverview(7)),
    readStat("downloads", () => getDownloadCount(30)),
    readStat("popup", getPopupOverview),
  ]);

  return (
    <div>
      <AdminPageHeader title="Overview">
        Everything here is read from this site’s own database, one figure at a time. A figure that could not be read says so; a source that does not exist says that.
      </AdminPageHeader>

      {/* ------------------------------------------------------------ catalogue */}
      <AdminSection
        id="catalogue-heading"
        title="Catalogue"
        note={
          <>
            Counts what the database holds. Books are edited in <code className="text-fg-hi">scripts/catalog/valice-catalog.mjs</code> and loaded with the catalogue loader — never here.{" "}
            <Link prefetch={false} href="/admin/books" className="text-emerald-bright underline-offset-2 hover:underline">
              See every title
            </Link>
            .
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Published titles" stat={catalogue} value={(c) => n(c.published)} sub={(c) => `${n(c.drafts)} draft${c.drafts === 1 ? "" : "s"}`} />
          <StatCard label="Sold on this site" stat={catalogue} value={(c) => n(c.directSale)} sub={() => "priced and wired to checkout"} accent />
          <StatCard label="Ebook titles" stat={catalogue} value={(c) => n(c.editions.ebook)} />
          <StatCard label="Paperback titles" stat={catalogue} value={(c) => n(c.editions.paperback)} />
          <StatCard label="Hardcover titles" stat={catalogue} value={(c) => n(c.editions.hardcover)} />
          <StatCard label="Large-print titles" stat={catalogue} value={(c) => n(c.editions.large_print)} />
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5" data-stat="Featured books" data-state={featured.state}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">Featured on every shelf, in order</h3>
          {featured.state === "ok" ? (
            <ol className="mt-3 space-y-1.5 text-[14px]">
              {featured.value.map((f, i) => (
                <li key={f.slug} className="flex flex-wrap items-baseline gap-x-3">
                  <span className="w-5 text-fg-fade tabular-nums">{i + 1}</span>
                  <span className={f.title ? "text-fg-hi" : "text-fg-soft"}>{f.title ?? f.slug}</span>
                  {f.status !== "published" && (
                    <span className="rounded-full border border-white/[0.12] px-2 py-px text-[10.5px] uppercase tracking-[0.12em] text-fg-soft">
                      {f.status === null ? "not in the database" : `${f.status} — not on any shelf`}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-[13px] text-fg-soft">{featured.state === "unavailable" ? featured.reason : featured.message}</p>
          )}
          <p className="mt-4 text-[11.5px] text-fg-fade">
            Set in <code>src/lib/pinned-books.ts</code>. A pinned book that is still a draft waits at its place until it is published.
          </p>
        </div>
      </AdminSection>

      {/* ---------------------------------------------------------------- email */}
      <AdminSection
        id="email-heading"
        title="Email"
        note={
          <>
            The contact book: the newsletter, free-book requests and customers.{" "}
            <Link prefetch={false} href="/admin/email" className="text-emerald-bright underline-offset-2 hover:underline">
              Manage it
            </Link>
            .
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Mailable subscribers"
            stat={contacts}
            value={(c) => n(c.mailable)}
            accent
            hint="Opted in and not suppressed. Counts the contact book only — bonus-scene signups live in MailerLite and are not included."
          />
          <StatCard label="Contacts on file" stat={contacts} value={(c) => n(c.total)} sub={(c) => `${n(c.customers)} customer${c.customers === 1 ? "" : "s"}`} />
          <StatCard label="Suppressed" stat={contacts} value={(c) => n(c.suppressed)} sub={() => "unsubscribed or opted out"} />
          <StatCard label="Accounts" stat={accounts} value={n} sub={() => "signed-in readers"} />
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5" data-stat="Latest signups" data-state={signups.state}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">Latest signups</h3>
          {signups.state === "ok" ? (
            signups.value.length === 0 ? (
              <p className="mt-3 text-[13px] text-fg-soft">No one has opted in yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-white/[0.05] text-[13.5px]">
                {signups.value.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                    <Link prefetch={false} href={`/admin/email/${s.id}`} className="break-all text-fg-hi underline-offset-2 hover:text-emerald-bright hover:underline">
                      {s.email}
                    </Link>
                    <span className="text-[12px] text-fg-soft">
                      {s.source} · {s.at.toISOString().slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p className="mt-3 text-[13px] text-fg-soft">{signups.state === "unavailable" ? signups.reason : signups.message}</p>
          )}
        </div>
      </AdminSection>

      {/* ----------------------------------------------------------- free books */}
      <AdminSection
        id="free-books-heading"
        title="Free books"
        note={
          <>
            Requests for the free ebook, by where they have got to.{" "}
            <Link prefetch={false} href="/admin/free-books" className="text-emerald-bright underline-offset-2 hover:underline">
              Open the queue
            </Link>
            .
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Waiting" stat={freeBooks} value={(c) => n(c.pending)} accent sub={(c) => (c.sending ? `${c.sending} sending now` : undefined)} />
          <StatCard label="Delivered" stat={freeBooks} value={(c) => n(c.fulfilled)} />
          <StatCard label="Failed" stat={freeBooks} value={(c) => n(c.failed)} />
          <StatCard label="Flagged" stat={freeBooks} value={(c) => n(c.flagged)} />
          <StatCard label="All requests" stat={freeBooks} value={(c) => n(c.total)} sub={(c) => `${n(c.duplicate)} duplicate${c.duplicate === 1 ? "" : "s"}`} />
        </div>
      </AdminSection>

      {/* ---------------------------------------------------------------- sales */}
      <AdminSection
        id="sales-heading"
        title="Sales"
        note="Only what this site’s own payment webhook has recorded. It does not mark an order as test or live, so test-mode orders are counted with the rest."
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Direct revenue (net)"
            stat={sales}
            accent
            value={(s) => (s.revenueByCurrency[0] ? formatPrice(s.revenueByCurrency[0].netCents, s.revenueByCurrency[0].currency) : "—")}
            sub={(s) => (s.revenueByCurrency[0] ? `gross ${formatPrice(s.revenueByCurrency[0].grossCents, s.revenueByCurrency[0].currency)}` : "no paid orders recorded")}
          />
          <StatCard label="Paid orders" stat={sales} value={(s) => n(s.paidOrders)} sub={(s) => `${n(s.totalOrders)} order${s.totalOrders === 1 ? "" : "s"} in all`} />
          <StatCard label="Books sold here" stat={sales} value={(s) => n(s.booksSold)} sub={() => "across paid orders"} />
          <StatCard label="Amazon / KDP sales" stat={unavailable(NO_SALES_SOURCE)} value={() => null} />
        </div>
        {sales.state === "ok" && sales.value.revenueByCurrency.length > 1 && (
          <p className="mt-3 text-xs text-fg-soft">
            Other currencies:{" "}
            {sales.value.revenueByCurrency
              .slice(1)
              .map((c) => `${formatPrice(c.netCents, c.currency)} (${c.orderCount} ${c.orderCount === 1 ? "order" : "orders"})`)
              .join(" · ")}
          </p>
        )}
        <RecentOrders stat={orders} />
      </AdminSection>

      {/* ------------------------------------------------------------- activity */}
      <AdminSection id="activity-heading" title="Site activity" note={<>Only what the site itself records. More on <Link prefetch={false} href="/admin/data" className="text-emerald-bright underline-offset-2 hover:underline">Site data</Link>.</>}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Funnel events (7 days)" stat={events} value={(e) => n(e.total)} sub={(e) => (e.byEvent[0] ? `most: ${e.byEvent[0].event} (${n(e.byEvent[0].n)})` : "none recorded")} />
          <StatCard label="Paid downloads (30 days)" stat={downloads} value={(d) => n(d.downloads)} />
          <StatCard label="Newsletter popup" stat={popup} value={(p) => `${n(p.submitted)} signed up`} sub={(p) => `${n(p.shown)} shown · ${n(p.dismissed)} dismissed`} />
          <StatCard label="Page views" stat={unavailable(NO_PAGEVIEW_SOURCE)} value={() => null} />
        </div>
      </AdminSection>
    </div>
  );
}

const STATUS_TONE: Record<OrderStatus, string> = {
  paid: "border-emerald-bright/30 bg-emerald-bright/10 text-emerald-bright",
  pending: "border-white/[0.12] bg-white/[0.04] text-fg-mid",
  failed: "border-[#ff7a7a]/30 bg-[#ff7a7a]/10 text-[#ff9b9b]",
  refunded: "border-[#ffce63]/30 bg-[#ffce63]/10 text-[#ffce63]",
};

function RecentOrders({ stat }: { stat: Stat<RecentOrder[]> }) {
  return (
    <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]" data-stat="Recent orders" data-state={stat.state}>
      <h3 className="px-5 pt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">Recent orders</h3>
      {stat.state !== "ok" ? (
        <p className="px-5 pb-5 pt-3 text-[13px] text-fg-soft">{stat.state === "unavailable" ? stat.reason : stat.message}</p>
      ) : stat.value.length === 0 ? (
        <p className="px-5 pb-5 pt-3 text-[13px] text-fg-soft">No orders recorded yet. When a customer completes a checkout it appears here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-y border-white/[0.06] text-[11px] uppercase tracking-[0.12em] text-fg-fade">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">Date</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Customer</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Items</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Total</th>
                <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {stat.value.map((o) => (
                <tr key={o.id} className="text-fg-hi">
                  <td className="whitespace-nowrap px-5 py-2.5 text-xs text-fg-soft">{o.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td className="px-3 py-2.5">
                    <span className="block">{o.customerName ?? "—"}</span>
                    <span className="block break-all text-xs text-fg-soft">{o.customerEmail}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-fg-mid">
                    {o.items[0]?.bookTitle ?? "(empty order)"}
                    {o.items.length > 1 ? ` +${o.items.length - 1} more` : ""}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatPrice(o.totalCents, o.currency)}</td>
                  <td className="px-5 py-2.5">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] ${STATUS_TONE[o.status]}`}>{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
