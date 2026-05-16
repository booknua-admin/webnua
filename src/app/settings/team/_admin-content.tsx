import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { InviteTeamButton } from '@/components/admin/team/InviteTeamButton';
import { TeamRow } from '@/components/shared/settings/TeamRow';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { cn } from '@/lib/utils';
import { adminSettingsNav } from '@/lib/nav/admin-settings-nav';
import { adminTeamMembers, adminTeamPermissions } from '@/lib/settings/admin-team';

export function AdminSettingsTeamContent() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Team" />} />
      <SettingsShell
        eyebrow="Workspace · Webnua Perth"
        title={
          <>
            Settings + <em>integrations</em>.
          </>
        }
        subtitle="Manage your team, who they can access, and what they're allowed to do across your clients."
        items={adminSettingsNav}
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
                3 of 5 seats used on the Operator plan.{' '}
                <strong>Invite team members to help manage clients</strong> — they can be assigned
                client-level or workspace-level access.
              </>
            }
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
                <strong className="text-ink">3</strong> members · 1 invite pending
              </span>
              <InviteTeamButton />
            </div>
            {adminTeamMembers.map((member) => (
              <TeamRow
                key={member.id}
                initial={member.initial}
                name={member.name}
                isYou={member.isYou}
                email={member.email}
                role={member.role}
                roleSub={member.roleSub}
                status={member.status}
                statusLabel={member.statusLabel}
                actions={member.actions}
              />
            ))}
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
