// =============================================================================
// Automations cluster — data access (Phase 8 Session 1).
//
// Retargeted to the new engine tables:
//   • `automations`         — new shape (is_enabled, automation_key, etc.)
//   • `automation_actions`  — replaces automation_steps. Comm-only actions
//                              (send_sms_to_lead / send_email_to_lead) are
//                              shown to the existing editor; other action
//                              types (wait, operator_notification, etc.)
//                              are engine-internal until Session 2 lands
//                              the new editor UI.
//
// READ HOOKS — work as before.
// TOGGLE     — works as before (real persistence).
// EDITOR STEP-SAVE — throws a clear AppError pointing at Session 2. The
//                    editor surfaces the error in its existing pane.
//                    Editing per-step copy means editing the referenced
//                    sms_templates / email_templates row; that surface
//                    lands with Session 2.
//
// Performance metrics (sent / delivered / replied) still have no schema
// home — placeholders unchanged.
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

// ---- Row shapes (new schema) -----------------------------------------------

type ActionRow = {
  id: string;
  position: number;
  action_type: string;
  action_config: Record<string, unknown> | null;
};

type AutomationJoinRow = {
  id: string;
  client_id: string;
  name: string;
  is_enabled: boolean;
  trigger_type: string;
  trigger_config: Record<string, unknown> | null;
  client: { name: string; slug: string } | null;
  automation_actions: ActionRow[];
};

const AUTOMATION_SELECT =
  'id, client_id, name, is_enabled, trigger_type, trigger_config, ' +
  'client:clients(name, slug), ' +
  'automation_actions(id, position, action_type, action_config)';

// ---- Trigger-type vocabulary ------------------------------------------------

// The library types, in display order. lead_inactive (cold lead) lives at
// the end — it surfaces a task, not a message, so it sits visually apart.
const TYPE_ORDER = [
  'lead_created',
  'job_scheduled',
  'job_status_changed',
  'job_completed',
  'payment_failed',
  'lead_inactive',
] as const;

const TYPE_LABEL: Record<string, string> = {
  lead_created: 'New lead automations',
  job_scheduled: 'Booking confirmation',
  job_status_changed: 'Status-change notifications',
  job_completed: 'Review request loop',
  payment_failed: 'Billing alerts',
  lead_inactive: 'Cold-lead nudges',
};

const TYPE_TAG: Record<string, string> = {
  lead_created: '// LEAD CAPTURE',
  job_scheduled: '// BOOKING REMINDER',
  job_status_changed: '// JOB STATUS',
  job_completed: '// REPUTATION LOOP',
  payment_failed: '// BILLING',
  lead_inactive: '// FOLLOW-UP',
};

const TRIGGER_NAME: Record<string, string> = {
  lead_created: 'New lead submits the form',
  job_scheduled: 'Booking is created',
  job_status_changed: 'Booking status changes',
  job_completed: 'Booking is marked completed',
  payment_failed: 'Stripe payment failure',
  lead_inactive: 'Lead goes quiet (4+ days)',
};

const TYPE_DESCRIPTION: Record<string, ReactNode> = {
  lead_created: (
    <>
      Fires the moment a new lead lands.{' '}
      <strong>Sends the acknowledgement SMS + email + fans operator alerts.</strong>
    </>
  ),
  job_scheduled: (
    <>
      Sends a booking confirmation message when a booking is created.{' '}
      <strong>Default-off — opt in when you trust the cadence.</strong>
    </>
  ),
  job_status_changed: (
    <>
      Sends an arrival or status-change notification.{' '}
      <strong>Default-off — opt in when you trust the cadence.</strong>
    </>
  ),
  job_completed: (
    <>
      Sends a Google review request 2 hours after the job is marked complete.{' '}
      <strong>Only fires when the client has a connected GBP location.</strong>
    </>
  ),
  payment_failed: (
    <>
      Emails the operator(s) when a Stripe subscription payment fails.
    </>
  ),
  lead_inactive: (
    <>
      Surfaces a quiet lead (no inbound for 4+ days) as a follow-up task.{' '}
      <strong>Never sends a message — you write the follow-up yourself.</strong>
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

// ---- Action helpers ---------------------------------------------------------

function sortedActions(actions: ActionRow[]): ActionRow[] {
  return [...actions].sort((a, b) => a.position - b.position);
}

function isCommAction(t: string): boolean {
  return t === 'send_sms_to_lead' || t === 'send_email_to_lead';
}

function actionToChannel(t: string): AutomationEditorChannel | null {
  if (t === 'send_sms_to_lead') return 'sms';
  if (t === 'send_email_to_lead') return 'email';
  return null;
}

function actionTypeSummary(actions: ActionRow[]): string {
  const types = sortedActions(actions).map((a) => a.action_type);
  if (types.length === 0) return 'no actions';
  // Compact: "SMS / email" for comm-only; otherwise "task" for non-comm.
  return types
    .map((t) => {
      if (t === 'send_sms_to_lead') return 'SMS';
      if (t === 'send_email_to_lead') return 'email';
      if (t === 'send_operator_notification') return 'operator alert';
      if (t === 'wait_for_duration') return 'wait';
      if (t === 'update_lead_field') return 'lead update';
      if (t === 'create_followup_task') return 'follow-up task';
      return t;
    })
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
      <>An automated flow Webnua runs for you.</>
    ),
    enabled: row.is_enabled,
    // Performance stat tiles are intentionally omitted — no send-log table
    // yet. The card renders header + toggle only.
  };
}

function buildClientAutomations(rows: AutomationJoinRow[]): ClientAutomations {
  const clientName = rows[0]?.client?.name ?? 'Your business';
  const activeCount = rows.filter((r) => r.is_enabled).length;

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
// Admin `/automations` — the cross-client roster, grouped by trigger type.
// =============================================================================

function toFlowMini(row: AutomationJoinRow): AutomationFlowMini {
  const clientName = row.client?.name ?? 'Unknown client';
  const actionCount = row.automation_actions.length;
  return {
    id: row.id,
    clientInitial: (clientName[0] ?? '?').toUpperCase(),
    clientName,
    flowName: `${actionCount} ${actionCount === 1 ? 'action' : 'actions'} · ${
      actionTypeSummary(row.automation_actions)
    }`,
    clientSlug: row.client?.slug ?? 'generic',
    clientTone: toClientTone(row.client?.slug ?? 'generic'),
    enabled: row.is_enabled,
    stats: [
      { label: '// FIRED 7D', value: '—' },
      { label: '// DELIVERED', value: '—' },
      { label: '// REPLIED', value: '—' },
    ],
    href: `/automations/${row.id}`,
  };
}

function buildAdminAutomations(rows: AutomationJoinRow[]): AdminAutomations {
  const activeCount = rows.filter((r) => r.is_enabled).length;

  const groups: AutomationGroup[] = [];
  for (const triggerType of TYPE_ORDER) {
    const groupRows = rows.filter((r) => r.trigger_type === triggerType);
    if (groupRows.length === 0) continue;
    const enabled = groupRows.filter((r) => r.is_enabled).length;
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
          Every flow across your clients, grouped by trigger type.{' '}
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
// Editor `/automations/[id]` — one automation + its comm actions.
//
// Session 2 will replace the editor UI with one that handles every action
// type. Until then this view shows the SMS / email actions only; non-comm
// actions are engine-internal and the editor doesn't render them.
// =============================================================================

const VARIABLE_CATALOG = [
  { code: '{first_name}', description: "Lead's first name" },
  { code: '{business}', description: 'The client business name' },
  { code: '{job_type}', description: 'What the lead asked for' },
  { code: '{suburb}', description: 'From the address field' },
  { code: '{review_link}', description: 'Google review URL' },
  { code: '{rebook_link}', description: 'Rebooking page URL' },
];

/** Convert a comm action to the editor's step shape. Body text resolves to
 *  the referenced template_key — Session 2 fetches the template body inline;
 *  for now we display a placeholder pointing at the template. */
function toEditorStep(action: ActionRow): AutomationEditorStep {
  const channel = actionToChannel(action.action_type) ?? 'sms';
  const cfg = (action.action_config ?? {}) as { template_key?: string };
  const templateKey = cfg.template_key ?? '(no template)';
  const placeholder = `Template "${templateKey}" — edit on the templates surface (Session 2).`;
  const step: AutomationEditorStep = {
    id: action.id,
    number: action.position,
    channel,
    delay: 'Sends from the trigger',
    name: channel === 'sms' ? 'SMS' : 'Email',
    body: placeholder,
    bodyText: placeholder,
    footerMeta: '// Awaiting send data',
    variables: [],
  };
  if (channel === 'email') step.subject = '';
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
  const commActions = sortedActions(row.automation_actions).filter((a) =>
    isCommAction(a.action_type),
  );

  return {
    id: row.id,
    enabled: row.is_enabled,
    eyebrow: `// ${clientName} · ${row.name}`,
    title: (
      <>
        Edit the <em>flow</em>.
      </>
    ),
    subtitle: (
      <>
        {commActions.length}-step sequence on the{' '}
        <strong>{TYPE_LABEL[row.trigger_type] ?? row.trigger_type}</strong>{' '}
        trigger. Step copy edits land with Session 2.
      </>
    ),
    trigger: {
      label: '// TRIGGER',
      name: TRIGGER_NAME[row.trigger_type] ?? row.trigger_type,
      changeLabel: 'Change trigger →',
    },
    steps: commActions.map(toEditorStep),
    addStepLabel: '+ Add another step (Session 2)',
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
          <strong>{row.is_enabled ? 'active' : 'disabled'}</strong>
        </>
      ),
      backLabel: '← Back to all automations',
      backHref: '/automations',
      disableLabel: row.is_enabled ? 'Disable flow' : 'Enable flow',
      saveLabel: 'Save (Session 2)',
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
      smsPreview: commActions[0]
        ? (toEditorStep(commActions[0]).body as ReactNode)
        : 'This automation has no comm actions.',
      smsVariablesLine: <>Variables are filled with sample values for the test.</>,
      options: {
        title: <strong>Send as SMS only</strong>,
        sub: <>SMS is what your customers actually receive.</>,
        switchLabel: 'Switch to email',
      },
      footerInfo: <>Test sends use your messaging credit.</>,
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
    .update({ is_enabled: input.enabled })
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

// =============================================================================
// Step save — Session 2.
//
// The Phase 5 editor wrote step copy back to automation_steps.body. In the
// new engine the body lives on the referenced sms_templates / email_templates
// row, and editing a template is a Session 2 surface (the template is shared
// across automations of the same key, so the editor can't just write through
// without affecting siblings). For Session 1 this mutation throws a clear
// AppError; the editor's existing error pane surfaces it.
// =============================================================================

export type AutomationStepEdit = {
  id: string;
  name: string;
  subject: string | null;
  body: string;
};

async function updateAutomationSteps(_input: {
  steps: AutomationStepEdit[];
}): Promise<void> {
  void _input;
  throw AppError.validation(
    { body: 'Step copy editing moves to a dedicated templates surface in Session 2.' },
    'Step copy editing is unavailable in this build.',
  );
}

/** Editor Save — throws AppError until Session 2 lands the templates editor.
 *  Existing call sites see the error in their normalized error pane. */
export function useUpdateAutomationSteps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAutomationSteps,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}
