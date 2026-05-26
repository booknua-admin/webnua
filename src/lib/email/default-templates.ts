// =============================================================================
// Email template defaults — runtime fallbacks for the send_email job.
//
// Phase 7 Resend session. Sibling of src/lib/sms/default-templates.ts.
// Migration 0062 seeds every client with one row per template key carrying
// these same bodies; this constant is the runtime fallback the send_email
// job uses if a template row is somehow absent (a misconfigured seed, a row
// deleted manually). The MIGRATION is the source of truth for the bodies an
// operator can edit — editing only this constant would not show up for
// existing clients.
//
// Keep these bodies in lockstep with the seed bodies in 0062. Editing the
// default copy means BOTH this file and the migration.
// =============================================================================

import type { EmailTemplateKey } from '@/lib/integrations/resend/types';
import { EMAIL_BRAND_FOOTER } from '@/lib/email/footer';

export type EmailTemplateBody = {
  subject: string;
  body_html: string;
  body_text: string;
};

const NL = '\n';

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateKey, EmailTemplateBody> = {
  // ---------------------------------------------------------------------------
  // Customer-facing (operator → lead) — plain text only. The send path
  // (`resend/job-handlers.ts`) appends the "Powered by Webnua" footer at send
  // time and forces html to empty. Keep `body_html` here as an empty string
  // so the type stays uniform across customer- and operator-facing entries.
  // ---------------------------------------------------------------------------
  lead_followup: {
    subject: 'Following up on your enquiry — {{client.businessName}}',
    body_html: '',
    body_text:
      `Hi {{lead.firstName}},${NL}${NL}` +
      `{{client.shortName}} here, following up on your enquiry about {{lead.service}}.${NL}${NL}` +
      `We typically respond within {{client.responseTime}} — if you have any extra detail (timing, photos, what you've already tried) please reply to this email and it'll come straight to my inbox.${NL}${NL}` +
      `Thanks,${NL}{{client.shortName}}`,
  },
  review_request: {
    subject: 'Quick favour — would you mind leaving a review?',
    body_html: '',
    body_text:
      `Hi {{lead.firstName}},${NL}${NL}` +
      `Hope the work went well. If you have 30 seconds, would you mind leaving a Google review? It genuinely helps a small business like {{client.businessName}}.${NL}${NL}` +
      `Leave a review: {{review.link}}${NL}${NL}` +
      `Thanks again,${NL}{{client.shortName}}`,
  },
  quote_followup: {
    subject: 'Still keen? — your quote from {{client.businessName}}',
    body_html: '',
    body_text:
      `Hi {{lead.firstName}},${NL}${NL}` +
      `Just checking in on the quote we sent for {{lead.service}}. No pressure either way — if the timing has shifted, or you have any questions, hit reply and I'll get back to you.${NL}${NL}` +
      `Cheers,${NL}{{client.shortName}}`,
  },
  // ---------------------------------------------------------------------------
  // Operator-facing (Webnua → operator) — branded HTML. These go through the
  // send_email job too but the customer-facing footer is NOT applied; the
  // body keeps its HTML.
  // ---------------------------------------------------------------------------
  lead_notification: {
    subject:
      'New lead: {{lead.firstName}}{{lead.lastNameSuffix}} — {{lead.service}}',
    body_html: BRANDED_SHELL({
      eyebrow: '// New lead',
      headline: 'New lead in {{client.businessName}}.',
      bodyHtml:
        `<div style="margin:0 0 16px 0;padding:14px 16px;background:#f5f1ea;border-left:3px solid #d24317;border-radius:6px;">` +
        `<div style="font-weight:800;font-size:15px;color:#0a0a0a;margin-bottom:4px;">{{lead.fullName}}</div>` +
        `<div style="font-size:13px;color:#4a4a45;line-height:1.55;">{{lead.phone}}<br/>{{lead.email}}</div>` +
        `</div>` +
        `<div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6e685c;font-weight:700;margin:0 0 6px 0;">// About</div>` +
        `<p style="font-size:14px;line-height:1.55;color:#0a0a0a;margin:0 0 10px 0;font-weight:600;">{{lead.service}}</p>` +
        `<p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 22px 0;font-style:italic;">{{lead.preview}}</p>`,
      ctaLabel: 'Open in inbox →',
      ctaHref: '{{platform.inboxLink}}',
    }),
    body_text:
      `New lead in {{client.businessName}}${NL}${NL}` +
      `{{lead.fullName}}${NL}` +
      `{{lead.phone}}${NL}` +
      `{{lead.email}}${NL}${NL}` +
      `About: {{lead.service}}${NL}${NL}` +
      `"{{lead.preview}}"${NL}${NL}` +
      `Open in inbox: {{platform.inboxLink}}`,
  },
  lead_digest: {
    subject: '{{digest.count}} new leads in {{client.businessName}}',
    body_html: BRANDED_SHELL({
      eyebrow: '// New leads',
      headline: '{{digest.count}} new leads in {{client.businessName}}.',
      bodyHtml:
        `<p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 16px 0;">Captured in the last hour. Tap any one to open in the Webnua inbox.</p>` +
        `<div style="margin:0 0 22px 0;">{{digest.summaryHtml}}</div>`,
      ctaLabel: 'Open inbox →',
      ctaHref: '{{platform.inboxLink}}',
    }),
    body_text:
      `{{digest.count}} new leads have come in for {{client.businessName}} in the last hour.${NL}${NL}` +
      `{{digest.summary}}${NL}${NL}` +
      `Open the inbox: {{platform.inboxLink}}`,
  },
};

/** Branded HTML shell used by the two operator-facing email templates above
 *  (lead_notification, lead_digest). Same visual chrome as the auth-flow
 *  branded senders (paper bg, white card, rust eyebrow, mono footer); the
 *  body slot accepts hand-authored HTML — keep it minimal (inline styles
 *  only; mail clients strip <style> blocks). */
function BRANDED_SHELL(input: {
  eyebrow: string;
  headline: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaHref: string;
}): string {
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:14px;">${input.eyebrow}</div>
    <h1 style="font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;margin:0 0 18px 0;color:#0a0a0a;">${input.headline}</h1>
    ${input.bodyHtml}
    <p style="margin:0;">
      <a href="${input.ctaHref}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">${input.ctaLabel}</a>
    </p>
  </div>
  ${EMAIL_BRAND_FOOTER}
</body></html>`;
}

/** Maximum byte length the renderer will allow on a final composed email
 *  body. Resend's API allows up to ~10 MB request bodies (including
 *  attachments); this is just a sanity bound on the template + render path. */
export const MAX_EMAIL_BODY_BYTES = 500_000;
