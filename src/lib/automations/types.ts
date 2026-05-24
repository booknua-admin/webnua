import type { ReactNode } from 'react';

/**
 * Client-tone vocabulary for automation rows. Matches the same slugs used
 * across leads / tickets / calendar so a workspace-wide tone map can be
 * applied later. Solid-tone background colours come from
 * `lib/automations/tones.ts` (mirrors the prototype's per-client swatches).
 */
export type AutomationClientTone =
  | 'voltline'
  | 'freshhome'
  | 'keyhero'
  | 'neatworks'
  | 'flowline'
  | 'generic';

export type AutomationStatTone = 'default' | 'accent';

export type AutomationStat = {
  label: string;
  /** ReactNode so `<em>` can render rust on the value. */
  value: ReactNode;
  tone?: AutomationStatTone;
};

/**
 * The client-screen-5 card. Header + 4-tile stats (when enabled) + toggle.
 * Disabled state hides the stats grid entirely.
 */
export type AutomationStatsCard = {
  id: string;
  tag: string;
  title: string;
  description: ReactNode;
  enabled: boolean;
  /** Optional href — currently unused on client view (read-only). */
  href?: string;
  /** 4 stat tiles. Omitted when `enabled === false`. */
  stats?: AutomationStat[];
};

/**
 * The admin-screen-10 mini-row. A single client's flow within a group.
 */
export type AutomationFlowMini = {
  id: string;
  clientInitial: string;
  clientName: string;
  /** e.g. "3 steps · SMS / email / SMS · click to edit" */
  flowName: string;
  /** Real client slug — the client-filter identity (clientTone collapses
   *  many clients to one colour, so it can't filter). */
  clientSlug: string;
  clientTone?: AutomationClientTone;
  enabled: boolean;
  /** 3 stat tiles. When `enabled === false`, render "—" placeholders so the columns line up. */
  stats: AutomationStat[];
  /** Set on rows that click through to the editor (admin Screen 17). */
  href?: string;
};

/**
 * The admin-screen-10 grouped view. One group per automation type.
 */
export type AutomationGroup = {
  id: string;
  /** The display title, e.g. "24-hour follow-up sequence". */
  title: string;
  /** e.g. "3 / 4" — active count over total configured. */
  countBadge: string;
  /** e.g. "3 active · 34% reply rate". `<strong>` renders ink-bold. */
  meta: ReactNode;
  flows: AutomationFlowMini[];
};

/**
 * Top-level hero copy. Both roles share the shape; admin adds workspace stats.
 */
export type AutomationsHero = {
  eyebrow: string;
  title: ReactNode;
  subtitle: ReactNode;
};

/**
 * Workspace-stat row on the admin list. Reuses the existing `StatCard` shape.
 */
export type AutomationsWorkspaceStat = {
  label: string;
  value: ReactNode;
  trend?: ReactNode;
  trendTone?: 'good' | 'quiet';
};

export type ClientAutomations = {
  hero: AutomationsHero;
  banner: ReactNode;
  cards: AutomationStatsCard[];
};

export type AdminAutomations = {
  hero: AutomationsHero;
  /** Filter chip set, shape-compatible with `shared/FilterChips`. */
  filters: { id: string; label: string; count?: number }[];
  defaultFilterId: string;
  stats: AutomationsWorkspaceStat[];
  groups: AutomationGroup[];
};

/**
 * The editor step's channel — SMS or email.
 */
export type AutomationEditorChannel = 'sms' | 'email';

/**
 * Single trigger box at the top of the editor canvas (admin Screen 17).
 * Ink-bg row with the rust ⚡ icon, mono label, name, and "Change trigger →"
 * affordance.
 */
export type AutomationEditorTrigger = {
  /** Mono uppercase label, e.g. "// TRIGGER" — caller passes the leading // */
  label: string;
  /** The trigger summary, e.g. 'Lead status = "New" for 24+ hours'. */
  name: string;
  /** The right-aligned affordance label, e.g. "Change trigger →". */
  changeLabel: string;
};

/**
 * Per-step action-kind metadata. Drives the editor's per-step header pill +
 * which fields to render. Phase 8 Session 2 widens the editor from comm-only
 * to every action type the engine supports; non-comm steps still render
 * (with their config in read-only form) so the operator sees the full action
 * sequence rather than a misleading "comm actions only" subset.
 */
export type AutomationEditorActionKind =
  | 'send_sms_to_lead'
  | 'send_email_to_lead'
  | 'send_operator_notification'
  | 'wait_for_duration'
  | 'update_lead_field'
  | 'create_followup_task';

/**
 * Single editable step inside the editor canvas. Step 2 of FreshHome's
 * follow-up is in editing state per the prototype.
 *
 * Phase 8 Session 2: the body / subject reflect the live values stored on
 * `automation_actions.action_config`. Editing them and saving writes the same
 * jsonb back. Non-comm steps (`actionKind` not in send_sms_to_lead /
 * send_email_to_lead) render in `readOnly` form — the editor explains the
 * limitation honestly rather than silently hiding them.
 */
export type AutomationEditorStep = {
  id: string;
  number: number;
  /** The action_type from the engine — drives the editor's per-step UI. */
  actionKind: AutomationEditorActionKind;
  /** Comms-only convenience: 'sms' / 'email'. Undefined for non-comm steps. */
  channel?: AutomationEditorChannel;
  /** Display text on the delay pill (e.g. "Delay: 24 hrs"). */
  delay: string;
  /** Editable step name, e.g. "Soft follow-up · check-in". */
  name: string;
  /** Email-only subject line — present iff channel === 'email'. */
  subject?: string;
  /** Email HTML body — sent alongside the plain-text variant. */
  bodyHtml?: string;
  /** Email plain-text body — also used as the SMS body for SMS steps. */
  bodyText?: string;
  /** A human-readable summary of this step for non-comm action kinds (wait
   *  N minutes, fire operator alert, etc.). Drives the read-only display. */
  readOnlySummary?: ReactNode;
  /** Footer reply meta, e.g. "// 28% reply · 142 sent · last 7d". */
  footerMeta: string;
  /** Variable chips shown in the footer (excluding the "+ Insert variable" leader, which is always rendered). */
  variables: string[];
  /** When true, flips the step to the rust-bordered editing state + "// EDITING · auto-saved 8s ago" footer. */
  isEditing?: boolean;
  /** True when the operator/client can edit this step's copy. Currently true
   *  for comm steps, false for everything else (V1 — see Session 2 spec). */
  canEditBody: boolean;
  /** True when the operator/client can edit the SMS body. SMS steps only. */
  canEditSms: boolean;
};

/**
 * Trigger configuration editing — per-trigger-type editable fields. The
 * editor renders a small form depending on which fields exist for the
 * automation's trigger type (delay_minutes for review-request, to_status
 * for arrival, etc.). Session 2 keeps this scope tight: only the fields
 * the platform default carries are editable.
 */
export type AutomationEditableTriggerField =
  | { kind: 'delay_minutes'; label: string; value: number; min: number; max: number }
  | { kind: 'days_after_last_outbound'; label: string; value: number; min: number; max: number }
  | { kind: 'max_nudges'; label: string; value: number; min: number; max: number }
  | { kind: 'to_status'; label: string; value: string; options: { value: string; label: string }[] };

export type AutomationEditableFilterField =
  | { kind: 'requires_phone'; label: string; value: boolean }
  | { kind: 'requires_email'; label: string; value: boolean }
  | { kind: 'requires_gbp_location'; label: string; value: boolean };

/**
 * Per-automation run row exposed in the editor's "Recent runs" rail.
 */
export type AutomationEditorRun = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  pausedReason: 'lead_replied' | 'client_took_over' | 'manually_cancelled' | null;
  /** Human-readable trigger event summary (e.g. "Lead created · Sarah Davies"). */
  triggerSummary: string;
  /** Lead id when the run is bound to a lead, else null. */
  leadId: string | null;
  /** The action position the run reached (1-indexed) — drives "stopped at step N". */
  currentActionPosition: number;
  /** Failure detail, when status='failed'. */
  errorMessage: string | null;
};

/** Stats panel computed from the last 30 days of automation_runs. */
export type AutomationEditorStats = {
  /** Total runs in the last 30 days. */
  totalRuns: number;
  /** Number of `completed` runs in the last 30 days. */
  completedRuns: number;
  /** Number of `paused` runs in the last 30 days. */
  pausedRuns: number;
  /** Number of `failed` runs in the last 30 days. */
  failedRuns: number;
  /** Completed / total as a percentage (0–100). */
  completionRate: number;
  /** Paused / total as a percentage. */
  pauseRate: number;
  /** Mean time from started_at to completed_at across completed runs, in
   *  seconds. Null when there are no completed runs (no signal). */
  avgCompletionSeconds: number | null;
};

export type AutomationVariable = {
  code: string;
  description: string;
};

/**
 * Phase 8 · Session 3 — the rich per-action shape the new editor body
 * consumes. One row per `automation_actions` row, position-ordered, every
 * action type represented (comm + non-comm). Comm actions carry the resolved
 * template `body` (and `subject` for email) the operator edits inline.
 */
/**
 * Alias of {@link AutomationEditorActionKind}. Kept as a separate name
 * because Session 3's `AutomationEditorAction` shape was introduced under
 * `actionType` while Session 2's `AutomationEditorStep` was already on
 * `actionKind`. Both unions are identical — adopt `AutomationEditorActionKind`
 * for new code.
 */
export type AutomationEditorActionType = AutomationEditorActionKind;

export type AutomationEditorAction = {
  id: string;
  position: number;
  actionType: AutomationEditorActionType;
  /** The action_config jsonb verbatim — the editor body reads the shape it
   *  needs per type (template_key, minutes, field/value, etc.). */
  config: Record<string, unknown>;
  /** Resolved template body for comm actions; null for non-comm. The editor's
   *  inline textarea reads + writes this directly. */
  body: string | null;
  /** Resolved template subject for `send_email_to_lead`; null otherwise. */
  subject: string | null;
  /** True for comm actions — surfaces in the editor as a pause-on-handoff
   *  hint badge. */
  pausesOnHumanActivity: boolean;
};

export type AutomationPerformanceMetric = {
  label: string;
  value: ReactNode;
  /** Optional value-tint: 'accent' = rust, 'good' = good-green; default = ink-bold. */
  tone?: 'default' | 'accent' | 'good';
};

/**
 * Test-send modal config (admin Screen 22). Triggered from the right-rail
 * `AutomationTestSendCard` button. Stub state for the stub layer.
 */
export type AutomationTestSendData = {
  /** Mono pill at the top of the modal, e.g. "// TEST SEND · 24h follow-up · Step 2". */
  tag: string;
  /** Headline (ReactNode — `<em>` renders rust). */
  title: ReactNode;
  /** Subtitle (ReactNode — `<strong>` renders ink-bold). */
  subtitle: ReactNode;
  /** Read-only "Send to" field value. */
  sendTo: string;
  /** Helper text below the Send-to input. */
  sendToHint: string;
  /** SMS preview body — the actual rendered message text. */
  smsPreview: ReactNode;
  /** Mono meta below the SMS bubble showing variable substitutions. */
  smsVariablesLine: ReactNode;
  /** Phone-bar text above the SMS bubble. */
  phoneBar: string;
  /** Test-options row inside the modal body. */
  options: {
    title: ReactNode;
    sub: ReactNode;
    switchLabel: string;
  };
  /** Footer info line above the Cancel/Send buttons. */
  footerInfo: ReactNode;
  cancelLabel: string;
  sendLabel: string;
};

/**
 * Top-level admin editor stub. Drives `/automations/[id]` for admin.
 *
 * Phase 8 Session 2 widens this shape considerably: the editor now exposes
 * every action type (not just comm), surfaces the live action_config so the
 * inline editor can write to it, exposes the trigger config + filters as
 * editable, and adds the recent runs + stats rails. The previous shape's
 * comm-only `steps` field is preserved but now includes non-comm action
 * entries with `canEditBody: false` instead of hiding them.
 */
export type AutomationEditor = {
  id: string;
  /** Stable per-client key (e.g. `lead_acknowledgment_sms`). Used by the
   *  clone flow + the "is this a platform default" badge. */
  automationKey: string;
  /** True for the nine platform-seeded automations; false for clones /
   *  operator-built variants. */
  isDefault: boolean;
  /** Engine trigger type — used by the trigger-config editor to pick which
   *  fields are editable. */
  triggerType:
    | 'lead_created'
    | 'job_scheduled'
    | 'job_status_changed'
    | 'job_completed'
    | 'payment_failed'
    | 'lead_inactive';
  /** Whether the flow is currently enabled — drives the footer toggle. */
  enabled: boolean;
  /** The client this automation belongs to (UUID, for capability gating). */
  clientId: string;
  /** Display client name — for the editor breadcrumb + clone-target. */
  clientName: string;
  /** Page-header eyebrow, e.g. "// FreshHome · 24-hour follow-up sequence". */
  eyebrow: string;
  /** Page-header title (ReactNode — `<em>` renders rust). */
  title: ReactNode;
  /** Page-header subtitle (ReactNode — `<strong>` renders ink-bold). */
  subtitle: ReactNode;
  trigger: AutomationEditorTrigger;
  /** Currently-editable trigger-config fields (subset of the trigger's
   *  schema). Each field has its own editor in the Trigger section. */
  triggerFields: AutomationEditableTriggerField[];
  /** Editable filter fields (requires_phone, requires_email, etc.). */
  filterFields: AutomationEditableFilterField[];
  steps: AutomationEditorStep[];
  /** Phase 8 · Session 3 — full ordered action list. Replaces `steps` (which
   *  was comm-only) for the new editor body. Existing `steps` is preserved
   *  for legacy callers (currently nobody — the old body unmounted in this
   *  session). */
  actions: AutomationEditorAction[];
  /** "+ Add another step (SMS / Email / Wait)" affordance label. */
  addStepLabel: string;
  rail: {
    variables: { heading: string; items: AutomationVariable[] };
    testSend: {
      heading: string;
      body: ReactNode;
      buttonLabel: string;
    };
    performance: {
      heading: string;
      metrics: AutomationPerformanceMetric[];
    };
  };
  footer: {
    /** Mono uppercase progress label, e.g. "FreshHome · 24-hour follow-up · v4 · auto-saved 8s ago". `<strong>` renders ink-bold. */
    progress: ReactNode;
    backLabel: string;
    backHref: string;
    disableLabel: string;
    saveLabel: string;
  };
  testSend: AutomationTestSendData;
};
