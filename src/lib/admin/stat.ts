import { AdminAccessError } from "@/lib/auth";

/**
 * A dashboard number is one of three things, and the dashboard must say which.
 *
 *   ok           — we read it, and here it is (zero is a real answer);
 *   unavailable  — there is no source to read it from ("Sales data unavailable —
 *                  no connected sales source"), or the table that holds it has
 *                  not been created on this database yet;
 *   error        — there IS a source and reading it failed.
 *
 * The old dashboard collapsed all three into a number: `safeQuery` turned a
 * database failure into zeros, so an outage read "0 orders, 0 users" — a
 * fabrication that looks exactly like a quiet day. Here a failure is shown as a
 * failure and a missing source as a missing source, and a zero only ever means
 * zero.
 */
export type Stat<T> =
  | { state: "ok"; value: T }
  | { state: "unavailable"; reason: string }
  | { state: "error"; message: string };

export const unavailable = (reason: string): Stat<never> => ({ state: "unavailable", reason });

/**
 * The error that actually happened. Drizzle wraps the driver's error in its own
 * ("Failed query: select … params: …") and keeps the real one on `cause`; the
 * wrapper's message carries the SQL and its parameters, so it is both useless
 * for telling what went wrong and unfit for a log (a search by email puts the
 * email in the parameters).
 */
function rootCause(err: unknown): unknown {
  let current = err;
  for (let depth = 0; depth < 6; depth++) {
    const next = current && typeof current === "object" ? (current as { cause?: unknown }).cause : undefined;
    if (!next) break;
    current = next;
  }
  return current;
}

/** Postgres "undefined_table" — the migration that creates it has not been applied here. */
function isMissingTable(err: unknown): boolean {
  // Check every layer: the code sits on the driver's error, which is not always the outermost.
  let current: unknown = err;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const { code, message, cause } = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (code === "42P01") return true;
    if (typeof message === "string" && /relation ".*" does not exist/i.test(message)) return true;
    current = cause;
  }
  return false;
}

/** One line safe to log: what kind of error, and what Postgres said — never the SQL or its parameters. */
export function describeFailure(err: unknown): string {
  const root = rootCause(err);
  if (root instanceof Error) {
    const code = (root as { code?: unknown }).code;
    return `${root.name}${typeof code === "string" ? ` ${code}` : ""}: ${root.message.split("\n")[0].slice(0, 200)}`;
  }
  return String(root).slice(0, 200);
}

export const MISSING_TABLE_REASON = "Not available on this database yet — the table that holds it has not been created.";
export const READ_FAILED_MESSAGE = "Could not be read just now. The details are in the server log.";

/**
 * Run one read and classify the outcome. An `AdminAccessError` is NOT a stat
 * problem — it means the caller was never allowed to see any of this — so it is
 * re-thrown for the page to handle.
 */
export async function readStat<T>(label: string, run: () => Promise<T>): Promise<Stat<T>> {
  try {
    return { state: "ok", value: await run() };
  } catch (err) {
    if (err instanceof AdminAccessError) throw err;
    if (isMissingTable(err)) {
      console.warn(`[admin] ${label}: table missing`);
      return { state: "unavailable", reason: MISSING_TABLE_REASON };
    }
    console.warn(`[admin] ${label} failed: ${describeFailure(err)}`);
    return { state: "error", message: READ_FAILED_MESSAGE };
  }
}
