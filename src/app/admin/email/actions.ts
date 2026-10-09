"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { adminActionDenial } from "@/lib/admin/context";
import { validateDetails, validateNewContact, type FieldErrors } from "@/lib/admin/contact-rules";
import { describeFailure } from "@/lib/admin/stat";
import { AdminAccessError } from "@/lib/auth";
import {
  adminAddContact,
  adminChangeConsent,
  adminDeleteContact,
  adminUpdateContactDetails,
  type WriteFailure,
} from "@/lib/db/queries/contacts-write";

/**
 * The admin's email actions — thin on purpose.
 *
 * Each one does the same four things in the same order:
 *   1. ask the gate (`adminActionDenial`) BEFORE reading a single field — a
 *      hidden button is not access control, and an action is a public HTTP
 *      endpoint that anybody can POST to;
 *   2. validate the input with the pure rules (`@/lib/admin/contact-rules`);
 *   3. call the query layer, which asks the gate again and obeys the consent
 *      policy;
 *   4. turn the outcome into a value the form can show — never a thrown error,
 *      never a database message, never the SQL.
 * The policy lives below this file, so there is exactly one place to read it.
 */

export type EmailActionState =
  | { status: "idle" }
  | { status: "ok"; message: string; id?: string }
  | {
      status: "error";
      error: string;
      errors?: FieldErrors;
      /** The same mailbox is already in the book — the form may offer "add anyway". */
      canForce?: boolean;
      existingId?: string;
    };

const field = (form: FormData, key: string): string | undefined => {
  const v = form.get(key);
  return typeof v === "string" ? v : undefined;
};

function fromFailure(f: WriteFailure): EmailActionState {
  return {
    status: "error",
    error: f.error,
    ...(f.field ? { errors: { [f.field]: f.error } as FieldErrors } : {}),
    ...(f.code === "alias" ? { canForce: true } : {}),
    ...(f.existingId ? { existingId: f.existingId } : {}),
  };
}

/** Anything unexpected becomes one calm sentence; the cause goes to the log without SQL or parameters. */
function unexpected(where: string, err: unknown): EmailActionState {
  if (err instanceof AdminAccessError) return { status: "error", error: "You are not authorized to do that." };
  console.error(`[admin/email] ${where} failed: ${describeFailure(err)}`);
  return { status: "error", error: "Something went wrong and nothing was changed. Try again, and check the server log if it keeps happening." };
}

function refresh(id?: string) {
  revalidatePath("/admin/email");
  revalidatePath("/admin");
  if (id) revalidatePath(`/admin/email/${id}`);
}

export async function addContactAction(_prev: EmailActionState, form: FormData): Promise<EmailActionState> {
  const denial = await adminActionDenial();
  if (denial) return { status: "error", error: denial };

  const parsed = validateNewContact({
    email: field(form, "email"),
    name: field(form, "name"),
    notes: field(form, "notes"),
    sourceDetail: field(form, "sourceDetail"),
    consent: field(form, "consent"),
    evidence: field(form, "evidence"),
  });
  if (!parsed.ok) return { status: "error", error: "Check the highlighted fields.", errors: parsed.errors };

  try {
    const result = await adminAddContact(parsed.value, { allowAlias: form.get("allowAlias") === "on" });
    if (!result.ok) return fromFailure(result);
    refresh();
    return { status: "ok", message: `Added ${result.value.email}.`, id: result.value.id };
  } catch (err) {
    return unexpected("add", err);
  }
}

export async function updateDetailsAction(_prev: EmailActionState, form: FormData): Promise<EmailActionState> {
  const denial = await adminActionDenial();
  if (denial) return { status: "error", error: denial };

  const id = field(form, "id") ?? "";
  const parsed = validateDetails({ name: field(form, "name"), notes: field(form, "notes"), sourceDetail: field(form, "sourceDetail") });
  if (!parsed.ok) return { status: "error", error: "Check the highlighted fields.", errors: parsed.errors };

  try {
    const result = await adminUpdateContactDetails(id, parsed.value);
    if (!result.ok) return fromFailure(result);
    refresh(id);
    return { status: "ok", message: "Saved." };
  } catch (err) {
    return unexpected("update", err);
  }
}

/** Suppress a contact — stop emailing them. The only consent change that is always open to an admin. */
export async function suppressContactAction(_prev: EmailActionState, form: FormData): Promise<EmailActionState> {
  const denial = await adminActionDenial();
  if (denial) return { status: "error", error: denial };
  const id = field(form, "id") ?? "";
  try {
    const result = await adminChangeConsent(id, { to: "suppress" });
    if (!result.ok) return fromFailure(result);
    refresh(id);
    return { status: "ok", message: "Suppressed. They will not be emailed." };
  } catch (err) {
    return unexpected("suppress", err);
  }
}

/** Record that someone agreed to marketing email — only with the evidence, in words. */
export async function optInContactAction(_prev: EmailActionState, form: FormData): Promise<EmailActionState> {
  const denial = await adminActionDenial();
  if (denial) return { status: "error", error: denial };
  const id = field(form, "id") ?? "";
  try {
    const result = await adminChangeConsent(id, { to: "opt_in", evidence: field(form, "evidence") });
    if (!result.ok) return fromFailure(result);
    refresh(id);
    return { status: "ok", message: "Recorded, with your evidence." };
  } catch (err) {
    return unexpected("opt-in", err);
  }
}

export async function markNotMarketingAction(_prev: EmailActionState, form: FormData): Promise<EmailActionState> {
  const denial = await adminActionDenial();
  if (denial) return { status: "error", error: denial };
  const id = field(form, "id") ?? "";
  try {
    const result = await adminChangeConsent(id, { to: "not_marketing_contact" });
    if (!result.ok) return fromFailure(result);
    refresh(id);
    return { status: "ok", message: "Marked as not a marketing contact." };
  } catch (err) {
    return unexpected("relabel", err);
  }
}

export async function deleteContactAction(_prev: EmailActionState, form: FormData): Promise<EmailActionState> {
  const denial = await adminActionDenial();
  if (denial) return { status: "error", error: denial };
  const id = field(form, "id") ?? "";
  try {
    const result = await adminDeleteContact(id, { erase: form.get("erase") === "on" });
    if (!result.ok) return fromFailure(result);
    refresh(id);
  } catch (err) {
    return unexpected("delete", err);
  }
  // Outside the try: `redirect` works by throwing, and must not be swallowed.
  redirect("/admin/email?deleted=1");
}
