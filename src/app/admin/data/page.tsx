import type { Metadata } from "next";

import { AdminBlocked } from "@/components/admin/admin-blocked";
import { AdminPageHeader, AdminSection, StatCard } from "@/components/admin/stat-card";
import { loadAdminContext } from "@/lib/admin/context";
import { readStat, unavailable } from "@/lib/admin/stat";
import { getDownloadCount, getEventOverview, getPopupOverview } from "@/lib/db/queries/admin-overview";

/**
 * /admin/data — site activity, from the only sources that exist.
 *
 * Three tables record anything about visitors: `analytics_events` (the first-
 * party funnel beacons), `download_logs` (opens of a paid file) and
 * `popup_impressions` (the newsletter popup). That is all, and this page shows
 * all of it. It does NOT show page views, sessions or sales from Amazon, because
 * nothing here records them — and says so, rather than estimating.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Site data" };

const WINDOWS = [7, 30, 90] as const;
const n = (v: number) => v.toLocaleString("en-US");

export default async function AdminDataPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const ctx = await loadAdminContext();
  if (!ctx.ok) return <AdminBlocked ctx={ctx} />;

  const { days: raw } = await searchParams;
  const days = (WINDOWS as readonly number[]).includes(Number(raw)) ? Number(raw) : 7;

  const [events, downloads, popup] = await Promise.all([
    readStat("events", () => getEventOverview(days)),
    readStat("downloads", () => getDownloadCount(days)),
    readStat("popup", getPopupOverview),
  ]);

  return (
    <div>
      <AdminPageHeader title="Site data">
        What the site itself records about visitors. Nothing here is estimated: a figure with no source says so.
      </AdminPageHeader>

      <nav aria-label="Time window" className="mt-6 flex gap-2">
        {WINDOWS.map((w) => (
          <a
            key={w}
            href={`/admin/data?days=${w}`}
            aria-current={w === days ? "true" : undefined}
            className={`inline-flex h-10 items-center rounded-full border px-4 text-[13px] font-medium ${
              w === days ? "border-emerald-bright/50 bg-emerald-bright/10 text-emerald-bright" : "border-white/[0.12] text-fg-mid hover:text-fg-hi"
            }`}
          >
            Last {w} days
          </a>
        ))}
      </nav>

      <AdminSection id="funnel-heading" title={`Funnel events, last ${days} days`} note="First-party beacons from the storefront: views, adds to cart, checkouts begun, purchases. They carry no names, addresses or IPs.">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="All events" stat={events} value={(e) => n(e.total)} accent />
          <StatCard label="Paid downloads" stat={downloads} value={(d) => n(d.downloads)} sub={(d) => `last ${d.days} days`} />
          <StatCard label="Page views" stat={unavailable("Page views are not recorded in this database — Vercel Analytics is not connected to this dashboard.")} value={() => null} />
          <StatCard label="Amazon / KDP sales" stat={unavailable("Sales data unavailable — no connected sales source")} value={() => null} />
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.06]" data-stat="Events by name" data-state={events.state}>
          {events.state !== "ok" ? (
            <p className="p-5 text-[13px] text-fg-soft">{events.state === "unavailable" ? events.reason : events.message}</p>
          ) : events.value.byEvent.length === 0 ? (
            <p className="p-5 text-[13px] text-fg-soft">No events were recorded in this window.</p>
          ) : (
            <table className="w-full min-w-[420px] text-left text-[13px]">
              <caption className="sr-only">Events by name</caption>
              <thead className="border-b border-white/[0.07] text-[11px] uppercase tracking-[0.14em] text-fg-fade">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Event</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {events.value.byEvent.map((e) => (
                  <tr key={e.event}>
                    <td className="px-4 py-2.5 font-mono text-[12.5px] text-fg-hi">{e.event}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-fg-mid">{n(e.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </AdminSection>

      <AdminSection id="popup-heading" title="Newsletter popup" note="One row per visitor, ever — the popup is shown to a person once. These are all-time figures.">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Shown" stat={popup} value={(p) => n(p.shown)} />
          <StatCard label="Dismissed" stat={popup} value={(p) => n(p.dismissed)} />
          <StatCard label="Signed up" stat={popup} value={(p) => n(p.submitted)} accent />
        </div>
      </AdminSection>
    </div>
  );
}
