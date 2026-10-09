"use client";

import { useActionState, useTransition, type FormEvent, type ReactNode } from "react";

import type { EmailActionState } from "@/app/admin/email/actions";

export const IDLE: EmailActionState = { status: "idle" };

/**
 * A form wired to a server action — WITHOUT React 19's automatic form reset.
 *
 * `<form action={fn}>` resets every uncontrolled field once the action finishes,
 * success or not. For an admin form that is wrong in exactly the moment it
 * matters: a typo'd address, a validation message, an "it looks like a duplicate"
 * warning — and everything the administrator had typed is gone. (Caught by a
 * component test: pressing "add anyway" after a warning submitted an empty
 * address.) So the form submits through `onSubmit`, the fields keep what was
 * typed, and the form clears itself only when the caller says so.
 *
 * The submitting button's own name/value is included (that is how a second
 * "add anyway" button can say so).
 */
export function useAdminForm(action: (prev: EmailActionState, form: FormData) => Promise<EmailActionState>) {
  const [state, dispatch, pending] = useActionState(action, IDLE);
  const [, startTransition] = useTransition();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.name) data.set(submitter.name, submitter.value);
    startTransition(() => dispatch(data));
  };
  return { state, pending, onSubmit };
}

/** One labelled control with its own error, wired so a screen reader hears both. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined; className: string }) => ReactNode;
}) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-soft">
        {label}
      </label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
        className: `w-full rounded-lg border bg-white/[0.02] px-3 text-sm text-fg-hi placeholder:text-fg-fade focus:outline-none focus:ring-2 focus:ring-emerald-bright/20 ${
          error ? "border-[#ff7a7a]/60 focus:border-[#ff7a7a]" : "border-white/[0.1] focus:border-emerald-bright/40"
        }`,
      })}
      {hint && (
        <p id={`${id}-hint`} className="text-[12px] leading-snug text-fg-fade">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-[12.5px] leading-snug text-[#ff9b9b]">
          {error}
        </p>
      )}
    </div>
  );
}

/** What the last submission said — polite for success, assertive for a problem. */
export function FormMessage({ state }: { state: EmailActionState }) {
  if (state.status === "idle") return null;
  if (state.status === "ok") {
    return (
      <p role="status" className="rounded-lg border border-emerald-bright/30 bg-emerald-bright/[0.07] px-3 py-2 text-[13px] text-emerald-bright">
        {state.message}
      </p>
    );
  }
  return (
    <p role="alert" className="rounded-lg border border-[#ff7a7a]/30 bg-[#ff7a7a]/[0.06] px-3 py-2 text-[13px] text-[#ff9b9b]">
      {state.error}
    </p>
  );
}

export const primaryButton =
  "inline-flex h-11 items-center justify-center rounded-lg bg-emerald-bright px-5 text-[13px] font-semibold text-[#03281b] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/60 disabled:cursor-not-allowed disabled:opacity-60";
export const secondaryButton =
  "inline-flex h-11 items-center justify-center rounded-lg border border-white/[0.14] px-5 text-[13px] font-medium text-fg-hi transition-colors hover:border-emerald-bright/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/60 disabled:cursor-not-allowed disabled:opacity-60";
export const dangerButton =
  "inline-flex h-11 items-center justify-center rounded-lg border border-[#ff7a7a]/40 px-5 text-[13px] font-semibold text-[#ff9b9b] transition-colors hover:bg-[#ff7a7a]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a7a]/50 disabled:cursor-not-allowed disabled:opacity-60";
export const inputHeight = "h-11";
