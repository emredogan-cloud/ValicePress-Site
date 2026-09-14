/**
 * Enumeration throttle for the private reader (Directive §35).
 *
 * The perimeter limiter in `src/lib/rate-limit.ts` bounds ALL traffic at 100
 * requests per 10 seconds per IP. That is the right shape for a storefront and
 * the wrong shape for this particular abuse: at 600 requests a minute a signed-
 * in account can probe every book id in the catalogue several times over and
 * never come near the ceiling. What matters here is not request volume, it is
 * the volume of *refusals* — a reader who owns their book is refused zero
 * times, so a stream of denials is not a busy customer, it is someone trying
 * book ids that are not theirs.
 *
 * So this throttle counts denials only, and the counter is keyed on the
 * authenticated account when there is one. Reading a 400-page book issues
 * hundreds of range requests and is never touched by it.
 *
 * TWO BACKENDS, ONE CONTRACT
 * --------------------------
 *   • Upstash, when configured — shared across every serverless instance, so
 *     the count is real.
 *   • An in-process ring, otherwise — bounded, single-instance, and honest
 *     about being a partial defence. It is kept because a partial defence on
 *     the one warm instance is strictly better than none, and because the
 *     project runs on Fluid Compute where instances are reused across
 *     requests, so a burst from one client usually does land on one instance.
 *
 * FAILING OPEN IS THE HOUSE RULE. An unreachable Redis must never turn into a
 * customer who cannot open their book; see `checkRateLimit`. The cost of that
 * choice — an attacker who can knock out Upstash also lifts this throttle — is
 * recorded in the threat model rather than hidden.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Ten refusals in a minute. A real customer whose entitlement is still
 * watermarking generates one refusal per reader open, so the ceiling is two
 * orders of magnitude above honest use and one order below a useful probe of a
 * 30-book catalogue.
 */
export const DENIAL_LIMIT = 10;
export const DENIAL_WINDOW_SECONDS = 60;

let _limiter: Ratelimit | null | undefined;

function getDenialLimiter(): Ratelimit | null {
  if (_limiter !== undefined) return _limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _limiter = null;
    return null;
  }
  _limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(DENIAL_LIMIT, `${DENIAL_WINDOW_SECONDS} s`),
    analytics: false,
    prefix: "valice-reader-denial",
  });
  return _limiter;
}

// ---------------------------------------------------------------------------
// In-process fallback — a bounded map of identifier → recent denial timestamps.
// ---------------------------------------------------------------------------

/** Hard cap so a spray of distinct identifiers cannot grow this without end. */
const MAX_TRACKED_IDENTIFIERS = 5_000;
const localDenials = new Map<string, number[]>();

function recordLocalDenial(identifier: string): number {
  const now = Date.now();
  const cutoff = now - DENIAL_WINDOW_SECONDS * 1000;

  // Evict wholesale rather than by LRU bookkeeping: this map is a fallback,
  // and a clear at the ceiling costs one burst of leniency, not correctness.
  if (localDenials.size > MAX_TRACKED_IDENTIFIERS) localDenials.clear();

  const hits = (localDenials.get(identifier) ?? []).filter((t) => t > cutoff);
  hits.push(now);
  localDenials.set(identifier, hits);
  return hits.length;
}

/** Test seam — the module-level map would otherwise leak between cases. */
export function __resetReaderThrottleForTests(): void {
  localDenials.clear();
  _limiter = undefined;
}

export interface DenialCheck {
  /** True when this identifier has exceeded the denial budget. */
  throttled: boolean;
  /** Seconds the caller should be told to wait. */
  retryAfterSeconds: number;
}

/**
 * Count one refusal against `identifier` and say whether it has now crossed
 * the line. Call this ONLY on a path that has already decided to refuse — it
 * is a counter of denials, not a gate on requests.
 */
export async function registerReaderDenial(
  identifier: string,
): Promise<DenialCheck> {
  const limiter = getDenialLimiter();
  if (limiter) {
    try {
      const { success, reset } = await limiter.limit(identifier);
      return {
        throttled: !success,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((reset - Date.now()) / 1000),
        ),
      };
    } catch {
      // Fall through to the local ring rather than failing the request.
    }
  }

  const count = recordLocalDenial(identifier);
  return {
    throttled: count > DENIAL_LIMIT,
    retryAfterSeconds: DENIAL_WINDOW_SECONDS,
  };
}

/**
 * The bucket a refusal is charged to.
 *
 * An authenticated account is the sharper key: it survives an IP change and it
 * is the thing an operator can actually act on. Anonymous refusals fall back to
 * the forwarded IP, and to a shared bucket when even that is absent — a shared
 * bucket is deliberate, since "no identity at all" is itself worth bounding.
 */
export function denialIdentifier(
  userId: string | null,
  headers: Headers,
): string {
  if (userId) return `u:${userId}`;
  const xff = headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  if (first) return `ip:${first}`;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return `ip:${realIp}`;
  return "ip:anonymous";
}
