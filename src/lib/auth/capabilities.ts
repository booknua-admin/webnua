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
  | 'editForms'
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
  'editForms',
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
  editForms: 'Edit lead-capture forms',
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

// CLIENT_DEFAULTS is the FLOOR for client-role users — every signed-in client
// gets at least this set from their role alone. Stays at `viewBuilder` only:
// an invited teammate without an explicit owner grant can SEE the builder but
// can't change anything until the workspace owner grants them more on
// /settings/access. Matches the "operator-managed by default" framing the
// CAP_EXPLAINER strings assume.
export const CLIENT_DEFAULTS: readonly Capability[] = ['viewBuilder'];

// CLIENT_OWNER_DEFAULTS is the full self-serve capability set granted at
// signup (Pattern B `provisionPendingSignup`) and to any concierge-invite
// owner the operator creates on their behalf. The paying owner of a Pattern B
// workspace can:
//   - edit copy / media / SEO / layout / sections / theme / pages
//   - draft + insert lead-capture forms
//   - use the AI tools
//   - publish their own changes directly (Pattern B "you publish your own")
//   - roll back to a prior version
//   - attach a custom domain
//
// Deliberately EXCLUDED: `approve` stays operator-only — review of a junior
// teammate's pending submission is a governance action, not an ownership
// action. A workspace owner can publish directly without ever submitting for
// review, so they don't need `approve` themselves; teammates who DO submit
// for review surface to the operator queue.
//
// Stored as a workspace-wide grant (website_id IS NULL) in `capability_grants`
// — one row covers every site the owner ever has.
export const CLIENT_OWNER_DEFAULTS: readonly Capability[] = [
  'viewBuilder',
  'editCopy',
  'editMedia',
  'editSEO',
  'editLayout',
  'editSections',
  'editTheme',
  'editPages',
  'editForms',
  'useAI',
  'publish',
  'rollback',
  'manageDomain',
] as const;

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
   *  (workspace-wide via role). **This is the workspace SLUG** (matches
   *  `AdminClient.id` from `clients-store.ts`, which intentionally aliases
   *  `slug` to `id` for the public surface) — **NOT the UUID** stored in
   *  `auth.users.user_metadata.client_id` / `public.users.client_id`.
   *
   *  Conversion lives in `lib/clients/clients-store.ts`:
   *    - `getClientUuidBySlug(slug)` — slug → UUID
   *    - `getClientSlugByUuid(uuid)` — UUID → slug
   *
   *  Any API that takes a "clientId" param needs to be told which it wants.
   *  Routes that compare against `users.client_id` (the UUID column) — eg.
   *  `requireClientAccess` — need the UUID. The Stripe billing helpers in
   *  `lib/integrations/stripe/use-billing.ts` carry a runtime UUID guard so
   *  passing the slug fails loudly instead of returning 403. See the
   *  "User.clientId is a slug" gotcha in CLAUDE.md. */
  clientId: string | null;
  // Resolved capability set: role defaults + grants applied.
  capabilities: Set<Capability>;
};
