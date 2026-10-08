import { NextResponse } from "next/server";
import { isNotNull } from "drizzle-orm";

import { adminRouteDenial } from "@/lib/admin/api-auth";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import {
  ARTIFACTS_BUCKET,
  MASTERS_BUCKET,
  deleteObject,
  headObject,
  listObjects,
  putObject,
  resolveBucketNameForDiagnostics,
} from "@/lib/storage";

/**
 * GET /api/admin/storage-check — does this deployment's R2 configuration
 * actually reach the files a paid order needs?
 *
 * WHY THIS ROUTE EXISTS
 * `R2_BUCKET_MASTERS` is a *sensitive* Vercel variable: `vercel env pull`
 * returns the string `[SENSITIVE]`, and no API decrypts it. For two phases
 * the repository carried an open question it could not close — the local
 * credentials name `bookstore-masters-dev` and every master verifiably lives
 * there, while the setup guide says production uses `bookstore-masters-prod`.
 * If production really pointed at `-prod`, every direct sale would have taken
 * the customer's money and then failed to find a book to watermark. Guessing
 * was not an option and neither was shipping a checkout on top of the
 * question. The only thing that knows is the running function, so this asks
 * it — and keeps asking, before every future launch.
 *
 * WHAT IT DOES
 *   1. names the bucket this runtime resolves for MASTERS and ARTIFACTS;
 *   2. HEADs every `books.master_file_key` in the database and reports
 *      whether the object is there and how big it is;
 *   3. round-trips a small object through ARTIFACTS (put → head → delete),
 *      because the watermark worker writes there and a read-only token would
 *      fail at the last step of fulfillment rather than the first.
 *
 * It writes nothing but its own probe object under `diagnostics/`, and
 * deletes that.
 *
 * AUTH — two ways in, because the two callers are different:
 *   - a signed-in admin (`requireAdmin`, same gate as /admin);
 *   - `Authorization: Bearer $OPS_DIAG_TOKEN`, for the operator's shell and
 *     for CI, where there is no browser session to carry a Clerk cookie.
 * The token gate is off unless `OPS_DIAG_TOKEN` is set to at least 32
 * characters — an absent or short token must never become an open door.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // It writes and deletes a probe object, so a cross-site request is refused
  // even with a valid admin cookie (`sideEffects`); the bearer token is exempt.
  const denied = await adminRouteDenial(req, { allowToken: true, sideEffects: true });
  if (denied) return denied;

  const buckets: Record<string, { bucket: string | null; error?: string }> = {};
  for (const [label, key] of [
    ["masters", MASTERS_BUCKET],
    ["artifacts", ARTIFACTS_BUCKET],
  ] as const) {
    try {
      buckets[label] = { bucket: resolveBucketNameForDiagnostics(key) };
    } catch (err) {
      buckets[label] = {
        bucket: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Every master the catalogue believes it owns, checked one at a time.
  const rows = await db
    .select({ slug: books.slug, key: books.masterFileKey, title: books.title })
    .from(books)
    .where(isNotNull(books.masterFileKey));

  const masters = [];
  for (const row of rows) {
    if (!row.key) continue;
    const head = await headObject({ bucket: MASTERS_BUCKET, key: row.key });
    masters.push({ slug: row.slug, key: row.key, ...head });
  }

  // What is actually in the bucket, which catches a master uploaded under a
  // key the database does not know about (and the reverse).
  let mastersInBucket: string[] | { error: string };
  try {
    mastersInBucket = (
      await listObjects({ bucket: MASTERS_BUCKET, prefix: "books/", maxKeys: 200 })
    ).map((o) => `${o.key} (${o.size ?? "?"} bytes)`);
  } catch (err) {
    mastersInBucket = { error: err instanceof Error ? err.message : String(err) };
  }

  // The write half. The watermark worker's last act is a PUT into ARTIFACTS;
  // a token that can read masters but not write artifacts fails there, after
  // the customer has paid.
  const probeKey = `diagnostics/storage-check-${Date.now()}.txt`;
  const artifactWrite: Record<string, unknown> = { key: probeKey };
  try {
    await putObject({
      bucket: ARTIFACTS_BUCKET,
      key: probeKey,
      body: "valice storage-check",
      contentType: "text/plain",
      cacheControl: "private, max-age=0, no-store",
    });
    artifactWrite.put = "ok";
    const back = await headObject({ bucket: ARTIFACTS_BUCKET, key: probeKey });
    artifactWrite.head = back;
    await deleteObject({ bucket: ARTIFACTS_BUCKET, key: probeKey });
    artifactWrite.delete = "ok";
  } catch (err) {
    artifactWrite.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  const missing = masters.filter((m) => !m.exists);
  return NextResponse.json({
    ok: missing.length === 0 && !artifactWrite.error,
    checkedAt: new Date().toISOString(),
    vercelEnv: process.env.VERCEL_ENV ?? null,
    endpointHost: process.env.R2_ENDPOINT
      ? new URL(process.env.R2_ENDPOINT).host
      : null,
    buckets,
    masters,
    missingMasters: missing.map((m) => m.key),
    mastersInBucket,
    artifactWrite,
  });
}
