"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { addContactAction } from "@/app/admin/email/actions";

import { Field, FormMessage, inputHeight, primaryButton, secondaryButton, useAdminForm } from "./form-parts";

/**
 * "Add a contact" — a disclosure, so the list stays the page.
 *
 * Adding a contact does NOT subscribe them. The default is "we only know the
 * address"; the third choice, "they agreed to marketing email", is the only way
 * to a mailable contact and it will not submit without the evidence in words.
 * (The server enforces both; this form only makes them easy to meet.)
 */
export function AddContactForm() {
  const { state, pending, onSubmit } = useAdminForm(addContactAction);
  const [consent, setConsent] = useState("unknown");
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.status === "error" ? (state.errors ?? {}) : {};

  // A successful add empties the form for the next one. Only a success: after a
  // problem the administrator's typing stays exactly where it was.
  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);
  // ...and the evidence box follows the radio, not the other way round.
  const optedIn = consent === "opted_in";

  return (
    // Deliberately NOT `open={…}`: a React-controlled `open` closes the form again the moment a
    // submission succeeds (the prop goes back to undefined) and takes the confirmation with it.
    // The administrator opened it; it stays as they left it.
    <details className="group rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm font-medium text-fg-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/60">
        <span>Add a contact</span>
        <span aria-hidden className="text-fg-soft transition-transform group-open:rotate-45">
          +
        </span>
      </summary>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        onReset={() => setConsent("unknown")}
        className="grid gap-5 border-t border-white/[0.06] px-5 pb-5 pt-5 sm:grid-cols-2"
        noValidate
      >
        <Field id="add-email" label="Email address" error={errors.email}>
          {(p) => <input {...p} name="email" type="email" required autoComplete="off" placeholder="name@example.com" className={`${p.className} ${inputHeight}`} />}
        </Field>
        <Field id="add-name" label="Name (optional)" error={errors.name}>
          {(p) => <input {...p} name="name" type="text" autoComplete="off" className={`${p.className} ${inputHeight}`} />}
        </Field>
        <Field id="add-source" label="Where did you meet them? (optional)" error={errors.sourceDetail} hint="Kept as the contact’s provenance — e.g. “Book fair, Izmir, Oct 2026”.">
          {(p) => <input {...p} name="sourceDetail" type="text" autoComplete="off" className={`${p.className} ${inputHeight}`} />}
        </Field>
        <Field id="add-notes" label="Notes (optional)" error={errors.notes}>
          {(p) => <textarea {...p} name="notes" rows={3} className={`${p.className} py-2`} />}
        </Field>

        <fieldset className="sm:col-span-2">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-soft">What do you know about their consent?</legend>
          <div className="mt-3 space-y-2.5">
            {[
              ["unknown", "I only know the address", "Not subscribed. They will not be counted as mailable."],
              ["not_marketing_contact", "Not a marketing contact", "A professional or one-off contact — never to be added to a list."],
              ["opted_in", "They agreed to marketing email", "Needs the evidence below. This is the only way to add someone as mailable."],
            ].map(([value, label, help]) => (
              <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.06] p-3 has-[:checked]:border-emerald-bright/40 has-[:checked]:bg-emerald-bright/[0.04]">
                <input type="radio" name="consent" value={value} checked={consent === value} onChange={() => setConsent(value)} className="mt-1 h-4 w-4 accent-[#33f0aa]" />
                <span>
                  <span className="block text-[13.5px] text-fg-hi">{label}</span>
                  <span className="block text-[12px] text-fg-soft">{help}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.consent && <p className="mt-2 text-[12.5px] text-[#ff9b9b]">{errors.consent}</p>}
        </fieldset>

        {optedIn && (
          <div className="sm:col-span-2">
            <Field id="add-evidence" label="Evidence they agreed" error={errors.evidence} hint="Say how and when — e.g. “Replied yes to the 12 October email”. Stored with the contact.">
              {(p) => <textarea {...p} name="evidence" rows={2} required className={`${p.className} py-2`} />}
            </Field>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Adding…" : "Add contact"}
          </button>
          {state.status === "error" && state.canForce && (
            <button type="submit" name="allowAlias" value="on" disabled={pending} className={secondaryButton}>
              It’s a different person — add anyway
            </button>
          )}
          {state.status === "error" && state.existingId && (
            <Link prefetch={false} href={`/admin/email/${state.existingId}`} className="text-[13px] text-emerald-bright underline-offset-2 hover:underline">
              Open the existing contact
            </Link>
          )}
          {state.status === "ok" && state.id && (
            <Link prefetch={false} href={`/admin/email/${state.id}`} className="text-[13px] text-emerald-bright underline-offset-2 hover:underline">
              Open it
            </Link>
          )}
        </div>
        <div className="sm:col-span-2" aria-live="polite">
          <FormMessage state={state} />
        </div>
      </form>
    </details>
  );
}
