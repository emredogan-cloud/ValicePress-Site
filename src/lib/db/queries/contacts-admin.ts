import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import type { MarketingConsent } from "@/lib/db/contacts";

/**
 * The operator's view of the contact book.
 *
 * EVERY EXPORT HERE CALLS `requireAdmin()` FIRST, before it looks at an
 * argument. That is not defence in depth for its own sake: this is the one
 * table in the schema that is a list of real people's email addresses, and a
 * query helper that trusts its caller to have checked is a query helper that
 * will one day be called from somewhere that did not.
 *
 * Nothing in this module is cached. A consent decision read from a five-
 * minute cache is a consent decision that can be five minutes out of date,
 * and the whole point of the column is that it is current.
 */

export interface ContactRow {
  id: string;
  email: string;
  name: string | null;
  source: string;
  sourceDetail: string | null;
  firstSeen: Date;
  lastSeen: Date;
  purchased: boolean;
  purchaseCount: number;
  customerStatus: string;
  marketingConsent: MarketingConsent;
  consentSource: string | null;
  consentAt: Date | null;
  unsubscribed: boolean;
  notes: string | null;
}

export interface ContactFilters {
  /** Substring of the email or the name. */
  q?: string;
  consent?: MarketingConsent | "all";
  source?: string | "all";
  /** "customers" | "prospects" | "all" */
  audience?: "customers" | "prospects" | "all";
  /** Only rows with a suppression in force. */
  suppressedOnly?: boolean;
  limit?: number;
  offset?: number;
}

function buildWhere(f: ContactFilters): SQL | undefined {
  const parts: SQL[] = [];

  if (f.q?.trim()) {
    const needle = `%${f.q.trim()}%`;
    const clause = or(ilike(contacts.email, needle), ilike(contacts.name, needle));
    if (clause) parts.push(clause);
  }
  if (f.consent && f.consent !== "all") {
    parts.push(eq(contacts.marketingConsent, f.consent));
  }
  if (f.source && f.source !== "all") {
    parts.push(eq(contacts.source, f.source));
  }
  if (f.audience === "customers") parts.push(eq(contacts.purchased, true));
  if (f.audience === "prospects") parts.push(eq(contacts.purchased, false));
  if (f.suppressedOnly) parts.push(eq(contacts.unsubscribed, true));

  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : and(...parts);
}

export async function listContacts(
  filters: ContactFilters = {},
): Promise<{ rows: ContactRow[]; total: number }> {
  await requireAdmin();

  const where = buildWhere(filters);
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: contacts.id,
        email: contacts.email,
        name: contacts.name,
        source: contacts.source,
        sourceDetail: contacts.sourceDetail,
        firstSeen: contacts.firstSeen,
        lastSeen: contacts.lastSeen,
        purchased: contacts.purchased,
        purchaseCount: contacts.purchaseCount,
        customerStatus: contacts.customerStatus,
        marketingConsent: contacts.marketingConsent,
        consentSource: contacts.consentSource,
        consentAt: contacts.consentAt,
        unsubscribed: contacts.unsubscribed,
        notes: contacts.notes,
      })
      .from(contacts)
      .where(where)
      .orderBy(desc(contacts.lastSeen))
      .limit(limit)
      .offset(offset),
    db.select({ n: count() }).from(contacts).where(where),
  ]);

  return { rows: rows as ContactRow[], total: totals[0]?.n ?? 0 };
}

export interface ContactSummary {
  total: number;
  byConsent: Record<string, number>;
  bySource: Array<{ source: string; n: number }>;
  customers: number;
  suppressed: number;
  /**
   * How many people this press may actually email a campaign to.
   *
   * Deliberately its own number, and deliberately the smallest one on the
   * page: opted in AND not suppressed. Every other count on this dashboard
   * is a count of people we KNOW; this is the count of people we may WRITE
   * TO, and conflating the two is how a contact list becomes a spam list.
   */
  mailable: number;
}

export async function getContactSummary(): Promise<ContactSummary> {
  await requireAdmin();

  const [totals, consent, sources] = await Promise.all([
    db
      .select({
        total: count(),
        customers: sql<number>`count(*) filter (where ${contacts.purchased})::int`,
        suppressed: sql<number>`count(*) filter (where ${contacts.unsubscribed})::int`,
        mailable: sql<number>`count(*) filter (where ${contacts.marketingConsent} = 'opted_in' and not ${contacts.unsubscribed})::int`,
      })
      .from(contacts),
    db
      .select({ consent: contacts.marketingConsent, n: count() })
      .from(contacts)
      .groupBy(contacts.marketingConsent),
    db
      .select({ source: contacts.source, n: count() })
      .from(contacts)
      .groupBy(contacts.source)
      .orderBy(desc(count())),
  ]);

  const byConsent: Record<string, number> = {
    opted_in: 0,
    opted_out: 0,
    unknown: 0,
    not_marketing_contact: 0,
  };
  for (const r of consent) byConsent[r.consent] = r.n;

  return {
    total: totals[0]?.total ?? 0,
    customers: totals[0]?.customers ?? 0,
    suppressed: totals[0]?.suppressed ?? 0,
    mailable: totals[0]?.mailable ?? 0,
    byConsent,
    bySource: sources.map((s) => ({ source: s.source, n: s.n })),
  };
}

/** The distinct sources present, for the filter's own options. */
export async function listContactSources(): Promise<string[]> {
  await requireAdmin();
  const rows = await db
    .selectDistinct({ source: contacts.source })
    .from(contacts)
    .orderBy(contacts.source);
  return rows.map((r) => r.source);
}
