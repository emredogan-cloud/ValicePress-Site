import { NextResponse, type NextRequest } from "next/server";

import { adminRouteDenial } from "@/lib/admin/api-auth";
import { csvRow } from "@/lib/admin/csv";
import type { MarketingConsent } from "@/lib/db/contacts";
import { CONTACT_SORTS, listContactsForExport, type ContactSort } from "@/lib/db/queries/contacts-admin";

/**
 * GET /admin/email/export — the current view, as CSV, for an admin.
 *
 * ADMIN-ONLY, AND CHECKED HERE RATHER THAN INHERITED. This route sits under
 * `/admin`, which the proxy protects, but it is the one endpoint on the site
 * that will hand back a file full of real people's email addresses — so it asks
 * the gate itself and answers 401/403 rather than relying on a matcher
 * somewhere else staying correct forever.
 *
 * GENERATED ON DEMAND, NEVER WRITTEN TO DISK. `Content-Disposition: attachment`
 * sends it to the operator's own machine and nothing is left behind; the
 * response is `no-store, private` for the same reason.
 *
 * THE WHOLE VIEW. It used to stop at 500 rows without saying so — a file that
 * quietly lies about being the list. It now pages through everything the filters
 * match (up to `EXPORT_ROW_CAP`), and if even that is not enough the file says
 * so in its last line.
 *
 * The consent column travels WITH the addresses, and so does the evidence. An
 * export that lists only emails is an export that will be pasted into a sending
 * tool by somebody who did not have this page in front of them.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CONSENTS = new Set(["opted_in", "opted_out", "unknown", "not_marketing_contact"]);
const STATES = new Set(["active", "suppressed", "inactive"]);

export async function GET(req: NextRequest) {
  const denied = await adminRouteDenial(req);
  if (denied) return denied;

  const p = req.nextUrl.searchParams;
  const consent = p.get("consent") ?? "all";
  const state = p.get("state") ?? "all";
  const audience = p.get("audience");
  const sort = p.get("sort");

  const { rows, truncated } = await listContactsForExport({
    q: p.get("q") ?? undefined,
    consent: CONSENTS.has(consent) ? (consent as MarketingConsent) : "all",
    state: STATES.has(state) ? (state as "active" | "suppressed" | "inactive") : "all",
    source: p.get("source") ?? "all",
    audience: audience === "customers" || audience === "prospects" ? audience : "all",
    sort: CONTACT_SORTS.some((s) => s.value === sort) ? (sort as ContactSort) : "recent",
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
    csvRow(header),
    ...rows.map((c) =>
      csvRow([c.email, c.name, c.source, c.sourceDetail, iso(c.firstSeen), iso(c.lastSeen), c.purchased, c.purchaseCount, c.customerStatus, c.marketingConsent, c.consentSource, iso(c.consentAt), c.unsubscribed, c.notes]),
    ),
  ];
  if (truncated) lines.push(csvRow([`# Export stopped at ${rows.length} rows — narrow the filters for the rest.`]));

  const stamp = new Date().toISOString().slice(0, 10);
  // A BOM, so a Turkish-locale Excel opens the file as UTF-8 rather than mangling every non-ASCII name.
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
