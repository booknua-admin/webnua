// =============================================================================
// Team roles — the three operator-tier roles a workspace teammate can hold.
//
// Distinct from `Role` ('client' | 'admin') in capabilities.ts: that drives
// sidebar shape; this is the finer org-tier an operator picks at invite time.
//
// TEAM_ROLE_CAPABILITIES is DERIVED from the capability layer — owner/operator
// inherit ADMIN_DEFAULTS verbatim; junior is a deliberate subset. The Step 2
// permissions preview computes allow/deny from this map; it is never a
// hand-written list.
//
// Note: owner and operator are identical in the 13-cap *builder* model — they
// genuinely diverge only on billing / team management / client deletion, which
// the cap model does not yet cover (see the parked decision in CLAUDE.md).
// =============================================================================

import { ADMIN_DEFAULTS, type Capability } from '@/lib/auth/capabilities';

export type TeamRole = 'owner' | 'operator' | 'junior';

export type TeamRoleDef = {
  id: TeamRole;
  name: string;
  /** Single-glyph icon shown in the role-select card's icon tile. */
  icon: string;
  description: string;
};

export const TEAM_ROLES: readonly TeamRoleDef[] = [
  {
    id: 'owner',
    name: 'Owner',
    icon: '○',
    description: 'Full access — billing, deletes, team management. Use sparingly.',
  },
  {
    id: 'operator',
    name: 'Operator',
    icon: '◐',
    description: 'Manages all clients, automations, ad campaigns. No billing or team changes.',
  },
  {
    id: 'junior',
    name: 'Junior operator',
    icon: '◑',
    description: 'Limited to specific clients you assign. Can edit those clients only.',
  },
] as const;

// Junior operator's builder capabilities. Deliberate subset:
//  - editSEO is IN allow — SEO drafts are not SEO pushes; the `publish` gate
//    still requires Operator, so a junior drafting SEO copy can't ship it live.
//  - editLayout / editSections / editTheme / editPages are out — structural
//    changes are operator-managed.
//  - publish / approve / rollback / manageDomain are out — release control.
const JUNIOR_CAPABILITIES: readonly Capability[] = [
  'viewBuilder',
  'editCopy',
  'editMedia',
  'editSEO',
  'useAI',
];

export const TEAM_ROLE_CAPABILITIES: Record<TeamRole, readonly Capability[]> = {
  owner: ADMIN_DEFAULTS,
  operator: ADMIN_DEFAULTS,
  junior: JUNIOR_CAPABILITIES,
};

export function getTeamRoleDef(role: TeamRole): TeamRoleDef {
  // TEAM_ROLES is exhaustive over TeamRole — find always resolves.
  return TEAM_ROLES.find((r) => r.id === role) as TeamRoleDef;
}
