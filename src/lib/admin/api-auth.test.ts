import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.fn();
vi.mock("@/lib/auth", () => {
  class AdminAccessError extends Error {
    kind: string;
    constructor(kind: string) {
      super(`Admin access denied: ${kind}`);
      this.kind = kind;
    }
  }
  return { AdminAccessError, requireAdmin: () => requireAdmin() };
});

import { AdminAccessError } from "@/lib/auth";

import { adminRouteDenial, isCrossSiteRequest, opsTokenConfigured, tokenAccepted } from "./api-auth";

const TOKEN = "t".repeat(40);
const req = (headers: Record<string, string> = {}) => new Request("https://valicepress.com/api/admin/x", { headers });
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

describe("tokenAccepted — an ops token is a door that must be shut unless it is real", () => {
  it("accepts exactly the configured token", () => {
    expect(tokenAccepted(req(bearer(TOKEN)), TOKEN)).toBe(true);
  });

  it.each([
    ["no header", {}],
    ["wrong token", bearer("x".repeat(40))],
    ["right length, one character off", bearer(`${TOKEN.slice(0, -1)}X`)],
    ["shorter than expected", bearer(TOKEN.slice(0, 39))],
    ["longer than expected", bearer(`${TOKEN}x`)],
    ["not a Bearer header", { authorization: TOKEN }],
    ["Basic auth", { authorization: `Basic ${TOKEN}` }],
    ["empty bearer", { authorization: "Bearer " }],
  ])("refuses %s", (_what, headers) => {
    expect(tokenAccepted(req(headers), TOKEN)).toBe(false);
  });

  it("an unset, empty or SHORT configured token accepts nothing — not even itself", () => {
    for (const configured of [undefined, "", "short", "x".repeat(31)]) {
      expect(tokenAccepted(req(bearer(configured ?? "")), configured), String(configured)).toBe(false);
      expect(opsTokenConfigured(configured)).toBe(false);
    }
    expect(opsTokenConfigured("x".repeat(32))).toBe(true);
  });

  it("never throws on a length mismatch (timingSafeEqual would)", () => {
    expect(() => tokenAccepted(req(bearer("a")), TOKEN)).not.toThrow();
  });
});

describe("isCrossSiteRequest", () => {
  it("is true only when the browser says cross-site", () => {
    expect(isCrossSiteRequest(req({ "sec-fetch-site": "cross-site" }))).toBe(true);
    for (const v of ["same-origin", "same-site", "none"]) expect(isCrossSiteRequest(req({ "sec-fetch-site": v })), v).toBe(false);
    expect(isCrossSiteRequest(req())).toBe(false); // curl, scripts, older browsers
  });
});

describe("adminRouteDenial", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("lets an admin through", async () => {
    requireAdmin.mockResolvedValue({ email: "a@b.org", localUserId: "1" });
    expect(await adminRouteDenial(req())).toBeNull();
  });

  it("signed out → 401; signed in but not an admin (or unconfigured, or unverified) → 403 — the same body for all of those", async () => {
    requireAdmin.mockRejectedValue(new AdminAccessError("not_signed_in"));
    const out = await adminRouteDenial(req());
    expect(out?.status).toBe(401);
    expect(await out?.json()).toEqual({ ok: false, error: "unauthorized" });

    const bodies = [];
    for (const kind of ["not_admin", "unconfigured", "no_primary_email", "email_unverified"]) {
      requireAdmin.mockRejectedValue(new AdminAccessError(kind as never));
      const r = await adminRouteDenial(req());
      expect(r?.status, kind).toBe(403);
      bodies.push(await r?.json());
    }
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
    expect(bodies[0]).toEqual({ ok: false, error: "forbidden" });
  });

  it("every refusal is no-store and says nothing else", async () => {
    requireAdmin.mockRejectedValue(new AdminAccessError("not_admin"));
    const r = await adminRouteDenial(req());
    expect(r?.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(await r?.json())).not.toMatch(/ADMIN_EMAILS|@|allow/i);
  });

  it("a failure of the gate itself is a calm 503 with no stack", async () => {
    requireAdmin.mockRejectedValue(new Error("connect ECONNREFUSED 10.1.2.3:5432"));
    const r = await adminRouteDenial(req());
    expect(r?.status).toBe(503);
    expect(JSON.stringify(await r?.json())).not.toMatch(/ECONNREFUSED|10\.1/);
  });

  it("the token is honoured only when the route opts in — and then skips the session check entirely", async () => {
    vi.stubEnv("OPS_DIAG_TOKEN", TOKEN);
    requireAdmin.mockRejectedValue(new AdminAccessError("not_signed_in"));
    expect((await adminRouteDenial(req(bearer(TOKEN))))?.status).toBe(401); // route did not opt in
    expect(await adminRouteDenial(req(bearer(TOKEN)), { allowToken: true })).toBeNull();
    expect(requireAdmin).toHaveBeenCalledTimes(1);
    expect((await adminRouteDenial(req(bearer("wrong".repeat(10))), { allowToken: true }))?.status).toBe(401);
  });

  it("a route with side effects refuses a CROSS-SITE request even from a valid admin session", async () => {
    requireAdmin.mockResolvedValue({ email: "a@b.org", localUserId: "1" });
    const cross = req({ "sec-fetch-site": "cross-site" });
    expect((await adminRouteDenial(cross, { sideEffects: true }))?.status).toBe(403);
    expect(requireAdmin).not.toHaveBeenCalled(); // refused before any session work
    // the same request to a read-only route is fine, and same-origin to a side-effecting one is fine
    expect(await adminRouteDenial(cross)).toBeNull();
    expect(await adminRouteDenial(req({ "sec-fetch-site": "same-origin" }), { sideEffects: true })).toBeNull();
    expect(await adminRouteDenial(req(), { sideEffects: true })).toBeNull();
  });

  it("…but a bearer token is exempt from the cross-site rule (a browser never sends one by itself)", async () => {
    vi.stubEnv("OPS_DIAG_TOKEN", TOKEN);
    const cross = req({ "sec-fetch-site": "cross-site", ...bearer(TOKEN) });
    expect(await adminRouteDenial(cross, { allowToken: true, sideEffects: true })).toBeNull();
  });
});
