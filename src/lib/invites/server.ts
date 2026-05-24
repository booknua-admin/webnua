// =============================================================================
// Invite server logic — create / lookup / resend / cancel / accept.
//
// The single place the real magic-link flow's business logic lives. Routes
// call into this; UI never imports it (these functions use the service-role
// Supabase client). The previous in-memory stub modules (`team-invite-stub`,
// `client-invite-stub`) still own the browser-side cache; their `addX` writes
// now POST the matching route here.
//
// Two invite shapes, one set of operations:
//
//   - `team_invites`         — operator invites a Webnua-team member
//                              (role: owner | operator | junior). Junior
//                              invites carry `assignedClientIds` joined via
//                              `team_invite_clients`.
//   - `client_user_invites`  — invite into a CLIENT workspace. Two callers:
//                              (a) client owner inviting a teammate, (b)
//                              operator inviting the FIRST client owner of a
//                              freshly created workspace (the concierge
//                              path).
//
// Acceptance contract — on POST /api/invites/[token]/accept:
//   1. Resolve invite by token (RLS bypassed via service role).
//   2. Validate: status=pending, expires_at > now, consumed_at IS NULL.
//   3. Refuse if an auth user with this email already exists (the invitee
//      would log in via /login instead — same email twice is operator drift).
//   4. supabase.auth.admin.createUser({ email, password, email_confirm: true,
//      user_metadata: { role, client_id?, team_role?, display_name } }) —
//      the migration 0017 trigger inserts the public.users row, the
//      migration 0088 trigger fans the CLIENT_OWNER_DEFAULTS grant when the
//      user is the FIRST client-role user of their workspace.
//   5. For `team_invites`: copy team_invite_clients into user_client_access
//      (junior scoping carries forward).
//   6. UPDATE the invite row — status='accepted', consumed_at=now.
//   7. Return { ok: true, email } so the page can sign the user in via
//      supabase.auth.signInWithPassword and route to /dashboard.
//
// SERVER-ONLY (uses service-role client, node:crypto, env secrets).
// =============================================================================

import { AppError } from '@/lib/errors';
import { getAppBaseUrl } from '@/lib/env';
import { getServiceClient } from '@/lib/supabase/server';
import { canInviteToClient } from '@/lib/invites/seats';
import { TEAM_ROLES, type TeamRole } from '@/lib/team/roles';
import { INVITE_TTL_DAYS } from '@/lib/invites/shared-types';
import { emailAlreadyRegistered } from '@/lib/auth/signup-workspace';

import { sendInviteEmail, type InviteEmailOutcome } from './invite-email';
import { composeInviteUrl, generateInviteToken } from './token';

// --- shared types -----------------------------------------------------------

export type InviteRecord = {
  id: string;
  email: string;
  fullName: string;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  token: string;
  magicLink: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  personalNote: string | null;
};

export type TeamInviteRecord = InviteRecord & {
  kind: 'team';
  role: TeamRole;
  assignedClientIds: string[];
};

export type ClientUserInviteRecord = InviteRecord & {
  kind: 'client';
  clientId: string;
};

export type SendResult<R extends InviteRecord> = {
  invite: R;
  emailOutcome: InviteEmailOutcome;
};

// --- helpers ----------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

function expiresIso(ttlDays: number = INVITE_TTL_DAYS): string {
  return new Date(Date.now() + ttlDays * 86_400_000).toISOString();
}

function appBase(originHint?: string | null): string {
  if (originHint && originHint.trim()) return originHint.replace(/\/+$/, '');
  const base = getAppBaseUrl();
  if (base) return base;
  // Last-resort fallback: localhost. The accept route always passes
  // request.url so this branch is only hit in tests/build-time importing.
  return 'http://localhost:3000';
}

function teamRoleLabel(role: TeamRole): string {
  return TEAM_ROLES.find((r) => r.id === role)?.name ?? role;
}

async function resolveOperatorName(userId: string): Promise<string> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('users')
    .select('display_name, email')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return 'Your operator';
  const name = (data as { display_name?: string | null }).display_name?.trim();
  if (name) return name;
  const email = (data as { email?: string | null }).email ?? '';
  return email.split('@')[0] || 'Your operator';
}

async function resolveClientName(clientId: string): Promise<string> {
  const svc = getServiceClient();
  const { data } = await svc.from('clients').select('name').eq('id', clientId).maybeSingle();
  return (data as { name?: string } | null)?.name ?? 'your account';
}

/** Untyped view of the service client for the migration-0089 columns
 *  (`token`, `consumed_at`) that aren't in the generated `Database` type yet.
 *  Same pattern as `lib/integrations/_shared/db-types.ts`'s
 *  `getIntegrationDb()`: cast through unknown so the new columns are
 *  addressable while the generated type catches up post-deploy. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inviteDb(): any {
  return getServiceClient();
}

// --- create: TEAM invite ----------------------------------------------------

export type CreateTeamInviteInput = {
  email: string;
  fullName: string;
  role: TeamRole;
  /** Required when role='junior'; ignored otherwise. */
  assignedClientIds: string[];
  personalNote: string;
  invitedBy: string;
  /** Origin from the request URL — preferred over env so the magic link
   *  lands on whichever host the operator was working from. */
  requestOrigin?: string | null;
  workspaceName?: string | null;
};

export async function createTeamInvite(
  input: CreateTeamInviteInput,
): Promise<SendResult<TeamInviteRecord>> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new AppError('validation', 'email-required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('validation', 'email-invalid');
  }
  const role = input.role;
  if (role !== 'owner' && role !== 'operator' && role !== 'junior') {
    throw new AppError('validation', 'role-invalid');
  }
  if (role === 'junior' && input.assignedClientIds.length === 0) {
    throw new AppError('validation', 'junior-needs-clients');
  }

  const svc = getServiceClient();

  // Refuse duplicate-email pending invites — a re-invite uses /resend, not
  // a second row. (`status='pending'` filter keeps an invite that was
  // already accepted/expired from blocking the re-add.)
  const { data: existing } = await svc
    .from('team_invites')
    .select('id')
    .eq('email', email)
    .eq('status', 'pending')
    .limit(1);
  if (existing && existing.length > 0) {
    throw new AppError('conflict', 'invite-already-pending');
  }

  const token = generateInviteToken();
  const invitedAt = nowIso();
  const expiresAt = expiresIso();
  const magicLink = composeInviteUrl(appBase(input.requestOrigin), token);

  const insertPayload = {
    email,
    full_name: input.fullName.trim(),
    role,
    invited_by: input.invitedBy,
    invited_at: invitedAt,
    expires_at: expiresAt,
    magic_link: magicLink,
    status: 'pending' as const,
    personal_note: input.personalNote.trim(),
    token,
  };

  const { data: inserted, error } = await inviteDb()
    .from('team_invites')
    .insert(insertPayload)
    .select('id')
    .single();
  if (error || !inserted) {
    throw AppError.unexpected(`team_invites insert failed: ${error?.message ?? 'no row'}`);
  }
  const inviteId = (inserted as { id: string }).id;

  // Junior client assignments. We persist for any role that supplied a
  // non-empty list, but only `junior` actually scopes off this table — the
  // form already strips assignments for non-junior roles.
  const assignedClientIds = role === 'junior' ? input.assignedClientIds.filter(Boolean) : [];
  if (assignedClientIds.length > 0) {
    const rows = assignedClientIds.map((cid) => ({ invite_id: inviteId, client_id: cid }));
    const { error: linkError } = await svc.from('team_invite_clients').insert(rows as never);
    if (linkError) {
      // Best-effort — the invite still exists. Operator can re-edit assignments.
      console.warn(
        `[invites/server] team_invite_clients insert failed for ${inviteId}: ${linkError.message}`,
      );
    }
  }

  const inviterName = await resolveOperatorName(input.invitedBy);
  const workspaceName = input.workspaceName?.trim() || 'Webnua';

  const emailOutcome = await sendInviteEmail({
    kind: 'team',
    recipientEmail: email,
    recipientName: input.fullName,
    inviterName,
    workspaceName,
    roleLabel: teamRoleLabel(role),
    magicLink,
    expiresAt,
    personalNote: input.personalNote.trim() || null,
  });

  const invite: TeamInviteRecord = {
    kind: 'team',
    id: inviteId,
    email,
    fullName: input.fullName.trim(),
    role,
    assignedClientIds,
    invitedBy: input.invitedBy,
    invitedAt,
    expiresAt,
    token,
    magicLink,
    status: 'pending',
    personalNote: input.personalNote.trim() || null,
  };

  return { invite, emailOutcome };
}

// --- create: CLIENT-USER invite ---------------------------------------------

export type CreateClientUserInviteInput = {
  email: string;
  fullName: string;
  clientId: string; // UUID
  personalNote: string;
  invitedBy: string;
  isOperator: boolean;
  requestOrigin?: string | null;
};

export async function createClientUserInvite(
  input: CreateClientUserInviteInput,
): Promise<SendResult<ClientUserInviteRecord>> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new AppError('validation', 'email-required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('validation', 'email-invalid');
  }
  if (!input.clientId) throw new AppError('validation', 'client-required');

  // Seat-limit guard — the client-side modal already checks, but the count
  // could move while the modal is open. canInviteToClient reads the
  // hydrated in-memory stores; on the server it reads zero, so we re-do
  // the check directly from the DB for accuracy.
  const seatBlock = await checkSeatLimitAvailable(input.clientId);
  if (!seatBlock.allowed) {
    throw new AppError('conflict', seatBlock.reason ?? 'seat-limit-reached');
  }

  const svc = getServiceClient();

  // Refuse a duplicate pending invite per (client, email).
  const { data: existing } = await svc
    .from('client_user_invites')
    .select('id')
    .eq('client_id', input.clientId)
    .eq('email', email)
    .eq('status', 'pending')
    .limit(1);
  if (existing && existing.length > 0) {
    throw new AppError('conflict', 'invite-already-pending');
  }

  const token = generateInviteToken();
  const invitedAt = nowIso();
  const expiresAt = expiresIso();
  const magicLink = composeInviteUrl(appBase(input.requestOrigin), token);

  const insertPayload = {
    email,
    full_name: input.fullName.trim(),
    client_id: input.clientId,
    invited_by: input.invitedBy,
    invited_at: invitedAt,
    expires_at: expiresAt,
    magic_link: magicLink,
    status: 'pending' as const,
    personal_note: input.personalNote.trim() || null,
    token,
  };

  const { data: inserted, error } = await inviteDb()
    .from('client_user_invites')
    .insert(insertPayload)
    .select('id')
    .single();
  if (error || !inserted) {
    throw AppError.unexpected(
      `client_user_invites insert failed: ${error?.message ?? 'no row'}`,
    );
  }
  const inviteId = (inserted as { id: string }).id;

  const [inviterName, workspaceName] = await Promise.all([
    resolveOperatorName(input.invitedBy),
    resolveClientName(input.clientId),
  ]);

  const emailOutcome = await sendInviteEmail({
    kind: 'client',
    recipientEmail: email,
    recipientName: input.fullName,
    inviterName,
    workspaceName,
    magicLink,
    expiresAt,
    personalNote: input.personalNote.trim() || null,
  });

  const invite: ClientUserInviteRecord = {
    kind: 'client',
    id: inviteId,
    email,
    fullName: input.fullName.trim(),
    clientId: input.clientId,
    invitedBy: input.invitedBy,
    invitedAt,
    expiresAt,
    token,
    magicLink,
    status: 'pending',
    personalNote: input.personalNote.trim() || null,
  };

  return { invite, emailOutcome };
}

// --- seat-limit check (server-side) -----------------------------------------

/** Returns { allowed: false } when adding ONE more pending invite would
 *  exceed the client's seat limit. Server-side counterpart to the
 *  in-memory `canInviteToClient` in lib/invites/seats.ts — counts active
 *  client-role users + pending invites against the resolved limit. */
async function checkSeatLimitAvailable(
  clientId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const svc = getServiceClient();
  // Resolve the limit via the policy_overrides → agency_policy stack. For
  // simplicity (no resolver server-side yet), we read overrides directly,
  // fall back to agency policy, fall back to no-limit. The CLAUDE.md note
  // about `defaultSeatLimit` resolving through the policy resolver applies
  // here — this is a defensive minimum, not the full resolution chain.
  const { data: override } = await svc
    .from('policy_overrides')
    .select('value')
    .eq('client_id', clientId)
    .eq('policy_key', 'defaultSeatLimit')
    .maybeSingle();
  let limit: number | null = null;
  if (override) {
    const raw = (override as { value?: unknown }).value;
    if (typeof raw === 'number') limit = raw;
    else if (raw && typeof raw === 'object' && typeof (raw as { value?: unknown }).value === 'number') {
      limit = (raw as { value: number }).value;
    }
  } else {
    const { data: agency } = await svc
      .from('agency_policy')
      .select('value')
      .eq('policy_key', 'defaultSeatLimit')
      .maybeSingle();
    if (agency) {
      const raw = (agency as { value?: unknown }).value;
      if (typeof raw === 'number') limit = raw;
    }
  }

  if (limit === null) return { allowed: true };

  const [usersResp, invitesResp] = await Promise.all([
    svc.from('users').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('role', 'client'),
    svc
      .from('client_user_invites')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'pending'),
  ]);
  const used = (usersResp.count ?? 0) + (invitesResp.count ?? 0);
  if (used >= limit) return { allowed: false, reason: 'seat-limit-reached' };
  return { allowed: true };
}

// Re-export from seats.ts for consistency with the client-side check name.
export { canInviteToClient };

// --- lookup: resolve token --------------------------------------------------

export type InviteResolution =
  | {
      ok: true;
      kind: 'team';
      inviteId: string;
      email: string;
      fullName: string;
      role: TeamRole;
      roleLabel: string;
      assignedClientIds: string[];
      inviterName: string;
      workspaceName: string;
      personalNote: string | null;
      expiresAt: string;
    }
  | {
      ok: true;
      kind: 'client';
      inviteId: string;
      email: string;
      fullName: string;
      clientId: string;
      clientSlug: string;
      clientName: string;
      inviterName: string;
      personalNote: string | null;
      expiresAt: string;
    }
  | {
      ok: false;
      reason: 'not_found' | 'expired' | 'consumed' | 'revoked';
    };

export async function resolveInviteByToken(token: string): Promise<InviteResolution> {
  if (!token || token.length < 8) return { ok: false, reason: 'not_found' };
  const svc = getServiceClient();
  const db = inviteDb();

  // Try team first, then client. The chance of collision across the two
  // tables is vanishing (32-byte tokens) but we order on common case (team
  // invites are much rarer than client invites in practice).
  const { data: clientRow } = await db
    .from('client_user_invites')
    .select(
      'id, email, full_name, client_id, invited_by, invited_at, expires_at, status, consumed_at, personal_note',
    )
    .eq('token', token)
    .maybeSingle();

  if (clientRow) {
    const row = clientRow as {
      id: string;
      email: string;
      full_name: string;
      client_id: string;
      invited_by: string;
      expires_at: string;
      status: string;
      consumed_at: string | null;
      personal_note: string | null;
    };
    const stateError = inviteStateError(row.status, row.consumed_at, row.expires_at);
    if (stateError) return { ok: false, reason: stateError };
    const [inviterName, clientResp] = await Promise.all([
      resolveOperatorName(row.invited_by),
      svc.from('clients').select('name, slug').eq('id', row.client_id).maybeSingle(),
    ]);
    const c = (clientResp.data as { name?: string; slug?: string } | null) ?? null;
    return {
      ok: true,
      kind: 'client',
      inviteId: row.id,
      email: row.email,
      fullName: row.full_name,
      clientId: row.client_id,
      clientSlug: c?.slug ?? '',
      clientName: c?.name ?? 'your account',
      inviterName,
      personalNote: row.personal_note,
      expiresAt: row.expires_at,
    };
  }

  const { data: teamRow } = await db
    .from('team_invites')
    .select(
      'id, email, full_name, role, invited_by, invited_at, expires_at, status, consumed_at, personal_note',
    )
    .eq('token', token)
    .maybeSingle();

  if (teamRow) {
    const row = teamRow as {
      id: string;
      email: string;
      full_name: string;
      role: TeamRole;
      invited_by: string;
      expires_at: string;
      status: string;
      consumed_at: string | null;
      personal_note: string;
    };
    const stateError = inviteStateError(row.status, row.consumed_at, row.expires_at);
    if (stateError) return { ok: false, reason: stateError };
    const [inviterName, assignments] = await Promise.all([
      resolveOperatorName(row.invited_by),
      svc.from('team_invite_clients').select('client_id').eq('invite_id', row.id),
    ]);
    return {
      ok: true,
      kind: 'team',
      inviteId: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      roleLabel: teamRoleLabel(row.role),
      assignedClientIds:
        (assignments.data as Array<{ client_id: string }> | null)?.map((r) => r.client_id) ?? [],
      inviterName,
      workspaceName: 'Webnua',
      personalNote: row.personal_note?.trim() ? row.personal_note : null,
      expiresAt: row.expires_at,
    };
  }

  return { ok: false, reason: 'not_found' };
}

function inviteStateError(
  status: string,
  consumedAt: string | null,
  expiresAt: string,
): 'expired' | 'consumed' | 'revoked' | null {
  if (consumedAt) return 'consumed';
  if (status === 'accepted') return 'consumed';
  if (status === 'revoked') return 'revoked';
  if (status === 'expired') return 'expired';
  if (new Date(expiresAt).getTime() < Date.now()) return 'expired';
  return null;
}

// --- accept -----------------------------------------------------------------

export type AcceptInviteInput = {
  token: string;
  password: string;
  fullName?: string;
};

export type AcceptInviteResult = {
  ok: true;
  email: string;
  redirectTo: string;
};

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

export async function acceptInvite(input: AcceptInviteInput): Promise<AcceptInviteResult> {
  const resolution = await resolveInviteByToken(input.token);
  if (!resolution.ok) {
    if (resolution.reason === 'not_found') throw AppError.notFound('invite-not-found');
    if (resolution.reason === 'consumed') throw new AppError('conflict', 'invite-already-used');
    if (resolution.reason === 'revoked') throw new AppError('conflict', 'invite-revoked');
    throw new AppError('validation', 'invite-expired');
  }

  const password = (input.password ?? '').trim();
  if (password.length < MIN_PASSWORD) {
    throw new AppError('validation', 'password-too-short');
  }
  if (password.length > MAX_PASSWORD) {
    throw new AppError('validation', 'password-too-long');
  }

  const svc = getServiceClient();
  const email = resolution.email;

  // Refuse if an auth user with this email already exists (the invitee
  // would log in via /login instead). Race-safe: if a duplicate exists,
  // auth.admin.createUser also errors — but checking first gives a clearer
  // error message.
  if (await emailAlreadyRegistered(email)) {
    throw new AppError('conflict', 'email-already-registered');
  }

  const displayName = (input.fullName ?? resolution.fullName)?.trim() || email.split('@')[0];

  const userMetadata: Record<string, unknown> = {
    display_name: displayName,
  };
  if (resolution.kind === 'client') {
    userMetadata.role = 'client';
    userMetadata.client_id = resolution.clientId;
  } else {
    userMetadata.role = 'admin';
    userMetadata.team_role = resolution.role;
  }

  const created = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });
  if (created.error || !created.data.user) {
    throw AppError.unexpected(
      `accept: auth.admin.createUser failed: ${created.error?.message ?? 'no user returned'}`,
    );
  }
  const newUserId = created.data.user.id;

  // For team invites: copy junior client assignments → user_client_access.
  // Owner/operator stay unbounded (no rows) by design.
  if (resolution.kind === 'team' && resolution.role === 'junior' && resolution.assignedClientIds.length > 0) {
    const rows = resolution.assignedClientIds.map((cid) => ({
      user_id: newUserId,
      client_id: cid,
      granted_by: newUserId, // self-attributed at acceptance; the inviter id is on team_invites.invited_by
    }));
    const { error: accessError } = await svc.from('user_client_access').insert(rows as never);
    if (accessError) {
      console.warn(
        `[invites/server] user_client_access insert failed for ${newUserId}: ${accessError.message}`,
      );
    }
  }

  // Mark the invite consumed.
  const table = resolution.kind === 'team' ? 'team_invites' : 'client_user_invites';
  const { error: updateError } = await inviteDb()
    .from(table)
    .update({ status: 'accepted', consumed_at: nowIso() })
    .eq('id', resolution.inviteId);
  if (updateError) {
    // Non-fatal — the user IS provisioned, the invite stays pending and the
    // expiry sweep will eventually clean it up. We log loudly so the next
    // operations review sees it.
    console.error(
      `[invites/server] failed to mark invite ${resolution.inviteId} consumed: ${updateError.message}`,
    );
  }

  // Redirect target: dashboard for both shapes. Operator team invitees land
  // on the operator dashboard (agency mode); client invitees land on the
  // client dashboard scoped to their workspace.
  return { ok: true, email, redirectTo: '/dashboard' };
}

// --- resend -----------------------------------------------------------------

export type ResendInviteInput = {
  id: string;
  callerUserId: string;
  callerIsOperator: boolean;
  requestOrigin?: string | null;
};

export type ResendOutcome = {
  invite: TeamInviteRecord | ClientUserInviteRecord;
  emailOutcome: InviteEmailOutcome;
};

/** Re-mint a token, extend expiry, re-send the email. The OLD token is
 *  invalidated by the unique constraint (the row's token column is
 *  overwritten) — there can only be one valid magic link per invite at a
 *  time. Status is re-set to 'pending' even if it had drifted to
 *  'expired'. */
export async function resendInvite(input: ResendInviteInput): Promise<ResendOutcome> {
  const svc = getServiceClient();
  const db = inviteDb();
  // Probe both tables in parallel; whichever returns the row is the kind.
  const [teamProbe, clientProbe] = await Promise.all([
    db
      .from('team_invites')
      .select(
        'id, email, full_name, role, invited_by, invited_at, expires_at, status, consumed_at, personal_note',
      )
      .eq('id', input.id)
      .maybeSingle(),
    db
      .from('client_user_invites')
      .select(
        'id, email, full_name, client_id, invited_by, invited_at, expires_at, status, consumed_at, personal_note',
      )
      .eq('id', input.id)
      .maybeSingle(),
  ]);

  if (teamProbe.data) {
    if (!input.callerIsOperator) throw AppError.forbidden('forbidden');
    const row = teamProbe.data as Record<string, unknown>;
    if ((row.status as string) === 'accepted' || row.consumed_at) {
      throw new AppError('conflict', 'invite-already-used');
    }
    const token = generateInviteToken();
    const expiresAt = expiresIso();
    const magicLink = composeInviteUrl(appBase(input.requestOrigin), token);
    const { error } = await inviteDb()
      .from('team_invites')
      .update({ token, magic_link: magicLink, expires_at: expiresAt, status: 'pending' })
      .eq('id', input.id);
    if (error) throw AppError.unexpected(`resend update failed: ${error.message}`);

    const inviterName = await resolveOperatorName(row.invited_by as string);
    const emailOutcome = await sendInviteEmail({
      kind: 'team',
      recipientEmail: row.email as string,
      recipientName: row.full_name as string,
      inviterName,
      workspaceName: 'Webnua',
      roleLabel: teamRoleLabel(row.role as TeamRole),
      magicLink,
      expiresAt,
      personalNote: ((row.personal_note as string) ?? '').trim() || null,
    });

    const { data: assignments } = await svc
      .from('team_invite_clients')
      .select('client_id')
      .eq('invite_id', input.id);

    const invite: TeamInviteRecord = {
      kind: 'team',
      id: row.id as string,
      email: row.email as string,
      fullName: row.full_name as string,
      role: row.role as TeamRole,
      assignedClientIds:
        (assignments as Array<{ client_id: string }> | null)?.map((r) => r.client_id) ?? [],
      invitedBy: row.invited_by as string,
      invitedAt: row.invited_at as string,
      expiresAt,
      token,
      magicLink,
      status: 'pending',
      personalNote: ((row.personal_note as string) ?? '').trim() || null,
    };
    return { invite, emailOutcome };
  }

  if (clientProbe.data) {
    const row = clientProbe.data as Record<string, unknown>;
    if ((row.status as string) === 'accepted' || row.consumed_at) {
      throw new AppError('conflict', 'invite-already-used');
    }
    const token = generateInviteToken();
    const expiresAt = expiresIso();
    const magicLink = composeInviteUrl(appBase(input.requestOrigin), token);
    const { error } = await inviteDb()
      .from('client_user_invites')
      .update({ token, magic_link: magicLink, expires_at: expiresAt, status: 'pending' })
      .eq('id', input.id);
    if (error) throw AppError.unexpected(`resend update failed: ${error.message}`);

    const [inviterName, clientName] = await Promise.all([
      resolveOperatorName(row.invited_by as string),
      resolveClientName(row.client_id as string),
    ]);
    const emailOutcome = await sendInviteEmail({
      kind: 'client',
      recipientEmail: row.email as string,
      recipientName: row.full_name as string,
      inviterName,
      workspaceName: clientName,
      magicLink,
      expiresAt,
      personalNote: ((row.personal_note as string | null) ?? '')?.trim() || null,
    });

    const invite: ClientUserInviteRecord = {
      kind: 'client',
      id: row.id as string,
      email: row.email as string,
      fullName: row.full_name as string,
      clientId: row.client_id as string,
      invitedBy: row.invited_by as string,
      invitedAt: row.invited_at as string,
      expiresAt,
      token,
      magicLink,
      status: 'pending',
      personalNote: ((row.personal_note as string | null) ?? '')?.trim() || null,
    };
    return { invite, emailOutcome };
  }

  throw AppError.notFound('invite-not-found');
}

// --- cancel / revoke --------------------------------------------------------

export async function cancelInvite(id: string): Promise<{ ok: true }> {
  const svc = getServiceClient();
  // Probe + flip in parallel — whichever table holds the row wins.
  const [teamUpdate, clientUpdate] = await Promise.all([
    svc
      .from('team_invites')
      .update({ status: 'revoked' } as never)
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle(),
    svc
      .from('client_user_invites')
      .update({ status: 'revoked' } as never)
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle(),
  ]);

  if (!teamUpdate.data && !clientUpdate.data) {
    // Either not found, or not in 'pending' state. Treat the latter as a
    // conflict and the former as not_found — but they're indistinguishable
    // here without a second query, so collapse to a single 404. The UI
    // refreshes its list and the user sees the right state regardless.
    throw AppError.notFound('invite-not-found-or-not-pending');
  }
  return { ok: true };
}
