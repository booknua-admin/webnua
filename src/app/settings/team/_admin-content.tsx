'use client';

// /settings/team — operator branch. Dispatches on workspace mode:
// agency mode → Webnua's own team members (operators); sub-account mode →
// the drilled-in client's user roster + a "+ Invite teammate" button that
// covers BOTH the operator-concierge invite of the first client owner AND
// adding subsequent client teammates.

import { useMemo, useSyncExternalStore } from 'react';

import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { InviteTeamButton } from '@/components/admin/team/InviteTeamButton';
import { TeamRow } from '@/components/shared/settings/TeamRow';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { cn } from '@/lib/utils';
import {
  cancelTeamInvite,
  getAllTeamInvites,
  resendTeamInvite,
  subscribeTeamInvites,
} from '@/lib/team/team-invite-stub';
import { adminTeamPermissions } from '@/lib/settings/admin-team';
import { useUser } from '@/lib/auth/user-stub';
import { getAllRoster, subscribeRoster } from '@/lib/auth/roster-store';
import { useWorkspace } from '@/lib/workspace/workspace-stub';
import { inviteInitials } from '@/components/shared/invite/InviteModalChrome';
import { getTeamRoleDef } from '@/lib/team/roles';
import type { TeamInvite } from '@/lib/team/types';

import { SubAccountTeamContent } from './_sub-account-content';

const EMPTY_INVITES: TeamInvite[] = [];

// Reference-stable empty server snapshot for the roster store. Per the
// CLAUDE.md `useSyncExternalStore` rule — the SSR/initial snapshot must NOT
// recompute or return a fresh array each render.
type RosterSnapshot = ReturnType<typeof getAllRoster>;
const EMPTY_ROSTER: RosterSnapshot = [];

/** Label + sub-label per operator tier. Pulled from `users.team_role`
 *  surfaced on `RosterUser.teamRole`. Null falls back to plain "Operator". */
function describeOperatorTier(
  teamRole: 'owner' | 'operator' | 'junior' | null,
): { label: string; sub: string } {
  switch (teamRole) {
    case 'owner':
      return { label: 'Owner', sub: 'Software owner' };
    case 'junior':
      return { label: 'Junior operator', sub: 'Limited access' };
    case 'operator':
    case null:
    default:
      return { label: 'Operator', sub: 'Workspace access' };
  }
}

export function AdminSettingsTeamContent() {
  const { activeClient } = useWorkspace();
  if (activeClient) {
    return <SubAccountTeamContent />;
  }
  return <AgencyTeamContent />;
}

function AgencyTeamContent() {
  const signedInUser = useUser();

  const allInvites = useSyncExternalStore(
    subscribeTeamInvites,
    getAllTeamInvites,
    () => EMPTY_INVITES,
  ) as TeamInvite[];

  const roster = useSyncExternalStore(
    subscribeRoster,
    getAllRoster,
    () => EMPTY_ROSTER,
  );

  const operatorMembers = useMemo(
    () => roster.filter((u) => u.role === 'admin'),
    [roster],
  );

  const pendingInvites = useMemo(
    () => allInvites.filter((i) => i.status === 'pending'),
    [allInvites],
  );

  const totalMembers = operatorMembers.length;
  const pendingCount = pendingInvites.length;

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Team" />} />
      <SettingsShell
        eyebrow="Workspace · Webnua"
        title={
          <>
            Settings + <em>integrations</em>.
          </>
        }
        subtitle="Manage your team, who they can access, and what they're allowed to do across your clients."
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Team <em>members</em>
              </>
            }
            description={
              <>
                <strong>Invite team members to help manage clients</strong> —
                they can be assigned client-level or workspace-level access.
                Operators see every workspace; juniors see only the clients
                they&apos;re assigned to.
              </>
            }
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
                <strong className="text-ink">{totalMembers}</strong> members ·{' '}
                {pendingCount} invite{pendingCount === 1 ? '' : 's'} pending
              </span>
              <InviteTeamButton />
            </div>
            {operatorMembers.map((member) => {
              const { label, sub } = describeOperatorTier(member.teamRole);
              return (
                <TeamRow
                  key={member.id}
                  initial={inviteInitials(member.displayName, member.email)}
                  name={member.displayName}
                  isYou={member.id === signedInUser?.id}
                  email={member.email}
                  role={label}
                  roleSub={sub}
                  status="active"
                  statusLabel="Active"
                  actions={[]}
                />
              );
            })}
            {operatorMembers.length <= 1 && pendingCount === 0 ? (
              <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-rule bg-paper px-5 py-6 text-center">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  {'// Invite teammates'}
                </p>
                <p className="max-w-sm text-sm text-ink-quiet">
                  Bring on other operators to help manage clients.
                  They&apos;ll get a magic-link email and pick a password.
                </p>
              </div>
            ) : null}

            {pendingInvites.map((invite) => {
              const roleDef = getTeamRoleDef(invite.role);
              return (
                <TeamRow
                  key={invite.id}
                  initial={inviteInitials(invite.fullName, invite.email)}
                  name={invite.fullName.trim() || invite.email}
                  email={invite.email}
                  role={roleDef.name}
                  roleSub="Invite pending"
                  status="pending"
                  statusLabel="Pending"
                  actions={[
                    {
                      label: 'Resend',
                      onClick: () => {
                        void resendTeamInvite(invite.id);
                      },
                    },
                    {
                      label: 'Revoke',
                      tone: 'danger',
                      onClick: () => {
                        void cancelTeamInvite(invite.id);
                      },
                    },
                  ]}
                />
              );
            })}
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Permissions by <em>role</em>
              </>
            }
            description={
              <>
                Three roles: Owner (full access), Operator (manage clients and automations), Junior
                operator (limited to assigned clients).{' '}
                <strong>Custom roles are coming in v2.</strong>
              </>
            }
          >
            <div className="mt-4 overflow-hidden rounded-lg border border-rule bg-paper">
              <div className="grid grid-cols-[1fr_100px_100px_100px] gap-3 border-b border-rule bg-paper-2 px-[18px] py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                <span>Capability</span>
                <span className="text-center text-ink">Owner</span>
                <span className="text-center text-ink">Operator</span>
                <span className="text-center text-ink">Junior</span>
              </div>
              {adminTeamPermissions.map((row) => (
                <div
                  key={row.capability}
                  className="grid grid-cols-[1fr_100px_100px_100px] items-center gap-3 border-b border-paper-2 bg-card px-[18px] py-[11px] last:border-b-0"
                >
                  <div className="text-[13px] font-semibold text-ink">
                    {row.capability}
                    {row.sub ? (
                      <span className="mt-0.5 block text-[11px] font-medium text-ink-quiet">
                        {row.sub}
                      </span>
                    ) : null}
                  </div>
                  {([row.owner, row.operator, row.junior] as const).map((checked, i) => (
                    <span
                      key={i}
                      className={cn(
                        'text-center text-[16px] font-extrabold',
                        checked ? 'text-good' : 'text-rule',
                      )}
                    >
                      {checked ? '✓' : '—'}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
