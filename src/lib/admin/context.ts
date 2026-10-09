import { AdminAccessError, requireAdmin, type AdminAccessFailureKind } from "@/lib/auth";

/**
 * The one place the admin area decides what a visitor is told.
 *
 * It used to be decided five times, in five pages, each with its own switch —
 * and two of them printed `err.message`, which read "User a@b.com is not on
 * ADMIN_EMAILS". A refusal now says THAT access was refused and nothing about
 * why: not the setting that guards the door, not whether an address is on the
 * list, not what is missing from the environment on a production deployment.
 * The reason goes to the server log, where only the operator can read it.
 */

export interface AdminContextOk {
  ok: true;
  email: string;
  localUserId: string;
}

export interface AdminBlocked {
  ok: false;
  title: string;
  body: string;
  /** Environment variables worth naming — empty on production, where naming them helps only an attacker. */
  missing: readonly string[];
}

export type AdminContext = AdminContextOk | AdminBlocked;

/** What a refused person is told for each way of being refused. Deliberately few distinct answers. */
export function describeAccessFailure(kind: AdminAccessFailureKind): { title: string; body: string } {
  if (kind === "not_signed_in") {
    return { title: "Sign in required", body: "Sign in with an administrator account to use this area." };
  }
  // not_admin, unconfigured, no_primary_email, email_unverified: the same sentence, so the answer does
  // not tell a stranger whether an address is on the list, or whether the list exists.
  return { title: "Not authorized", body: "This area is for the site's administrators." };
}

/** The variables the admin area cannot work without. */
export function missingAdminEnv(env: Record<string, string | undefined> = process.env): string[] {
  const missing: string[] = [];
  if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !env.CLERK_SECRET_KEY) {
    missing.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY");
  }
  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  return missing;
}

const onProduction = () => process.env.VERCEL_ENV === "production";

/** Resolve who is asking, as a value a page can render — never a throw, never a 500. */
export async function loadAdminContext(): Promise<AdminContext> {
  const missing = missingAdminEnv();
  if (missing.length > 0) {
    console.warn("[admin] not configured; missing:", missing.join(", "));
    return {
      ok: false,
      title: "Admin is not available",
      body: "The admin area needs sign-in and a database before it can load.",
      missing: onProduction() ? [] : missing,
    };
  }

  try {
    const { email, localUserId } = await requireAdmin();
    return { ok: true, email, localUserId };
  } catch (err) {
    if (err instanceof AdminAccessError) {
      console.warn("[admin] access refused:", err.kind);
      return { ok: false, ...describeAccessFailure(err.kind), missing: [] };
    }
    console.error("[admin] could not resolve the signed-in user:", err instanceof Error ? err.message : err);
    return {
      ok: false,
      title: "Admin is not available",
      body: "The admin area could not be loaded just now. Try again in a moment.",
      missing: [],
    };
  }
}

/**
 * For Server Actions: `null` when the caller may proceed, otherwise one short
 * sentence to send back to the browser. An action must call this FIRST — hiding
 * a button is not access control.
 */
export async function adminActionDenial(): Promise<string | null> {
  try {
    await requireAdmin();
    return null;
  } catch (err) {
    if (err instanceof AdminAccessError) {
      console.warn("[admin] action refused:", err.kind);
      return err.kind === "not_signed_in" ? "Sign in required." : "You are not authorized to do that.";
    }
    console.error("[admin] action gate failed:", err instanceof Error ? err.message : err);
    return "Something went wrong. Nothing was changed.";
  }
}
