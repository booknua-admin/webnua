'use client';

// /settings/team — client view. The business owner's view of their own client
// account: who's on the account, how many seats are used, and the invite CTA.
// Net-new surface — the client prototype has no Team tab (see CLAUDE.md note).

import { useMemo, useSyncExternalStore } from 'react';

import { SeatUsageMeter } from '@/components/client/team/SeatUsageMeter';
import { InviteTeammateButton } from '@/components/client/team/InviteTeammateButton';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { TeamRow } from '@/components/shared/settings/TeamRow';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { inviteInitials } from '@/components/shared/invite/InviteModalChrome';
import { getUserDefsForClient, useUser } from '@/lib/auth/user-stub';
import {
  getAllClientInvites,
  subscribeClientInvites,
} from '@/lib/invites/client-invite-stub';
import type { ClientUserInvite } from '@/lib/invites/client-invite';
import { useClientSeatUsage } from '@/lib/invites/use-seat-usage';
import { clientSettingsNav } from '@/lib/nav/client-settings-nav';
import { adminClients } from '@/lib/nav/admin-clients';

const EMPTY_INVITES: ClientUserInvite[] = [];

export function ClientSettingsTeamContent() {
  const user = useUser();
  const clientId = user?.clientId ?? null;

  const allInvites = useSyncExternalStore(
    subscribeClientInvites,
    getAllClientInvites,
    () => EMPTY_INVITES,
  );

  const pendingInvites = useMemo(
    () =>
      clientId
        ? allInvites.filter(
            (inv) => inv.clientId === clientId && inv.status === 'pending',
          )
        : [],
    [allInvites, clientId],
  );

  const usage = useClientSeatUsage(clientId ?? '');
  const members = clientId ? getUserDefsForClient(clientId) : [];
  const clientName =
    adminClients.find((c) => c.id === clientId)?.name ?? 'your account';

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Team" />} />
      <SettingsShell
        eyebrow={`${clientName} · your account`}
        title={
          <>
            Your <em>team</em>.
          </>
        }
        subtitle={
          <>
            Everyone with access to {clientName}.{' '}
            <strong>Invite teammates to view your website, leads, and bookings</strong> — editing
            access is granted by Webnua.
          </>
        }
        items={clientSettingsNav}
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                People on <em>{clientName}</em>
              </>
            }
            description="Teammates can see your account. They start with view-only access until Webnua grants editing."
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SeatUsageMeter usage={usage} className="min-w-[220px] flex-1" />
              <InviteTeammateButton />
            </div>

            {members.map((member) => (
              <TeamRow
                key={member.id}
                initial={inviteInitials(member.displayName, member.email)}
                name={member.displayName}
                isYou={member.id === user?.id}
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
                actions={[{ label: 'Revoke', tone: 'danger' }]}
              />
            ))}
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                What teammates <em>can do</em>
              </>
            }
            description="Every teammate starts with the same view-only access. There are no in-account roles to manage — Webnua controls who can edit and publish."
          >
            <div className="mt-3 rounded-lg border border-rule bg-paper px-5 py-4">
              {[
                ['Can', 'See your website, funnels, leads, bookings, and reviews'],
                ['Cannot', 'Edit pages, publish changes, or manage billing'],
                ['Need editing access?', `Ask Craig at Webnua to grant it per teammate`],
              ].map(([label, body]) => (
                <div
                  key={label}
                  className="grid grid-cols-[150px_1fr] gap-3 border-b border-paper-2 py-2.5 last:border-b-0"
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
