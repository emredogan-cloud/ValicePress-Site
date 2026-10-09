import { ANALYTICS_EVENTS, type AnalyticsEvent } from "@/lib/analytics";

/**
 * What `POST /api/events` will accept, as a pure function.
 *
 * It lives here and not in the route file because a Next.js route module may export only HTTP handlers
 * and route config: Next's type check for routes refuses any other export, and the one the Turbopack
 * build ships with does not enforce it while the webpack build does — so a validator exported from
 * `route.ts` was a production build that passes or fails by bundler. The contract is documented at the
 * route; this is its enforcement.
 */

const MAX_PROPS = 12;
const MAX_STRING = 120;
const PII_KEYS = /^(e-?mail|name|first_?name|last_?name|address|phone|query|q|search|user_?id|ip)$/i;
const EVENT_SET = new Set<string>(ANALYTICS_EVENTS);

type Props = Record<string, string | number | boolean | null>;

export function validateEventPayload(raw: unknown):
  | { ok: true; event: AnalyticsEvent; props: Props; path: string | null; bookSlug: string | null }
  | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "not-an-object" };
  const body = raw as Record<string, unknown>;
  const event = typeof body.event === "string" ? body.event : "";
  if (!EVENT_SET.has(event)) return { ok: false, reason: "unknown-event" };

  const props: Props = {};
  const rawProps = body.props;
  if (rawProps !== undefined && rawProps !== null) {
    if (typeof rawProps !== "object" || Array.isArray(rawProps)) {
      return { ok: false, reason: "props-not-object" };
    }
    const entries = Object.entries(rawProps as Record<string, unknown>);
    if (entries.length > MAX_PROPS) return { ok: false, reason: "too-many-props" };
    for (const [k, v] of entries) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,39}$/.test(k)) return { ok: false, reason: "bad-key" };
      if (PII_KEYS.test(k)) return { ok: false, reason: "pii-key" };
      if (v === null || typeof v === "number" || typeof v === "boolean") {
        if (typeof v === "number" && !Number.isFinite(v)) return { ok: false, reason: "bad-number" };
        props[k] = v;
      } else if (typeof v === "string") {
        if (v.length > MAX_STRING) return { ok: false, reason: "string-too-long" };
        if (v.includes("@")) return { ok: false, reason: "pii-value" };
        props[k] = v;
      } else {
        return { ok: false, reason: "bad-value" };
      }
    }
  }

  let path: string | null = null;
  if (typeof body.path === "string" && body.path) {
    const p = body.path.split("?")[0].split("#")[0];
    if (!p.startsWith("/") || p.length > 200) return { ok: false, reason: "bad-path" };
    path = p;
  }

  const slugCandidate =
    typeof props.slug === "string"
      ? props.slug
      : typeof props.bookSlug === "string"
        ? props.bookSlug
        : null;
  const bookSlug =
    slugCandidate && /^[a-z0-9-]{1,80}$/.test(slugCandidate) ? slugCandidate : null;

  return { ok: true, event: event as AnalyticsEvent, props, path, bookSlug };
}
