// =============================================================================
// Capability layer — the spine of the page-builder access model.
//
// See reference/builder-design.md §1 for the full design rationale.
//
// One editor renders for everyone; capabilities decide which controls are
// live. Role still drives sidebar shape (which nav set, workspace block).
// Capabilities are the finer-grained layer that lives inside the editor.
// =============================================================================

export type Capability =
  | 'viewBuilder'
  | 'editCopy'
  | 'editMedia'
  | 'editSEO'
  | 'editLayout'
  | 'editSections'
  | 'editTheme'
  | 'editPages'
  | 'useAI'
  | 'publish'
  | 'approve'
  | 'rollback'
  | 'manageDomain';

export const ALL_CAPABILITIES: readonly Capability[] = [
  'viewBuilder',
  'editCopy',
  'editMedia',
  'editSEO',
  'editLayout',
  'editSections',
  'editTheme',
  'editPages',
  'useAI',
  'publish',
  'approve',
  'rollback',
  'manageDomain',
] as const;

// Affirmative display name per capability — the single source of truth for
// how a capability is labelled in any human-facing UI (the team-invite
// permissions preview, future role-management surfaces). Sits alongside
// CAP_EXPLAINER in explainers.ts: capability name → label → explainer all
// live in the same orbit.
export const CAPABILITY_LABEL: Record<Capability, string> = {
  viewBuilder: 'View the page builder',
  editCopy: 'Edit page copy',
  editMedia: 'Edit images + media',
  editSEO: 'Edit SEO settings',
  editLayout: 'Reorder + resize layout',
  editSections: 'Add + remove sections',
  editTheme: 'Edit brand + theme',
  editPages: 'Create + manage pages',
  useAI: 'Use AI drafting tools',
  publish: 'Publish changes live',
  approve: 'Approve submitted changes',
  rollback: 'Roll back to past versions',
  manageDomain: 'Manage domains + DNS',
};

export type Role = 'client' | 'admin';

// Default capability sets per role. Per-user grants apply on top (V1: pre-
// resolved at user-load time; backend version will resolve at session start).
export const ADMIN_DEFAULTS: readonly Capability[] = ALL_CAPABILITIES;
export const CLIENT_DEFAULTS: readonly Capability[] = ['viewBuilder'];

// Per-user-per-website capability grant. Shape kept additive-friendly so a
// future named-preset layer can land later without migrating existing grants
// (design doc §1.4 forward-compat note).
export type CapabilityGrant = {
  userId: string;
  websiteId: string | '*'; // '*' = workspace-wide (operators)
  capabilities: Capability[];
};

export type User = {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  /** The client business this user belongs to. Operators have null
   *  (workspace-wide via role). Resolves to AdminClient.id. */
  clientId: string | null;
  // Resolved capability set: role defaults + grants applied.
  capabilities: Set<Capability>;
};
