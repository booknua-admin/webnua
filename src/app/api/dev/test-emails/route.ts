// =============================================================================
// POST /api/dev/test-emails — fire ANY transactional email to a chosen
// recipient with stub data. One-shot QA endpoint, NOT user-facing.
//
// Covers every branded operator email (Surface 1) AND every customer-facing
// engine-driven email (Surface 2) AND the Stripe payment-failed alert AND
// the Stripe billing-suspended interstitial's underlying gate.
//
// Auth: gated by `TEST_EMAIL_SECRET` env var passed as Bearer token. NOT
// behind requireOperatorForClient — the whole point is to fire from a curl
// without a Supabase session. The secret never ships in the client bundle
// (server-only route + server-only env). When `TEST_EMAIL_SECRET` is unset
// the route returns 503 so a deploy without the secret can't be abused.
//
// Usage:
//   curl -X POST https://<host>/api/dev/test-emails \
//     -H "Authorization: Bearer $TEST_EMAIL_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"kind":"all","recipientEmail":"you@example.com"}'
//
// `kind` accepts a single email key OR `"all"` to fire every kind.
// =============================================================================

import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { EMAIL_BRAND_FOOTER, EMAIL_BRAND_FOOTER_TEXT } from '@/lib/email/footer';
import { sendReEngagementEmail } from '@/lib/auth/re-engagement-email';
import { sendVerificationCodeEmail } from '@/lib/auth/verification-code-email';
import { sendVerificationEmail } from '@/lib/auth/verification-email';
import { sendWelcomeEmail } from '@/lib/auth/welcome-email';
import { sendCancellationWarningEmail } from '@/lib/billing/cancellation-warning-email';
import { sendInviteEmail } from '@/lib/invites/invite-email';
import {
  buildMonthlyDigestHtml,
  buildMonthlyDigestSubject,
  buildMonthlyDigestText,
  buildWeeklyDigestHtml,
  buildWeeklyDigestSubject,
  buildWeeklyDigestText,
  SAMPLE_MONTHLY_CONTEXT,
  SAMPLE_WEEKLY_CONTEXT,
} from '@/lib/email/digest-templates';
import {
  enqueueJob,
  type JobContext,
  registerJobHandler,
} from '@/lib/integrations/_shared/jobs';
import { sendOperatorEmail } from '@/lib/integrations/stripe/notify';

// Re-import the payment-failed handler builder helpers via a tiny duplicate
// here — they're file-local in job-handlers.ts. Cheaper than exporting them
// from a non-test file. If the templates change, update this string too.
function buildStripePaymentFailedTestHtml(clientName: string, billingLink: string): string {
  const e = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#c44444;font-weight:700;margin-bottom:14px;">// Payment failed</div>
    <h1 style="font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;margin:0 0 14px 0;">A subscription payment failed for ${e(clientName)}.</h1>
    <p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 22px 0;">Stripe will retry the charge automatically over the next few days. The client has <strong>7 days</strong> from this notice before access is suspended.</p>
    <p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 22px 0;"><strong>What to do:</strong> reach out to the client and ask them to update their payment method via the Stripe billing portal. If the retry succeeds the suspension is cancelled automatically.</p>
    <p style="margin:0 0 6px 0;">
      <a href="${e(billingLink)}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">View billing →</a>
    </p>
  </div>
  ${EMAIL_BRAND_FOOTER}
</body></html>`;
}

function buildStripePaymentFailedTestText(clientName: string, billingLink: string): string {
  return [
    `A subscription payment failed for ${clientName}.`,
    '',
    'Stripe will retry the charge automatically over the next few days. The client has 7 days from this notice before access is suspended.',
    '',
    'What to do: reach out to the client and ask them to update their payment method via the Stripe billing portal. If the retry succeeds the suspension is cancelled automatically.',
    '',
    `View billing: ${billingLink}`,
    '',
    EMAIL_BRAND_FOOTER_TEXT,
  ].join('\n');
}

// Side-effect: ensure the send_email job handler is registered for the
// `enqueueJob` path. The manifest module imports + re-exports the right
// side-effect modules.
import '@/lib/integrations/job-handler-manifest';

const ALL_KINDS = [
  'verification',
  'verification-code',
  'welcome',
  're-engagement',
  'invite-team',
  'invite-client',
  'cancellation-warning',
  'stripe-payment-failed',
  'weekly-digest',
  'monthly-digest',
  // PR C — agency notification stream (Stream A) previews.
  'agency-new-ticket',
  'agency-new-signup',
  'agency-cancellation',
] as const;

type Kind = (typeof ALL_KINDS)[number];

function isKind(value: unknown): value is Kind {
  return typeof value === 'string' && (ALL_KINDS as readonly string[]).includes(value);
}

/** Diagnostic GET — returns whether the route is wired and the secret is
 *  configured WITHOUT revealing the secret value. Hit this from a browser
 *  to confirm the deployment picked up TEST_EMAIL_SECRET before debugging
 *  the POST. Never returns the secret itself. */
export async function GET(): Promise<Response> {
  return NextResponse.json({
    route: '/api/dev/test-emails',
    method: 'POST',
    secret_configured: Boolean(env.TEST_EMAIL_SECRET),
    resend_configured: Boolean(env.RESEND_API_KEY),
    accepted_kinds: ['all', ...ALL_KINDS],
    usage:
      'POST with Authorization: Bearer <TEST_EMAIL_SECRET> + body { kind, recipientEmail }',
  });
}

export async function POST(request: Request): Promise<Response> {
  const secret = env.TEST_EMAIL_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'test-emails-disabled' }, { status: 503 });
  }
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (token !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { kind?: unknown; recipientEmail?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const recipientEmail = typeof body.recipientEmail === 'string' ? body.recipientEmail.trim() : '';
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return NextResponse.json({ error: 'invalid-recipientEmail' }, { status: 400 });
  }

  const kinds: Kind[] =
    body.kind === 'all'
      ? [...ALL_KINDS]
      : isKind(body.kind)
        ? [body.kind]
        : [];
  if (kinds.length === 0) {
    return NextResponse.json(
      { error: 'invalid-kind', accepted: ['all', ...ALL_KINDS] },
      { status: 400 },
    );
  }

  const results: Record<string, string> = {};
  for (const kind of kinds) {
    try {
      results[kind] = await trigger(kind, recipientEmail);
    } catch (error) {
      results[kind] = `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return NextResponse.json({ ok: true, recipient: recipientEmail, results });
}

async function trigger(kind: Kind, recipientEmail: string): Promise<string> {
  const base = `https://${env.APP_HOST ?? 'app.webnua.com'}`;
  switch (kind) {
    case 'verification': {
      const outcome = await sendVerificationEmail({
        recipientEmail,
        businessName: 'Voltline Electrical (test)',
        magicLink: `${base}/auth/callback?token=test-stub-link`,
      });
      return outcome;
    }
    case 'verification-code': {
      const outcome = await sendVerificationCodeEmail({
        recipientEmail,
        code: '482517',
        expiresInMinutes: 10,
      });
      return outcome;
    }
    case 'welcome': {
      const outcome = await sendWelcomeEmail({
        recipientEmail,
        businessName: 'Voltline Electrical (test)',
        liveSiteUrl: 'https://voltline.webnua.dev',
        dashboardUrl: `${base}/dashboard`,
      });
      return outcome;
    }
    case 're-engagement': {
      const outcome = await sendReEngagementEmail({
        recipientEmail,
        businessName: 'Voltline Electrical (test)',
        dashboardUrl: `${base}/dashboard`,
        previewUrl: 'https://voltline.webnua.dev',
      });
      return outcome;
    }
    case 'invite-team': {
      const outcome = await sendInviteEmail({
        kind: 'team',
        recipientEmail,
        recipientName: 'Sam (test)',
        inviterName: 'Craig at Webnua',
        workspaceName: 'Webnua',
        roleLabel: 'Operator',
        magicLink: `${base}/invite/test-team-token-stub`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        personalNote: null,
      });
      return outcome;
    }
    case 'invite-client': {
      const outcome = await sendInviteEmail({
        kind: 'client',
        recipientEmail,
        recipientName: 'Sam (test)',
        inviterName: 'Voltline Electrical',
        workspaceName: 'Voltline Electrical',
        roleLabel: null,
        magicLink: `${base}/invite/test-client-token-stub`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        personalNote: 'Hey Sam — added you as a teammate so you can see leads + reply.',
      });
      return outcome;
    }
    case 'cancellation-warning': {
      const outcome = await sendCancellationWarningEmail({
        recipientEmail,
        businessName: 'Voltline Electrical (test)',
        daysRemaining: 7,
        supportUrl: `${base}/help`,
      });
      return outcome;
    }
    case 'stripe-payment-failed': {
      // We have NO usable clientId here — pass a dummy UUID; the
      // notifications_outbound write is the only consumer and it
      // tolerates any UUID for a one-shot test.
      const clientId = '00000000-0000-0000-0000-000000000000';
      const billingLink = `${base}/settings/billing`;
      const outcome = await sendOperatorEmail({
        clientId,
        recipientEmail,
        subject: 'Payment failed — Voltline Electrical (test)',
        html: buildStripePaymentFailedTestHtml('Voltline Electrical (test)', billingLink),
        text: buildStripePaymentFailedTestText('Voltline Electrical (test)', billingLink),
        templateName: 'stripe_payment_failed_TEST',
      });
      return outcome;
    }
    case 'weekly-digest': {
      // Stream B: platform → sub-account owner. Sample context (Dublin
      // Cleaning Co, May 2026) lives in lib/email/digest-templates.ts so the
      // PROD send path can reuse the same render helpers with REAL context.
      const ctx = { ...SAMPLE_WEEKLY_CONTEXT, dashboardLink: `${base}/dashboard` };
      const outcome = await sendOperatorEmail({
        clientId: '00000000-0000-0000-0000-000000000000',
        recipientEmail,
        subject: buildWeeklyDigestSubject(ctx),
        html: buildWeeklyDigestHtml(ctx),
        text: buildWeeklyDigestText(ctx),
        templateName: 'weekly_performance_digest_TEST',
      });
      return outcome;
    }
    case 'monthly-digest': {
      const ctx = { ...SAMPLE_MONTHLY_CONTEXT, dashboardLink: `${base}/dashboard` };
      const outcome = await sendOperatorEmail({
        clientId: '00000000-0000-0000-0000-000000000000',
        recipientEmail,
        subject: buildMonthlyDigestSubject(ctx),
        html: buildMonthlyDigestHtml(ctx),
        text: buildMonthlyDigestText(ctx),
        templateName: 'monthly_performance_digest_TEST',
      });
      return outcome;
    }
    case 'agency-new-ticket': {
      // Sample preview of the operator's "new ticket" alert (Stream A).
      // The production path resolves these strings from DB joins; the test
      // path uses sample data to render the same branded chrome.
      const html = buildAgencyPreview({
        eyebrow: '// New ticket',
        headline: 'Dublin Cleaning Co opened a ticket.',
        summary: '<strong>Cannot update tile photo on the about page</strong>',
        quote: 'I tried replacing the kitchen tile photo on /about three times and it keeps reverting to the original. Have a great morning when you get to this.',
        metaParts: ['From <strong>Aoife (owner)</strong>', 'Category: website'],
        ctaLabel: 'Open ticket inbox →',
        ctaHref: `${base}/tickets`,
      });
      const text = `Dublin Cleaning Co opened a ticket.\n\nCannot update tile photo on the about page\n\nI tried replacing the kitchen tile photo on /about three times…\n\nFrom: Aoife (owner)\nCategory: website\n\nOpen: ${base}/tickets`;
      const outcome = await sendOperatorEmail({
        clientId: '00000000-0000-0000-0000-000000000000',
        recipientEmail,
        subject: 'New ticket from Dublin Cleaning Co — Cannot update tile photo on the about page',
        html,
        text,
        templateName: 'agency_new_ticket_TEST',
      });
      return outcome;
    }
    case 'agency-new-signup': {
      const html = buildAgencyPreview({
        eyebrow: '// New signup',
        headline: 'Dublin Cleaning Co just signed up.',
        summary: 'A new sub-account verified their email and entered preview.',
        metaParts: ['Industry: Domestic cleaning', 'Email: <strong>aoife@dublincleaning.ie</strong>'],
        ctaLabel: 'Open sub-account →',
        ctaHref: `${base}/clients/dublin-cleaning-co`,
      });
      const text = `Dublin Cleaning Co just signed up.\n\nA new sub-account verified their email and entered preview.\n\nIndustry: Domestic cleaning\nEmail: aoife@dublincleaning.ie\n\nOpen: ${base}/clients/dublin-cleaning-co`;
      const outcome = await sendOperatorEmail({
        clientId: '00000000-0000-0000-0000-000000000000',
        recipientEmail,
        subject: 'New signup — Dublin Cleaning Co',
        html,
        text,
        templateName: 'agency_new_signup_TEST',
      });
      return outcome;
    }
    case 'agency-cancellation': {
      const html = buildAgencyPreview({
        eyebrow: '// Sub-account cancelled',
        headline: 'Dublin Cleaning Co cancelled their subscription.',
        summary: 'They have a 30-day grace before deletion. Reach out if you want to save the relationship.',
        ctaLabel: 'Open sub-account →',
        ctaHref: `${base}/clients/dublin-cleaning-co`,
      });
      const text = `Dublin Cleaning Co cancelled their subscription.\n\nThey have a 30-day grace before deletion. Reach out if you want to save the relationship.\n\nOpen: ${base}/clients/dublin-cleaning-co`;
      const outcome = await sendOperatorEmail({
        clientId: '00000000-0000-0000-0000-000000000000',
        recipientEmail,
        subject: 'Sub-account cancelled — Dublin Cleaning Co',
        html,
        text,
        templateName: 'agency_cancellation_TEST',
      });
      return outcome;
    }
  }
}

/** Mirror of `agencyEmailHtml` in lib/integrations/_shared/agency-notifications.ts.
 *  Kept inline here so the test route can render preview HTML without DB
 *  lookups. Edits to the chrome must apply to both. */
function buildAgencyPreview(input: {
  eyebrow: string;
  headline: string;
  summary?: string;
  quote?: string;
  metaParts?: Array<string | null>;
  ctaLabel: string;
  ctaHref: string;
}): string {
  const e = (s: string) =>
    s.replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
    );
  const meta = (input.metaParts ?? [])
    .filter((p): p is string => p != null && p.length > 0)
    .join(' · ');
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:14px;">${e(input.eyebrow)}</div>
    <h1 style="font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;margin:0 0 14px 0;color:#0a0a0a;">${e(input.headline)}</h1>
    ${input.summary ? `<p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 18px 0;">${input.summary}</p>` : ''}
    ${input.quote ? `<div style="margin:0 0 18px 0;padding:14px 16px;background:#f5f1ea;border-left:3px solid #d24317;border-radius:6px;"><p style="font-size:13px;line-height:1.55;color:#0a0a0a;margin:0;font-style:italic;">${e(input.quote)}</p></div>` : ''}
    ${meta ? `<p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.06em;color:#6e685c;margin:0 0 22px 0;">${meta}</p>` : ''}
    <p style="margin:0 0 4px 0;"><a href="${e(input.ctaHref)}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">${e(input.ctaLabel)}</a></p>
  </div>
  ${EMAIL_BRAND_FOOTER}
</body></html>`;
}

// Suppress unused-imports lint — these are surface-area for future test types.
void enqueueJob;
void registerJobHandler;
void (null as JobContext | null);
