'use client';

// =============================================================================
// /settings/access — admin-only access management. Two-mode surface driven
// by the workspace context (see lib/workspace/workspace-stub.tsx).
//
//   Agency mode  → birds-eye summary across all clients. Per-client roster,
//                  force-publish audit log, pending-approval empty state.
//                  No per-user cap editing here.
//   Sub-account  → that client's users + per-user cap grid + audit log
//                  entries scoped to this client. This is where actual
//                  user management happens, drilled-into via the picker.
//
// Mental model: GoHighLevel-style. Agency for triage, sub-account for
// changes. Per-client user counts are small (1–5) so the grid never
// scales beyond what fits on one screen.
// =============================================================================

import { useMemo } from 'react';

import { AccessClientRosterRow } from '@/components/shared/settings/AccessClientRosterRow';
import {
  CapabilityToggleGrid,
  type CapabilityGridWebsite,
  type CapabilityToggleGridUser,
} from '@/components/shared/settings/CapabilityToggleGrid';
import { ForcePublishLog } from '@/components/shared/settings/ForcePublishLog';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { WorkspaceContextBanner } from '@/components/shared/WorkspaceContextBanner';
import { Button } from '@/components/ui/button';
import {
  STUB_FORCE_PUBLISH_LOG,
  type ForcePublishEntry,
} from '@/lib/auth/audit-stub';
import {
  ADMIN_DEFAULTS,
  ALL_CAPABILITIES,
  CLIENT_DEFAULTS,
  type Capability,
} from '@/lib/auth/capabilities';
import {
  getClientUserDefs,
  getUserDefsForClient,
  useUserContext,
} from '@/lib/auth/user-stub';
import { adminClients } from '@/lib/nav/admin-clients';
import { adminSettingsNav } from '@/lib/nav/admin-settings-nav';
import { findWebsite, getWebsitesForClient } from '@/lib/website/data-stub';
import type { Website } from '@/lib/website/types';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

/** Project a full Website into the minimal display shape the cap grid needs. */
function projectWebsite(website: Website): CapabilityGridWebsite {
  return {
    id: website.id,
    clientName: website.name,
    domain: website.domain.primary,
  };
}

export default function AdminSettingsAccessPage() {
  const workspace = useWorkspace();

  if (!workspace.hydrated) {
    return (
      <>
        <Topbar
          breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Access" />}
        />
        <SettingsShell
          eyebrow="Workspace · Webnua Perth"
          title={
            <>
              Access <em>across all clients</em>.
            </>
          }
          subtitle="Loading access context..."
          items={adminSettingsNav}
        >
          <SettingsPanel>
            <div className="h-32" />
          </SettingsPanel>
        </SettingsShell>
      </>
    );
  }

  return workspace.activeClient ? (
    <SubAccountView
      clientId={workspace.activeClient.id}
      clientName={workspace.activeClient.name}
    />
  ) : (
    <AgencyOverview />
  );
}

// -- Sub-account view (drilled into a specific client) --------------------

function SubAccountView({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const ctx = useUserContext();
  const websites = useMemo(() => getWebsitesForClient(clientId), [clientId]);
  const userDefs = useMemo(() => getUserDefsForClient(clientId), [clientId]);

  const gridUsers = useMemo<CapabilityToggleGridUser[]>(() => {
    return userDefs.map((def) => {
      const liveUser = ctx.allUsers.find((u) => u.id === def.id);
      const userWebsites = def.accessibleWebsiteIds
        .map((id) => findWebsite(id))
        .filter((w): w is NonNullable<typeof w> => w != null)
        .map(projectWebsite);
      return {
        id: def.id,
        displayName: def.displayName,
        email: def.email,
        role: def.role,
        websites: userWebsites,
        capabilities: liveUser?.capabilities ?? new Set<Capability>(),
      };
    });
  }, [ctx.allUsers, userDefs]);

  const handleToggle = (
    userId: string,
    websiteId: string,
    capability: Capability,
    enabled: boolean,
  ) => {
    const user = ctx.allUsers.find((u) => u.id === userId);
    if (!user) return;
    const next = new Set(user.capabilities);
    if (enabled) next.add(capability);
    else next.delete(capability);
    const roleFloor =
      user.role === 'admin'
        ? new Set<Capability>(ADMIN_DEFAULTS)
        : new Set<Capability>(CLIENT_DEFAULTS);
    const explicit: Capability[] = [];
    for (const cap of next) {
      if (!roleFloor.has(cap)) explicit.push(cap);
    }
    ctx.setUserGrant(userId, websiteId, explicit);
  };

  const clientAuditEntries: ForcePublishEntry[] = useMemo(() => {
    const websiteIds = new Set(websites.map((w) => w.id));
    return STUB_FORCE_PUBLISH_LOG.filter((e) =>
      websiteIds.has(e.target.websiteId),
    );
  }, [websites]);

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Settings', 'Access']}
            current={clientName}
          />
        }
      />
      <SettingsShell
        eyebrow={`Sub-account · ${clientName}`}
        title={
          <>
            Access for <em>{clientName}</em>.
          </>
        }
        subtitle={
          <>
            <strong>Manage capabilities for the users at this client business.</strong>{' '}
            Switch context with the client picker in the sidebar, or jump back to
            agency birds-eye to triage across all clients.
          </>
        }
        items={adminSettingsNav}
      >
        <SettingsPanel>
          <div className="mb-6">
            <WorkspaceContextBanner />
          </div>

          <SettingsSection
            heading={
              <>
                {clientName} <em>users</em>
              </>
            }
            description={
              <>
                Every client user gets <strong>viewBuilder</strong> by default.
                Anything beyond that is granted per-user, per-website. Changes
                persist immediately and update every consumer of the cap layer.
              </>
            }
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
                <strong className="text-ink">{userDefs.length}</strong>{' '}
                {userDefs.length === 1 ? 'user' : 'users'} ·{' '}
                <strong className="text-ink">{websites.length}</strong>{' '}
                {websites.length === 1 ? 'website' : 'websites'}
              </p>
              <Button size="sm" variant="secondary" onClick={ctx.resetGrants}>
                Reset to defaults
              </Button>
            </div>
            <CapabilityToggleGrid users={gridUsers} onToggle={handleToggle} />
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Force-publish <em>audit log</em>
              </>
            }
            description={
              <>
                Break-glass force-publish events that affected{' '}
                <strong>{clientName}</strong>. Each entry shows actor,
                target page, free-text reason, and the resulting version id.
              </>
            }
          >
            <ForcePublishLog entries={clientAuditEntries} />
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}

// -- Agency birds-eye view (cross-client, no per-user editing) ------------

function AgencyOverview() {
  const ctx = useUserContext();
  const workspace = useWorkspace();
  const clientUserDefs = getClientUserDefs();
  const totalClientUsers = clientUserDefs.length;
  const totalAuditEntries = STUB_FORCE_PUBLISH_LOG.length;

  const perClient = useMemo(() => {
    return adminClients.map((client) => {
      const users = getUserDefsForClient(client.id);
      const totalCapsGranted = users.reduce((sum, def) => {
        const liveUser = ctx.allUsers.find((u) => u.id === def.id);
        if (!liveUser) return sum;
        // Don't count role-floor caps (viewBuilder for clients) — they
        // aren't a "grant", they're the floor.
        const floor = new Set<Capability>(CLIENT_DEFAULTS);
        let count = 0;
        for (const cap of liveUser.capabilities) {
          if (!floor.has(cap)) count++;
        }
        return sum + count;
      }, 0);
      return { client, userCount: users.length, totalCapsGranted };
    });
  }, [ctx.allUsers]);

  const totalCapsGrantedAcrossAll = useMemo(
    () => perClient.reduce((s, c) => s + c.totalCapsGranted, 0),
    [perClient],
  );

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Settings']} current="Access" />
        }
      />
      <SettingsShell
        eyebrow="Workspace · Webnua Perth"
        title={
          <>
            Access <em>across all clients</em>.
          </>
        }
        subtitle={
          <>
            <strong>Birds-eye on every client business&rsquo;s user access.</strong>{' '}
            Triage approvals and audit force-publish events from here. Drill into a
            client to manage their users.
          </>
        }
        items={adminSettingsNav}
      >
        <SettingsPanel>
          <div className="mb-6">
            <WorkspaceContextBanner hideReturnButton />
          </div>

          <SettingsSection
            heading={
              <>
                Workspace <em>at a glance</em>
              </>
            }
            description={
              <>
                Quick numbers across every client. Drill into a client below to
                edit their users&rsquo; capabilities.
              </>
            }
          >
            <div className="grid grid-cols-4 gap-3.5">
              <SummaryTile
                label="Client users"
                value={totalClientUsers.toString()}
                meta={`${adminClients.length} clients`}
              />
              <SummaryTile
                label="Pending approvals"
                value="0"
                meta="cap-change submissions"
                tone="quiet"
              />
              <SummaryTile
                label="Force-publish · 30d"
                value={totalAuditEntries.toString()}
                meta="audited break-glass events"
                tone={totalAuditEntries > 0 ? 'warn' : 'quiet'}
              />
              <SummaryTile
                label="Caps granted total"
                value={totalCapsGrantedAcrossAll.toString()}
                meta={`${ALL_CAPABILITIES.length} caps × users`}
              />
            </div>
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Clients <em>roster</em>
              </>
            }
            description={
              <>
                Every client business with their user count + granted-cap
                summary. <strong>&ldquo;Drill in&rdquo; switches your
                workspace context</strong> — the page re-renders with their
                user list and the cap grid.
              </>
            }
          >
            <div className="overflow-hidden rounded-lg border border-rule bg-paper">
              <div className="grid grid-cols-[40px_1fr_120px_140px_120px] gap-3 border-b border-rule bg-paper-2 px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                <span />
                <span>Client</span>
                <span>Users</span>
                <span>Caps granted</span>
                <span />
              </div>
              {perClient.map(({ client, userCount, totalCapsGranted }) => (
                <AccessClientRosterRow
                  key={client.id}
                  client={client}
                  userCount={userCount}
                  totalCapsGranted={totalCapsGranted}
                  onDrillIn={workspace.setActiveClientId}
                />
              ))}
            </div>
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Force-publish <em>audit log</em>
              </>
            }
            description={
              <>
                Every force-publish event across every client. Each entry is
                also surfaced inside the affected client&rsquo;s sub-account view
                and (when publish ships) in their version history.
              </>
            }
          >
            <ForcePublishLog entries={STUB_FORCE_PUBLISH_LOG} />
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}

function SummaryTile({
  label,
  value,
  meta,
  tone = 'default',
}: {
  label: string;
  value: string;
  meta: string;
  tone?: 'default' | 'warn' | 'quiet';
}) {
  return (
    <div className="rounded-lg border border-rule bg-card px-4 py-3.5">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </p>
      <p
        className={
          'mt-1 text-[26px] font-bold leading-none tracking-[-0.01em] ' +
          (tone === 'warn'
            ? 'text-warn'
            : tone === 'quiet'
              ? 'text-ink-quiet'
              : 'text-ink')
        }
      >
        {value}
      </p>
      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
        {meta}
      </p>
    </div>
  );
}
