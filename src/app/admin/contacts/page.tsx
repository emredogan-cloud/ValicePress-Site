import type { Metadata } from "next";
import Link from "next/link";

import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import { AdminAccessError, requireAdmin } from "@/lib/auth";
import type { MarketingConsent } from "@/lib/db/contacts";
import {
  getContactSummary,
  listContactSources,
  listContacts,
  type ContactRow,
} from "@/lib/db/queries/contacts-admin";

/**
 * /admin/contacts — every email address this press holds, and on what footing.
 *
 * WHY IT EXISTS. Before this page the addresses lived in four places that did
 * not know about each other: Resend held the newsletter, a CSV under
 * MARKETING/ held creator outreach, the `free_book_requests` table held people
 * who had asked for a PDF, and `orders` held buyers. Nobody could answer "do
 * we know this person, and may we write to them" without opening four things
 * and reconciling them by eye.
 *
 * THE COLUMN THAT MATTERS IS CONSENT, AND IT IS NOT A HEADCOUNT. The top of
 * this page shows four numbers, and the smallest is the only one that
 * authorises anything: MAILABLE — opted in, and not suppressed. Everything
 * else is a count of people we know of. Eighty-one of the contacts in here
 * are published professional addresses written to once about one specific
 * book; they are `not_marketing_contact`, and a campaign that treats them as
 * a list is spam whatever the dashboard's biggest number says.
 *
 * `ƒ Dynamic`, never prerendered, never cached: it reads Clerk session
 * cookies and live consent state, and a consent decision served from a cache
 * is a consent decision that can be wrong.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Contacts",
  robots: { index: false, follow: false },
};

const CONSENTS: Array<MarketingConsent | "all"> = [
  "all",
  "opted_in",
  "unknown",
  "not_marketing_contact",
  "opted_out",
];

const CONSENT_LABEL: Record<string, string> = {
  all: "All",
  opted_in: "Opted in",
  opted_out: "Opted out",
  unknown: "Unknown",
  not_marketing_contact: "Not a marketing contact",
};

const CONSENT_TONE: Record<string, string> = {
  opted_in: "border-emerald-bright/35 bg-emerald-bright/[0.10] text-emerald-bright",
  opted_out: "border-[#f0b2a0]/30 bg-[#f0b2a0]/[0.08] text-[#f0b2a0]",
  unknown: "border-white/[0.12] bg-white/[0.03] text-fg-soft",
  not_marketing_contact: "border-[#c9a24a]/30 bg-[#c9a24a]/[0.08] text-[#c9a24a]",
};

const PAGE_SIZE = 100;

function asConsent(v: string | undefined): MarketingConsent | "all" {
  return (CONSENTS as readonly string[]).includes(v ?? "")
    ? (v as MarketingConsent | "all")
    : "all";
}

export default async function AdminContactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    consent?: string;
    source?: string;
    audience?: string;
    suppressed?: string;
    page?: string;
  }>;
}) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAccessError) {
      return (
        <div className="cinematic-root">
          <CinematicHeader />
          <main id="main-content" className="mx-auto max-w-3xl px-6 py-24">
            <h1 className="font-serif text-3xl text-fg-hi">Admin</h1>
            <p className="mt-4 text-fg-mid">{err.message}</p>
          </main>
          <HomeFooter />
        </div>
      );
    }
    throw err;
  }

  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 120);
  const consent = asConsent(sp.consent);
  const source = sp.source && sp.source !== "all" ? sp.source.slice(0, 40) : "all";
  const audience =
    sp.audience === "customers" || sp.audience === "prospects" ? sp.audience : "all";
  const suppressedOnly = sp.suppressed === "1";
  const pageNum = Math.max(1, Number(sp.page) || 1);

  const [summary, sources, { rows, total }] = await Promise.all([
    getContactSummary(),
    listContactSources(),
    listContacts({
      q,
      consent,
      source,
      audience,
      suppressedOnly,
      limit: PAGE_SIZE,
      offset: (pageNum - 1) * PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = {
      q: q || undefined,
      consent: consent !== "all" ? consent : undefined,
      source: source !== "all" ? source : undefined,
      audience: audience !== "all" ? audience : undefined,
      suppressed: suppressedOnly ? "1" : undefined,
      page: pageNum > 1 ? String(pageNum) : undefined,
      ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/contacts?${s}` : "/admin/contacts";
  };

  return (
    <div className="cinematic-root">
      <CinematicHeader />

      <main id="main-content" className="mx-auto max-w-[1500px] px-4 py-14 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-bright/80">
              Admin
            </p>
            <h1 className="mt-2 font-serif text-3xl text-fg-hi">Contacts</h1>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-fg-soft">
              Every address this press holds, from every source, with the
              footing it is held on. Having someone’s address is not permission
              to add them to a mailing list — only the{" "}
              <strong className="font-medium text-emerald-bright">mailable</strong>{" "}
              figure below authorises a send.
            </p>
          </div>
          <a
            href={`/admin/contacts/export${qs({}).includes("?") ? `?${qs({}).split("?")[1]}` : ""}`}
            className="rounded-full border border-white/[0.14] px-5 py-2.5 text-[13px] font-medium text-fg-hi transition-colors hover:border-emerald-bright/50"
          >
            Export this view (CSV)
          </a>
        </header>

        {/* ------------------------------ counts ------------------------- */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Known contacts" value={summary.total} />
          <Stat label="Customers" value={summary.customers} />
          <Stat label="Suppressed" value={summary.suppressed} />
          <Stat
            label="Mailable"
            value={summary.mailable}
            hint="Opted in, not suppressed"
            accent
          />
        </div>

        {/* ------------------------------ filters ------------------------ */}
        <form method="get" className="mt-8 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.2em] text-fg-soft">
              Search
            </span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Email or name"
              className="h-10 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-sm text-fg-hi placeholder:text-fg-fade focus:border-emerald-bright/40 focus:outline-none"
            />
          </label>

          <Select name="consent" label="Consent" value={consent}>
            {CONSENTS.map((c) => (
              <option key={c} value={c}>
                {CONSENT_LABEL[c]}
              </option>
            ))}
          </Select>

          <Select name="source" label="Source" value={source}>
            <option value="all">All</option>
            {sources.map((s) => (
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

          <label className="flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-[13px] text-fg-mid">
            <input
              type="checkbox"
              name="suppressed"
              value="1"
              defaultChecked={suppressedOnly}
              className="h-3.5 w-3.5 accent-[#33f0aa]"
            />
            Suppressed only
          </label>

          <button
            type="submit"
            className="h-10 rounded-lg bg-emerald-bright px-5 text-[13px] font-semibold text-[#03281b]"
          >
            Apply
          </button>
          <Link
            href="/admin/contacts"
            className="h-10 rounded-lg border border-white/[0.1] px-4 text-[13px] leading-10 text-fg-mid"
          >
            Reset
          </Link>
        </form>

        {/* ------------------------------ table -------------------------- */}
        <p className="mt-6 text-[12.5px] text-fg-soft">
          {total.toLocaleString("en-US")}{" "}
          {total === 1 ? "contact" : "contacts"} match
          {rows.length < total ? ` · showing ${rows.length}` : ""}
        </p>

        <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full min-w-[980px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-[0.14em] text-fg-fade">
                <Th>Email</Th>
                <Th>Name</Th>
                <Th>Consent</Th>
                <Th>Evidence</Th>
                <Th>Source</Th>
                <Th>Bought</Th>
                <Th>First seen</Th>
                <Th>Last seen</Th>
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
                rows.map((c) => <Row key={c.id} contact={c} />)
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <nav className="mt-6 flex items-center gap-3 text-[13px]">
            {pageNum > 1 && (
              <Link
                href={qs({ page: String(pageNum - 1) })}
                className="rounded-full border border-white/[0.12] px-4 py-2 text-fg-hi"
              >
                Previous
              </Link>
            )}
            <span className="text-fg-soft">
              Page {pageNum} of {totalPages}
            </span>
            {pageNum < totalPages && (
              <Link
                href={qs({ page: String(pageNum + 1) })}
                className="rounded-full border border-white/[0.12] px-4 py-2 text-fg-hi"
              >
                Next
              </Link>
            )}
          </nav>
        )}

        <p className="mt-10 max-w-3xl text-[12px] leading-relaxed text-fg-fade">
          Provenance for every row in this table is recorded in{" "}
          <code className="text-fg-soft">
            docs/40-production/CRM-DATA-PROVENANCE-2026-09-19.md
          </code>
          . Exports are generated on demand and are never written into the
          repository.
        </p>
      </main>

      <HomeFooter />
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent
          ? "border-emerald-bright/30 bg-emerald-bright/[0.06]"
          : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-fg-fade">{label}</p>
      <p
        className={`mt-2 font-serif text-[30px] tabular-nums ${
          accent ? "text-emerald-bright" : "text-fg-hi"
        }`}
      >
        {value.toLocaleString("en-US")}
      </p>
      {hint && <p className="mt-1 text-[11.5px] text-fg-soft">{hint}</p>}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top text-fg-mid">{children}</td>;
}

function Select({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.2em] text-fg-soft">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="h-10 rounded-lg border border-white/[0.08] bg-[#0b1410] px-3 text-sm text-fg-hi focus:border-emerald-bright/40 focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function Row({ contact }: { contact: ContactRow }) {
  const d = (x: Date | null) =>
    x ? new Date(x).toISOString().slice(0, 10) : "—";
  return (
    <tr className="border-b border-white/[0.04] last:border-0">
      <Td>
        <span className="break-all text-fg-hi">{contact.email}</span>
        {contact.unsubscribed && (
          <span className="ml-2 rounded-full border border-[#f0b2a0]/30 px-2 py-[1px] text-[10px] uppercase tracking-[0.12em] text-[#f0b2a0]">
            suppressed
          </span>
        )}
      </Td>
      <Td>{contact.name ?? "—"}</Td>
      <Td>
        <span
          className={`rounded-full border px-2 py-[2px] text-[10.5px] font-medium ${
            CONSENT_TONE[contact.marketingConsent] ?? CONSENT_TONE.unknown
          }`}
        >
          {CONSENT_LABEL[contact.marketingConsent]}
        </span>
      </Td>
      <Td>
        {/*
          The evidence, beside the decision. An `opted_in` row with nothing
          here is exactly what an operator needs to be able to SEE — it is an
          opt-in nobody can substantiate, and this column is why it cannot
          hide among the ones that can.
        */}
        {contact.consentSource ? (
          <span className="block max-w-[320px] text-[12px] leading-snug text-fg-soft">
            {contact.consentSource}
            {contact.consentAt ? ` · ${d(contact.consentAt)}` : ""}
          </span>
        ) : contact.marketingConsent === "opted_in" ? (
          <span className="text-[12px] font-medium text-[#f0b2a0]">
            no evidence recorded
          </span>
        ) : (
          <span className="text-fg-fade">—</span>
        )}
      </Td>
      <Td>
        <span className="text-fg-mid">{contact.source}</span>
        {contact.sourceDetail && (
          <span className="mt-0.5 block max-w-[240px] text-[11.5px] text-fg-fade">
            {contact.sourceDetail}
          </span>
        )}
      </Td>
      <Td>{contact.purchased ? contact.purchaseCount : "—"}</Td>
      <Td>{d(contact.firstSeen)}</Td>
      <Td>{d(contact.lastSeen)}</Td>
    </tr>
  );
}
