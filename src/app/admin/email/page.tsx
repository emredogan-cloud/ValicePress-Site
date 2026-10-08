import type { Metadata } from "next";
import Link from "next/link";

import { AdminBlocked } from "@/components/admin/admin-blocked";
import { AddContactForm } from "@/components/admin/email/add-contact-form";
import { AdminPageHeader, StatCard } from "@/components/admin/stat-card";
import { ACTIVITY_LABEL, contactActivity, type ContactActivity } from "@/lib/admin/contact-rules";
import { loadAdminContext } from "@/lib/admin/context";
import { readStat, type Stat } from "@/lib/admin/stat";
import type { MarketingConsent } from "@/lib/db/contacts";
import {
  CONTACT_SORTS,
  getContactSummary,
  listAliasGroups,
  listContactSources,
  listContacts,
  type ContactRow,
  type ContactSort,
} from "@/lib/db/queries/contacts-admin";

/**
 * /admin/email — every address this press holds, and on what footing.
 *
 * The contact book has one rule above all the others: HAVING an address is not
 * permission to email it. The figure that authorises a send is MAILABLE — opted
 * in, and not suppressed — and it is the smallest number on the page and the
 * only one drawn in green. A contact added here starts as "not subscribed"; the
 * only way to a mailable one is to state, in words, how and when they agreed.
 * And nobody who unsubscribed can be put back on from this page.
 *
 * Dynamic and never cached: it reads live consent state, and a consent decision
 * served from a cache is a consent decision that can be wrong.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = { title: "Email" };

const CONSENTS: Array<MarketingConsent | "all"> = ["all", "opted_in", "unknown", "not_marketing_contact", "opted_out"];
const CONSENT_LABEL: Record<string, string> = {
  all: "All",
  opted_in: "Opted in",
  opted_out: "Opted out",
  unknown: "Unknown",
  not_marketing_contact: "Not a marketing contact",
};
const STATES = ["all", "active", "suppressed", "inactive"] as const;
const STATE_LABEL: Record<(typeof STATES)[number], string> = { all: "All", active: "Active (mailable)", suppressed: "Suppressed", inactive: "Not subscribed" };

const ACTIVITY_TONE: Record<ContactActivity, string> = {
  active: "border-emerald-bright/35 bg-emerald-bright/[0.10] text-emerald-bright",
  suppressed: "border-[#f0b2a0]/30 bg-[#f0b2a0]/[0.08] text-[#f0b2a0]",
  inactive: "border-white/[0.12] bg-white/[0.03] text-fg-soft",
};

const PAGE_SIZE = 100;
const n = (v: number) => v.toLocaleString("en-US");

type Params = {
  q?: string;
  state?: string;
  consent?: string;
  source?: string;
  audience?: string;
  sort?: string;
  page?: string;
  view?: string;
  deleted?: string;
};

export default async function AdminEmailPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await loadAdminContext();
  if (!ctx.ok) return <AdminBlocked ctx={ctx} />;

  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 120);
  const state = (STATES as readonly string[]).includes(sp.state ?? "") ? (sp.state as (typeof STATES)[number]) : "all";
  const consent = (CONSENTS as readonly string[]).includes(sp.consent ?? "") ? (sp.consent as MarketingConsent | "all") : "all";
  const source = sp.source && sp.source !== "all" ? sp.source.slice(0, 40) : "all";
  const audience = sp.audience === "customers" || sp.audience === "prospects" ? sp.audience : "all";
  const sort: ContactSort = CONTACT_SORTS.some((s) => s.value === sp.sort) ? (sp.sort as ContactSort) : "recent";
  const pageNum = Math.max(1, Number(sp.page) || 1);
  const duplicates = sp.view === "duplicates";

  const [summary, sources, list, groups] = await Promise.all([
    readStat("contacts-summary", getContactSummary),
    readStat("contact-sources", listContactSources),
    readStat("contacts", () => listContacts({ q, state, consent, source, audience, sort, limit: PAGE_SIZE, offset: (pageNum - 1) * PAGE_SIZE })),
    duplicates ? readStat("contact-aliases", listAliasGroups) : Promise.resolve(null),
  ]);

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      q: q || undefined,
      state: state !== "all" ? state : undefined,
      consent: consent !== "all" ? consent : undefined,
      source: source !== "all" ? source : undefined,
      audience: audience !== "all" ? audience : undefined,
      sort: sort !== "recent" ? sort : undefined,
      page: pageNum > 1 ? String(pageNum) : undefined,
      ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const exportHref = `/admin/email/export${qs({ page: undefined })}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AdminPageHeader title="Email">
          Every address this press holds, with the footing it is held on. Having an address is not permission to email it — only the <strong className="font-medium text-emerald-bright">mailable</strong> figure authorises a send.
        </AdminPageHeader>
        <div className="flex flex-wrap gap-3">
          <Link
            href={duplicates ? `/admin/email${qs({ view: undefined })}` : `/admin/email${qs({ view: "duplicates" })}`}
            prefetch={false}
            className="inline-flex h-11 items-center rounded-full border border-white/[0.14] px-5 text-[13px] font-medium text-fg-hi transition-colors hover:border-emerald-bright/50"
          >
            {duplicates ? "Hide duplicates" : "Find duplicates"}
          </Link>
          <a href={exportHref} className="inline-flex h-11 items-center rounded-full border border-white/[0.14] px-5 text-[13px] font-medium text-fg-hi transition-colors hover:border-emerald-bright/50">
            Export this view (CSV)
          </a>
        </div>
      </div>

      {sp.deleted === "1" && (
        <p role="status" className="mt-6 rounded-lg border border-emerald-bright/30 bg-emerald-bright/[0.07] px-4 py-3 text-[13.5px] text-emerald-bright">
          Contact deleted.
        </p>
      )}

      {/* ------------------------------------------------------------ counts */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Known contacts" stat={summary} value={(s) => n(s.total)} />
        <StatCard label="Customers" stat={summary} value={(s) => n(s.customers)} />
        <StatCard label="Suppressed" stat={summary} value={(s) => n(s.suppressed)} />
        <StatCard label="Mailable" stat={summary} value={(s) => n(s.mailable)} accent hint="Opted in, not suppressed" />
      </div>

      {summary.state === "unavailable" || list.state === "unavailable" ? (
        <MissingTable />
      ) : (
        <>
          {/* ------------------------------------------------------------ add */}
          <div className="mt-8">
            <AddContactForm />
          </div>

          {/* ------------------------------------------------- duplicates */}
          {duplicates && groups && <DuplicatesPanel stat={groups} />}

          {/* ----------------------------------------------------- filters */}
          <form method="get" className="mt-8 flex flex-wrap items-end gap-3" role="search" aria-label="Filter contacts">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[0.2em] text-fg-soft">Search</span>
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Email or name"
                className="h-11 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-sm text-fg-hi placeholder:text-fg-fade focus:border-emerald-bright/40 focus:outline-none"
              />
            </label>
            <Select name="state" label="Status" value={state}>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {STATE_LABEL[s]}
                </option>
              ))}
            </Select>
            <Select name="consent" label="Consent" value={consent}>
              {CONSENTS.map((c) => (
                <option key={c} value={c}>
                  {CONSENT_LABEL[c]}
                </option>
              ))}
            </Select>
            <Select name="source" label="Source" value={source}>
              <option value="all">All</option>
              {(sources.state === "ok" ? sources.value : []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select name="audience" label="Audience" value={audience}>
              <option value="all">Everyone</option>
              <option value="customers">Customers</option>
              <option value="prospects">Never bought</option>
            </Select>
            <Select name="sort" label="Sort" value={sort}>
              {CONTACT_SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <button type="submit" className="h-11 rounded-lg bg-emerald-bright px-5 text-[13px] font-semibold text-[#03281b]">
              Apply
            </button>
            <Link href="/admin/email" prefetch={false} className="inline-flex h-11 items-center rounded-lg border border-white/[0.1] px-4 text-[13px] text-fg-mid">
              Reset
            </Link>
          </form>

          <ContactTable list={list} pageNum={pageNum} qs={qs} />
        </>
      )}
    </div>
  );
}

function MissingTable() {
  return (
    <section className="mt-10 max-w-3xl rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6" data-state="unavailable">
      <h2 className="font-serif text-[22px] text-fg-hi">The contact book is not on this database yet</h2>
      <p className="mt-3 text-[14px] leading-relaxed text-fg-mid">
        Nothing is wrong with the page — the migration that creates the contact book (<code className="text-fg-hi">0013_long_slayback</code>) has not been applied here.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08] bg-black/40 p-4 text-[12.5px] text-fg-soft">{`ENVFILE=<file holding the production DATABASE_URL> \\
  node scripts/db/apply-migration.mjs drizzle/0013_long_slayback.sql`}</pre>
    </section>
  );
}

function DuplicatesPanel({ stat }: { stat: Stat<Awaited<ReturnType<typeof listAliasGroups>>> }) {
  return (
    <section aria-labelledby="dupes-heading" className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5" data-stat="Duplicates" data-state={stat.state}>
      <h2 id="dupes-heading" className="font-serif text-[20px] text-fg-hi">
        Possible duplicates
      </h2>
      <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-fg-soft">
        Addresses that read as one mailbox (Gmail ignores dots and +tags; Outlook, iCloud and Proton ignore +tags). A report only — nothing is merged or deleted for you.
      </p>
      {stat.state !== "ok" ? (
        <p className="mt-4 text-[13px] text-fg-soft">{stat.state === "unavailable" ? stat.reason : stat.message}</p>
      ) : stat.value.length === 0 ? (
        <p className="mt-4 text-[13.5px] text-emerald-bright">No duplicates found.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {stat.value.map((g) => (
            <li key={g.canonical} className="rounded-xl border border-white/[0.06] p-4" data-duplicate-group={g.canonical}>
              <p className="text-[12px] uppercase tracking-[0.14em] text-fg-fade">{g.members.length} addresses, one mailbox</p>
              <ul className="mt-2 space-y-1.5 text-[13.5px]">
                {g.members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-baseline gap-x-3">
                    <Link prefetch={false} href={`/admin/email/${m.id}`} className="break-all text-fg-hi underline-offset-2 hover:text-emerald-bright hover:underline">
                      {m.email}
                    </Link>
                    <span className="text-[12px] text-fg-soft">
                      {ACTIVITY_LABEL[contactActivity(m)]} · {m.source} · first seen {m.firstSeen.toISOString().slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContactTable({
  list,
  pageNum,
  qs,
}: {
  list: Stat<{ rows: ContactRow[]; total: number }>;
  pageNum: number;
  qs: (over: Record<string, string | undefined>) => string;
}) {
  if (list.state !== "ok") {
    return (
      <p role="alert" className="mt-8 rounded-2xl border border-white/[0.08] p-5 text-sm text-fg-mid" data-state={list.state}>
        {list.state === "unavailable" ? list.reason : list.message}
      </p>
    );
  }
  const { rows, total } = list.value;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const d = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : "—");

  return (
    <>
      <p className="mt-6 text-[12.5px] text-fg-soft" data-contacts-total={total}>
        {n(total)} {total === 1 ? "contact matches" : "contacts match"}
        {rows.length < total ? ` · showing ${rows.length}` : ""}
      </p>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[0.06]">
        <table className="w-full min-w-[1000px] border-collapse text-left text-[13px]">
          <caption className="sr-only">Contacts</caption>
          <thead>
            <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-[0.14em] text-fg-fade">
              {["Email", "Name", "Status", "Consent evidence", "Source", "Bought", "First seen", "Last seen"].map((h) => (
                <th key={h} scope="col" className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-fg-soft">
                  No contacts match this view.
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                const activity = contactActivity(c);
                return (
                  <tr key={c.id} data-contact={c.email} data-activity={activity} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-3 align-top">
                      <Link href={`/admin/email/${c.id}`} prefetch={false} className="break-all text-fg-hi underline-offset-2 hover:text-emerald-bright hover:underline">
                        {c.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-top text-fg-mid">{c.name ?? "—"}</td>
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex rounded-full border px-2 py-[2px] text-[10.5px] font-medium ${ACTIVITY_TONE[activity]}`}>{ACTIVITY_LABEL[activity]}</span>
                      <span className="mt-1 block text-[11.5px] text-fg-fade">{CONSENT_LABEL[c.marketingConsent]}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {/* The evidence beside the decision: an opt-in with nothing here is exactly what an operator needs to SEE. */}
                      {c.consentSource ? (
                        <span className="block max-w-[320px] text-[12px] leading-snug text-fg-soft">
                          {c.consentSource}
                          {c.consentAt ? ` · ${d(c.consentAt)}` : ""}
                        </span>
                      ) : c.marketingConsent === "opted_in" ? (
                        <span className="text-[12px] font-medium text-[#f0b2a0]">no evidence recorded</span>
                      ) : (
                        <span className="text-fg-fade">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-fg-mid">
                      {c.source}
                      {c.sourceDetail && <span className="mt-0.5 block max-w-[240px] text-[11.5px] text-fg-fade">{c.sourceDetail}</span>}
                    </td>
                    <td className="px-4 py-3 align-top text-fg-mid">{c.purchased ? c.purchaseCount : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-fg-mid">{d(c.firstSeen)}</td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-fg-mid">{d(c.lastSeen)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center gap-3 text-[13px]">
          {pageNum > 1 && (
            <Link href={`/admin/email${qs({ page: String(pageNum - 1) })}`} prefetch={false} className="inline-flex h-11 items-center rounded-full border border-white/[0.12] px-5 text-fg-hi">
              Previous
            </Link>
          )}
          <span className="text-fg-soft">
            Page {pageNum} of {totalPages}
          </span>
          {pageNum < totalPages && (
            <Link href={`/admin/email${qs({ page: String(pageNum + 1) })}`} prefetch={false} className="inline-flex h-11 items-center rounded-full border border-white/[0.12] px-5 text-fg-hi">
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

function Select({ name, label, value, children }: { name: string; label: string; value: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.2em] text-fg-soft">{label}</span>
      <select name={name} defaultValue={value} className="h-11 rounded-lg border border-white/[0.08] bg-[#0b1410] px-3 text-sm text-fg-hi focus:border-emerald-bright/40 focus:outline-none">
        {children}
      </select>
    </label>
  );
}
