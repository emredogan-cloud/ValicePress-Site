import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminBlocked } from "@/components/admin/admin-blocked";
import { ConsentPanel, ContactDetailsForm, DeletePanel } from "@/components/admin/email/contact-editor";
import { AdminPageHeader } from "@/components/admin/stat-card";
import { ACTIVITY_LABEL, contactActivity } from "@/lib/admin/contact-rules";
import { loadAdminContext } from "@/lib/admin/context";
import { readStat } from "@/lib/admin/stat";
import { getContactById } from "@/lib/db/queries/contacts-admin";

/**
 * /admin/email/[id] — one contact: what is known, what can be changed, and
 * what cannot.
 *
 * The address itself is never editable (it is the row's identity, and a
 * consent record belongs to the address it was given for — to correct a typo,
 * delete the contact and add the right one). Consent is changed only by the
 * routes `contact-rules` allows, and for someone who has unsubscribed there is
 * no control at all.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = { title: "Contact" };

const when = (d: Date | null) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—");

export default async function AdminContactPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await loadAdminContext();
  if (!ctx.ok) return <AdminBlocked ctx={ctx} />;

  const { id } = await params;
  const stat = await readStat("contact", () => getContactById(id));

  if (stat.state !== "ok") {
    return (
      <div>
        <BackLink />
        <p role="alert" data-state={stat.state} className="mt-8 rounded-2xl border border-white/[0.08] p-6 text-sm text-fg-mid">
          {stat.state === "unavailable" ? stat.reason : stat.message}
        </p>
      </div>
    );
  }
  const c = stat.value;
  if (!c) notFound();

  const activity = contactActivity(c);

  return (
    <div>
      <BackLink />
      <div className="mt-4">
        <AdminPageHeader title={c.email}>
          <span data-activity={activity} className="font-medium text-fg-hi">
            {ACTIVITY_LABEL[activity]}
          </span>
          {c.name ? <> · {c.name}</> : null}
        </AdminPageHeader>
      </div>

      <dl className="mt-8 grid gap-x-8 gap-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Consent" value={c.marketingConsent.replace(/_/g, " ")} />
        <Fact label="Evidence" value={c.consentSource ?? (c.marketingConsent === "opted_in" ? "no evidence recorded" : "—")} />
        <Fact label="Consent recorded" value={when(c.consentAt)} />
        <Fact label="Source" value={c.source} />
        <Fact label="First seen" value={when(c.firstSeen)} />
        <Fact label="Last seen" value={when(c.lastSeen)} />
        <Fact label="Customer" value={c.purchased ? `Yes — ${c.purchaseCount} purchase${c.purchaseCount === 1 ? "" : "s"}` : "No"} />
        <Fact label="Customer status" value={c.customerStatus} />
      </dl>

      <section aria-labelledby="details-heading" className="mt-10">
        <h2 id="details-heading" className="font-serif text-[22px] text-fg-hi">
          Details
        </h2>
        <div className="mt-4">
          <ContactDetailsForm id={c.id} name={c.name} notes={c.notes} sourceDetail={c.sourceDetail} />
        </div>
      </section>

      <section aria-labelledby="consent-heading" className="mt-10">
        <h2 id="consent-heading" className="font-serif text-[22px] text-fg-hi">
          Consent
        </h2>
        <div className="mt-4 max-w-2xl">
          <ConsentPanel id={c.id} consent={c.marketingConsent} unsubscribed={c.unsubscribed} />
        </div>
      </section>

      <section aria-labelledby="delete-heading" className="mt-12 border-t border-white/[0.06] pt-8">
        <h2 id="delete-heading" className="font-serif text-[22px] text-fg-hi">
          Delete
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-fg-soft">
          Removes this contact from the book for good. To stop emailing someone without erasing the record, suppress them instead.
        </p>
        <div className="mt-4 max-w-2xl">
          <DeletePanel id={c.id} email={c.email} unsubscribed={c.unsubscribed || c.marketingConsent === "opted_out"} />
        </div>
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin/email" prefetch={false} className="inline-flex min-h-11 items-center text-[13px] text-fg-mid underline-offset-4 hover:text-fg-hi hover:underline">
      ← All contacts
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.18em] text-fg-fade">{label}</dt>
      <dd className="mt-1 break-words text-fg-hi">{value}</dd>
    </div>
  );
}
