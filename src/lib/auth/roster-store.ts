// =============================================================================
// roster-store — in-memory cache of users + capability grants, hydrated from
// Supabase.
//
// Provides the accessors previously exported from user-stub.tsx that are about
// the overall user roster (not the signed-in session). These were removed from
// user-stub when real auth shipped; this module re-exposes them backed by live
// Supabase reads.
//
// Import sites: lib/invites/seats.ts, app/settings/team/_client-content.tsx,
// app/settings/access/page.tsx.
//
// Snapshot discipline (CLAUDE.md): all getters are reference-stable —
// version counter bumps on every write; per-query snapshots cached against it.
// =============================================================================

import { supabase } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/errors';
import {
  type Capability,
  type CapabilityGrant,
  type Role,
  CLIENT_DEFAULTS,
} from './capabilities';
import { resolveCapabilities } from './user-stub';

const CHANGE_EVENT = 'webnua:roster-change';

// ---- Internal types ---------------------------------------------------------

/** Operator-tier sub-role. Mirrors `lib/team/roles.ts` `TeamRole` but kept as
 *  a local string union so this module has no upward dep. Surfaced via
 *  `RosterUser.teamRole` for the operator team page; null for client-role
 *  users (the column carries no meaningful value there). */
type TeamRoleValue = 'owner' | 'operator' | 'junior';

type RosterUser = {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  /** Operator-tier sub-role — distinguishes Owner / Operator / Junior. Null
   *  for client-role users + for any operator row whose `team_role` column
   *  is unset (treated as plain "Operator" by consumers). */
  teamRole: TeamRoleValue | null;
  /** Slug of the client this user belongs to, or null for operators. */
  clientId: string | null;
  capabilities: Set<Capability>;
  /** Website UUIDs (or '*') this user has an explicit grant for. */
  accessibleWebsiteIds: string[];
};

// ---- In-memory cache --------------------------------------------------------

let rosterCache: RosterUser[] = [];
let grantsCache: Record<string, CapabilityGrant[]> = {};
let version = 0;

// Stable snapshots keyed by query (clientId or '*')
const snapshotsByClient: Record<string, { v: number; data: RosterUser[] }> = {};
let allClientUsersVersion = -1;
let allClientUsersSnapshot: RosterUser[] = [];

function dispatch() {
  version++;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

// ---- Hydration --------------------------------------------------------------

type ClientSlugRel = { slug: string } | { slug: string }[] | null;

function readClientSlug(rel: ClientSlugRel): string | null {
  if (!rel) return null;
  const row = Array.isArray(rel) ? rel[0] : rel;
  return row?.slug ?? null;
}

export async function hydrateRoster(): Promise<void> {
  // Fetch users with their client slug + operator-tier sub-role. `team_role`
  // is the Owner/Operator/Junior column on `public.users` (constrained by the
  // privilege-escalation guard added in migration 0045).
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, display_name, email, role, team_role, client:clients!users_client_id_fkey(slug)');

  if (usersError) {
    console.error('[roster-store] users hydrate failed:', normalizeError(usersError).message);
    return;
  }

  // Fetch all capability grants.
  const { data: grants, error: grantsError } = await supabase
    .from('capability_grants')
    .select('user_id, website_id, capabilities');

  if (grantsError) {
    console.error('[roster-store] grants hydrate failed:', normalizeError(grantsError).message);
  }

  // Fetch user_client_access for accessible website resolution.
  // (We use capability_grants.website_id as the accessible website list.)

  // Build grants map.
  const grantsByUser: Record<string, CapabilityGrant[]> = {};
  for (const g of (grants ?? []) as Array<Record<string, unknown>>) {
    const userId = g.user_id as string;
    if (!grantsByUser[userId]) grantsByUser[userId] = [];
    grantsByUser[userId].push({
      userId,
      websiteId: (g.website_id as string | null) ?? '*',
      capabilities: (g.capabilities ?? []) as Capability[],
    });
  }

  // Build roster.
  rosterCache = (users ?? []).map((u: Record<string, unknown>) => {
    const userId = u.id as string;
    const role = u.role as Role;
    const rawTeamRole = u.team_role as string | null | undefined;
    const teamRole: TeamRoleValue | null =
      rawTeamRole === 'owner' || rawTeamRole === 'operator' || rawTeamRole === 'junior'
        ? rawTeamRole
        : null;
    const clientSlug = readClientSlug(u.client as ClientSlugRel);
    const userGrants = grantsByUser[userId] ?? [];
    const capabilities = resolveCapabilities(role, userGrants);
    const accessibleWebsiteIds = userGrants
      .map((g) => g.websiteId)
      .filter((id) => id !== '*');

    return {
      id: userId,
      displayName: u.display_name as string,
      email: u.email as string,
      role,
      teamRole,
      clientId: clientSlug,
      capabilities,
      accessibleWebsiteIds,
    };
  });

  grantsCache = grantsByUser;
  dispatch();
}

// ---- Reads ------------------------------------------------------------------

/** User defs belonging to a client slug. Reference-stable per version. */
export function getUserDefsForClient(slug: string): RosterUser[] {
  const cached = snapshotsByClient[slug];
  if (cached && cached.v === version) return cached.data;
  const data = rosterCache.filter(
    (u) => u.role === 'client' && u.clientId === slug,
  );
  snapshotsByClient[slug] = { v: version, data };
  return data;
}

/** All client-role users. Reference-stable per version. */
export function getClientUserDefs(): RosterUser[] {
  if (version === allClientUsersVersion) return allClientUsersSnapshot;
  allClientUsersVersion = version;
  allClientUsersSnapshot = rosterCache.filter((u) => u.role === 'client');
  return allClientUsersSnapshot;
}

/** All users in the roster. */
export function getAllRoster(): RosterUser[] {
  return rosterCache;
}

/** The grants for one user. */
export function getUserGrants(userId: string): CapabilityGrant[] {
  return grantsCache[userId] ?? [];
}

// ---- Writes -----------------------------------------------------------------

/** Update a user's capability grant. Optimistic cache update + Supabase write.
 *
 *  `websiteId` '*' → null in the DB (the unique constraint is
 *  UNIQUE(user_id, website_id) NULLS NOT DISTINCT).
 */
export function setUserGrant(
  userId: string,
  websiteId: string,
  capabilities: Capability[],
): void {
  const dbWebsiteId = websiteId === '*' ? null : websiteId;

  // Build the new grant object.
  const newGrant: CapabilityGrant = { userId, websiteId, capabilities };

  // Update in-memory grants cache.
  const existing = grantsCache[userId] ?? [];
  const next = existing.filter((g) => g.websiteId !== websiteId);
  if (capabilities.length > 0) next.push(newGrant);
  grantsCache = { ...grantsCache, [userId]: next };

  // Recompute capabilities for the affected user.
  rosterCache = rosterCache.map((u) => {
    if (u.id !== userId) return u;
    const userGrants = grantsCache[userId] ?? [];
    const newCaps = resolveCapabilities(u.role, userGrants);
    const accessibleWebsiteIds = userGrants
      .map((g) => g.websiteId)
      .filter((id) => id !== '*');
    return { ...u, capabilities: newCaps, accessibleWebsiteIds };
  });

  dispatch();

  // Background write.
  if (capabilities.length > 0) {
    void supabase
      .from('capability_grants')
      .upsert(
        {
          user_id: userId,
          website_id: dbWebsiteId,
          capabilities,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,website_id' },
      )
      .then((result: { error: unknown }) => {
        if (result.error) {
          console.error('[roster-store] setUserGrant UPSERT failed:', normalizeError(result.error).message);
        }
      });
  } else {
    // Delete only the grant for this exact (user, website) pair — a
    // workspace-wide grant is the NULL website_id row; a per-site grant
    // matches the website id.
    const base = supabase.from('capability_grants').delete().eq('user_id', userId);
    void (dbWebsiteId === null
      ? base.is('website_id', null)
      : base.eq('website_id', dbWebsiteId)
    ).then((result: { error: unknown }) => {
      if (result.error) {
        console.error('[roster-store] setUserGrant DELETE failed:', normalizeError(result.error).message);
      }
    });
  }
}

/** Reset all capability grants — deletes all rows for client users. */
export function resetGrants(): void {
  const clientUserIds = rosterCache
    .filter((u) => u.role === 'client')
    .map((u) => u.id);

  // Clear grants for client users in the cache.
  const nextGrants = { ...grantsCache };
  for (const userId of clientUserIds) {
    delete nextGrants[userId];
  }
  grantsCache = nextGrants;

  // Recompute capabilities for affected users.
  rosterCache = rosterCache.map((u) => {
    if (!clientUserIds.includes(u.id)) return u;
    const roleCaps = new Set<Capability>(CLIENT_DEFAULTS);
    return { ...u, capabilities: roleCaps, accessibleWebsiteIds: [] };
  });

  dispatch();

  // Background delete.
  if (clientUserIds.length > 0) {
    void supabase
      .from('capability_grants')
      .delete()
      .in('user_id', clientUserIds)
      .then((result: { error: unknown }) => {
        if (result.error) {
          console.error('[roster-store] resetGrants DELETE failed:', normalizeError(result.error).message);
        }
      });
  }
}

export function subscribeRoster(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

// ---- Re-export type for consumers -------------------------------------------

export type { RosterUser };
