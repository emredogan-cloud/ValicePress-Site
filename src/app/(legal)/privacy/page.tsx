import type { Metadata } from "next";
import Link from "next/link";

import { LegalShell } from "@/components/cinematic/legal-shell";
import { buildPageMetadata } from "@/lib/metadata";

/**
 * /privacy — Privacy Policy.
 *
 * Phase 1.A. Walks through the exact data flow the storefront uses
 * today (Clerk + Lemon Squeezy + Neon + R2 + Inngest + Resend + Upstash +
 * Vercel Analytics), what we keep, how long, and how to exercise the
 * data-subject rights that the system already supports (export +
 * delete from /account/settings).
 *
 * Covers both GDPR (general principles) and KVKK (Turkish-specific
 * compliance). The dedicated /kvkk page expands the Turkish-specific
 * rights and contact information in Turkish.
 */
export const metadata: Metadata = buildPageMetadata({
  title: "Privacy policy",
  description:
    "What data Valice Press collects, how it flows through our infrastructure, and how to control it.",
  path: "/privacy",
  ogTitle: "Privacy policy — Valice Press",
  type: "article",
});

export default function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Privacy policy"
      lastUpdated="2026-05-30"
      intro={
        <p>
          We collect what we need to sell you a book, deliver it, and let
          you read it again later. Nothing else. This page lists every
          piece of data the storefront touches, where it lives, and how
          to delete it.
        </p>
      }
    >
      <h2>1. What we collect</h2>

      <h3>When you create an account</h3>
      <p>
        Your email address (required) and, optionally, a display name.
        These are handled by our authentication provider, Clerk; we
        never store your password ourselves. Clerk also retains login
        metadata (timestamps, IP, device family) for security.
      </p>

      <h3>When you buy a book</h3>
      <p>
        <strong>Lemon Squeezy LLC</strong> (a Utah limited liability company,
        part of Stripe), our Merchant of Record, handles the payment. They
        collect your billing details, card information, and any tax
        information required by your jurisdiction — this means your payment
        data is processed in the United States. We receive an order record
        (book id, amount, currency, paid-at timestamp), your name and email
        as given at checkout, and a customer id linking the order back to
        your account. We never receive or store your card details.
      </p>

      <h3>When you read</h3>
      <p>
        We record reading progress (last page + percentage) so the
        reader can resume where you left off. We do not log highlights
        or any in-document selection.
      </p>

      <h3>When you review a book</h3>
      <p>
        Your review text, star rating, and timestamp. Your display name
        appears next to the review on the public book page.
      </p>

      <h3>When you subscribe to the newsletter</h3>
      <p>
        Just your email. We hand it to Resend, our newsletter provider,
        which stores it in an &ldquo;audience&rdquo; we use to send
        future updates. Unsubscribe links are in every newsletter
        message.
      </p>

      <h3>Operational telemetry</h3>
      <p>
        Like every web service, we record server-side request logs
        (URL, status code, latency) and aggregate analytics (page
        views, country-level geography) through Vercel Analytics.
        These help us spot bugs and keep the site fast.
      </p>

      <h2>2. Where the data lives</h2>
      <p>
        Each piece of data is held by exactly one provider. We don&apos;t
        copy data into spreadsheets, CRMs, or marketing tools.
      </p>
      <ul>
        <li>
          <strong>Clerk</strong> — your account (email, sign-in metadata).
        </li>
        <li>
          <strong>Lemon Squeezy</strong> (United States) — your billing
          details and invoices.
        </li>
        <li>
          <strong>Neon</strong> (PostgreSQL) — your order history,
          library entitlements, reading progress, and reviews.
        </li>
        <li>
          <strong>Cloudflare R2</strong> — the per-order watermarked
          PDF artifacts you download. The watermark encodes your purchase
          id; no personally identifying name or email is written into
          the file.
        </li>
        <li>
          <strong>Inngest</strong> — short-lived async job records (e.g.
          the watermarking pipeline). Records are deleted after the job
          completes; no long-term retention.
        </li>
        <li>
          <strong>Resend</strong> — your newsletter subscription (if you
          opted in) and outbound transactional email logs (e.g. order
          confirmations).
        </li>
        <li>
          <strong>Upstash Redis</strong> — short-lived rate-limit
          counters keyed by IP. No identifying information beyond the IP
          for a rolling 10-second window.
        </li>
        <li>
          <strong>Vercel Analytics</strong> — aggregated, anonymized
          page-view counts. No cookies; no cross-site tracking.
        </li>
      </ul>

      <h2>3. What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t sell your data. Ever.</li>
        <li>We don&apos;t share your account email with publishers, authors, or any third party that isn&apos;t the providers listed above.</li>
        <li>We don&apos;t use advertising trackers or behavioral targeting.</li>
        <li>We don&apos;t store credit card numbers on our servers.</li>
      </ul>

      <h2>4. Retention</h2>
      <p>
        Library entitlements and reading progress stay as long as your
        account exists. Order records are kept for the duration required
        by accounting law (typically ten years for tax purposes in
        Turkey). Rate-limit counters expire after ten seconds.
        Inngest job records expire within a few hours.
      </p>

      <h2>5. Your rights</h2>
      <p>You can, at any time:</p>
      <ul>
        <li>
          <strong>Export your data</strong> — visit{" "}
          <Link href="/account/settings">/account/settings</Link> and
          click &ldquo;Export data.&rdquo; You&apos;ll receive a JSON
          file with your profile, orders, library, reading progress, and
          reviews.
        </li>
        <li>
          <strong>Delete your account</strong> — visit{" "}
          <Link href="/account/settings">/account/settings</Link> and
          click &ldquo;Delete account.&rdquo; This removes everything
          we can remove. Lemon Squeezy&apos;s tax records and Resend&apos;s
          unsubscribe history are retained as required by law and by
          those providers&apos; own retention rules.
        </li>
        <li>
          <strong>Object or correct</strong> — email us at{" "}
          <a href="mailto:emre30283@gmail.com">emre30283@gmail.com</a>{" "}
          and we&apos;ll respond within fourteen days.
        </li>
      </ul>

      <p>
        If you&apos;re in the European Union, you have the rights granted
        by GDPR (Articles 15–22). If you&apos;re in Turkey, you have the
        rights granted by KVKK Article 11 — see our{" "}
        <Link href="/kvkk">KVKK page</Link> in Turkish for the full
        list and how to file a complaint with the regulator (KVKK
        Kurumu).
      </p>

      <h2>6. Cookies</h2>
      <p>
        We use a small number of strictly necessary cookies: an auth
        session cookie from Clerk and a shopping-cart cookie that holds
        your in-progress purchase. We don&apos;t use any cookies for
        advertising or analytics.
      </p>

      <h2>7. Changes to this policy</h2>
      <p>
        We&apos;ll update this page when material changes happen and
        bump the &ldquo;last updated&rdquo; date at the top. For changes
        that affect retention or data sharing, we&apos;ll also email you
        before they take effect.
      </p>

      <hr />

      <p>
        Questions about your data? Email{" "}
        <a href="mailto:emre30283@gmail.com">emre30283@gmail.com</a>.
        We answer every message.
      </p>
    </LegalShell>
  );
}
