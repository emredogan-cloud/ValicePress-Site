"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import type { FreeBookRequestStatus } from "@/lib/db/queries/free-books";

import { fulfilFreeBookRequest, setFreeBookRequestStatus } from "./actions";

/**
 * The per-row operator controls.
 *
 * "Send" is the only button that does anything irreversible-ish (it mails a
 * person), so it is the only one that reports back inline: the result message
 * from the server action is shown next to the row rather than swallowed into a
 * page refresh. An operator who clicks Send and sees nothing has no way to
 * tell "sent" from "the R2 key was missing".
 *
 * `useTransition` rather than a local loading flag because the action calls
 * `revalidatePath`, and the row must stay disabled until the refreshed table
 * has actually arrived — otherwise a double-click sends the book twice.
 */
export function RequestRowActions({
  id,
  status,
  hasMaster,
}: {
  id: string;
  status: FreeBookRequestStatus;
  hasMaster: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => {
    setResult(null);
    start(async () => setResult(await fn()));
  };

  return (
    <div className="flex min-w-[190px] flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          /* `sending` disables the button here as well as on the server. The
             server claim is the real guard; this stops the operator from
             hammering a row whose send is visibly still running. */
          disabled={pending || !hasMaster || status === "sending"}
          onClick={() => run(() => fulfilFreeBookRequest(id))}
          title={
            !hasMaster
              ? "This book has no master file in R2"
              : status === "sending"
                ? "A send for this request is already in flight"
                : undefined
          }
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-emerald-bright/40 bg-emerald-bright/10 px-4 py-1 text-[11px] sm:min-h-0 sm:px-3 font-semibold text-emerald-bright transition-colors hover:bg-emerald-bright/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending && <Loader2 aria-hidden className="h-3 w-3 animate-spin" />}
          {status === "sending"
            ? "Sending…"
            : status === "fulfilled"
              ? "Send again"
              : "Send PDF"}
        </button>

        {status !== "fulfilled" && status !== "sending" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setFreeBookRequestStatus(id, "duplicate"))}
            className="min-h-11 rounded-full border border-white/12 px-4 py-1 text-[11px] text-fg-mid sm:min-h-0 sm:px-3 transition-colors hover:border-white/30 hover:text-fg-hi disabled:opacity-40"
          >
            Dismiss
          </button>
        )}

        {status !== "pending" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setFreeBookRequestStatus(id, "pending"))}
            className="min-h-11 rounded-full border border-white/12 px-4 py-1 text-[11px] text-fg-mid sm:min-h-0 sm:px-3 transition-colors hover:border-white/30 hover:text-fg-hi disabled:opacity-40"
          >
            Re-queue
          </button>
        )}
      </div>

      {result && (
        <p
          role="status"
          className={`text-[11px] leading-snug ${result.ok ? "text-emerald-bright" : "text-red-300"}`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
