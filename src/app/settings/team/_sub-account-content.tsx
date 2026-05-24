'use client';

// /settings/team — operator drilled into a client (sub-account mode). The
// operator-concierge surface: invite the FIRST client owner of a freshly-
// created workspace, OR add subsequent teammates on the client's behalf.
//
// Structurally mirrors `_client-content.tsx` (same TeamRow + SeatUsageMeter
// + pending-invite list) so the operator and the client see the SAME thing
// when they're looking at the same workspace. The framing differs — the
// operator's eyebrow says "Sub-account · {clientName}" and an explainer
// banner sits at the top reminding the operator they're acting on the
// client's behalf.
//
// Uses the same `InviteTeammateButton` the client uses. The button is
// already widened to accept operators in sub-account mode (it reads
// useWorkspace().activeClientId for operators) — when no users exist yet,
// the operator is inviting the OWNER, but the UI doesn't have to change
// for that: the auto-grant trigger from migration 0088 makes the first
// client-role user the workspace owner automatically. The button's label
// adapts ("Invite the owner" vs "+ Invite teammate") based on whether
// there are any client-role users yet.

import { useMemo, useSyncExternalStore } from 'react';

import { SeatUsageMeter } from '@/components/client/team/SeatUsageMeter';
import { InviteTeammateButton } from '@/components/client/team/InviteTeammateButton';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { TeamRow } from '@/components/shared/settings/TeamRow';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { inviteInitials } from '@/components/shared/invite/InviteModalChrome';
import {
  getUserDefsForClient,
  subscribeRoster,
  type RosterUser,
} from '@/lib/auth/roster-store';
import {
  cancelClientInvite,
  getAllClientInvites,
  resendClientInvite,
  subscribeClientInvites,
} from '@/lib/invites/client-invite-stub';
import type { ClientUserInvite } from '@/lib/invites/client-invite';
import { useClientSeatUsage } from '@/lib/invites/use-seat-usage';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

const EMPTY_INVITES: ClientUserInvite[] = [];

export function SubAccountTeamContent() {
  const { activeClient } = useWorkspace();
  const clientId = activeClient?.id ?? null;

  const allInvites = useSyncExternalStore(
    subscribeClientInvites,
    getAllClientInvites,
    () => EMPTY_INVITES,
  ) as ClientUserInvite[];

  const pendingInvites = useMemo(
    () =>
      clientId
        ? allInvites.filter(
            (inv) => inv.clientId === clientId && inv.status === 'pending',
          )
        : [],
    [allInvites, clientId],
  );

  const members = useSyncExternalStore(
    subscribeRoster,
    () => (clientId ? getUserDefsForClient(clientId) : []),
    () => [] as ReturnType<typeof getUserDefsForClient>,
  ) as RosterUser[];

  const usage = useClientSeatUsage(clientId ?? '');
  const clientName = activeClient?.name ?? 'this client';

  const isFirstInvite = members.length === 0 && pendingInvites.length === 0;

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Team" />} />
      <SettingsShell
        eyebrow={`Sub-account · ${clientName}`}
        title={
          <>
            {clientName}&rsquo;s <em>team</em>.
          </>
        }
        subtitle={
          <>
            Everyone with access to <strong>{clientName}</strong>. Invite the
            owner if they haven&rsquo;t accepted yet, or add their teammates.
            Concierge actions you take here affect the client&rsquo;s own view
            of their account.
          </>
        }
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                People on <em>{clientName}</em>
              </>
            }
            description={
              isFirstInvite
                ? "No one's accepted yet. Send the owner their magic link to bring them into their workspace."
                : 'Active teammates and pending invites. Pending invites count against the seat limit.'
            }
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SeatUsageMeter usage={usage} className="min-w-[220px] flex-1" />
              <InviteTeammateButton
                label={isFirstInvite ? 'Invite the owner →' : '+ Invite teammate'}
              />
            </div>

            {members.length === 0 && pendingInvites.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-rule bg-paper px-5 py-4 font-sans text-[13px] text-ink-quiet">
                No users on this workspace yet. Sending the first invite makes
                the recipient the <strong>workspace owner</strong>{' '}
                automatically — they&rsquo;ll land on the dashboard with full
                editing access.
              </div>
            ) : null}

            {members.map((member) => (
              <TeamRow
                key={member.id}
                initial={inviteInitials(member.displayName, member.email)}
                name={member.displayName}
                email={member.email}
                role="Member"
                roleSub="Client account"
                status="active"
                statusLabel="Active"
                actions={[]}
              />
            ))}

            {pendingInvites.map((invite) => (
              <TeamRow
                key={invite.id}
                initial={inviteInitials(invite.fullName, invite.email)}
                name={invite.fullName.trim() || invite.email}
                email={invite.email}
                role="Member"
                roleSub="Invite pending"
                status="pending"
                statusLabel="Pending"
                actions={[
                  {
                    label: 'Resend',
                    onClick: () => {
                      void resendClientInvite(invite.id);
                    },
                  },
                  {
                    label: 'Revoke',
                    tone: 'danger',
                    onClick: () => {
                      void cancelClientInvite(invite.id);
                    },
                  },
                ]}
              />
            ))}
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                What teammates <em>can do</em>
              </>
            }
            description="The first invitee becomes the workspace owner (full access). Every subsequent invitee starts with view-only access — grant edit caps per-website via /settings/access."
          >
            <div className="mt-3 rounded-lg border border-rule bg-paper px-5 py-4">
              {[
                ['Owner (1st invite)', 'Full edit + publish + manage their account'],
                ['Teammate', 'View only — needs per-website grants to edit'],
                ['Operator concierge', 'You can act on their behalf via this sub-account view'],
              ].map(([label, body]) => (
                <div
                  key={label}
                  className="grid grid-cols-[180px_1fr] gap-3 border-b border-paper-2 py-2.5 last:border-b-0"
                >
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
                    {label}
                  </span>
                  <span className="font-sans text-[13px] leading-[1.5] text-ink-soft">
                    {body}
                  </span>
                </div>
              ))}
            </div>
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
