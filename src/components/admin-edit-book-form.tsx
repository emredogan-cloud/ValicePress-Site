"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  updateBook,
  type UpdateBookInput,
} from "@/app/admin/actions";
import type {
  AdminCategory,
  BookEditData,
  BookStatus,
} from "@/lib/db/queries/admin";

/**
 * Admin edit form for a single book row (SUB-PR 4.4).
 *
 * Design choices:
 *   - **Uncontrolled inputs + `defaultValue`** — 13+ fields would make
 *     `useState`-per-field heavy for no real benefit. The only field
 *     that needs reactive state is `status` (it's a `<select>` and we
 *     want to read it on submit). Everything else is read via
 *     `new FormData(form)` on submit.
 *   - **Typed action call (not `<form action={…}>`)** — `updateBook`
 *     takes a typed `UpdateBookInput`, not raw FormData. We intercept
 *     `onSubmit`, build the typed object, and call the action via
 *     `useTransition` so we can show pending / success / error inline.
 *   - **Brief success state then `router.push('/admin')`** — admins
 *     edit-then-go-back to the catalog table. 600 ms gives them a
 *     visible confirmation; the redirect lets them keep working.
 *   - **`originalSlug` carried in props (not a hidden input)** — used
 *     for ISR invalidation of the old URL when the admin changes the
 *     slug. Source of truth is the data we loaded from the DB.
 */

interface AdminEditBookFormProps {
  book: BookEditData;
  /** All categories/collections to offer as checkboxes. */
  allCategories: AdminCategory[];
}

type FormResult =
  | { kind: "ok" }
  | { kind: "error"; message: string }
  | null;

export function AdminEditBookForm({
  book,
  allCategories,
}: AdminEditBookFormProps) {
  // Only `status` needs reactive state — used to drive the StatusBadge
  // hint above the select AND read at submit time (selects don't always
  // round-trip cleanly via FormData when the form has many controls).
  const [status, setStatus] = useState<BookStatus>(book.status);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<FormResult>(null);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const getStr = (key: string): string => {
      const v = fd.get(key);
      return typeof v === "string" ? v.trim() : "";
    };
    const getStrOrNull = (key: string): string | null => {
      const v = getStr(key);
      return v === "" ? null : v;
    };
    const getNumOrNull = (key: string): number | null => {
      const v = getStr(key);
      if (v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const priceCentsRaw = Number(getStr("priceCents"));
    if (!Number.isFinite(priceCentsRaw) || priceCentsRaw < 0) {
      setResult({
        kind: "error",
        message: "Price (cents) must be a non-negative number.",
      });
      return;
    }

    const input: UpdateBookInput = {
      id: book.id,
      originalSlug: book.slug,
      title: getStr("title"),
      slug: getStr("slug"),
      subtitle: getStrOrNull("subtitle"),
      description: getStrOrNull("description"),
      priceCents: priceCentsRaw,
      currency: getStr("currency") || "USD",
      language: getStr("language") || "en",
      coverKey: getStrOrNull("coverKey"),
      sampleKey: getStrOrNull("sampleKey"),
      masterFileKey: getStrOrNull("masterFileKey"),
      pageCount: getNumOrNull("pageCount"),
      isbn: getStrOrNull("isbn"),
      providerPriceId: getStrOrNull("providerPriceId"),
      status,
      authorNames: getStr("authorNames")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      categoryIds: fd
        .getAll("categoryIds")
        .filter((v): v is string => typeof v === "string"),
    };

    startTransition(async () => {
      const r = await updateBook(input);
      if (r.ok) {
        setResult({ kind: "ok" });
        // Brief visible confirmation, then back to the catalog table.
        // The /admin route re-fetches `listAllBooksForAdmin` on navigation,
        // so the updated row appears immediately.
        window.setTimeout(() => router.push("/admin"), 600);
      } else {
        setResult({ kind: "error", message: r.error });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Field
        label="Title"
        name="title"
        required
        defaultValue={book.title}
        disabled={pending}
      />
      <Field
        label="Slug"
        name="slug"
        required
        defaultValue={book.slug}
        disabled={pending}
        help="URL-safe identifier. Changing this rewrites the public URL — the old URL will 404 once the new one is published."
      />
      <Field
        label="Subtitle"
        name="subtitle"
        defaultValue={book.subtitle ?? ""}
        disabled={pending}
      />
      <Field
        label="Description"
        name="description"
        textarea
        defaultValue={book.description ?? ""}
        disabled={pending}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Price (cents)"
          name="priceCents"
          type="number"
          required
          defaultValue={String(book.priceCents)}
          disabled={pending}
          help="1500 = $15.00"
        />
        <Field
          label="Currency"
          name="currency"
          defaultValue={book.currency}
          disabled={pending}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Language"
          name="language"
          defaultValue={book.language}
          disabled={pending}
        />
        <Field
          label="Page count"
          name="pageCount"
          type="number"
          defaultValue={book.pageCount !== null ? String(book.pageCount) : ""}
          disabled={pending}
        />
      </div>

      <Field
        label="ISBN"
        name="isbn"
        defaultValue={book.isbn ?? ""}
        disabled={pending}
      />

      <Field
        label="Authors"
        name="authorNames"
        defaultValue={book.authorNames}
        disabled={pending}
        help="Comma-separated display names. Created automatically if new (e.g. Marcus Aurelius, Gregory Hays)."
      />

      <fieldset className="space-y-3 rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-5">
        <legend className="px-2 text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">
          Collections / categories
        </legend>
        {allCategories.length === 0 ? (
          <p className="text-xs leading-relaxed text-fg-mid">
            No categories yet. Use &ldquo;Ensure core collections&rdquo; on the
            admin dashboard, then reopen this form.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {allCategories.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2.5 text-sm text-fg-mid"
              >
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={c.id}
                  defaultChecked={book.categoryIds.includes(c.id)}
                  disabled={pending}
                  className="h-4 w-4 flex-shrink-0 rounded border border-white/[0.2] bg-white/[0.03] accent-emerald-bright"
                />
                {c.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-6 rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-5">
        <legend className="px-2 text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">
          R2 object keys
        </legend>
        <Field
          label="Cover key"
          name="coverKey"
          defaultValue={book.coverKey ?? ""}
          disabled={pending}
        />
        <Field
          label="Sample key"
          name="sampleKey"
          defaultValue={book.sampleKey ?? ""}
          disabled={pending}
        />
        <Field
          label="Master file key"
          name="masterFileKey"
          defaultValue={book.masterFileKey ?? ""}
          disabled={pending}
          help="Required before publishing — watermark worker fails fast without it."
        />
      </fieldset>

      <fieldset className="space-y-6 rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-5">
        <legend className="px-2 text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">
          Merchant of Record (Lemon Squeezy)
        </legend>
        <Field
          label="Lemon Squeezy variant ID"
          name="providerPriceId"
          defaultValue={book.providerPriceId ?? ""}
          disabled={pending}
          help="Example: pri_01h8z…. Checkout fails fast for any cart item without this id."
        />
      </fieldset>

      <fieldset className="space-y-3 rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-5">
        <legend className="px-2 text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">
          Publish status
        </legend>
        <label
          htmlFor="status"
          className="block text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-soft"
        >
          Status
        </label>
        <p className="text-xs leading-relaxed text-fg-mid">
          <strong className="font-medium text-fg-hi">draft</strong> = hidden
          from storefront ·{" "}
          <strong className="font-medium text-emerald-bright">published</strong> = live
          (the catalog includes it) ·{" "}
          <strong className="font-medium text-[#ffce63]">archived</strong> =
          hidden from storefront, history preserved
        </p>
        <select
          id="status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.currentTarget.value as BookStatus)}
          disabled={pending}
          className="block h-10 w-full max-w-sm rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-sm text-fg-hi focus-visible:border-emerald-bright/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/20"
        >
          <option value="draft" className="bg-[#0a1410]">
            draft
          </option>
          <option value="published" className="bg-[#0a1410]">
            published
          </option>
          <option value="archived" className="bg-[#0a1410]">
            archived
          </option>
        </select>
        {status === "published" && book.publishedAt === null && (
          <p className="text-xs text-emerald-bright">
            Publishing for the first time —{" "}
            <code className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 text-[12px] lg:text-[10px]">
              published_at
            </code>{" "}
            will be stamped to now on save.
          </p>
        )}
      </fieldset>

      {result?.kind === "error" && (
        <p
          role="alert"
          className="rounded-[14px] border border-[#ff7a7a]/30 bg-[#ff7a7a]/8 px-4 py-3 text-sm text-[#ff9b9b]"
        >
          {result.message}
        </p>
      )}
      {result?.kind === "ok" && (
        <p
          role="status"
          className="rounded-[14px] border border-emerald-bright/30 bg-emerald-bright/8 px-4 py-3 text-sm text-emerald-bright"
        >
          Saved. Returning to the catalog…
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="home-cta-primary inline-flex h-11 items-center justify-center rounded-full px-7 text-sm font-semibold tracking-tight disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending
            ? "Saving…"
            : result?.kind === "ok"
              ? "Saved"
              : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          disabled={pending}
          className="text-sm text-fg-mid transition-colors hover:text-fg-hi disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Field — inline helper kept local so the edit form is self-contained.
// Matches the visual treatment of the FormField in `src/app/admin/page.tsx`.
// ---------------------------------------------------------------------------

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  textarea?: boolean;
  help?: string;
  disabled?: boolean;
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  textarea,
  help,
  disabled,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[12px] lg:text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-soft"
      >
        {label}
        {required && <span className="text-[#ff9b9b]"> *</span>}
      </label>
      {help && <p className="mt-1.5 text-xs text-fg-mid">{help}</p>}
      {textarea ? (
        <textarea
          id={name}
          name={name}
          required={required}
          defaultValue={defaultValue}
          disabled={disabled}
          rows={4}
          className="mt-2 block w-full rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-fg-hi placeholder:text-fg-fade focus-visible:border-emerald-bright/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          disabled={disabled}
          className="mt-2 block h-10 w-full rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-sm text-fg-hi placeholder:text-fg-fade focus-visible:border-emerald-bright/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-bright/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
      )}
    </div>
  );
}
