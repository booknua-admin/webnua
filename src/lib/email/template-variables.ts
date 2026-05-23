// =============================================================================
// Email template variables — the closed catalogue of {{placeholders}}.
//
// Phase 7 Resend session. Same shape as src/lib/sms/template-variables.ts —
// every variable an operator can insert in an email template is enumerated
// here so the future template editor (deferred — see CLAUDE.md note) can
// show a typed list, and the renderer's missing-variable detection has
// something to compare against.
//
// Extends the SMS variable set with email-specific placeholders:
//   {{review.link}}        — the GBP-link the review_request template uses.
//   {{platform.inboxLink}} — the deep-link to the Webnua inbox (operator
//                            notification emails point operators here).
//   {{lead.fullName}}      — the full customer name (operator notification).
//   {{lead.lastNameSuffix}} — " Reilly" when last name present, "" otherwise.
//                            Lets a subject line read naturally:
//                            "New lead: Liam Reilly — …".
//   {{lead.email}} / {{lead.phone}} — the lead's contact details (operator
//                            notification).
//   {{lead.preview}}       — the inbox preview line of the lead.
//   {{digest.count}}       — for the lead_digest template.
//   {{digest.summary}}     — formatted summary block of the batched leads.
// =============================================================================

import type { EmailTemplateKey } from '@/lib/integrations/resend/types';

export type EmailTemplateVariableId =
  | 'client.shortName'
  | 'client.businessName'
  | 'client.phone'
  | 'client.responseTime'
  | 'lead.firstName'
  | 'lead.lastNameSuffix'
  | 'lead.fullName'
  | 'lead.email'
  | 'lead.phone'
  | 'lead.service'
  | 'lead.preview'
  | 'review.link'
  | 'platform.inboxLink'
  | 'digest.count'
  | 'digest.summary';

export type EmailTemplateVariable = {
  id: EmailTemplateVariableId;
  group: 'client' | 'lead' | 'review' | 'platform' | 'digest';
  /** Operator-facing label shown in the future editor's variable picker. */
  label: string;
  /** What a typical render looks like — operator preview. */
  sample: string;
};

export const EMAIL_TEMPLATE_VARIABLES: EmailTemplateVariable[] = [
  { id: 'client.shortName', group: 'client', label: 'Client short name', sample: 'Voltline' },
  {
    id: 'client.businessName',
    group: 'client',
    label: 'Client business name',
    sample: 'Voltline Electrical',
  },
  { id: 'client.phone', group: 'client', label: 'Client phone', sample: '0412 345 678' },
  {
    id: 'client.responseTime',
    group: 'client',
    label: 'Response time promise',
    sample: '1 hour',
  },
  { id: 'lead.firstName', group: 'lead', label: 'Lead first name', sample: 'Liam' },
  {
    id: 'lead.lastNameSuffix',
    group: 'lead',
    label: 'Lead last name (subject suffix)',
    sample: ' Reilly',
  },
  { id: 'lead.fullName', group: 'lead', label: 'Lead full name', sample: 'Liam Reilly' },
  { id: 'lead.email', group: 'lead', label: 'Lead email', sample: 'liam@example.com' },
  { id: 'lead.phone', group: 'lead', label: 'Lead phone', sample: '+61 412 345 678' },
  {
    id: 'lead.service',
    group: 'lead',
    label: 'Lead service / enquiry',
    sample: 'kitchen power outlet replacement',
  },
  {
    id: 'lead.preview',
    group: 'lead',
    label: 'Inbox preview line',
    sample: 'Outlet by the sink keeps tripping the breaker — need someone today.',
  },
  {
    id: 'review.link',
    group: 'review',
    label: 'Google review link',
    sample: 'https://g.page/voltline/review',
  },
  {
    id: 'platform.inboxLink',
    group: 'platform',
    label: 'Webnua inbox link',
    sample: 'https://app.webnua.com/leads',
  },
  { id: 'digest.count', group: 'digest', label: 'Digest lead count', sample: '3' },
  {
    id: 'digest.summary',
    group: 'digest',
    label: 'Digest summary block',
    sample: '• Liam Reilly — outlet replacement\n• Anna Larsen — fortnightly clean\n• Mark T — strata switchboard quote',
  },
];

/** Which variables each template typically uses. Used by the future editor's
 *  variable picker to surface a "relevant variables for this template" tab. */
export const EMAIL_TEMPLATE_VARIABLE_HINTS: Record<
  EmailTemplateKey,
  readonly EmailTemplateVariableId[]
> = {
  lead_followup: [
    'lead.firstName',
    'lead.service',
    'client.shortName',
    'client.businessName',
    'client.responseTime',
  ],
  review_request: [
    'lead.firstName',
    'client.shortName',
    'client.businessName',
    'review.link',
  ],
  quote_followup: [
    'lead.firstName',
    'lead.service',
    'client.shortName',
  ],
  lead_notification: [
    'lead.firstName',
    'lead.lastNameSuffix',
    'lead.fullName',
    'lead.email',
    'lead.phone',
    'lead.service',
    'lead.preview',
    'client.businessName',
    'platform.inboxLink',
  ],
  lead_digest: [
    'digest.count',
    'digest.summary',
    'client.businessName',
    'platform.inboxLink',
  ],
};
