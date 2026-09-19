import { NextResponse, type NextRequest } from "next/server";

import { AdminAccessError, requireAdmin } from "@/lib/auth";
import type { MarketingConsent } from "@/lib/db/contacts";
import { listContacts } from "@/lib/db/queries/contacts-admin";

/**
 * GET /admin/contacts/export — the current view, as CSV, for an admin.
 *
 * ADMIN-ONLY, AND CHECKED HERE RATHER THAN INHERITED. This route sits under
 * `/admin`, which the proxy protects, but it is the one endpoint on the site
 * that will hand back a file full of real people's email addresses — so it
 * calls `requireAdmin()` itself and returns 403 rather than relying on a
 * matcher somewhere else staying correct forever.
 *
 * GENERATED ON DEMAND, NEVER WRITTEN TO DISK. There is no export file in this
 * repository and there must never be one: `Content-Disposition: attachment`
 * sends it to the operator's own machine and nothing is left behind. The
 * response is `no-store, private` for the same reason — a CDN has no business
 * holding a copy.
 *
 * The consent column travels WITH the addresses, and so does the evidence. An
 * export that lists only emails is an export that will be pasted into a
 * sending tool by somebody who did not have this page in front of them.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CONSENTS = new Set([
  "opted_in",
  "opted_out",
  "unknown",
  "not_marketing_contact",
]);

/** RFC 4180: quote everything, double any inner quote. No formula injection. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let s = String(value);
  // A leading =, +, - or @ makes a spreadsheet treat the cell as a formula.
  // Prefixing with a single quote is the standard neutralisation and is what
  // Excel and Sheets both understand.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAccessError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  const p = req.nextUrl.searchParams;
  const consentParam = p.get("consent") ?? "all";
  const audienceParam = p.get("audience");

  const { rows } = await listContacts({
    q: p.get("q") ?? undefined,
    consent: CONSENTS.has(consentParam)
      ? (consentParam as MarketingConsent)
      : "all",
    source: p.get("source") ?? "all",
    audience:
      audienceParam === "customers" || audienceParam === "prospects"
        ? audienceParam
        : "all",
    suppressedOnly: p.get("suppressed") === "1",
    // The export is the whole view, not one page of it. 500 is the query
    // helper's own ceiling; beyond that an operator should narrow the filter
    // rather than pull the entire book in one request.
    limit: 500,
  });

  const header = [
    "email",
    "name",
    "source",
    "source_detail",
    "first_seen",
    "last_seen",
    "purchased",
    "purchase_count",
    "customer_status",
    "marketing_consent",
    "consent_source",
    "consent_at",
    "unsubscribed",
    "notes",
  ];

  const iso = (d: Date | null) => (d ? new Date(d).toISOString() : "");

  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((c) =>
      [
        c.email,
        c.name,
        c.source,
        c.sourceDetail,
        iso(c.firstSeen),
        iso(c.lastSeen),
        c.purchased,
        c.purchaseCount,
        c.customerStatus,
        c.marketingConsent,
        c.consentSource,
        iso(c.consentAt),
        c.unsubscribed,
        c.notes,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  // A BOM, so a Turkish-locale Excel opens the file as UTF-8 rather than
  // mangling every non-ASCII name in it.
  const body = `﻿${lines.join("\r\n")}\r\n`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="valicepress-contacts-${stamp}.csv"`,
      "cache-control": "no-store, private",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
