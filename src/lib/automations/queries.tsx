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
import type { Json } from '@/lib/types/database';

import type {
  AdminAutomations,
  AutomationClientTone,
  AutomationEditor,
  AutomationEditorAction,
  AutomationEditorActionType,
  AutomationEditorChannel,
  AutomationEditorStep,
  AutomationFlowMini,
  AutomationGroup,
  AutomationStatsCard,
  ClientAutomations,
} from './types';

import { ACTION_PAUSES_ON_HUMAN_ACTIVITY } from './engine-types';

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
function toEditorStep(
  action: ActionRow,
  templates: Map<string, { subject: string | null; body: string }>,
): AutomationEditorStep {
  const channel = actionToChannel(action.action_type) ?? 'sms';
  const cfg = (action.action_config ?? {}) as { template_key?: string };
  const templateKey = cfg.template_key ?? '';
  const resolved = templateKey
    ? templates.get(`${channel}:${templateKey}`)
    : null;
  const bodyText = resolved?.body ?? '';
  const step: AutomationEditorStep = {
    id: action.id,
    number: action.position,
    channel,
    delay: 'Sends from the trigger',
    name: channel === 'sms' ? 'SMS' : 'Email',
    body: bodyText,
    bodyText,
    footerMeta: '// Awaiting send data',
    variables: [],
  };
  if (channel === 'email') step.subject = resolved?.subject ?? '';
  return step;
}

async function fetchTemplateBodies(
  clientId: string,
  actions: ActionRow[],
): Promise<Map<string, { subject: string | null; body: string }>> {
  // Resolve template_key for every comm action, then look up the
  // per-client template body in a single round-trip per channel.
  const smsKeys = new Set<string>();
  const emailKeys = new Set<string>();
  for (const a of actions) {
    const k = ((a.action_config ?? {}) as { template_key?: string }).template_key;
    if (!k) continue;
    if (a.action_type === 'send_sms_to_lead') smsKeys.add(k);
    else if (a.action_type === 'send_email_to_lead') emailKeys.add(k);
  }
  const map = new Map<string, { subject: string | null; body: string }>();
  if (smsKeys.size > 0) {
    const { data: smsRows } = await supabase
      .from('sms_templates')
      .select('template_key, body')
      .eq('client_id', clientId)
      .in('template_key', [...smsKeys]);
    for (const r of (smsRows ?? []) as Array<{ template_key: string; body: string }>) {
      map.set(`sms:${r.template_key}`, { subject: null, body: r.body });
    }
  }
  if (emailKeys.size > 0) {
    const { data: emailRows } = await supabase
      .from('email_templates')
      .select('template_key, subject, body_text, body_html')
      .eq('client_id', clientId)
      .in('template_key', [...emailKeys]);
    for (const r of (emailRows ?? []) as Array<{
      template_key: string;
      subject: string;
      body_text: string;
      body_html: string;
    }>) {
      // Editor edits plain text — the send path renders both, with the
      // HTML reflowed from the text on save.
      map.set(`email:${r.template_key}`, {
        subject: r.subject,
        body: r.body_text || r.body_html,
      });
    }
  }
  return map;
}

function actionToEditorAction(
  a: ActionRow,
  templates: Map<string, { subject: string | null; body: string }>,
): AutomationEditorAction {
  const cfg = (a.action_config ?? {}) as Record<string, unknown>;
  const templateKey = typeof cfg.template_key === 'string' ? cfg.template_key : null;
  let body: string | null = null;
  let subject: string | null = null;
  if (templateKey) {
    if (a.action_type === 'send_sms_to_lead') {
      const t = templates.get(`sms:${templateKey}`);
      body = t?.body ?? '';
    } else if (a.action_type === 'send_email_to_lead') {
      const t = templates.get(`email:${templateKey}`);
      body = t?.body ?? '';
      subject = t?.subject ?? '';
    }
  }
  const actionType = a.action_type as AutomationEditorActionType;
  return {
    id: a.id,
    position: a.position,
    actionType,
    config: cfg,
    body,
    subject,
    pausesOnHumanActivity:
      ACTION_PAUSES_ON_HUMAN_ACTIVITY[actionType] ?? false,
  };
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
  const allActions = sortedActions(row.automation_actions);
  const commActions = allActions.filter((a) => isCommAction(a.action_type));
  const templates = await fetchTemplateBodies(row.client_id, allActions);
  const editorActions = allActions.map((a) => actionToEditorAction(a, templates));

  return {
    id: row.id,
    clientId: row.client_id,
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
    steps: commActions.map((a) => toEditorStep(a, templates)),
    actions: editorActions,
    addStepLabel: '+ Add another step',
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
        ? (toEditorStep(commActions[0], templates).body as ReactNode)
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
// Action mutations — Phase 8 · Session 3.
//
// The editor's action list is now fully editable: add, reorder, remove,
// update config, and (for comm actions) edit the referenced template body.
// Body edits write through to sms_templates / email_templates per the
// resolved (clientId, template_key); the change is per-client, so it
// doesn't affect siblings on other clients.
// =============================================================================

/** Update the body (+ subject for email) of a comm action's referenced
 *  per-client template row. Resolves template_key from action_config. */
async function updateActionBody(input: {
  actionId: string;
  body: string;
  subject?: string | null;
}): Promise<void> {
  const { data: action, error: aErr } = await supabase
    .from('automation_actions')
    .select('action_type, action_config, automation_id')
    .eq('id', input.actionId)
    .single();
  if (aErr) throw normalizeError(aErr);
  const a = action as {
    action_type: string;
    action_config: Record<string, unknown> | null;
    automation_id: string;
  };
  const templateKey = ((a.action_config ?? {}) as { template_key?: string })
    .template_key;
  if (!templateKey) {
    throw AppError.validation(
      { body: 'Action has no template_key configured.' },
      'Cannot edit body — no template reference.',
    );
  }
  const { data: automation, error: amErr } = await supabase
    .from('automations')
    .select('client_id')
    .eq('id', a.automation_id)
    .single();
  if (amErr) throw normalizeError(amErr);
  const clientId = (automation as { client_id: string }).client_id;

  if (a.action_type === 'send_sms_to_lead') {
    const { error } = await supabase
      .from('sms_templates')
      .update({ body: input.body, last_edited_at: new Date().toISOString() })
      .eq('client_id', clientId)
      .eq('template_key', templateKey);
    if (error) throw normalizeError(error);
  } else if (a.action_type === 'send_email_to_lead') {
    const update: {
      body_text: string;
      body_html: string;
      last_edited_at: string;
      subject?: string;
    } = {
      body_text: input.body,
      body_html: textToHtml(input.body),
      last_edited_at: new Date().toISOString(),
    };
    if (typeof input.subject === 'string') update.subject = input.subject;
    const { error } = await supabase
      .from('email_templates')
      .update(update)
      .eq('client_id', clientId)
      .eq('template_key', templateKey);
    if (error) throw normalizeError(error);
  } else {
    throw AppError.validation(
      { body: `${a.action_type} is not a comm action.` },
      'This action has no body to edit.',
    );
  }
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

/** Hook — update the body (+ subject for email) of one action's template. */
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
 *  the unique (automation_id, position) constraint is deferred at insert,
 *  but our DELETE → renumber happens in two steps with no overlap. */
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

/** Move an action one slot up or down. Swaps positions with the neighbour.
 *  Two-step swap with an intermediate temp slot to dodge the unique
 *  constraint (position INT, unique on (automation_id, position)). */
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

  // Three-step swap via a parking position to avoid the unique-constraint
  // collision (positions can't both temporarily equal each other).
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

/** Append a new action at the end of the automation's action list. Action
 *  config is initialised from the per-type default; the operator edits
 *  inline after the row appears. */
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
    })
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
      return { template_key: 'lead_acknowledgment' };
    case 'send_email_to_lead':
      return { template_key: 'lead_followup' };
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

// ---------------------------------------------------------------------------
// Legacy step-save bridge — kept callable for the existing editor page until
// it migrates onto the new action editor. Bodies still write through.
// ---------------------------------------------------------------------------

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
    await updateActionBody({
      actionId: step.id,
      body: step.body,
      subject: step.subject,
    });
  }
}

/** Bulk step-save — now wired through `updateActionBody`. */
export function useUpdateAutomationSteps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAutomationSteps,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}
