/**
 * Route tests for POST /api/subscribe — the MailerLite half of the
 * /bonus funnel.
 *
 * The property worth pinning here is the one the funnel is built on: the
 * route keeps TWO answers apart.
 *
 *   · `ok`      — did the MailerLite subscription succeed?
 *   · `deliver` — may the reader have the bonus?
 *
 * A vendor outage must not cost a reader the file they were promised, and
 * it must never be reported to them as a successful subscription. Those two
 * requirements pull in opposite directions, which is exactly why they are
 * tested rather than assumed.
 *
 * Also pinned: the honeypot never reaches the vendor, a missing secret
 * fails closed rather than faking success, and no branch puts the API token
 * anywhere near a log line.
 *
 * `fetch` is stubbed: the real endpoint needs a live key, and we want to
 * assert on the exact payload the route sends.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

type Call = { url: string; init: RequestInit };
const calls: Call[] = [];
let nextResponse: Response;

function req(body: unknown, headers: Record<string, string> = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("https://valice.press/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: raw,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

beforeEach(() => {
  calls.length = 0;
  process.env.MAILERLITE_API_TOKEN = "test-token-never-logged";
  process.env.MAILERLITE_GROUP_ID = "group-123";
  nextResponse = new Response(JSON.stringify({ data: { id: "1" } }), {
    status: 200,
  });
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(nextResponse);
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/subscribe", () => {
  it("subscribes a valid email and sends the documented payload", async () => {
    const res = await POST(req({ email: "reader@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, deliver: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://connect.mailerlite.com/api/subscribers");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      email: "reader@example.com",
      groups: ["group-123"],
    });
  });

  it("trims surrounding whitespace but does not otherwise mutate the address", async () => {
    await POST(req({ email: "  Reader.Name+tag@Example.com  " }));
    expect(JSON.parse(String(calls[0].init.body)).email).toBe(
      "Reader.Name+tag@Example.com",
    );
  });

  it.each([
    ["blank", ""],
    ["whitespace only", "   "],
    ["malformed", "not-an-email"],
    ["non-string", 42],
  ])("rejects a %s email without calling MailerLite", async (_label, email) => {
    const res = await POST(req({ email }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      ok: false,
      deliver: false,
      error: "invalid-email",
    });
    expect(calls).toHaveLength(0);
  });

  it("rejects an over-length address", async () => {
    const res = await POST(req({ email: `${"a".repeat(250)}@example.com` }));
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("swallows a honeypot submission without calling MailerLite", async () => {
    const res = await POST(
      req({ email: "bot@example.com", website: "http://spam" }),
    );
    expect(res.status).toBe(200);
    // deliver:false — the bot gets no file, and learns nothing from the 200.
    expect(await res.json()).toMatchObject({ ok: true, deliver: false });
    expect(calls).toHaveLength(0);
  });

  it("rejects malformed JSON", async () => {
    const res = await POST(req("{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid-request" });
  });

  it("rejects an oversized payload before parsing", async () => {
    const res = await POST(
      req({ email: "a@b.co", pad: "x".repeat(4000) }, {
        "content-length": "9000",
      }),
    );
    expect(res.status).toBe(413);
    expect(calls).toHaveLength(0);
  });

  it.each(["MAILERLITE_API_TOKEN", "MAILERLITE_GROUP_ID"])(
    "fails closed when %s is missing — never a fake success",
    async (key) => {
      delete process.env[key];
      const res = await POST(req({ email: "reader@example.com" }));
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({
        ok: false,
        deliver: false,
        error: "not-configured",
      });
      expect(calls).toHaveLength(0);
    },
  );

  it("maps a provider 422 to a reader-facing invalid-email", async () => {
    nextResponse = new Response(JSON.stringify({ message: "bad address" }), {
      status: 422,
    });
    const res = await POST(req({ email: "reader@example.com" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ deliver: false, error: "invalid-email" });
    // The vendor's own wording must not leak through.
    expect(JSON.stringify(body)).not.toContain("bad address");
  });

  it("maps a provider 401 to not-configured, not to a reader error", async () => {
    nextResponse = new Response("{}", { status: 401 });
    const res = await POST(req({ email: "reader@example.com" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "not-configured" });
  });

  it("still delivers the bonus on 429, and forwards Retry-After", async () => {
    nextResponse = new Response("{}", {
      status: 429,
      headers: { "retry-after": "30" },
    });
    const res = await POST(req({ email: "reader@example.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: false,
      deliver: true,
      error: "list-unavailable",
    });
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("still delivers the bonus on a provider 5xx", async () => {
    nextResponse = new Response("{}", { status: 503 });
    const res = await POST(req({ email: "reader@example.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: false, deliver: true });
  });

  it("still delivers the bonus when the network throws", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("ECONNRESET")));
    const res = await POST(req({ email: "reader@example.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: false, deliver: true });
  });

  it("never writes the API token or the full address to a log", async () => {
    const spy = vi.spyOn(console, "error");
    nextResponse = new Response("{}", { status: 500 });
    await POST(req({ email: "private.person@example.com" }));
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("test-token-never-logged");
    expect(logged).not.toContain("private.person");
    // The domain is kept — enough to tell a config fault from a typo.
    expect(logged).toContain("example.com");
  });
});
