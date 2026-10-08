import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin gate and everything that decides what a visitor is told.
 *
 * `requireAdmin` is the single choke point every admin page, query, action and
 * API route passes through, and until now NOTHING tested it. These tests pin
 * its decision (every branch, in order), what a refused visitor is told (the
 * same sentence for every reason that is not "you have not signed in", and no
 * address, no setting name, no variable name in it), and the tri-state reader
 * that stops a database failure from being printed as a zero.
 */

const currentUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ currentUser: () => currentUser(), auth: async () => ({ userId: null }) }));
vi.mock("@/lib/db/users", () => ({ upsertLocalUser: vi.fn(async () => "local-user-1") }));
// `cache` belongs to the server build of React; here it is the identity.
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

import { AdminAccessError, evaluateAdminCandidate, requireAdmin, type AdminCandidateUser } from "@/lib/auth";

import { adminActionDenial, describeAccessFailure, loadAdminContext, missingAdminEnv } from "./context";
import { MISSING_TABLE_REASON, READ_FAILED_MESSAGE, describeFailure, readStat, unavailable } from "./stat";

const ALLOW = ["boss@valicepress.com"];

function user(over: Partial<AdminCandidateUser> & { email?: string; verification?: unknown } = {}): AdminCandidateUser {
  const { email = "boss@valicepress.com", ...rest } = over;
  // `verification: undefined` must mean "Clerk sent no verification record", not "use the default".
  const verification = "verification" in over ? over.verification : { status: "verified" };
  delete (rest as { verification?: unknown }).verification;
  return {
    id: "user_1",
    firstName: "Ada",
    lastName: "Lovelace",
    primaryEmailAddressId: "em_1",
    emailAddresses: [{ id: "em_1", emailAddress: email, verification: verification as { status?: string | null } | null }],
    ...rest,
  };
}

describe("evaluateAdminCandidate — every branch, in order", () => {
  it("lets an allow-listed, verified primary address in", () => {
    expect(evaluateAdminCandidate(user(), ALLOW)).toEqual({ ok: true, email: "boss@valicepress.com" });
  });

  it("an empty allow-list lets NOBODY in, even a signed-in user", () => {
    expect(evaluateAdminCandidate(user(), [])).toEqual({ ok: false, kind: "unconfigured" });
    expect(evaluateAdminCandidate(null, [])).toEqual({ ok: false, kind: "unconfigured" });
  });

  it("no session is 'not signed in'", () => {
    expect(evaluateAdminCandidate(null, ALLOW)).toEqual({ ok: false, kind: "not_signed_in" });
  });

  it("a user with no primary address — or a primary id that matches nothing — is refused", () => {
    expect(evaluateAdminCandidate(user({ primaryEmailAddressId: null }), ALLOW)).toEqual({ ok: false, kind: "no_primary_email" });
    expect(evaluateAdminCandidate(user({ primaryEmailAddressId: "em_nope" }), ALLOW)).toEqual({ ok: false, kind: "no_primary_email" });
    expect(evaluateAdminCandidate(user({ emailAddresses: [] }), ALLOW)).toEqual({ ok: false, kind: "no_primary_email" });
  });

  it("an address that is not on the list is refused", () => {
    expect(evaluateAdminCandidate(user({ email: "stranger@example.com" }), ALLOW)).toEqual({ ok: false, kind: "not_admin" });
  });

  it("matches case-insensitively and ignores stray whitespace in what Clerk returns", () => {
    expect(evaluateAdminCandidate(user({ email: "  Boss@ValicePress.com " }), ALLOW)).toEqual({ ok: true, email: "boss@valicepress.com" });
  });

  it.each([null, undefined, { status: "unverified" }, { status: "failed" }, { status: "expired" }, { status: "transferable" }, { status: null }, {}])(
    "an allow-listed address Clerk has NOT verified (%j) is refused",
    (verification) => {
      expect(evaluateAdminCandidate(user({ verification }), ALLOW)).toEqual({ ok: false, kind: "email_unverified" });
    },
  );

  it("is decided on the PRIMARY address — an allow-listed secondary address elevates nobody", () => {
    const sneaky: AdminCandidateUser = {
      id: "user_2",
      primaryEmailAddressId: "em_1",
      emailAddresses: [
        { id: "em_1", emailAddress: "stranger@example.com", verification: { status: "verified" } },
        { id: "em_2", emailAddress: "boss@valicepress.com", verification: { status: "verified" } },
      ],
    };
    expect(evaluateAdminCandidate(sneaky, ALLOW)).toEqual({ ok: false, kind: "not_admin" });
  });

  it("asks 'on the list?' BEFORE 'verified?', so an unverified stranger learns nothing about the list", () => {
    // Not on the list + unverified: the refusal is not_admin, not email_unverified.
    expect(evaluateAdminCandidate(user({ email: "stranger@example.com", verification: null }), ALLOW)).toEqual({ ok: false, kind: "not_admin" });
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    currentUser.mockReset();
    vi.stubEnv("ADMIN_EMAILS", "boss@valicepress.com, Other@Example.com");
  });

  it("returns the identity for an admin, with the local user id", async () => {
    currentUser.mockResolvedValue(user());
    await expect(requireAdmin()).resolves.toEqual({ email: "boss@valicepress.com", localUserId: "local-user-1" });
  });

  it("throws AdminAccessError with the right kind — and a message that names no one and nothing", async () => {
    currentUser.mockResolvedValue(user({ email: "stranger@example.com" }));
    const err = await requireAdmin().catch((e) => e);
    expect(err).toBeInstanceOf(AdminAccessError);
    expect((err as AdminAccessError).kind).toBe("not_admin");
    expect((err as Error).message).not.toMatch(/stranger|@|ADMIN_EMAILS/i);
  });

  it("an unset allow-list never even asks Clerk who is there", async () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    await expect(requireAdmin()).rejects.toMatchObject({ kind: "unconfigured" });
    expect(currentUser).not.toHaveBeenCalled();
  });

  it("signed out → not_signed_in; unverified → email_unverified", async () => {
    currentUser.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toMatchObject({ kind: "not_signed_in" });
    currentUser.mockResolvedValue(user({ verification: { status: "unverified" } }));
    await expect(requireAdmin()).rejects.toMatchObject({ kind: "email_unverified" });
  });
});

describe("what a refused visitor is told", () => {
  it("is the SAME for every reason except 'not signed in'", () => {
    const same = ["not_admin", "unconfigured", "no_primary_email", "email_unverified"] as const;
    const first = describeAccessFailure(same[0]);
    for (const k of same) expect(describeAccessFailure(k), k).toEqual(first);
    expect(describeAccessFailure("not_signed_in")).not.toEqual(first);
  });

  it("never names a setting, a variable or an address", () => {
    for (const k of ["not_admin", "unconfigured", "no_primary_email", "email_unverified", "not_signed_in"] as const) {
      const { title, body } = describeAccessFailure(k);
      expect(`${title} ${body}`, k).not.toMatch(/ADMIN_EMAILS|allowlist|allow-list|CLERK|DATABASE|@|env/i);
    }
  });
});

describe("missingAdminEnv", () => {
  it("names what is missing, and only what is", () => {
    expect(missingAdminEnv({})).toEqual(["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"]);
    expect(missingAdminEnv({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk", CLERK_SECRET_KEY: "sk", DATABASE_URL: "x" })).toEqual([]);
    expect(missingAdminEnv({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk", CLERK_SECRET_KEY: "sk" })).toEqual(["DATABASE_URL"]);
  });
});

describe("loadAdminContext and adminActionDenial", () => {
  beforeEach(() => {
    currentUser.mockReset();
    vi.stubEnv("ADMIN_EMAILS", "boss@valicepress.com");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    vi.stubEnv("DATABASE_URL", "postgres://u:p@h/bookstore");
    vi.stubEnv("VERCEL_ENV", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("an admin gets a context", async () => {
    currentUser.mockResolvedValue(user());
    await expect(loadAdminContext()).resolves.toEqual({ ok: true, email: "boss@valicepress.com", localUserId: "local-user-1" });
    await expect(adminActionDenial()).resolves.toBeNull();
  });

  it("a non-admin gets a calm refusal as a VALUE, not a throw — and the reason goes to the log, not the page", async () => {
    currentUser.mockResolvedValue(user({ email: "stranger@example.com" }));
    const ctx = await loadAdminContext();
    expect(ctx).toMatchObject({ ok: false, title: "Not authorized" });
    expect(JSON.stringify(ctx)).not.toMatch(/stranger|ADMIN_EMAILS/);
    expect(console.warn).toHaveBeenCalledWith("[admin] access refused:", "not_admin");
    await expect(adminActionDenial()).resolves.toBe("You are not authorized to do that.");
  });

  it("an unexpected failure (Clerk down, database down) is a calm notice with no error text in it", async () => {
    currentUser.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:5432 secret-token-123"));
    const ctx = await loadAdminContext();
    expect(ctx.ok).toBe(false);
    expect(JSON.stringify(ctx)).not.toMatch(/ECONNREFUSED|secret|10\.0/);
    await expect(adminActionDenial()).resolves.toBe("Something went wrong. Nothing was changed.");
  });

  it("missing configuration names the variables off production, and hides them ON production", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const dev = await loadAdminContext();
    expect(dev).toMatchObject({ ok: false, missing: ["DATABASE_URL"] });
    vi.stubEnv("VERCEL_ENV", "production");
    const prod = await loadAdminContext();
    expect(prod).toMatchObject({ ok: false, missing: [] });
  });

  it("signed out is told to sign in", async () => {
    currentUser.mockResolvedValue(null);
    await expect(loadAdminContext()).resolves.toMatchObject({ ok: false, title: "Sign in required" });
    await expect(adminActionDenial()).resolves.toBe("Sign in required.");
  });
});

describe("readStat — a failure is a failure, a missing source is a missing source, and zero is zero", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("zero, empty and false are real answers", async () => {
    expect(await readStat("a", async () => 0)).toEqual({ state: "ok", value: 0 });
    expect(await readStat("b", async () => [])).toEqual({ state: "ok", value: [] });
    expect(await readStat("c", async () => false)).toEqual({ state: "ok", value: false });
  });

  it("a failed read is an ERROR — it does not come back as zeros", async () => {
    const stat = await readStat("orders", async () => {
      throw new Error("connection terminated unexpectedly");
    });
    expect(stat).toEqual({ state: "error", message: READ_FAILED_MESSAGE });
    expect(JSON.stringify(stat)).not.toMatch(/connection terminated/);
  });

  it("a table that has not been created is UNAVAILABLE, by code and by message", async () => {
    const byCode = await readStat("x", async () => {
      throw Object.assign(new Error("boom"), { code: "42P01" });
    });
    const byMessage = await readStat("y", async () => {
      throw new Error('relation "analytics_events" does not exist');
    });
    expect(byCode).toEqual({ state: "unavailable", reason: MISSING_TABLE_REASON });
    expect(byMessage).toEqual({ state: "unavailable", reason: MISSING_TABLE_REASON });
  });

  it("finds the missing table even when Drizzle has WRAPPED the driver's error (the real shape)", async () => {
    const driver = Object.assign(new Error('relation "analytics_events" does not exist'), { name: "NeonDbError", code: "42P01" });
    const wrapped = Object.assign(new Error('Failed query: select "event" from "analytics_events" where x = $1\nparams: me@example.com'), { name: "DrizzleQueryError", cause: driver });
    expect(await readStat("events", async () => { throw wrapped; })).toEqual({ state: "unavailable", reason: MISSING_TABLE_REASON });
    // and a wrapped error of another kind is an error, not a missing table
    const other = Object.assign(new Error("Failed query: select 1"), { cause: Object.assign(new Error("deadlock detected"), { code: "40P01" }) });
    expect(await readStat("x", async () => { throw other; })).toMatchObject({ state: "error" });
  });

  it("what it logs is the root cause — never the SQL, never its parameters (a search puts an email there)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const driver = Object.assign(new Error("deadlock detected\nDETAIL: Process 1 waits"), { name: "NeonDbError", code: "40P01" });
    const wrapped = Object.assign(new Error('Failed query: select * from contacts where email ilike $1\nparams: %jane@example.com%'), { cause: driver });
    await readStat("contacts", async () => { throw wrapped; });
    const logged = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("NeonDbError 40P01: deadlock detected");
    expect(logged).not.toMatch(/jane@example\.com|select \*|params:/);
    expect(describeFailure("plain string")).toBe("plain string");
  });

  it("an access failure is NOT a stat problem: it is re-thrown for the page", async () => {
    await expect(
      readStat("z", async () => {
        throw new AdminAccessError("not_admin");
      }),
    ).rejects.toBeInstanceOf(AdminAccessError);
  });

  it("`unavailable()` is how a card says it has no source", () => {
    expect(unavailable("Sales data unavailable — no connected sales source")).toEqual({
      state: "unavailable",
      reason: "Sales data unavailable — no connected sales source",
    });
  });
});
