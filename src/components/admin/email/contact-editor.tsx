"use client";

import { useState } from "react";

import {
  deleteContactAction,
  markNotMarketingAction,
  optInContactAction,
  suppressContactAction,
  updateDetailsAction,
} from "@/app/admin/email/actions";
import type { MarketingConsent } from "@/lib/admin/contact-rules";

import { dangerButton, Field, FormMessage, IDLE, inputHeight, primaryButton, secondaryButton, useAdminForm } from "./form-parts";

/** Name, notes, where we met them. Never the address, never consent. */
export function ContactDetailsForm({ id, name, notes, sourceDetail }: { id: string; name: string | null; notes: string | null; sourceDetail: string | null }) {
  const { state, pending, onSubmit } = useAdminForm(updateDetailsAction);
  const errors = state.status === "error" ? (state.errors ?? {}) : {};
  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2" noValidate>
      <input type="hidden" name="id" value={id} />
      <Field id="edit-name" label="Name" error={errors.name}>
        {(p) => <input {...p} name="name" type="text" defaultValue={name ?? ""} autoComplete="off" className={`${p.className} ${inputHeight}`} />}
      </Field>
      <Field id="edit-source" label="Where you met them" error={errors.sourceDetail}>
        {(p) => <input {...p} name="sourceDetail" type="text" defaultValue={sourceDetail ?? ""} autoComplete="off" className={`${p.className} ${inputHeight}`} />}
      </Field>
      <div className="sm:col-span-2">
        <Field id="edit-notes" label="Notes" error={errors.notes} hint="Internal. Never shown to the contact.">
          {(p) => <textarea {...p} name="notes" rows={4} defaultValue={notes ?? ""} className={`${p.className} py-2`} />}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Saving…" : "Save details"}
        </button>
        <div aria-live="polite">
          <FormMessage state={state} />
        </div>
      </div>
    </form>
  );
}

/**
 * What can be done about this person's consent — and, more to the point, what
 * cannot. Someone who unsubscribed gets NO controls here: only they can opt
 * back in, through a sign-up form, and a button that pretended otherwise would
 * be a way to mail someone who asked not to be mailed.
 *
 * ALL THE STATE LIVES HERE, in the one component that survives the change. A
 * successful action revalidates the page, the contact comes back as "suppressed"
 * (or "opted in"), and the controls that were just used are no longer offered —
 * which, when each control kept its own result, took the confirmation away with
 * it ("Suppressed." was on screen for no time at all, and a screen reader never
 * heard it). Here the confirmation sits in a live region that is always on the
 * page, whatever the panel turns into.
 */
export function ConsentPanel({ id, consent, unsubscribed }: { id: string; consent: MarketingConsent; unsubscribed: boolean }) {
  const suppress = useAdminForm(suppressContactAction);
  const optIn = useAdminForm(optInContactAction);
  const notMarketing = useAdminForm(markNotMarketingAction);
  const [asking, setAsking] = useState(false);
  const errors = optIn.state.status === "error" ? (optIn.state.errors ?? {}) : {};

  // The one success worth keeping on screen: whichever of the three just succeeded.
  const done = [suppress.state, optIn.state, notMarketing.state].find((s) => s.status === "ok") ?? IDLE;
  const locked = unsubscribed || consent === "opted_out";

  return (
    <div className="space-y-6">
      <div aria-live="polite">
        <FormMessage state={done} />
      </div>

      {locked ? (
        <p className="rounded-lg border border-[#f0b2a0]/25 bg-[#f0b2a0]/[0.05] p-4 text-[13.5px] leading-relaxed text-fg-mid" data-consent-locked="">
          This person has unsubscribed, so there is nothing to change here. Only they can opt back in — through a sign-up form — and that lifts the suppression on its own.
        </p>
      ) : (
        <>
          <form onSubmit={suppress.onSubmit} className="space-y-3">
            <input type="hidden" name="id" value={id} />
            {asking ? (
              <div className="rounded-lg border border-white/[0.1] bg-white/[0.03] p-4">
                <p className="text-[13.5px] text-fg-hi">Stop emailing this person? They are marked as unsubscribed, and only they can undo it.</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="submit" disabled={suppress.pending} className={dangerButton}>
                    {suppress.pending ? "Suppressing…" : "Yes, suppress"}
                  </button>
                  <button type="button" onClick={() => setAsking(false)} disabled={suppress.pending} className={secondaryButton}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setAsking(true)} className={dangerButton}>
                Suppress — stop emailing this person
              </button>
            )}
            {suppress.state.status === "error" && <FormMessage state={suppress.state} />}
          </form>

          {consent !== "opted_in" && (
            <form onSubmit={optIn.onSubmit} className="space-y-3 rounded-lg border border-white/[0.08] p-4" noValidate>
              <input type="hidden" name="id" value={id} />
              <Field id="optin-evidence" label="Record that they agreed to marketing email" error={errors.evidence} hint="Say how and when — e.g. “Replied yes to the 12 October email”. Without evidence this will not be recorded.">
                {(p) => <textarea {...p} name="evidence" rows={2} required className={`${p.className} py-2`} />}
              </Field>
              <button type="submit" disabled={optIn.pending} className={secondaryButton}>
                {optIn.pending ? "Recording…" : "Record opt-in"}
              </button>
              {optIn.state.status === "error" && !errors.evidence && <FormMessage state={optIn.state} />}
            </form>
          )}

          {consent === "unknown" && (
            <form onSubmit={notMarketing.onSubmit} className="space-y-3">
              <input type="hidden" name="id" value={id} />
              <button type="submit" disabled={notMarketing.pending} className={secondaryButton}>
                {notMarketing.pending ? "Saving…" : "Mark as not a marketing contact"}
              </button>
              {notMarketing.state.status === "error" && <FormMessage state={notMarketing.state} />}
            </form>
          )}
        </>
      )}
    </div>
  );
}

/** Delete — behind a question, and behind a tick when it would erase a suppression. */
export function DeletePanel({ id, email, unsubscribed }: { id: string; email: string; unsubscribed: boolean }) {
  const { state, pending, onSubmit } = useAdminForm(deleteContactAction);
  const [open, setOpen] = useState(false);
  const needsErase = state.status === "error" && /Tick the box/i.test(state.error);
  return (
    <div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={dangerButton}>
          Delete this contact…
        </button>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-[#ff7a7a]/30 bg-[#ff7a7a]/[0.04] p-4">
          <input type="hidden" name="id" value={id} />
          <p className="text-[13.5px] leading-relaxed text-fg-hi">
            Permanently delete <strong className="break-all font-semibold">{email}</strong> from the contact book? This cannot be undone.
          </p>
          {(unsubscribed || needsErase) && (
            <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-snug text-fg-mid">
              <input type="checkbox" name="erase" className="mt-0.5 h-4 w-4 accent-[#ff7a7a]" />
              <span>This person unsubscribed. Also erase the suppression record, so they could be added again later without that history.</span>
            </label>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending} className={dangerButton}>
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className={secondaryButton}>
              Cancel
            </button>
          </div>
          <div aria-live="polite">
            <FormMessage state={state} />
          </div>
        </form>
      )}
    </div>
  );
}
