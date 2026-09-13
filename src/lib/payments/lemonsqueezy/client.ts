/**
 * Lemon Squeezy REST client — lazy, memoized, dependency-free.
 *
 * No SDK: the four endpoints this storefront needs (create checkout, list
 * products, create product, create variant) are three lines of `fetch` each,
 * and a pinned SDK is one more thing to keep current for no gain. The JSON:API
 * content type is not optional — Lemon Squeezy returns 415 without it.
 *
 * The module imports cleanly with no credentials so that `next build`, `tsc`
 * and CI do not need a live account; the first real call throws a message that
 * names the missing variable.
 */

const API_BASE = "https://api.lemonsqueezy.com/v1";
const JSON_API = "application/vnd.api+json";

export class LemonSqueezyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "LemonSqueezyError";
  }
}

export function isLemonSqueezyConfigured(): boolean {
  return Boolean(process.env.LEMONSQUEEZY_API_KEY);
}

/** The store every product and checkout belongs to. */
export function getStoreId(): string {
  const id = process.env.LEMONSQUEEZY_STORE_ID;
  if (!id) {
    throw new Error(
      "LEMONSQUEEZY_STORE_ID is not set. It is the numeric store id from " +
        "Settings » Stores in the Lemon Squeezy dashboard (Valice Press).",
    );
  }
  return id;
}

function getApiKey(): string {
  const key = process.env.LEMONSQUEEZY_API_KEY;
  if (!key) {
    throw new Error(
      "Lemon Squeezy is not configured. Set LEMONSQUEEZY_API_KEY (server-side) " +
        "— see .env.example. Keys are mode-scoped: a key made while the store " +
        "was in test mode only ever returns test data.",
    );
  }
  return key;
}

export interface LsRequest {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  /** Abort after this many ms. A hung checkout must not hang the request. */
  timeoutMs?: number;
}

/**
 * One request against the Lemon Squeezy API.
 *
 * Errors are thrown as `LemonSqueezyError` carrying the status and the parsed
 * body, because Lemon Squeezy's useful message lives in `errors[0].detail` and
 * a bare "Request failed with 422" sends the reader to the wrong place.
 */
export async function lsRequest<T = unknown>(req: LsRequest): Promise<T> {
  const { method, path, body, timeoutMs = 20_000 } = req;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: JSON_API,
        "Content-Type": JSON_API,
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    const parsed: unknown = text ? safeJson(text) : null;

    if (!res.ok) {
      throw new LemonSqueezyError(
        `Lemon Squeezy ${method} ${path} → ${res.status}: ${describeError(parsed) ?? text.slice(0, 300)}`,
        res.status,
        parsed,
      );
    }
    return parsed as T;
  } catch (err) {
    if (err instanceof LemonSqueezyError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new LemonSqueezyError(
        `Lemon Squeezy ${method} ${path} timed out after ${timeoutMs}ms`,
        504,
        null,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Pull the human-readable detail out of a JSON:API error document. */
function describeError(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  return errors
    .map((e) => {
      if (!e || typeof e !== "object") return String(e);
      const { detail, title } = e as { detail?: string; title?: string };
      return detail ?? title ?? JSON.stringify(e);
    })
    .join("; ");
}

// ---------------------------------------------------------------------------
// Shapes — only the fields this storefront reads, typed defensively. Lemon
// Squeezy adds attributes freely; nothing here assumes a closed object.
// ---------------------------------------------------------------------------

export interface LsResource<A> {
  type: string;
  id: string;
  attributes: A;
}

export interface LsList<A> {
  data: LsResource<A>[];
  meta?: { page?: { currentPage?: number; lastPage?: number; total?: number } };
}

export interface LsProductAttrs {
  store_id: number;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  price: number | null;
  buy_now_url: string | null;
  test_mode?: boolean;
}

export interface LsVariantAttrs {
  product_id: number;
  name: string;
  slug: string;
  description: string | null;
  price?: number | null;
  status: string;
  sort: number;
  test_mode?: boolean;
}

export interface LsCheckoutAttrs {
  store_id: number;
  variant_id: number;
  url: string;
  expires_at: string | null;
  test_mode: boolean;
}

export interface LsStoreAttrs {
  name: string;
  slug: string;
  domain: string;
  url: string;
  currency: string;
  country: string;
  plan: string;
}

export interface LsWebhookAttrs {
  store_id: number;
  url: string;
  events: string[];
  last_sent_at: string | null;
  test_mode?: boolean;
}
