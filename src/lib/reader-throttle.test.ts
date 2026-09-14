import { afterEach, describe, expect, it } from "vitest";

import {
  DENIAL_LIMIT,
  __resetReaderThrottleForTests,
  denialIdentifier,
  registerReaderDenial,
} from "./reader-throttle";

afterEach(() => {
  __resetReaderThrottleForTests();
});

/**
 * These cases exercise the IN-PROCESS fallback, which is what runs when Upstash
 * is unconfigured — the state the local and CI environments are in, and the
 * state a production incident can put the deployment into. The Upstash path is
 * the library's own sliding window and is verified by the security harness
 * against the deployed instance rather than mocked here.
 */
describe("registerReaderDenial", () => {
  it("lets a customer be refused a few times without being throttled", () => {
    // A reader whose watermark is still running is refused once per open. That
    // must never look like an attack.
    return (async () => {
      for (let i = 0; i < DENIAL_LIMIT; i++) {
        const result = await registerReaderDenial("u:customer");
        expect(result.throttled, `refusal ${i + 1}`).toBe(false);
      }
    })();
  });

  it("throttles once the budget is spent", async () => {
    for (let i = 0; i < DENIAL_LIMIT; i++) {
      await registerReaderDenial("u:prober");
    }
    const result = await registerReaderDenial("u:prober");
    expect(result.throttled).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each identity separately", async () => {
    // One account's probing must not lock another account out of their books.
    for (let i = 0; i <= DENIAL_LIMIT; i++) {
      await registerReaderDenial("u:prober");
    }
    expect((await registerReaderDenial("u:bystander")).throttled).toBe(false);
  });
});

describe("denialIdentifier", () => {
  it("prefers the account, which survives an IP change", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9" });
    expect(denialIdentifier("user-1", headers)).toBe("u:user-1");
  });

  it("falls back to the first forwarded hop", () => {
    // Vercel prepends the client; everything after it is proxy chain and is
    // attacker-influenced, so only the first entry is used.
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2",
    });
    expect(denialIdentifier(null, headers)).toBe("ip:203.0.113.9");
  });

  it("uses x-real-ip when there is no forwarded chain", () => {
    expect(denialIdentifier(null, new Headers({ "x-real-ip": "198.51.100.4" }))).toBe(
      "ip:198.51.100.4",
    );
  });

  it("buckets identity-free requests together rather than exempting them", () => {
    // A shared bucket is the point: a caller that presents neither a session
    // nor an address is exactly the caller worth bounding.
    expect(denialIdentifier(null, new Headers())).toBe("ip:anonymous");
  });

  it("never lets a user identifier be forged through a header", () => {
    const headers = new Headers({
      "x-forwarded-for": "u:someone-else",
      "x-real-ip": "u:someone-else",
    });
    // The `ip:` prefix is what keeps the two namespaces from colliding: no
    // header value can ever be mistaken for an account bucket.
    expect(denialIdentifier(null, headers)).toBe("ip:u:someone-else");
    expect(denialIdentifier(null, headers).startsWith("u:")).toBe(false);
  });
});
