import "server-only";

import {
  DOWNLOAD_TTL_HOURS,
  claimRequestForSending,
  getAmazonEditions,
  getRequestForFulfilment,
  issueDownloadToken,
  markRequestStatus,
  type FreeBookRequestStatus,
} from "@/lib/db/queries/free-books";
import { getSiteUrl } from "@/lib/site-url";
import { getCompanionForBook } from "@/lib/companions";
import { sendFreeBookEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { getObject, headObject, MASTERS_BUCKET } from "@/lib/storage";

/**
 * Delivering one free-ebook request.
 *
 * WHY THIS IS A LIBRARY AND NOT A SERVER ACTION
 * It has two callers with two different front doors: the admin button, which
 * authenticates with a Clerk session, and the ops route, which authenticates
 * with a bearer token because there is no browser session in a shell or in
 * CI. The delivery itself is the same in both cases and must stay the same —
 * two copies of "which PDF, to whom, with which Amazon links" is exactly the
 * pair that drifts apart and starts mailing the wrong book.
 *
 * Both callers check their own gate BEFORE calling this. Nothing here checks
 * authorisation, so nothing here may be exported to a public route.
 *
 * WHERE THE FILE COMES FROM, AND WHAT THE READER SEES
 * The delivered file lives in the private masters bucket, and nothing in this
 * feature ever writes an R2 key, a bucket name or a storage URL into a row, an
 * email body or a page. Small books travel as an attachment. Books past the
 * attachment ceiling get a first-party `valicepress.com/download/<token>`
 * link, where the token names this request row and nothing else — see
 * `src/app/download/[token]/route.ts`. A request row is a record of an ask,
 * never a standing right to a file: the token expires.
 *
 * WHY IT IS AN OPERATOR ACTION AT ALL
 * The modal promises delivery "within 24 hours", and that is the honest
 * description of this design. Automatic sending would mean a route that mails
 * a private master to any address that can post a form.
 */

export interface FulfilResult {
  ok: boolean;
  message: string;
  /** The provider's id for the accepted message, when there is one. */
  providerId?: string;
}


/**
 * How large a master may be before we stop trying to attach it.
 *
 * Resend's ceiling is 40 MB for the whole message, and base64 inflates a
 * binary by about a third — so 24 MB of PDF is already ~32 MB on the wire
 * before any HTML. 20 MB leaves honest headroom. Anything bigger falls back to
 * the signed link, which is a worse experience but a working one, and the
 * email says which of the two the reader got.
 */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

/** `the-great-book-of-world-myths` → `the-great-book-of-world-myths.pdf`. */
function attachmentFilename(slug: string): string {
  return `${slug.replace(/[^a-z0-9-]/gi, "-").slice(0, 120)}.pdf`;
}

export async function deliverFreeBookRequest(id: string): Promise<FulfilResult> {
  /**
   * CLAIM THE ROW BEFORE DOING ANYTHING ELSE.
   *
   * One atomic UPDATE decides who is sending. A second click — another tab, a
   * retry, a refresh mid-send — loses the race and is told so rather than
   * mailing the reader a second copy. See `claimRequestForSending`.
   */
  const claim = await claimRequestForSending(id);
  if (!claim) {
    return {
      ok: false,
      message: "A send for this request is already in flight. Refresh in a moment.",
    };
  }

  /** Put the row back where it was found, with a reason, on any failure. */
  const fail = async (status: FreeBookRequestStatus, note: string, message: string) => {
    await markRequestStatus(id, status, note);
      return { ok: false, message };
  };

  const row = await getRequestForFulfilment(id);
  if (!row) {
      return { ok: false, message: "That request no longer exists." };
  }

  if (!row.masterFileKey) {
    // Recorded as `failed` with the reason, rather than left pending forever:
    // a queue where the un-fulfillable rows look exactly like the ones nobody
    // has got to yet is a queue that stops being read.
    return fail(
      "failed",
      "no master file on the book row — nothing to deliver",
      `${row.bookTitle} has no master file in R2, so there is nothing to send. Upload one and try again.`,
    );
  }

  /**
   * THE FILE, FETCHED SERVER-SIDE.
   *
   * The bytes go from the private bucket into the message and nowhere else —
   * no public URL, no key in a row, nothing written to disk. If the object is
   * too big to carry, or R2 will not give it up, the signed link takes over
   * below rather than the whole send failing.
   */
  let attachment: { filename: string; content: Buffer } | null = null;
  let attachmentNote = "";
  try {
    const head = await headObject({ bucket: MASTERS_BUCKET, key: row.masterFileKey });
    if (!head.exists) {
      return fail(
        "failed",
        `master missing in R2: ${head.error ?? "not found"}`,
        `The master file for ${row.bookTitle} is not in R2. Upload it and try again.`,
      );
    }
    if ((head.contentLength ?? 0) > MAX_ATTACHMENT_BYTES) {
      attachmentNote = `too large to attach (${Math.round((head.contentLength ?? 0) / 1048576)} MB) — secure download link, ${DOWNLOAD_TTL_HOURS}h`;
    } else {
      const obj = await getObject({ bucket: MASTERS_BUCKET, key: row.masterFileKey });
      attachment = {
        filename: attachmentFilename(row.bookSlug),
        content: Buffer.from(obj.body),
      };
    }
  } catch (err) {
    logger.error("[free-books] master fetch failed", { id, err: String(err) });
    attachmentNote = `could not read the master — secure download link, ${DOWNLOAD_TTL_HOURS}h`;
  }

  /**
   * Too large to attach → a first-party download link.
   *
   * The reader gets `valicepress.com/download/<token>` instead of 700
   * characters of signed storage URL. The token names this request row and
   * nothing else: no bucket, no key, no slug, nothing to tamper with. See
   * `src/app/download/[token]/route.ts`.
   */
  let url: string | null = null;
  if (!attachment) {
    try {
      const { token } = await issueDownloadToken(id);
      url = `${getSiteUrl()}/download/${token}`;
    } catch (err) {
      logger.error("[free-books] could not issue a download token", {
        id,
        err: String(err),
      });
      return fail(
        "failed",
        `no attachment and no download token: ${String(err).slice(0, 160)}`,
        "Could not attach the PDF or create a download link. See the logs.",
      );
    }
  }

  // Amazon editions come from the catalog, never from a template. A format
  // that is `coming_soon`, or has no recorded URL, is simply not offered.
  const editions = await getAmazonEditions(row.bookId);
  const companion = getCompanionForBook(row.bookSlug);

  const sent = await sendFreeBookEmail({
    to: row.email,
    bookTitle: row.bookTitle,
    bookSubtitle: row.bookSubtitle,
    bookPath: `/books/${row.bookSlug}`,
    companionPath: companion ? `/companion/${companion.slug}` : null,
    editions,
    attachment,
    downloadUrl: url,
    expiresInHours: DOWNLOAD_TTL_HOURS,
  });

  if (!sent.ok) {
    return fail(
      "failed",
      `email failed: ${sent.error.slice(0, 200)}`,
      `Email failed: ${sent.error}`,
    );
  }

  // Only now. A row says `fulfilled` when a provider accepted the message and
  // at no earlier point — the whole reason `sending` exists is so the middle
  // of this function is never mistaken for either end of it.
  const note =
    (attachmentNote ||
      `PDF attached (${attachment ? Math.round(attachment.content.byteLength / 1024) : 0} KB)`) +
    (editions.length ? `; ${editions.length} Amazon edition(s) linked` : "") +
    // The provider id goes on the row. When a mailbox is empty and the queue
    // says fulfilled, this is the only thread left to pull.
    (sent.id ? `; provider ${sent.id}` : "");
  await markRequestStatus(id, "fulfilled", note);

  const how = attachment
    ? "with the PDF attached"
    : `with a secure download link (valid ${DOWNLOAD_TTL_HOURS}h)`;
  return {
    ok: true,
    message: `Sent ${row.bookTitle} to ${row.email} ${how}.`,
    // The provider's id for this message. Recorded so a send that a mailbox
    // never shows can be chased in the provider's own log instead of argued
    // about — "accepted" and "delivered" are different claims.
    providerId: sent.id,
  };
}
