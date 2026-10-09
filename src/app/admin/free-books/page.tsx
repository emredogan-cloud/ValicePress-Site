import type { Metadata } from "next";
import Link from "next/link";

import { AdminBlocked } from "@/components/admin/admin-blocked";
import { AdminPageHeader } from "@/components/admin/stat-card";
import { loadAdminContext } from "@/lib/admin/context";
import { readStat } from "@/lib/admin/stat";
import { campaignEndMs, campaignState } from "@/lib/campaign";
import {
  DOWNLOAD_TTL_HOURS,
  getFreeBookRequestCounts,
  listFreeBookRequestsPage,
  type AdminFreeBookRequest,
  type FreeBookRequestStatus,
} from "@/lib/db/queries/free-books";
import { MAX_ATTACHMENT_BYTES } from "@/lib/free-book-delivery";

import { RequestRowActions } from "./row-actions";

/**
 * /admin/free-books — the fulfilment queue for the free-ebook promotion.
 *
 * The whole point of this page is that a promise made on the storefront
 * ("you'll receive your PDF by email within 24 hours") has somewhere to be
 * kept. A request system with no operator surface is a table nobody reads and
 * a promise nobody keeps.
 *
 * Newest first, filterable by status and searchable, a page at a time, with the
 * counts across the top so the size of the queue is visible without scrolling
 * it. `pending` is the default view because it is the only one that represents
 * work. (`sending` is a status too — a row stuck on it is a send that died
 * mid-flight, and it used to have no filter at all.)
 *
 * It moved under the shared admin shell; nothing about what it does changed.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Free books" };

const STATUSES: Array<FreeBookRequestStatus | "all"> = ["pending", "sending", "fulfilled", "failed", "duplicate", "flagged", "all"];
const PAGE_SIZE = 100;

export default async function FreeBookRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const ctx = await loadAdminContext();
  if (!ctx.ok) return <AdminBlocked ctx={ctx} />;

  const sp = await searchParams;
  const raw = sp.status ?? "pending";
  const filter = (STATUSES as string[]).includes(raw) ? raw : "pending";
  const q = (sp.q ?? "").slice(0, 120);
  const pageNum = Math.max(1, Number(sp.page) || 1);

  const [list, counts] = await Promise.all([
    readStat("free-book-requests", () =>
      listFreeBookRequestsPage({
        status: filter === "all" ? undefined : (filter as FreeBookRequestStatus),
        q,
        limit: PAGE_SIZE,
        offset: (pageNum - 1) * PAGE_SIZE,
      }),
    ),
    readStat("free-book-counts", getFreeBookRequestCounts),
  ]);

  const state = campaignState();
  const href = (over: { status?: string; page?: number }) => {
    const p = new URLSearchParams();
    p.set("status", over.status ?? filter);
    if (q) p.set("q", q);
    if ((over.page ?? 1) > 1) p.set("page", String(over.page));
    return `/admin/free-books?${p.toString()}`;
  };

  return (
    <div>
      <AdminPageHeader title="Free-ebook requests">
        The promotion is currently <strong className="text-fg-hi">{state}</strong>
        {state !== "ended" && <> — it closes {new Date(campaignEndMs()).toUTCString()}.</>} Fulfilling a request emails the book: up to {Math.round(MAX_ATTACHMENT_BYTES / 1048576)} MB as an attachment, anything larger as a secure link that works for {DOWNLOAD_TTL_HOURS} hours. Nothing here grants standing access to a file.
      </AdminPageHeader>

      {/* Counts strip */}
      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {STATUSES.map((s) => {
          const count = counts.state === "ok" ? (s === "all" ? counts.value.total : counts.value[s]) : null;
          const active = filter === s;
          return (
            <Link
              key={s}
              href={href({ status: s })}
              prefetch={false}
              aria-current={active ? "true" : undefined}
              className={[
                "inline-flex min-h-11 items-center rounded-full border px-4 text-[12px] font-medium capitalize transition-colors",
                active ? "border-emerald-bright/60 bg-emerald-bright/10 text-emerald-bright" : "border-white/10 text-fg-mid hover:border-white/25 hover:text-fg-hi",
              ].join(" ")}
            >
              {s} {count !== null && <span className="ml-1.5 tabular-nums opacity-70">{count}</span>}
            </Link>
          );
        })}
      </div>

      <form method="get" role="search" aria-label="Search requests" className="mt-5 flex flex-wrap items-end gap-3">
        <input type="hidden" name="status" value={filter} />
        <label className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.2em] text-fg-soft">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Email, book title or slug"
            className="h-11 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-sm text-fg-hi placeholder:text-fg-fade focus:border-emerald-bright/40 focus:outline-none"
          />
        </label>
        <button type="submit" className="h-11 rounded-lg bg-emerald-bright px-5 text-[13px] font-semibold text-[#03281b]">
          Search
        </button>
        {q && (
          <Link href={href({}).replace(/&?q=[^&]*/, "")} prefetch={false} className="inline-flex h-11 items-center rounded-lg border border-white/[0.1] px-4 text-[13px] text-fg-mid">
            Clear
          </Link>
        )}
      </form>

      {list.state !== "ok" ? (
        <p role="alert" data-state={list.state} className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-6 text-sm text-fg-mid">
          {list.state === "unavailable" ? list.reason : list.message}
        </p>
      ) : list.value.rows.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-8 text-center text-sm text-fg-mid">
          No {filter === "all" ? "" : filter} requests{q ? ` matching “${q}”` : ""}.
        </p>
      ) : (
        <>
          <p className="mt-6 text-[12.5px] text-fg-soft">
            {list.value.total.toLocaleString("en-US")} {list.value.total === 1 ? "request" : "requests"}
            {list.value.rows.length < list.value.total ? ` · showing ${list.value.rows.length}` : ""}
          </p>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-white/8">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <caption className="sr-only">Free-ebook requests</caption>
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.16em] text-fg-soft">
                <tr>
                  <Th>Requested</Th>
                  <Th>Email</Th>
                  <Th>Book</Th>
                  <Th>Message</Th>
                  <Th>Status</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {list.value.rows.map((r) => (
                  <Row key={r.id} r={r} />
                ))}
              </tbody>
            </table>
          </div>
          <Pager pageNum={pageNum} total={list.value.total} href={(page) => href({ page })} />
        </>
      )}

      <p className="mt-6 text-[12px] leading-relaxed text-fg-soft">
        Customer email addresses appear on this page and in the Email tab, and nowhere else on the site. This area is admin-only, <code>noindex</code>, and never cached.
      </p>
    </div>
  );
}

function Pager({ pageNum, total, href }: { pageNum: number; total: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-6 flex items-center gap-3 text-[13px]">
      {pageNum > 1 && (
        <Link href={href(pageNum - 1)} prefetch={false} className="inline-flex h-11 items-center rounded-full border border-white/[0.12] px-5 text-fg-hi">
          Previous
        </Link>
      )}
      <span className="text-fg-soft">
        Page {pageNum} of {pages}
      </span>
      {pageNum < pages && (
        <Link href={href(pageNum + 1)} prefetch={false} className="inline-flex h-11 items-center rounded-full border border-white/[0.12] px-5 text-fg-hi">
          Next
        </Link>
      )}
    </nav>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3 font-semibold">{children}</th>;
}

function Row({ r }: { r: AdminFreeBookRequest }) {
  return (
    <tr className="border-t border-white/6 align-top">
      <td className="whitespace-nowrap px-4 py-3 text-fg-soft tabular-nums">
        {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
      </td>
      <td className="px-4 py-3 text-fg-hi">
        {r.email}
        {r.marketingConsent && (
          <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-bright ring-1 ring-emerald-bright/30">
            list
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-fg-hi">{r.bookTitle}</span>
        <span className="block text-[11px] text-fg-soft">
          {r.bookSlug} · {r.format}
          {r.hasMaster === false && (
            <span className="ml-1 text-amber-300">· no master file</span>
          )}
        </span>
      </td>
      {/* React escapes this. The message is stored exactly as typed and is
          never interpolated into HTML anywhere — see the API route. */}
      <td className="max-w-[280px] px-4 py-3 text-fg-mid">
        {r.message ? (
          <span className="line-clamp-3 whitespace-pre-wrap break-words">{r.message}</span>
        ) : (
          <span className="text-fg-fade">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusPill status={r.status} />
        {r.notes && (
          <span className="mt-1 block max-w-[220px] text-[11px] leading-snug text-fg-soft">
            {r.notes}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <RequestRowActions id={r.id} status={r.status} hasMaster={r.hasMaster !== false} />
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: FreeBookRequestStatus }) {
  const tone: Record<FreeBookRequestStatus, string> = {
    pending: "text-sky-300 ring-sky-300/30",
    // Amber, like `flagged`: both mean "look at this one". A row still saying
    // SENDING minutes later is a send that died mid-flight, and it needs to be
    // as visible as a request that needs judgement.
    sending: "text-amber-200 ring-amber-200/40",
    fulfilled: "text-emerald-bright ring-emerald-bright/30",
    failed: "text-red-300 ring-red-300/30",
    duplicate: "text-fg-soft ring-white/15",
    flagged: "text-amber-300 ring-amber-300/30",
  };
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ring-1 ${tone[status]}`}
    >
      {status}
    </span>
  );
}
