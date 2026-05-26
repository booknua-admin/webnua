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
    body_html:
      `<p>You have a new lead in {{client.businessName}}.</p>` +
      `<p><strong>{{lead.fullName}}</strong><br/>` +
      `{{lead.phone}}<br/>` +
      `{{lead.email}}</p>` +
      `<p><strong>About:</strong> {{lead.service}}</p>` +
      `<p>{{lead.preview}}</p>` +
      `<p><a href="{{platform.inboxLink}}">Open in the Webnua inbox →</a></p>`,
    body_text:
      `You have a new lead in {{client.businessName}}.${NL}${NL}` +
      `{{lead.fullName}}${NL}` +
      `{{lead.phone}}${NL}` +
      `{{lead.email}}${NL}${NL}` +
      `About: {{lead.service}}${NL}${NL}` +
      `{{lead.preview}}${NL}${NL}` +
      `Open in the Webnua inbox: {{platform.inboxLink}}`,
  },
  lead_digest: {
    subject: '{{digest.count}} new leads in {{client.businessName}}',
    body_html:
      `<p>{{digest.count}} new leads have come in for {{client.businessName}} in the last hour.</p>` +
      `<p>{{digest.summary}}</p>` +
      `<p><a href="{{platform.inboxLink}}">Open the inbox →</a></p>`,
    body_text:
      `{{digest.count}} new leads have come in for {{client.businessName}} in the last hour.${NL}${NL}` +
      `{{digest.summary}}${NL}${NL}` +
      `Open the inbox: {{platform.inboxLink}}`,
  },
};

/** Maximum byte length the renderer will allow on a final composed email
 *  body. Resend's API allows up to ~10 MB request bodies (including
 *  attachments); this is just a sanity bound on the template + render path. */
export const MAX_EMAIL_BODY_BYTES = 500_000;
