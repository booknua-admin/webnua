// =============================================================================
// Automations cluster — data access (Phase 3).
//
// The client `/automations` list, the admin cross-client roster, and the
// `/automations/[id]` editor read the `automations` + `automation_steps`
// tables; RLS bounds the rows. The full automation library (one automation
// per type per client) is seeded by migration 0021, so every automation the
// UI shows is a real, editable row.
//
// SCHEMA NOTE — automation *definitions* (name, trigger, steps, copy) are
// fully wired here. Automation *performance* metrics (sent / delivered /
// replied counts) have no schema home — there is no send-log table — so the
// per-card / per-row stat tiles and the editor performance rail render honest
// placeholders, the same gap campaigns hit (design §5). The definition is
// what is editable; the metrics arrive with the messaging-event pipeline.
//
// `useToggleAutomation` is a real mutation — enabling / disabling a flow
// persists. queryFn / mutationFn throw `AppError`.
// =============================================================================

import type { ReactNode } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

import type {
  AdminAutomations,
  AutomationClientTone,
  AutomationEditor,
  AutomationEditorChannel,
  AutomationEditorStep,
  AutomationFlowMini,
  AutomationGroup,
  AutomationStatsCard,
  ClientAutomations,
} from './types';

// ---- Row shapes -------------------------------------------------------------

type StepRow = {
  id: string;
  position: number;
  channel: AutomationEditorChannel;
  delay_amount: number;
  delay_unit: string;
  name: string;
  subject: string | null;
  body: string;
};

type AutomationJoinRow = {
  id: string;
  client_id: string;
  name: string;
  enabled: boolean;
  trigger_type: string;
  client: { name: string; slug: string } | null;
  automation_steps: StepRow[];
};

const AUTOMATION_SELECT =
  'id, client_id, name, enabled, trigger_type, ' +
  'client:clients(name, slug), ' +
  'automation_steps(id, position, channel, delay_amount, delay_unit, ' +
  'name, subject, body)';

// ---- Trigger-type vocabulary ------------------------------------------------

// The four library types, in display order.
const TYPE_ORDER = [
  'lead_created',
  'lead_stale_24h',
  'job_completed',
  'booking_no_show',
] as const;

const TYPE_LABEL: Record<string, string> = {
  lead_created: 'Instant confirm SMS',
  lead_stale_24h: '24-hour follow-up sequence',
  job_completed: 'Review request loop',
  booking_no_show: 'No-show recovery',
};

const TYPE_TAG: Record<string, string> = {
  lead_created: '// LEAD CAPTURE',
  lead_stale_24h: '// LEAD NURTURE',
  job_completed: '// REPUTATION LOOP',
  booking_no_show: '// BOOKING RECOVERY',
};

const TRIGGER_NAME: Record<string, string> = {
  lead_created: 'New lead submits the funnel form',
  lead_stale_24h: 'Lead status = "New" for 24+ hours',
  job_completed: 'Job marked "Completed"',
  booking_no_show: 'Customer marked no-show',
};

const TYPE_DESCRIPTION: Record<string, ReactNode> = {
  lead_created: (
    <>
      Fires the moment a new lead submits your funnel form — confirms{' '}
      <strong>you have their enquiry</strong> and will be in touch shortly.
    </>
  ),
  lead_stale_24h: (
    <>
      A three-step SMS → email → SMS sequence that fires if a lead is still new
      after 24 hours.{' '}
      <strong>Pauses automatically once you mark the lead Contacted.</strong>
    </>
  ),
  job_completed: (
    <>
      Sends a Google review request a couple of hours after you mark a job
      Completed, <strong>with one polite reminder five days later</strong>.
    </>
  ),
  booking_no_show: (
    <>
      If a booked customer doesn&apos;t answer the door, this sends a friendly
      apology <strong>with a rebooking link</strong>.
    </>
  ),
};

function typeIndex(triggerType: string): number {
  const i = TYPE_ORDER.indexOf(triggerType as (typeof TYPE_ORDER)[number]);
  return i === -1 ? TYPE_ORDER.length : i;
}

// ---- Client tone ------------------------------------------------------------

const KNOWN_TONES = new Set<AutomationClientTone>([
  'voltline',
  'freshhome',
  'keyhero',
  'neatworks',
  'flowline',
]);

function toClientTone(slug: string): AutomationClientTone {
  return KNOWN_TONES.has(slug as AutomationClientTone)
    ? (slug as AutomationClientTone)
    : 'generic';
}

// ---- Step helpers -----------------------------------------------------------

function sortedSteps(steps: StepRow[]): StepRow[] {
  return [...steps].sort((a, b) => a.position - b.position);
}

function delayLabel(amount: number, unit: string): string {
  if (amount === 0) return 'Sends immediately';
  return `Delay: ${amount} ${amount === 1 ? unit.replace(/s$/, '') : unit}`;
}

/** Split a plain-text body into ReactNode, wrapping {placeholder} tokens in
 *  the `data-slot="var"` highlight span the step components style. */
function highlightVars(text: string): ReactNode {
  const parts = text.split(/(\{[a-z_]+\})/gi);
  return (
    <>
      {parts.map((part, i) =>
        /^\{[a-z_]+\}$/i.test(part) ? (
          <span key={i} data-slot="var">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function extractVars(text: string): string[] {
  const found = text.match(/\{[a-z_]+\}/gi) ?? [];
  return [...new Set(found)];
}

function channelSummary(steps: StepRow[]): string {
  return sortedSteps(steps)
    .map((s) => (s.channel === 'sms' ? 'SMS' : 'email'))
    .join(' / ');
}

// ---- Fetch ------------------------------------------------------------------

async function fetchAutomations(): Promise<AutomationJoinRow[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const { data, error } = await supabase
    .from('automations')
    .select(AUTOMATION_SELECT)
    .order('created_at', { ascending: true });

  if (error) throw normalizeError(error);

  const rows = data as unknown as AutomationJoinRow[];
  return [...rows].sort(
    (a, b) => typeIndex(a.trigger_type) - typeIndex(b.trigger_type),
  );
}

// =============================================================================
// Client `/automations` — the signed-in client's flows as toggle cards.
// =============================================================================

function toStatsCard(row: AutomationJoinRow): AutomationStatsCard {
  return {
    id: row.id,
    tag: TYPE_TAG[row.trigger_type] ?? '// AUTOMATION',
    title: row.name,
    description: TYPE_DESCRIPTION[row.trigger_type] ?? (
      <>An automated message flow Webnua runs for you.</>
    ),
    enabled: row.enabled,
    // Performance stat tiles are intentionally omitted — no send-log table
    // yet (see the module header). The card renders header + toggle only.
  };
}

function buildClientAutomations(rows: AutomationJoinRow[]): ClientAutomations {
  const clientName = rows[0]?.client?.name ?? 'Your business';
  const activeCount = rows.filter((r) => r.enabled).length;

  return {
    hero: {
      eyebrow: `// ${clientName} · ${activeCount} active ${
        activeCount === 1 ? 'flow' : 'flows'
      }`,
      title: (
        <>
          Your <em>automations</em>.
        </>
      ),
      subtitle: (
        <>
          Webnua writes and manages the copy and timing.{' '}
          <strong>You can pause any flow with its toggle</strong> — copy
          changes go through your operator.
        </>
      ),
    },
    banner: (
      <>
        <strong>Webnua writes and manages these automations for you.</strong>{' '}
        You can pause any flow with the toggle, but copy changes go through
        your operator — text Craig or use the support button in the sidebar.
      </>
    ),
    cards: rows.map(toStatsCard),
  };
}

/** The client automations list — RLS bounds rows to the signed-in client. */
export function useClientAutomations() {
  return useQuery({
    queryKey: ['automations', 'list'],
    queryFn: fetchAutomations,
    select: buildClientAutomations,
  });
}

// =============================================================================
// Admin `/automations` — the cross-client roster, grouped by automation type.
// =============================================================================

function toFlowMini(row: AutomationJoinRow): AutomationFlowMini {
  const clientName = row.client?.name ?? 'Unknown client';
  const stepCount = row.automation_steps.length;
  return {
    id: row.id,
    clientInitial: (clientName[0] ?? '?').toUpperCase(),
    clientName,
    flowName: `${stepCount} ${stepCount === 1 ? 'step' : 'steps'} · ${
      channelSummary(row.automation_steps) || 'no steps'
    }`,
    clientTone: toClientTone(row.client?.slug ?? 'generic'),
    enabled: row.enabled,
    // Performance metrics are integration-blocked — "—" placeholders.
    stats: [
      { label: '// SENT 7D', value: '—' },
      { label: '// DELIVERED', value: '—' },
      { label: '// REPLIED', value: '—' },
    ],
    href: `/automations/${row.id}`,
  };
}

function buildAdminAutomations(rows: AutomationJoinRow[]): AdminAutomations {
  const activeCount = rows.filter((r) => r.enabled).length;

  // Group by trigger type, preserving the library order.
  const groups: AutomationGroup[] = [];
  for (const triggerType of TYPE_ORDER) {
    const groupRows = rows.filter((r) => r.trigger_type === triggerType);
    if (groupRows.length === 0) continue;
    const enabled = groupRows.filter((r) => r.enabled).length;
    groups.push({
      id: triggerType,
      title: TYPE_LABEL[triggerType] ?? triggerType,
      countBadge: `${enabled} / ${groupRows.length}`,
      meta: (
        <>
          {enabled} active ·{' '}
          <strong>
            {groupRows.length} configured across{' '}
            {new Set(groupRows.map((r) => r.client_id)).size} clients
          </strong>
        </>
      ),
      flows: groupRows.map(toFlowMini),
    });
  }

  // Client filter chips, derived from the automations' own clients.
  const clients = new Map<string, string>();
  for (const r of rows) {
    if (r.client) clients.set(r.client.slug, r.client.name);
  }
  const filters = [
    { id: 'all', label: 'All clients' },
    ...[...clients].map(([slug, name]) => ({ id: slug, label: name })),
  ];

  return {
    hero: {
      eyebrow: `// Workspace · ${activeCount} active ${
        activeCount === 1 ? 'flow' : 'flows'
      }`,
      title: (
        <>
          All <em>automations</em>.
        </>
      ),
      subtitle: (
        <>
          Every flow across your clients, grouped by automation type.{' '}
          <strong>
            {activeCount} of {rows.length} flows are active.
          </strong>
        </>
      ),
    },
    filters,
    defaultFilterId: 'all',
    stats: [
      {
        label: '// ACTIVE FLOWS',
        value: <em>{activeCount}</em>,
        trend: `of ${rows.length} configured`,
        trendTone: 'quiet',
      },
      {
        label: '// AUTOMATION TYPES',
        value: String(groups.length),
        trend: 'in the library',
        trendTone: 'quiet',
      },
      {
        label: '// CLIENTS',
        value: String(clients.size),
        trend: 'with automations',
        trendTone: 'quiet',
      },
      {
        label: '// SENT · 7D',
        value: '—',
        trend: 'awaiting send log',
        trendTone: 'quiet',
      },
    ],
    groups,
  };
}

/** The operator cross-client automations roster. */
export function useAdminAutomations() {
  return useQuery({
    queryKey: ['automations', 'list'],
    queryFn: fetchAutomations,
    select: buildAdminAutomations,
  });
}

// =============================================================================
// Editor `/automations/[id]` — one automation + its steps.
// =============================================================================

const VARIABLE_CATALOG = [
  { code: '{first_name}', description: "Lead's first name" },
  { code: '{business}', description: 'The client business name' },
  { code: '{job_type}', description: 'What the lead asked for' },
  { code: '{suburb}', description: 'From the address field' },
  { code: '{review_link}', description: 'Google review URL' },
  { code: '{rebook_link}', description: 'Rebooking page URL' },
  { code: '{est_price}', description: 'From the pricing engine' },
];

function toEditorStep(row: StepRow): AutomationEditorStep {
  const step: AutomationEditorStep = {
    id: row.id,
    number: row.position,
    channel: row.channel,
    delay: delayLabel(row.delay_amount, row.delay_unit),
    name: row.name,
    body: highlightVars(row.body),
    footerMeta: '// Awaiting send data',
    variables: extractVars(row.body),
  };
  if (row.channel === 'email') step.subject = row.subject ?? '';
  return step;
}

async function fetchAutomationEditor(id: string): Promise<AutomationEditor> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const { data, error } = await supabase
    .from('automations')
    .select(AUTOMATION_SELECT)
    .eq('id', id)
    .single();
  if (error) throw normalizeError(error);

  const row = data as unknown as AutomationJoinRow;
  const clientName = row.client?.name ?? 'Client';
  const steps = sortedSteps(row.automation_steps);

  return {
    id: row.id,
    enabled: row.enabled,
    eyebrow: `// ${clientName} · ${row.name}`,
    title: (
      <>
        Edit the <em>flow</em>.
      </>
    ),
    subtitle: (
      <>
        {steps.length}-step sequence on the{' '}
        <strong>{TYPE_LABEL[row.trigger_type] ?? row.trigger_type}</strong>{' '}
        trigger. Edit copy and timing; test sends go to your phone, not the
        customer.
      </>
    ),
    trigger: {
      label: '// TRIGGER',
      name: TRIGGER_NAME[row.trigger_type] ?? row.trigger_type,
      changeLabel: 'Change trigger →',
    },
    steps: steps.map(toEditorStep),
    addStepLabel: '+ Add another step (SMS / Email / Wait)',
    rail: {
      variables: { heading: '// AVAILABLE VARIABLES', items: VARIABLE_CATALOG },
      testSend: {
        heading: '// TEST SEND',
        body: (
          <>
            Send every step to your phone instantly so you can read them as a
            customer would. Won&apos;t reach real leads.
          </>
        ),
        buttonLabel: 'Send test to my phone',
      },
      performance: {
        heading: '// PERFORMANCE · 7D',
        metrics: [
          { label: 'Triggered', value: '—' },
          { label: 'Replies', value: '—', tone: 'accent' },
          { label: '→ Booked', value: '—', tone: 'good' },
        ],
      },
    },
    footer: {
      progress: (
        <>
          {clientName} · {row.name} ·{' '}
          <strong>{row.enabled ? 'active' : 'disabled'}</strong>
        </>
      ),
      backLabel: '← Back to all automations',
      backHref: '/automations',
      disableLabel: row.enabled ? 'Disable flow' : 'Enable flow',
      saveLabel: 'Save changes',
    },
    testSend: {
      tag: `// TEST SEND · ${row.name}`,
      title: (
        <>
          Test <em>before</em> going live
        </>
      ),
      subtitle: (
        <>
          Send a real SMS or email to your own number.{' '}
          <strong>Your actual customers won&apos;t see this send.</strong>
        </>
      ),
      sendTo: 'Your verified operator number',
      sendToHint: 'Add another test recipient in Settings.',
      phoneBar: 'Test send · from your business number',
      smsPreview: (
        <>
          {steps[0]
            ? highlightVars(steps[0].body)
            : 'This automation has no steps yet.'}
        </>
      ),
      smsVariablesLine: (
        <>Variables are filled with sample values for the test.</>
      ),
      options: {
        title: <strong>Send as SMS only</strong>,
        sub: <>SMS is what your customers actually receive.</>,
        switchLabel: 'Switch to email',
      },
      footerInfo: (
        <>Charges your messaging credit (<strong>~$0.04</strong> for AU SMS).</>
      ),
      cancelLabel: 'Cancel',
      sendLabel: 'Send test now →',
    },
  };
}

/** One automation as the editor sees it. RLS scopes the by-id fetch to the
 *  caller's tenant; an automation outside it resolves as not_found. */
export function useAutomationEditor(id: string) {
  return useQuery({
    queryKey: ['automations', 'editor', id],
    queryFn: () => fetchAutomationEditor(id),
    enabled: id.length > 0,
  });
}

// =============================================================================
// Toggle — enable / disable a flow. A real mutation; the change persists.
// =============================================================================

async function toggleAutomation(input: {
  id: string;
  enabled: boolean;
}): Promise<void> {
  const { error } = await supabase
    .from('automations')
    .update({ enabled: input.enabled })
    .eq('id', input.id);
  if (error) throw normalizeError(error);
}

/** Enable / disable an automation. On success the automations queries are
 *  invalidated so every list + the editor reflect the new state. */
export function useToggleAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleAutomation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}
