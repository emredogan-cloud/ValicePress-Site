"use server";

import { revalidatePath } from "next/cache";

import { adminActionDenial } from "@/lib/admin/context";
import { isUuid } from "@/lib/admin/ids";
import { describeFailure } from "@/lib/admin/stat";
import { markRequestStatus, type FreeBookRequestStatus } from "@/lib/db/queries/free-books";
import { deliverFreeBookRequest, type FulfilResult } from "@/lib/free-book-delivery";

/**
 * The free-book queue's two buttons.
 *
 * Both are thin: ask the gate FIRST (an action is a public HTTP endpoint, and a
 * hidden button is not access control), do the thing, revalidate the list. The
 * delivery itself lives in `@/lib/free-book-delivery` because the ops route
 * performs exactly the same send behind a bearer token, and the two must not be
 * allowed to drift.
 *
 * A refusal now says only that it is a refusal (`adminActionDenial`): the old
 * messages named the allow-list setting.
 */

const STATUSES: ReadonlySet<string> = new Set(["pending", "sending", "fulfilled", "failed", "duplicate", "flagged"]);

export async function fulfilFreeBookRequest(id: string): Promise<FulfilResult> {
  const denial = await adminActionDenial();
  if (denial) return { ok: false, message: denial };
  if (!isUuid(id)) return { ok: false, message: "That request no longer exists. Reload the list." };
  const result = await deliverFreeBookRequest(id);
  revalidatePath("/admin/free-books");
  revalidatePath("/admin");
  return result;
}

/** Move a request between states by hand — the operator's escape hatch. */
export async function setFreeBookRequestStatus(id: string, status: FreeBookRequestStatus, notes?: string): Promise<FulfilResult> {
  const denial = await adminActionDenial();
  if (denial) return { ok: false, message: denial };
  // The type says what `status` is; the network does not. This is a public endpoint.
  if (!STATUSES.has(status)) return { ok: false, message: "That is not a state a request can be in." };
  if (!isUuid(id)) return { ok: false, message: "That request no longer exists. Reload the list." };
  try {
    await markRequestStatus(id, status, notes);
  } catch (err) {
    console.error(`[admin/free-books] status change failed: ${describeFailure(err)}`);
    return { ok: false, message: "Something went wrong and nothing was changed." };
  }
  revalidatePath("/admin/free-books");
  revalidatePath("/admin");
  return { ok: true, message: `Marked ${status}.` };
}
