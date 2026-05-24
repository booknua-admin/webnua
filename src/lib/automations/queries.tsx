// =============================================================================
// Automations cluster — data access (Phase 8 Session 2).
//
// READS:
//   • useClientAutomations()  — client-side toggle cards (own client).
//   • useAdminAutomations()   — cross-client roster (operator).
//   • useAutomationEditor(id) — one automation's editor view: every action
//     type (not just comm), live body / subject from action_config, the
//     editable trigger + filter fields, and the variable catalog.
//   • useAutomationRuns(id, limit) — recent runs for an automation
//     (sourced from automation_runs; SELECT RLS in migration 0076 already
//     scopes the read).
//   • useAutomationStats(id) — last-30-day completion / pause / failure
//     rates + average completion time.
//
// MUTATIONS:
//   • useToggleAutomation()        — flip is_enabled (works for client + op).
//   • useUpdateAutomationAction()  — write the editable fields of one action
//     (body / subject / body_html / body_text). The engine + manual paths
//     pick this up on the next send.
//   • useUpdateAutomationTrigger() — write trigger_config / trigger_filters.
//   • useCloneAutomation()         — operator-only. Forks an automation under
//     a new automation_key with is_default=false + is_enabled=false. Body
//     edits on the clone don't touch the source.
//   • useUpdateAutomationSteps()   — kept as a thin shim over
//     useUpdateAutomationAction so the existing editor page's `handleSave`
//     keeps compiling — it now writes per-action through the new path.
// =============================================================================

import type { ReactNode } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/types/database';

import { ACTION_PAUSES_ON_HUMAN_ACTIVITY } from './engine-types';
import {
  AUTOMATION_VARIABLE_FLAT,
} from './platform-defaults';
import type {
  AdminAutomations,
  AutomationClientTone,
  AutomationEditableFilterField,
  AutomationEditableTriggerField,
  AutomationEditor,
  AutomationEditorAction,
  AutomationEditorActionKind,
  AutomationEditorActionType,
  AutomationEditorChannel,
  AutomationEditorRun,
  AutomationEditorStats,
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
  pauses_on_human_activity: boolean;
};

type AutomationJoinRow = {
  id: string;
  client_id: string;
  automation_key: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  is_default: boolean;
  trigger_type: string;
  trigger_config: Record<string, unknown> | null;
  trigger_filters: Record<string, unknown> | null;
  client: { name: string; slug: string } | null;
  automation_actions: ActionRow[];
};

const AUTOMATION_SELECT =
  'id, client_id, automation_key, name, description, is_enabled, is_default, ' +
  'trigger_type, trigger_config, trigger_filters, ' +
  'client:clients(name, slug), ' +
  'automation_actions(id, position, action_type, action_config, pauses_on_human_activity)';

// ---- Trigger-type vocabulary ------------------------------------------------

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

function actionToChannel(t: string): AutomationEditorChannel | null {
  if (t === 'send_sms_to_lead') return 'sms';
  if (t === 'send_email_to_lead') return 'email';
  return null;
}

function actionTypeSummary(actions: ActionRow[]): string {
  const types = sortedActions(actions).map((a) => a.action_type);
  if (types.length === 0) return 'no actions';
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
    href: `/automations/${row.id}`,
    // Performance stat tiles intentionally omitted — `useAutomationStats`
    // (lazy, per-automation) is the right call for real counts, not the
    // list view's eager join.
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
        label: '// SENT · 30D',
        value: '—',
        trend: 'open editor for per-flow stats',
        trendTone: 'quiet',
      },
    ],
    groups,
  };
}

export function useAdminAutomations() {
  return useQuery({
    queryKey: ['automations', 'list'],
    queryFn: fetchAutomations,
    select: buildAdminAutomations,
  });
}

// =============================================================================
// Editor `/automations/[id]` — one automation + its actions + trigger config.
//
// Phase 8 Session 2: surfaces every action type (not just comm), the live
// body / subject from action_config, the editable trigger fields, and the
// filter checkboxes. Add/remove/reorder of actions is V1.1 and the
// `addStepLabel` reflects that.
// =============================================================================

function toEditorStep(action: ActionRow): AutomationEditorStep {
  const kind = action.action_type as AutomationEditorActionKind;
  const channel = actionToChannel(action.action_type);
  const cfg = (action.action_config ?? {}) as Record<string, unknown>;
  const isComm = kind === 'send_sms_to_lead' || kind === 'send_email_to_lead';
  const isSms = kind === 'send_sms_to_lead';

  const base: AutomationEditorStep = {
    id: action.id,
    number: action.position,
    actionKind: kind,
    channel: channel ?? undefined,
    delay: action.position === 1 ? 'Sends from the trigger' : `Step ${action.position}`,
    name:
      typeof cfg.label === 'string' && cfg.label.length > 0
        ? cfg.label
        : actionDefaultName(kind),
    bodyText: typeof cfg.body === 'string' ? (cfg.body as string) : undefined,
    footerMeta: isComm ? '// Edits save to this client only' : '// Engine-managed',
    variables: AUTOMATION_VARIABLE_FLAT.slice(0, 4).map((v) => v.code),
    canEditBody: isComm,
    canEditSms: isSms,
  };

  if (kind === 'send_email_to_lead') {
    base.subject = typeof cfg.subject === 'string' ? (cfg.subject as string) : '';
    base.bodyHtml = typeof cfg.body_html === 'string' ? (cfg.body_html as string) : '';
    base.bodyText = typeof cfg.body_text === 'string' ? (cfg.body_text as string) : '';
  }

  if (!isComm) {
    base.readOnlySummary = describeReadOnlyAction(kind, cfg);
  }

  return base;
}

/**
 * Phase 8 · Session 3 — `AutomationEditorAction` projection consumed by the
 * full editor body (add/reorder/remove + per-action edit). Reads body/subject
 * straight off `action_config` (inline-body model from Session 2).
 */
function actionToEditorAction(a: ActionRow): AutomationEditorAction {
  const cfg = (a.action_config ?? {}) as Record<string, unknown>;
  let body: string | null = null;
  let subject: string | null = null;
  if (a.action_type === 'send_sms_to_lead') {
    body = typeof cfg.body === 'string' ? cfg.body : '';
  } else if (a.action_type === 'send_email_to_lead') {
    body =
      typeof cfg.body_text === 'string'
        ? cfg.body_text
        : typeof cfg.body_html === 'string'
          ? cfg.body_html
          : '';
    subject = typeof cfg.subject === 'string' ? cfg.subject : '';
  }
  const actionType = a.action_type as AutomationEditorActionType;
  return {
    id: a.id,
    position: a.position,
    actionType,
    config: cfg,
    body,
    subject,
    // Prefer the DB column (Session 2 schema), fall back to the static map.
    pausesOnHumanActivity:
      a.pauses_on_human_activity ??
      ACTION_PAUSES_ON_HUMAN_ACTIVITY[actionType] ??
      false,
  };
}

function actionDefaultName(kind: AutomationEditorActionKind): string {
  switch (kind) {
    case 'send_sms_to_lead':
      return 'SMS';
    case 'send_email_to_lead':
      return 'Email';
    case 'send_operator_notification':
      return 'Operator notification';
    case 'wait_for_duration':
      return 'Wait';
    case 'update_lead_field':
      return 'Update lead';
    case 'create_followup_task':
      return 'Follow-up task';
  }
}

function describeReadOnlyAction(
  kind: AutomationEditorActionKind,
  cfg: Record<string, unknown>,
): ReactNode {
  switch (kind) {
    case 'send_operator_notification':
      return (
        <>
          Fans the <strong>{String(cfg.variant ?? 'configured')}</strong>{' '}
          notification through the operator throttle + digest pipeline.
        </>
      );
    case 'wait_for_duration':
      return (
        <>
          Waits <strong>{Number(cfg.minutes ?? 0)}</strong> minutes before the
          next action.
        </>
      );
    case 'update_lead_field':
      return (
        <>
          Sets <strong>lead.{String(cfg.field ?? 'field')}</strong> to{' '}
          <strong>{String(cfg.value ?? '')}</strong>.
        </>
      );
    case 'create_followup_task':
      return (
        <>
          Surfaces the lead on the &ldquo;Needs follow-up&rdquo; inbox tab so
          the client can write a personal nudge.
          {typeof cfg.hint === 'string' && cfg.hint.length > 0 ? (
            <>
              {' '}
              Hint: <em>{cfg.hint}</em>.
            </>
          ) : null}
        </>
      );
    default:
      return null;
  }
}

// --- Trigger config + filter editors ----------------------------------------

function buildTriggerFields(
  triggerType: string,
  cfg: Record<string, unknown>,
): AutomationEditableTriggerField[] {
  const fields: AutomationEditableTriggerField[] = [];

  // delay_minutes is editable on triggers that defer the first action
  // (review request 2h, etc.).
  if (triggerType === 'job_completed' || triggerType === 'job_scheduled') {
    const value = Number(cfg.delay_minutes ?? 0);
    fields.push({
      kind: 'delay_minutes',
      label: 'Delay before send (minutes)',
      value: Number.isFinite(value) ? value : 0,
      min: 0,
      max: 1440, // 24h cap — beyond that, the operator should rethink the flow.
    });
  }

  if (triggerType === 'job_status_changed') {
    const current = typeof cfg.to_status === 'string' ? (cfg.to_status as string) : 'on_the_way';
    fields.push({
      kind: 'to_status',
      label: 'Fire when booking status becomes',
      value: current,
      options: [
        { value: 'on_the_way', label: 'On the way' },
        { value: 'arrived', label: 'Arrived' },
        { value: 'completed', label: 'Completed' },
      ],
    });
  }

  if (triggerType === 'lead_inactive') {
    const days = Number(cfg.days_after_last_outbound ?? 4);
    fields.push({
      kind: 'days_after_last_outbound',
      label: 'Lead is "cold" after this many days',
      value: Number.isFinite(days) ? days : 4,
      min: 1,
      max: 30,
    });
    const max = Number(cfg.max_nudges ?? 3);
    fields.push({
      kind: 'max_nudges',
      label: 'Maximum nudges per lead',
      value: Number.isFinite(max) ? max : 3,
      min: 1,
      max: 10,
    });
  }

  return fields;
}

function buildFilterFields(
  filters: Record<string, unknown>,
): AutomationEditableFilterField[] {
  return [
    {
      kind: 'requires_phone',
      label: 'Only fire when the lead has a phone number',
      value: filters.requires_phone === true,
    },
    {
      kind: 'requires_email',
      label: 'Only fire when the lead has an email',
      value: filters.requires_email === true,
    },
    {
      kind: 'requires_gbp_location',
      label: 'Only fire when the client has a connected Google Business Profile',
      value: filters.requires_gbp_location === true,
    },
  ];
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
  const actions = sortedActions(row.automation_actions);
  const triggerCfg = row.trigger_config ?? {};
  const triggerFilters = row.trigger_filters ?? {};
  const triggerType = row.trigger_type as AutomationEditor['triggerType'];

  return {
    id: row.id,
    automationKey: row.automation_key,
    isDefault: row.is_default,
    triggerType,
    enabled: row.is_enabled,
    clientId: row.client_id,
    clientName,
    eyebrow: `// ${clientName} · ${row.name}${row.is_default ? '' : ' · custom'}`,
    title: (
      <>
        Edit the <em>flow</em>.
      </>
    ),
    subtitle: (
      <>
        {actions.length}-step sequence on the{' '}
        <strong>{TYPE_LABEL[row.trigger_type] ?? row.trigger_type}</strong>{' '}
        trigger. Edits apply only to <strong>{clientName}</strong>.
      </>
    ),
    trigger: {
      label: '// TRIGGER',
      name: TRIGGER_NAME[row.trigger_type] ?? row.trigger_type,
      changeLabel: 'Trigger type is fixed — clone to change',
    },
    triggerFields: buildTriggerFields(row.trigger_type, triggerCfg),
    filterFields: buildFilterFields(triggerFilters),
    steps: actions.map(toEditorStep),
    actions: actions.map(actionToEditorAction),
    addStepLabel: '+ Add another step (SMS / Email / Wait)',
    rail: {
      variables: { heading: '// AVAILABLE VARIABLES', items: [...AUTOMATION_VARIABLE_FLAT] },
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
        heading: '// PERFORMANCE · 30D',
        metrics: [
          { label: 'Triggered', value: '—' },
          { label: 'Completed', value: '—', tone: 'good' },
          { label: 'Paused', value: '—', tone: 'accent' },
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
      saveLabel: 'Save copy',
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
      smsPreview:
        actions[0] && actions[0].action_type === 'send_sms_to_lead'
          ? String(
              (actions[0].action_config as { body?: string } | null)?.body ??
                'This automation has no SMS step.',
            )
          : 'This automation has no SMS step.',
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

export function useAutomationEditor(id: string) {
  return useQuery({
    queryKey: ['automations', 'editor', id],
    queryFn: () => fetchAutomationEditor(id),
    enabled: id.length > 0,
  });
}

// =============================================================================
// Toggle — enable / disable a flow.
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
// useUpdateAutomationAction — write one action's editable fields.
//
// The single canonical write path for body / subject / body_html / body_text.
// RLS already gates this to operators in `accessible_client_ids()`; client
// users get a permission error (we surface that as the editor's read-only
// banner — see the client editor page).
// =============================================================================

export type AutomationActionPatch = {
  /** SMS body OR email plain-text body. */
  body?: string;
  /** Email-only — the subject line. */
  subject?: string;
  /** Email-only — HTML body. */
  body_html?: string;
  /** Email-only — plain-text body (when set alongside body_html). */
  body_text?: string;
  /** Editable step name — stored on action_config.label. */
  label?: string;
};

async function updateAutomationAction(input: {
  actionId: string;
  patch: AutomationActionPatch;
}): Promise<void> {
  // Read-modify-write: merge into the existing action_config so we don't
  // clobber keys we don't manage (template_key, writes_gbp_review_request_audit).
  const { data, error: readErr } = await supabase
    .from('automation_actions')
    .select('action_config')
    .eq('id', input.actionId)
    .single();
  if (readErr) throw normalizeError(readErr);
  const existing =
    ((data as { action_config?: Record<string, unknown> } | null)?.action_config ?? {}) as Record<
      string,
      unknown
    >;

  const next: Record<string, unknown> = { ...existing };
  if (input.patch.body !== undefined) next.body = input.patch.body;
  if (input.patch.subject !== undefined) next.subject = input.patch.subject;
  if (input.patch.body_html !== undefined) next.body_html = input.patch.body_html;
  if (input.patch.body_text !== undefined) next.body_text = input.patch.body_text;
  if (input.patch.label !== undefined) next.label = input.patch.label;

  const { error } = await supabase
    .from('automation_actions')
    .update({ action_config: next } as unknown as never)
    .eq('id', input.actionId);
  if (error) throw normalizeError(error);
}

export function useUpdateAutomationAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAutomationAction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

// =============================================================================
// useUpdateAutomationTrigger — trigger_config / trigger_filters patch.
// =============================================================================

export type AutomationTriggerPatch = {
  triggerConfig?: Record<string, unknown>;
  triggerFilters?: Record<string, unknown>;
};

async function updateAutomationTrigger(input: {
  id: string;
  patch: AutomationTriggerPatch;
}): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.patch.triggerConfig !== undefined) {
    updates.trigger_config = input.patch.triggerConfig;
  }
  if (input.patch.triggerFilters !== undefined) {
    updates.trigger_filters = input.patch.triggerFilters;
  }
  if (Object.keys(updates).length === 0) return;
  const { error } = await supabase
    .from('automations')
    .update(updates as unknown as never)
    .eq('id', input.id);
  if (error) throw normalizeError(error);
}

export function useUpdateAutomationTrigger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAutomationTrigger,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

// =============================================================================
// useCloneAutomation — operator-only fork.
//
// Reads the source row + every action, inserts a new automation with a new
// automation_key (suffixed `_v2`, `_v3`, … picking the next free slot for
// this client), then inserts every action with the same action_config. The
// new row lands `is_default=false`, `is_enabled=false` so an operator picks
// the moment to flip it on.
// =============================================================================

export type CloneAutomationInput = {
  /** The automation to clone. */
  sourceId: string;
  /** Optional human-readable suffix to append to the source name. */
  suffix?: string;
};

async function cloneAutomation(
  input: CloneAutomationInput,
): Promise<{ id: string; automationKey: string }> {
  // 1. Read the source.
  const { data: src, error: srcError } = await supabase
    .from('automations')
    .select(
      'id, client_id, automation_key, name, description, trigger_type, trigger_config, trigger_filters, ' +
        'automation_actions(position, action_type, action_config, pauses_on_human_activity)',
    )
    .eq('id', input.sourceId)
    .single();
  if (srcError) throw normalizeError(srcError);
  const source = src as unknown as {
    client_id: string;
    automation_key: string;
    name: string;
    description: string | null;
    trigger_type: string;
    trigger_config: Record<string, unknown> | null;
    trigger_filters: Record<string, unknown> | null;
    automation_actions: Array<{
      position: number;
      action_type: string;
      action_config: Record<string, unknown> | null;
      pauses_on_human_activity: boolean;
    }>;
  };

  // 2. Pick a fresh automation_key for the same client.
  const newKey = await findFreeAutomationKey(source.client_id, source.automation_key);
  const suffix = input.suffix?.trim();
  const newName = suffix ? `${source.name} · ${suffix}` : `${source.name} (copy)`;

  // 3. Insert the new automation.
  const { data: inserted, error: insertError } = await supabase
    .from('automations')
    .insert({
      client_id: source.client_id,
      automation_key: newKey,
      name: newName,
      description: source.description,
      is_enabled: false,
      is_default: false,
      trigger_type: source.trigger_type,
      trigger_config: source.trigger_config ?? {},
      trigger_filters: source.trigger_filters ?? {},
    } as unknown as never)
    .select('id')
    .single();
  if (insertError) throw normalizeError(insertError);
  const newId = (inserted as { id: string }).id;

  // 4. Insert each action with the same config.
  if (source.automation_actions.length > 0) {
    const actionRows = source.automation_actions.map((a) => ({
      automation_id: newId,
      position: a.position,
      action_type: a.action_type,
      action_config: a.action_config ?? {},
      pauses_on_human_activity: a.pauses_on_human_activity,
    }));
    const { error: actionsError } = await supabase
      .from('automation_actions')
      .insert(actionRows as unknown as never);
    if (actionsError) throw normalizeError(actionsError);
  }

  return { id: newId, automationKey: newKey };
}

async function findFreeAutomationKey(
  clientId: string,
  sourceKey: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('automations')
    .select('automation_key')
    .eq('client_id', clientId)
    .like('automation_key', `${sourceKey}%`);
  if (error) throw normalizeError(error);
  const used = new Set(
    (data as { automation_key: string }[]).map((r) => r.automation_key),
  );
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${sourceKey}_v${n}`;
    if (!used.has(candidate)) return candidate;
  }
  // Beyond v99 — fall back to a timestamp.
  return `${sourceKey}_${Date.now()}`;
}

export function useCloneAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cloneAutomation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

// =============================================================================
// Recent runs + stats.
// =============================================================================

async function fetchAutomationRuns(
  automationId: string,
  limit: number,
): Promise<AutomationEditorRun[]> {
  const { data, error } = await supabase
    .from('automation_runs')
    .select(
      'id, automation_id, lead_id, trigger_event, started_at, completed_at, paused_at, ' +
        'status, paused_reason, current_action_position, error_message',
    )
    .eq('automation_id', automationId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw normalizeError(error);
  type Row = {
    id: string;
    automation_id: string;
    lead_id: string | null;
    trigger_event: Record<string, unknown>;
    started_at: string;
    completed_at: string | null;
    paused_at: string | null;
    status: string;
    paused_reason: string | null;
    current_action_position: number;
    error_message: string | null;
  };
  return (data as unknown as Row[]).map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status as AutomationEditorRun['status'],
    pausedReason: (row.paused_reason as AutomationEditorRun['pausedReason']) ?? null,
    triggerSummary: summariseTriggerEvent(row.trigger_event),
    leadId: row.lead_id,
    currentActionPosition: row.current_action_position,
    errorMessage: row.error_message,
  }));
}

function summariseTriggerEvent(event: Record<string, unknown>): string {
  const recipientName =
    typeof event.recipientName === 'string' && event.recipientName.length > 0
      ? event.recipientName
      : null;
  if (recipientName) return `Lead · ${recipientName}`;
  if (typeof event.bookingId === 'string') return 'Booking · ' + event.bookingId.slice(0, 8);
  if (typeof event.leadId === 'string') return 'Lead · ' + event.leadId.slice(0, 8);
  if (typeof event.invoiceId === 'string') return 'Invoice · ' + event.invoiceId.slice(0, 8);
  return 'Triggered';
}

/** Recent N runs for an automation (newest first). Default 20. */
export function useAutomationRuns(automationId: string, limit = 20) {
  return useQuery({
    queryKey: ['automations', 'runs', automationId, limit],
    queryFn: () => fetchAutomationRuns(automationId, limit),
    enabled: automationId.length > 0,
  });
}

async function fetchAutomationStats(
  automationId: string,
): Promise<AutomationEditorStats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('automation_runs')
    .select('status, started_at, completed_at')
    .eq('automation_id', automationId)
    .gte('started_at', thirtyDaysAgo);
  if (error) throw normalizeError(error);

  const rows = data as {
    status: string;
    started_at: string;
    completed_at: string | null;
  }[];

  const totalRuns = rows.length;
  const completedRuns = rows.filter((r) => r.status === 'completed').length;
  const pausedRuns = rows.filter((r) => r.status === 'paused').length;
  const failedRuns = rows.filter((r) => r.status === 'failed').length;

  const completionRate = totalRuns === 0 ? 0 : Math.round((completedRuns / totalRuns) * 100);
  const pauseRate = totalRuns === 0 ? 0 : Math.round((pausedRuns / totalRuns) * 100);

  let avgCompletionSeconds: number | null = null;
  const completedWithTime = rows.filter(
    (r) => r.status === 'completed' && r.completed_at !== null,
  );
  if (completedWithTime.length > 0) {
    const total = completedWithTime.reduce((sum, r) => {
      const start = Date.parse(r.started_at);
      const end = Date.parse(r.completed_at ?? '');
      if (!Number.isFinite(start) || !Number.isFinite(end)) return sum;
      return sum + (end - start) / 1000;
    }, 0);
    avgCompletionSeconds = Math.round(total / completedWithTime.length);
  }

  return {
    totalRuns,
    completedRuns,
    pausedRuns,
    failedRuns,
    completionRate,
    pauseRate,
    avgCompletionSeconds,
  };
}

export function useAutomationStats(automationId: string) {
  return useQuery({
    queryKey: ['automations', 'stats', automationId],
    queryFn: () => fetchAutomationStats(automationId),
    enabled: automationId.length > 0,
  });
}

// =============================================================================
// Back-compat shim — useUpdateAutomationSteps.
//
// The Phase 8 Session 1 editor page calls this with a list of step edits. We
// translate each step into a per-action update via the new path so existing
// call sites keep working while the new editor surfaces (which call
// useUpdateAutomationAction directly) come online.
// =============================================================================

export type AutomationStepEdit = {
  id: string;
  name: string;
  subject: string | null;
  body: string;
};

async function updateAutomationSteps(input: {
  steps: AutomationStepEdit[];
}): Promise<void> {
  for (const step of input.steps) {
    const patch: AutomationActionPatch = { label: step.name };
    if (step.subject !== null) patch.subject = step.subject;
    // Heuristic: a body with HTML angle brackets is an email HTML payload,
    // else SMS / plain-text. The editor splits these explicitly so this
    // shim only fires for legacy call sites.
    if (/<\/?[a-z]/i.test(step.body)) {
      patch.body_html = step.body;
    } else {
      patch.body = step.body;
    }
    await updateAutomationAction({ actionId: step.id, patch });
  }
}

export function useUpdateAutomationSteps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAutomationSteps,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

// =============================================================================
// Active-run count — drives the editor's in-flight note (Phase 8 · Session 3).
//
// A run is "active" while status ∈ {running, paused}. Reorders / inserts /
// deletes on an automation's actions never block — they only affect runs
// triggered after the edit (see migration 0080 + the snapshot contract on
// automation_runs.action_sequence). The note in the editor surfaces this so
// an operator isn't surprised when an old-sequence run finishes mid-edit.
// =============================================================================

async function fetchActiveRunCount(automationId: string): Promise<number> {
  const { count, error } = await supabase
    .from('automation_runs')
    .select('id', { count: 'exact', head: true })
    .eq('automation_id', automationId)
    .in('status', ['running', 'paused']);
  if (error) throw normalizeError(error);
  return count ?? 0;
}

export function useAutomationActiveRuns(automationId: string) {
  return useQuery({
    queryKey: ['automations', 'active-runs', automationId],
    queryFn: () => fetchActiveRunCount(automationId),
    enabled: automationId.length > 0,
    staleTime: 15_000,
  });
}

// =============================================================================
// Action mutations — Phase 8 · Session 3.
//
// The editor's action list is fully editable: add, reorder, remove, update
// config, and (for comm actions) edit body / subject inline. All write paths
// land on `automation_actions.action_config` (Session 2's inline-body model);
// per-client templates are NOT involved.
// =============================================================================

/** Update body (+ optional subject) of a comm action — thin wrapper around
 *  `useUpdateAutomationAction`'s write path that picks the right config keys
 *  per action_type. Use this when the editor knows only "body" / "subject"
 *  rather than the discriminated `body_text` / `body_html` shape. */
async function updateActionBody(input: {
  actionId: string;
  body: string;
  subject?: string | null;
}): Promise<void> {
  const { data: action, error: aErr } = await supabase
    .from('automation_actions')
    .select('action_type, action_config')
    .eq('id', input.actionId)
    .single();
  if (aErr) throw normalizeError(aErr);
  const a = action as {
    action_type: string;
    action_config: Record<string, unknown> | null;
  };
  const baseConfig = (a.action_config ?? {}) as Record<string, unknown>;
  let nextConfig: Record<string, unknown>;
  if (a.action_type === 'send_sms_to_lead') {
    nextConfig = { ...baseConfig, body: input.body };
  } else if (a.action_type === 'send_email_to_lead') {
    nextConfig = {
      ...baseConfig,
      body_text: input.body,
      body_html: textToHtml(input.body),
    };
    if (typeof input.subject === 'string') {
      nextConfig.subject = input.subject;
    }
  } else {
    throw AppError.validation(
      { body: `${a.action_type} is not a comm action.` },
      'This action has no body to edit.',
    );
  }
  const { error } = await supabase
    .from('automation_actions')
    .update({ action_config: nextConfig as never })
    .eq('id', input.actionId);
  if (error) throw normalizeError(error);
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/** Hook — update the body (+ subject for email) of one comm action. */
export function useUpdateActionBody() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateActionBody,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

/** Update the action_config jsonb on a non-body action (wait minutes,
 *  update_lead_field field/value, create_followup_task hint, etc.). */
async function updateActionConfig(input: {
  actionId: string;
  config: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase
    .from('automation_actions')
    .update({ action_config: input.config as Json })
    .eq('id', input.actionId);
  if (error) throw normalizeError(error);
}

export function useUpdateActionConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateActionConfig,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

/** Remove one action and shift the higher positions down. Atomic enough:
 *  the unique (automation_id, position) constraint is enforced via
 *  DELETE-then-renumber with no overlap window. In-flight runs are untouched
 *  thanks to the action_sequence snapshot on automation_runs (migration 0080). */
async function removeAction(input: { actionId: string }): Promise<void> {
  const { data: action, error: aErr } = await supabase
    .from('automation_actions')
    .select('automation_id, position')
    .eq('id', input.actionId)
    .single();
  if (aErr) throw normalizeError(aErr);
  const a = action as { automation_id: string; position: number };

  const { error: dErr } = await supabase
    .from('automation_actions')
    .delete()
    .eq('id', input.actionId);
  if (dErr) throw normalizeError(dErr);

  const { data: higher, error: hErr } = await supabase
    .from('automation_actions')
    .select('id, position')
    .eq('automation_id', a.automation_id)
    .gt('position', a.position)
    .order('position', { ascending: true });
  if (hErr) throw normalizeError(hErr);

  for (const r of (higher ?? []) as Array<{ id: string; position: number }>) {
    const { error } = await supabase
      .from('automation_actions')
      .update({ position: r.position - 1 })
      .eq('id', r.id);
    if (error) throw normalizeError(error);
  }
}

export function useRemoveAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeAction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

/** Move an action one slot up or down. Three-step swap with a parking
 *  position to dodge the unique (automation_id, position) constraint. */
async function moveAction(input: {
  actionId: string;
  direction: 'up' | 'down';
}): Promise<void> {
  const { data: action, error: aErr } = await supabase
    .from('automation_actions')
    .select('automation_id, position')
    .eq('id', input.actionId)
    .single();
  if (aErr) throw normalizeError(aErr);
  const a = action as { automation_id: string; position: number };

  const neighbourPosition = input.direction === 'up' ? a.position - 1 : a.position + 1;
  if (neighbourPosition < 1) return;

  const { data: neighbour } = await supabase
    .from('automation_actions')
    .select('id, position')
    .eq('automation_id', a.automation_id)
    .eq('position', neighbourPosition)
    .maybeSingle();
  if (!neighbour) return;
  const n = neighbour as { id: string; position: number };

  const PARK = -1;
  const m1 = await supabase
    .from('automation_actions')
    .update({ position: PARK })
    .eq('id', input.actionId);
  if (m1.error) throw normalizeError(m1.error);
  const m2 = await supabase
    .from('automation_actions')
    .update({ position: a.position })
    .eq('id', n.id);
  if (m2.error) throw normalizeError(m2.error);
  const m3 = await supabase
    .from('automation_actions')
    .update({ position: n.position })
    .eq('id', input.actionId);
  if (m3.error) throw normalizeError(m3.error);
}

export function useMoveAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: moveAction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

/** Append a new action at the end of the automation's action list. Config
 *  is initialised from the per-type default; the operator edits inline. */
async function addAction(input: {
  automationId: string;
  actionType: AutomationEditorActionType;
}): Promise<{ id: string }> {
  const { data: existing, error: eErr } = await supabase
    .from('automation_actions')
    .select('position')
    .eq('automation_id', input.automationId)
    .order('position', { ascending: false })
    .limit(1);
  if (eErr) throw normalizeError(eErr);
  const nextPosition =
    ((existing as Array<{ position: number }> | null)?.[0]?.position ?? 0) + 1;

  const defaultConfig = defaultActionConfig(input.actionType);
  const { data, error } = await supabase
    .from('automation_actions')
    .insert({
      automation_id: input.automationId,
      position: nextPosition,
      action_type: input.actionType,
      action_config: defaultConfig as Json,
      pauses_on_human_activity:
        ACTION_PAUSES_ON_HUMAN_ACTIVITY[input.actionType] ?? false,
    } as never)
    .select('id')
    .single();
  if (error) throw normalizeError(error);
  return { id: (data as { id: string }).id };
}

function defaultActionConfig(
  actionType: AutomationEditorActionType,
): Record<string, unknown> {
  switch (actionType) {
    case 'send_sms_to_lead':
      return { body: '' };
    case 'send_email_to_lead':
      return { subject: '', body_text: '', body_html: '' };
    case 'send_operator_notification':
      return { variant: 'new_lead' };
    case 'wait_for_duration':
      return { minutes: 60 };
    case 'update_lead_field':
      return { field: 'status', value: 'contacted' };
    case 'create_followup_task':
      return { hint: '' };
  }
}

export function useAddAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addAction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}
