/**
 * Grant a reader entitlement by hand, for testing (Directive §90).
 *
 * WHY THIS IS NOT A BACK DOOR
 * ---------------------------
 * The directive is explicit that development needs a way to create an
 * entitlement without a purchase, and equally explicit that it must never
 * become an undocumented permanent bypass. So this is a SCRIPT, run by a person
 * who already holds the database credentials, and not an endpoint, a flag, or a
 * header that a deployed application honours. There is no code path in the
 * running site that reaches it. Removing this file removes nothing from
 * production.
 *
 * It writes real rows through the real schema — a real order, a real
 * entitlement, the real watermark worker against the real master — so what it
 * produces is indistinguishable from a purchase except in how it was paid for.
 * That is the point: a test fixture that takes a different code path from a
 * customer proves nothing about the path a customer takes.
 *
 * Rows it creates are marked: the order's provider reference begins `test-`,
 * so they can be found and removed, and so nobody mistakes one for revenue.
 *
 * Dry by default, as every operational script in this repository is.
 *
 * USAGE
 *   node scripts/reader/grant-entitlement.mjs <email> <slug> [<slug>…]
 *   node scripts/reader/grant-entitlement.mjs <email> <slug> --commit
 *   node scripts/reader/grant-entitlement.mjs --revoke <email> <slug>
 *   node scripts/reader/grant-entitlement.mjs --list <email>
 *
 * Options
 *   --env <file>   which DATABASE_URL to use (default .env.local — the sandbox)
 *   --commit       actually write; without it nothing is touched
 */

import { readFileSync } from "node:fs";

function loadEnv(file, only = null) {
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    if (only && !only.test(m[1])) continue;
    if (process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const argv = process.argv.slice(2);
const envIdx = argv.indexOf("--env");
const envFile = envIdx !== -1 ? argv[envIdx + 1] : ".env.local";
loadEnv(envFile);
loadEnv(".env", /^R2_/);

const commit = argv.includes("--commit");
const positional = argv.filter(
  (a, i) =>
    !a.startsWith("--") && argv[i - 1] !== "--env" && argv[i - 1] !== "--revoke",
);

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL).pathname.slice(1);
  } catch {
    return "(unparseable)";
  }
})();

console.log(`database : ${dbName}`);
console.log(`mode     : ${commit ? "COMMIT" : "dry run — nothing will be written"}\n`);

// ---------------------------------------------------------------------------

if (argv.includes("--list")) {
  const email = positional[0];
  const rows = await sql`
    select b.slug, b.title, b.page_count, e.status, e.last_read_at,
           (e.watermarked_key is not null) as has_pdf,
           (e.epub_key is not null) as has_epub,
           o.mor_order_ref
    from entitlements e
    join books b on b.id = e.book_id
    join users u on u.id = e.user_id
    join orders o on o.id = e.order_id
    where u.email = ${email}
    order by b.slug
  `;
  if (rows.length === 0) {
    console.log(`${email} holds no entitlements in ${dbName}.`);
  } else {
    console.table(
      rows.map((r) => ({
        slug: r.slug,
        pages: r.page_count,
        status: r.status,
        pdf: r.has_pdf ? "yes" : "—",
        epub: r.has_epub ? "yes" : "—",
        order: r.mor_order_ref,
        lastRead: r.last_read_at?.toISOString().slice(0, 16) ?? "never",
      })),
    );
  }
  process.exit(0);
}

if (argv.includes("--revoke")) {
  const [email, ...slugs] = positional;
  for (const slug of slugs) {
    const [row] = await sql`
      select e.id, e.status from entitlements e
      join users u on u.id = e.user_id
      join books b on b.id = e.book_id
      where u.email = ${email} and b.slug = ${slug}
    `;
    if (!row) {
      console.log(`  ${slug}: no entitlement to revoke`);
      continue;
    }
    console.log(`  ${slug}: ${row.status} → revoked`);
    if (commit) {
      await sql`update entitlements set status = 'revoked' where id = ${row.id}`;
    }
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Grant
// ---------------------------------------------------------------------------

const [email, ...slugs] = positional;
if (!email || slugs.length === 0) {
  console.error(
    "usage: node scripts/reader/grant-entitlement.mjs <email> <slug> [<slug>…] [--commit]",
  );
  process.exit(1);
}

const books = await sql`
  select id, slug, title, page_count, master_file_key
  from books where slug = any(${slugs})
`;
const missing = slugs.filter((s) => !books.some((b) => b.slug === s));
if (missing.length) {
  console.error(`unknown slug(s): ${missing.join(", ")}`);
  process.exit(1);
}
const unbuilt = books.filter((b) => !b.master_file_key);
if (unbuilt.length) {
  // A book with no master cannot be watermarked, and an entitlement that can
  // never become `ready` is a library row that says "still preparing" for ever.
  console.error(
    `these books have no master file and cannot be granted: ${unbuilt
      .map((b) => b.slug)
      .join(", ")}`,
  );
  process.exit(1);
}

const [user] = await sql`select id, name from users where email = ${email}`;
console.log(
  user
    ? `user     : ${email} (existing row ${user.id})`
    : `user     : ${email} (a new row will be created)`,
);
for (const b of books) {
  console.log(`  grant  : ${b.slug} — ${b.title} (${b.page_count}pp)`);
}

if (!commit) {
  console.log("\nDry run. Re-run with --commit to write.");
  process.exit(0);
}

const userId =
  user?.id ??
  (
    await sql`
      insert into users (email, name, auth_provider)
      values (${email}, ${email.split("@")[0]}, 'test-grant')
      returning id
    `
  )[0].id;

const { watermarkOneBook } = await import("@/inngest/functions/watermark");

for (const book of books) {
  const ref = `test-grant-${book.slug}`;
  const [existingOrder] = await sql`
    select id from orders where mor_order_ref = ${ref}
  `;
  const orderId =
    existingOrder?.id ??
    (
      await sql`
        insert into orders (user_id, mor_order_ref, payment_provider,
                            total_cents, currency, status)
        values (${userId}, ${ref}, 'lemonsqueezy', 0, 'USD', 'paid')
        returning id
      `
    )[0].id;

  const [existing] = await sql`
    select id from entitlements where user_id = ${userId} and book_id = ${book.id}
  `;
  if (!existing) {
    const [ent] = await sql`
      insert into entitlements (user_id, book_id, order_id, status)
      values (${userId}, ${book.id}, ${orderId}, 'pending')
      returning id
    `;
    await sql`insert into watermark_jobs (entitlement_id, status)
              values (${ent.id}, 'queued')`;
  }

  process.stdout.write(`  ${book.slug}: watermarking… `);
  const result = await watermarkOneBook({
    orderId,
    userId,
    bookId: book.id,
    buyerName: user?.name ?? email.split("@")[0],
  });
  console.log(`${result.status}`);
  console.log(`    /read/${book.id}`);
}

console.log("\ndone.");
