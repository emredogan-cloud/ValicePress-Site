/**
 * Route tests for POST /api/newsletter.
 *
 * The route already existed; what is new is the `source` tag that makes
 * ONE audience segmentable. These tests pin the two properties that make
 * that tag safe rather than merely present:
 *
 *   · `source` is untrusted browser input, so only an allow-listed value
 *     ever reaches the stored contact record — an arbitrary string must
 *     not become a contact property
 *   · a bad tag is DROPPED, not rejected: a mistyped or stale tag must
 *     never cost a person their subscription
 *
 * Plus the pre-existing contract (validation, fail-closed on missing
 * provider env, 405 on GET), which had no coverage at all.
 *
 * Resend is mocked: the real SDK needs a network key, and we want to
 * assert on the exact payload the route hands it.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---- Resend mock ---------------------------------------------------------
const created: Array<Record<string, unknown>> = [];
let createResult: {
  data?: unknown;
  error?: { name: string; message?: string };
} = {
  data: { id: "contact_1" },
};
/** Queued results, consumed in order — lets a test model the retry. */
let createResults: Array<typeof createResult> = [];
let createThrows = false;

// `after()` needs a live request context, which a unit test has no way to
// provide. Run the callback inline instead: the welcome-email send is still
// exercised, just synchronously with the handler rather than after it.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (fn: () => unknown) => {
      void fn();
    },
  };
});

vi.mock("resend", () => ({
  Resend: class {
    contacts = {
      create: async (payload: Record<string, unknown>) => {
        if (createThrows) throw new Error("network down");
        created.push(payload);
        return createResults.length ? createResults.shift()! : createResult;
      },
    };
  },
}));

/**
 * WHICH TEST IS ASKING. Each test bumps this in `beforeEach`; `post()` remembers the value it started under.
 *
 * Why it exists (2026-10-09, reproduced and read, not guessed): the route is imported fresh for every test
 * (`vi.resetModules()` below), and that import — drizzle, the Resend SDK, next/server — took more than the default
 * five seconds on a machine that was busy building. Vitest abandoned the first test at 5 s, but an abandoned test's
 * function keeps running: when the import finally finished it called `contacts.create` and pushed its own
 * `codex-verify` into the SHARED `created` array — in the middle of the next test, which then read
 * `created[0].properties.source` and found "codex-verify" where it had asked for "home". One timeout, two failures,
 * and the second named the wrong culprit. So: a generous budget for the cold import (below), and a test that has
 * ended can no longer reach the provider.
 */
let epoch = 0;

async function post(body: unknown) {
  const startedUnder = epoch;
  const { POST } = await import("./route");
  if (startedUnder !== epoch) throw new Error("abandoned: the test that asked for this request has already ended");
  return POST(
    new Request("https://example.test/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

/** The route's import graph, cold, on a busy machine. The default is 5 s; this took longer. */
const COLD_IMPORT_MS = 60_000;

describe("POST /api/newsletter", { timeout: 30_000 }, () => {
  // Pay for the first (cold) import once, here, with a budget that matches it — not inside whichever test runs first.
  beforeAll(async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_AUDIENCE_ID", "aud_test");
    await import("./route");
  }, COLD_IMPORT_MS);

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    epoch += 1;
    created.length = 0;
    createResult = { data: { id: "contact_1" } };
    createResults = [];
    createThrows = false;
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_AUDIENCE_ID", "aud_test");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ---- the source tag ----------------------------------------------------

  it("records an allow-listed source as a contact property", async () => {
    const res = await post({ email: "a@b.co", source: "codex-verify" });
    expect(res.status).toBe(200);
    expect(created).toHaveLength(1);
    const props = created[0].properties as Record<string, string>;
    expect(props.source).toBe("codex-verify");
    expect(props.signup_purpose).toBe("product-updates");
  });

  it.each(["home", "article", "category", "codex-verify"])(
    "accepts the %s source",
    async (source) => {
      await post({ email: "a@b.co", source });
      expect(
        (created[0].properties as Record<string, string>).source,
      ).toBe(source);
    },
  );

  it("DROPS an unknown source but still subscribes", async () => {
    // A bad tag is our bug, not the subscriber's. Rejecting here would
    // cost a real person their subscription over a typo in our code.
    const res = await post({ email: "a@b.co", source: "not-a-real-source" });
    expect(res.status).toBe(200);
    const props = created[0].properties as Record<string, string>;
    expect(props.source).toBeUndefined();
    // The consent record is still written — consent is not conditional on
    // us having correctly identified which form it came from.
    expect(props.signup_purpose).toBe("product-updates");
  });

  it("never writes arbitrary input into the contact record", async () => {
    await post({ email: "a@b.co", source: "<script>alert(1)</script>" });
    expect(JSON.stringify(created[0])).not.toContain("script");
  });

  it("records consent even when no source is given", async () => {
    // Consent is recorded on every subscription, not only tagged ones.
    // `source` is analytics; `signup_purpose`, `consent_text` and
    // `consent_at` are the record of what this person agreed to, and that
    // must exist for every subscriber or it is not a consent record.
    await post({ email: "a@b.co" });
    const props = created[0].properties as Record<string, string>;
    expect(props.source).toBeUndefined();
    expect(props.signup_purpose).toBe("product-updates");
    expect(props.consent_text).toMatch(/unsubscribe at any time/i);
    expect(Date.parse(props.consent_at)).not.toBeNaN();
  });

  it("does not record IP, user agent or country", async () => {
    await post({ email: "a@b.co", source: "home" });
    const blob = JSON.stringify(created[0]).toLowerCase();
    for (const forbidden of ["ip", "useragent", "user_agent", "country"]) {
      expect(Object.keys(created[0]).join(",").toLowerCase()).not.toContain(
        forbidden,
      );
    }
    expect(blob).not.toContain("mozilla");
  });

  // ---- validation --------------------------------------------------------

  it("normalizes the email to lower case and trims it", async () => {
    await post({ email: "  A@B.CO  " });
    expect(created[0].email).toBe("a@b.co");
  });

  it.each(["", "nope", "a@b", "a b@c.co"])(
    "rejects %o as invalid-email",
    async (email) => {
      const res = await post({ email });
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        ok: false,
        error: "invalid-email",
      });
      expect(created).toHaveLength(0);
    },
  );

  it("rejects an over-long address without calling the provider", async () => {
    const res = await post({ email: `${"a".repeat(250)}@b.co` });
    expect(res.status).toBe(400);
    expect(created).toHaveLength(0);
  });

  it("rejects a non-JSON body", async () => {
    const res = await post("not json");
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: "invalid-json",
    });
  });

  // ---- provider failure --------------------------------------------------

  it("FAILS CLOSED with 503 when the provider env is missing", async () => {
    vi.stubEnv("RESEND_AUDIENCE_ID", "");
    const res = await post({ email: "a@b.co" });
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: "provider-unavailable",
    });
    expect(created).toHaveLength(0);
  });

  it("reports invalid-email only when the provider faults the ADDRESS", async () => {
    createResult = {
      error: { name: "validation_error", message: "Invalid `email` field." },
    };
    const res = await post({ email: "a@b.co" });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: "invalid-email",
    });
  });

  it("does NOT blame the address for a validation error that is not about it", async () => {
    // The regression this pins: every `validation_error` used to map to
    // `invalid-email`. A misconfigured audience therefore told people with
    // perfectly good addresses that their address was malformed — which
    // they cannot act on and will not report, because they assume it is
    // their own typo.
    createResult = {
      error: { name: "validation_error", message: "Something else entirely." },
    };
    const res = await post({ email: "a@b.co" });
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: "internal-error",
    });
  });

  it("still subscribes when the audience has no consent properties declared", async () => {
    // Resend rejects the whole create with 422 when a contact carries a
    // property the audience does not declare, and there is no API to
    // declare one. Losing the consent metadata is bad; losing the
    // subscription of someone who asked for it is worse.
    createResults = [
      {
        error: {
          name: "validation_error",
          message: "One or more properties do not exist",
        },
      },
      { data: { id: "contact_1" } },
    ];
    const res = await post({ email: "a@b.co", source: "home" });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      status: "subscribed",
      consentRecorded: false,
    });

    // First attempt carries the consent record; the retry drops it and
    // nothing else.
    expect(created).toHaveLength(2);
    expect(created[0].properties).toMatchObject({ source: "home" });
    expect(created[1]).not.toHaveProperty("properties");
    expect(created[1]).toMatchObject({ email: "a@b.co", unsubscribed: false });
  });

  it("returns 500 on an unexpected provider throw", async () => {
    createThrows = true;
    const res = await post({ email: "a@b.co" });
    expect(res.status).toBe(500);
  });

  it("answers GET with 405 and an Allow header", async () => {
    const { GET } = await import("./route");
    const res = GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });
});
