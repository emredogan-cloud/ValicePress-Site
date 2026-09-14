import type { Metadata } from "next";
import Link from "next/link";

import { CinematicHeader } from "@/components/home/cinematic-header";
import { HomeFooter } from "@/components/home/home-footer";
import { UnprovisionedNotice } from "@/components/unprovisioned-notice";
import { AdminAccessError, requireAdmin } from "@/lib/auth";
import {
  lookupReaderSupport,
  summariseRecentDenials,
  type SupportEntitlementRow,
  type SupportLookup,
} from "@/lib/db/queries/reader-support";

/**
 * /admin/support — "I bought the book but I can't open it."
 *
 * One screen, one question, answered in the order the chain fails. See
 * `reader-support.ts` for what it will and will not return; the short version
 * is that it shows STATE and never grants ACCESS. There is no control on this
 * page that opens a customer's book, and there should never be one — the
 * operator does not need it to answer the question, and adding it would build
 * the only impersonation path in the system.
 *
 * Admin-gated, dynamic, never indexed.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reader support",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ email?: string }>;

export default async function ReaderSupportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.CLERK_SECRET_KEY ||
    !process.env.DATABASE_URL
  ) {
    return (
      <UnprovisionedNotice
        title="Reader support — configuration required"
        body="This surface needs Clerk authentication and a database before it can load."
        missing={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"]}
      />
    );
  }

  try {
    await requireAdmin();
  } catch (err) {
    return (
      <UnprovisionedNotice
        title="Reader support"
        body={
          err instanceof AdminAccessError && err.kind === "not_admin"
            ? "This account is not on the admin allowlist."
            : "Sign in with an admin account to use this page."
        }
        missing={[]}
      />
    );
  }

  const { email } = await searchParams;
  const [lookup, denials] = await Promise.all([
    email ? lookupReaderSupport(email) : Promise.resolve(null),
    summariseRecentDenials().catch(() => []),
  ]);

  return (
    <div className="cinematic-root">
      <CinematicHeader />

      <main id="main-content" className="relative z-10 mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">
          Internal
        </p>
        <h1 className="mt-3 font-serif text-[30px] font-medium leading-tight text-fg-hi sm:text-[38px]">
          Reader support
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fg-mid">
          Look a customer up by the email on their account. This page shows the
          state of their entitlements and why the reader refused them. It shows
          no storage keys, no credentials, and no book content, and it cannot
          open anyone&rsquo;s book.
        </p>

        {/* A plain GET form: the query lands in the URL, so an operator can
            bookmark or share a lookup, and there is no action that mutates. */}
        <form method="GET" className="mt-8 flex flex-wrap gap-3">
          <label htmlFor="email" className="sr-only">
            Customer email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={email ?? ""}
            placeholder="customer@example.com"
            autoComplete="off"
            className="h-11 min-w-[280px] flex-1 rounded-full border border-white/[0.12] bg-white/[0.04] px-5 text-sm text-fg-hi placeholder:text-fg-muted"
          />
          <button
            type="submit"
            className="home-cta-primary inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold"
          >
            Look up
          </button>
        </form>

        {lookup && <LookupResult lookup={lookup} />}

        <DenialSummary rows={denials} />
      </main>

      <HomeFooter />
    </div>
  );
}

function LookupResult({ lookup }: { lookup: SupportLookup }) {
  if (!lookup.found) {
    return (
      <section className="home-glass mt-8 rounded-[20px] p-6">
        <h2 className="font-serif text-lg text-fg-hi">No account for that address</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-mid">
          Nothing is wrong yet — an account row is only created the first time
          someone signs in or the first time a purchase is fulfilled for them.
          Check the spelling, ask whether they used a different address at
          checkout, and check the payment provider&rsquo;s dashboard for an
          order under that email.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="home-glass mt-8 rounded-[20px] p-6">
        <h2 className="font-serif text-lg text-fg-hi">{lookup.email}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Field label="Name" value={lookup.name ?? "—"} />
          <Field label="Account since" value={lookup.joinedAt.toISOString().slice(0, 10)} />
          <Field label="Orders" value={String(lookup.orderCount)} />
          <Field label="Books" value={String(lookup.entitlements.length)} />
        </dl>
      </section>

      {lookup.entitlements.length === 0 ? (
        <section className="home-glass mt-4 rounded-[20px] p-6">
          <p className="text-sm leading-relaxed text-fg-mid">
            This account exists but holds no entitlements. If they have a
            receipt, the payment reached the provider but never became an
            order here — check the webhook delivery log for their order
            reference before doing anything else.
          </p>
        </section>
      ) : (
        <div className="mt-4 space-y-3">
          {lookup.entitlements.map((row) => (
            <EntitlementCard key={row.bookId} row={row} />
          ))}
        </div>
      )}

      {lookup.recentAccess.length > 0 && (
        <section className="home-glass mt-6 rounded-[20px] p-6">
          <h3 className="font-serif text-base text-fg-hi">Recent reader decisions</h3>
          <ul className="mt-3 space-y-1.5 text-[13px] text-fg-mid">
            {lookup.recentAccess.map((e, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-[11px] text-fg-muted">
                  {e.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                </span>
                <span
                  className={
                    e.outcome === "reader_opened"
                      ? "text-emerald-bright"
                      : "text-[#ffb3b3]"
                  }
                >
                  {e.outcome.replace(/_/g, " ")}
                </span>
                {e.detail && <span className="text-fg-muted">({e.detail})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function EntitlementCard({ row }: { row: SupportEntitlementRow }) {
  const tone =
    row.status === "ready"
      ? "text-emerald-bright"
      : row.status === "pending"
        ? "text-[#f5d27a]"
        : "text-[#ffb3b3]";

  return (
    <section className="home-glass rounded-[20px] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-base text-fg-hi">
          {row.bookSlug ? (
            <Link href={`/books/${row.bookSlug}`} className="hover:underline">
              {row.bookTitle}
            </Link>
          ) : (
            row.bookTitle
          )}
        </h3>
        <span className={`text-xs font-semibold uppercase tracking-wider ${tone}`}>
          {row.status}
        </span>
      </div>

      {/* The sentence the operator actually needs. */}
      <p className="mt-2 text-sm leading-relaxed text-fg-mid">{row.diagnosis}</p>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-4">
        <Field label="Order" value={row.orderRef} mono />
        <Field label="Order state" value={row.orderStatus} />
        <Field label="PDF built" value={row.hasPdf ? "yes" : "no"} />
        <Field label="EPUB built" value={row.hasEpub ? "yes" : "no"} />
        <Field
          label="Last opened"
          value={row.lastReadAt?.toISOString().slice(0, 16).replace("T", " ") ?? "never"}
        />
        <Field
          label="Last downloaded"
          value={
            row.lastDownloadedAt?.toISOString().slice(0, 16).replace("T", " ") ??
            "never"
          }
        />
        <Field label="Reached page" value={row.progressPage ? String(row.progressPage) : "—"} />
        <Field
          label="Watermark job"
          value={
            row.job
              ? `${row.job.status}${row.job.attempts > 1 ? ` ×${row.job.attempts}` : ""}`
              : "none"
          }
        />
      </dl>

      {row.job?.error && (
        <pre className="mt-3 overflow-x-auto rounded-lg border border-white/[0.08] bg-black/40 p-3 text-[11px] leading-relaxed text-[#ffb3b3]">
          {row.job.error}
        </pre>
      )}
    </section>
  );
}

function DenialSummary({ rows }: { rows: { outcome: string; count: number }[] }) {
  if (rows.length === 0) return null;
  const notOwned = rows.find((r) => r.outcome === "denied_not_owned")?.count ?? 0;
  return (
    <section className="home-glass mt-10 rounded-[20px] p-6">
      <h3 className="font-serif text-base text-fg-hi">
        Reader decisions, last 24 hours
      </h3>
      <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm text-fg-mid">
        {rows.map((r) => (
          <li key={r.outcome}>
            <span className="font-mono tabular-nums text-fg-hi">{r.count}</span>{" "}
            {r.outcome.replace(/_/g, " ")}
          </li>
        ))}
      </ul>
      {notOwned > 20 && (
        // The shape enumeration takes here. A number, not an alarm: it is the
        // operator who decides whether twenty-odd refusals is a customer with a
        // stale bookmark or somebody walking the catalogue.
        <p className="mt-3 text-[13px] leading-relaxed text-[#f5d27a]">
          {notOwned} requests for books the caller does not own. That is high
          for honest traffic — look at which accounts they came from before
          assuming it is a stale link.
        </p>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-fg-muted">{label}</dt>
      <dd className={`mt-0.5 text-fg-hi ${mono ? "font-mono text-[12px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
