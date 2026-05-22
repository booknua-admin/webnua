// =============================================================================
// SMS template variables — the catalogue of {{placeholders}} a template may
// use, with sample values for the editor preview + cost estimator.
//
// A variable is referenced as {{group.name}} in a template body. The renderer
// resolves it against a flat RenderContext keyed by the same dotted string.
//
// Two sample sets:
//   • typical — realistic everyday values, for the "typical data" estimate.
//   • long    — the longest realistic value for each variable, for the
//               worst-case estimate (so the operator sees the maximum-length
//               scenario before it surprises them in production).
//
// SERVER + CLIENT safe — pure data, no imports.
// =============================================================================

export type TemplateVariableGroup = 'client' | 'lead' | 'job' | 'review';

export type TemplateVariable = {
  /** The dotted key as it appears in a template, e.g. 'lead.firstName'. */
  key: string;
  group: TemplateVariableGroup;
  /** Short human label for the variable picker. */
  label: string;
  /** One-line explanation of what it resolves to. */
  description: string;
  /** A realistic everyday value. */
  sample: string;
  /** The longest realistic value — drives the worst-case estimate. */
  sampleLong: string;
};

/** Every variable a template may reference. The closed set — adding one means
 *  the renderer's context builder (in the send_sms job) must supply it. */
export const TEMPLATE_VARIABLES: readonly TemplateVariable[] = [
  {
    key: 'client.shortName',
    group: 'client',
    label: 'Business short name',
    description: "The business's SMS sender name (the alphanumeric sender id).",
    sample: 'Voltline',
    sampleLong: 'Brightspark',
  },
  {
    key: 'client.businessName',
    group: 'client',
    label: 'Business name',
    description: 'The full registered business name.',
    sample: 'Voltline Electrical',
    sampleLong: 'Brightspark Electrical Contractors',
  },
  {
    key: 'client.phone',
    group: 'client',
    label: 'Business phone',
    description: "The business's contact phone number.",
    sample: '01 555 0142',
    sampleLong: '+353 (0)1 555 0142',
  },
  {
    key: 'client.responseTime',
    group: 'client',
    label: 'Response time',
    description: 'How quickly the business promises to get back in touch.',
    sample: '1 hour',
    sampleLong: 'the next business day',
  },
  {
    key: 'lead.firstName',
    group: 'lead',
    label: 'Lead first name',
    description: "The enquiring customer's first name.",
    sample: 'Sarah',
    sampleLong: 'Christopher',
  },
  {
    key: 'lead.service',
    group: 'lead',
    label: 'Service enquired about',
    description: 'What the customer enquired about (resolved from the form).',
    sample: 'a fuse board upgrade',
    sampleLong: 'a full rewire and consumer unit replacement',
  },
  {
    key: 'job.date',
    group: 'job',
    label: 'Job date',
    description: 'The scheduled date of the booking.',
    sample: 'Tue 26 May',
    sampleLong: 'Wednesday 26 November',
  },
  {
    key: 'job.time',
    group: 'job',
    label: 'Job time',
    description: 'The scheduled start time of the booking.',
    sample: '9:30am',
    sampleLong: 'between 8:00am and 10:00am',
  },
  {
    key: 'job.address',
    group: 'job',
    label: 'Job address',
    description: 'The address the job is at.',
    sample: '14 Seaview Rd',
    sampleLong: '142 Lower Ballybough Road, Dublin 3',
  },
  {
    key: 'job.eta',
    group: 'job',
    label: 'Arrival ETA',
    description: 'The estimated arrival time for an arrival notification.',
    sample: '20 minutes',
    sampleLong: 'approximately 45 minutes',
  },
  {
    key: 'review.link',
    group: 'review',
    label: 'Review link',
    description: 'The short link to leave a Google review.',
    sample: 'g.page/r/voltline',
    sampleLong: 'https://g.page/r/CdR-voltline-electrical/review',
  },
] as const;

/** Fast lookup of a variable definition by its dotted key. */
export const TEMPLATE_VARIABLE_BY_KEY: ReadonlyMap<string, TemplateVariable> = new Map(
  TEMPLATE_VARIABLES.map((v) => [v.key, v]),
);

/** A flat render context — dotted variable key → string value. */
export type RenderContext = Record<string, string>;

/** Build a sample render context for the editor preview / cost estimator.
 *  'typical' uses everyday values; 'long' uses the longest realistic value of
 *  every variable, for the worst-case estimate. */
export function buildSampleContext(kind: 'typical' | 'long'): RenderContext {
  const context: RenderContext = {};
  for (const v of TEMPLATE_VARIABLES) {
    context[v.key] = kind === 'long' ? v.sampleLong : v.sample;
  }
  return context;
}
