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
 * The editor step's channel — same vocabulary as the onboarding card, kept
 * here so the editor types can stand alone without depending on
 * lib/onboarding/types.
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
 * Single editable step inside the editor canvas. Step 2 of FreshHome's
 * follow-up is in editing state per the prototype.
 */
export type AutomationEditorStep = {
  id: string;
  number: number;
  channel: AutomationEditorChannel;
  /** Display text on the delay pill (e.g. "Delay: 24 hrs"). */
  delay: string;
  /** Editable step name, e.g. "Soft follow-up · check-in". */
  name: string;
  /** Email-only subject line — present iff channel === 'email'. */
  subject?: string;
  /** Message body. Wrap variable spans in `[data-slot=var]` for highlight. */
  body: ReactNode;
  /** Footer reply meta, e.g. "// 28% reply · 142 sent · last 7d". */
  footerMeta: string;
  /** Variable chips shown in the footer (excluding the "+ Insert variable" leader, which is always rendered). */
  variables: string[];
  /** When true, flips the step to the rust-bordered editing state + "// EDITING · auto-saved 8s ago" footer. */
  isEditing?: boolean;
};

export type AutomationVariable = {
  code: string;
  description: string;
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
 */
export type AutomationEditor = {
  id: string;
  /** Page-header eyebrow, e.g. "// FreshHome · 24-hour follow-up sequence". */
  eyebrow: string;
  /** Page-header title (ReactNode — `<em>` renders rust). */
  title: ReactNode;
  /** Page-header subtitle (ReactNode — `<strong>` renders ink-bold). */
  subtitle: ReactNode;
  trigger: AutomationEditorTrigger;
  steps: AutomationEditorStep[];
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
