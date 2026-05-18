'use client';

// =============================================================================
// /settings/access — admin-only access management. Two-mode surface driven
// by the workspace context (see lib/workspace/workspace-stub.tsx).
//
//   Agency mode  → birds-eye summary across all clients. Per-client roster,
//                  force-publish audit log, pending-approval surface.
//                  No per-user cap editing here.
//   Sub-account  → that client's users + per-user cap grid + audit log
//                  entries scoped to this client. This is where actual
//                  user management happens, drilled-into via the picker.
//
// Mental model: GoHighLevel-style. Agency for triage, sub-account for
// changes. Per-client user counts are small (1–5) so the grid never
// scales beyond what fits on one screen.
// =============================================================================

import { useMemo, useSyncExternalStore } from 'react';

import { AccessClientRosterRow } from '@/components/shared/settings/AccessClientRosterRow';
import { ClientSeatLimitCard } from '@/components/shared/settings/ClientSeatLimitCard';
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
import { Button } from '@/components/ui/button';
import type { ForcePublishEntry } from '@/lib/auth/audit-stub';
import {
  ADMIN_DEFAULTS,
  ALL_CAPABILITIES,
  CLIENT_DEFAULTS,
  type Capability,
} from '@/lib/auth/capabilities';
import {
  getClientUserDefs,
  getUserDefsForClient,
  setUserGrant,
  resetGrants,
  subscribeRoster,
  type RosterUser,
} from '@/lib/auth/roster-store';
import { useUser } from '@/lib/auth/user-stub';
import { useAdminClients } from '@/lib/clients/clients-store';
import { findWebsite, getWebsitesForClient } from '@/lib/website/data-stub';
import { useForcePublishLog } from '@/lib/website/queries';
import type { Website } from '@/lib/website/types';
import { useAllPendingApprovals } from '@/lib/website/use-publish-state';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

/** Live read of the force-publish audit log. */
function useAuditLog(): ForcePublishEntry[] {
  return useForcePublishLog().data ?? [];
}

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
  const currentUser = useUser();
  const rosterUsers = useSyncExternalStore(
    subscribeRoster,
    (): RosterUser[] => getUserDefsForClient(clientId),
    (): RosterUser[] => [],
  ) as RosterUser[];
  const websites = useMemo(() => getWebsitesForClient(clientId), [clientId]) as Website[];

  const gridUsers = useMemo<CapabilityToggleGridUser[]>(() => {
    return rosterUsers.map((def) => {
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
        capabilities: def.capabilities,
      };
    });
  }, [rosterUsers]);

  const handleToggle = (
    userId: string,
    websiteId: string,
    capability: Capability,
    enabled: boolean,
  ) => {
    const user = rosterUsers.find((u) => u.id === userId);
    if (!user) return;
    const next = new Set(user.capabilities);
    if (enabled) next.add(capability);
    else next.delete(capability);
    const roleFloor =
      user.role === 'admin'
        ? new Set<Capability>(ADMIN_DEFAULTS)
        : new Set<Capability>(CLIENT_DEFAULTS);
    const explicit: Capability[] = [];
    for (const cap of next as Set<Capability>) {
      if (!roleFloor.has(cap)) explicit.push(cap);
    }
    setUserGrant(userId, websiteId, explicit);
  };

  const auditEntries = useAuditLog();
  const clientAuditEntries: ForcePublishEntry[] = useMemo(() => {
    const websiteIds = new Set(websites.map((w) => w.id));
    return auditEntries.filter((e) => websiteIds.has(e.target.websiteId));
  }, [websites, auditEntries]);

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
      >
        <SettingsPanel>
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
                <strong className="text-ink">{rosterUsers.length}</strong>{' '}
                {rosterUsers.length === 1 ? 'user' : 'users'} ·{' '}
                <strong className="text-ink">{websites.length}</strong>{' '}
                {websites.length === 1 ? 'website' : 'websites'}
              </p>
              <Button size="sm" variant="secondary" onClick={resetGrants}>
                Reset to defaults
              </Button>
            </div>
            <CapabilityToggleGrid users={gridUsers} onToggle={handleToggle} />
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Seat <em>limit</em>
              </>
            }
            description={
              <>
                A <strong>contract axis</strong>, separate from capabilities
                above — it caps how many users {clientName} can have, not what
                they can do. The client&apos;s teammate-invite flow enforces
                this limit.
              </>
            }
          >
            <ClientSeatLimitCard
              clientId={clientId}
              clientName={clientName}
              actorId={currentUser?.id ?? 'unknown'}
            />
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
  const workspace = useWorkspace();
  const adminClients = useAdminClients();
  const allRosterUsers = useSyncExternalStore(
    subscribeRoster,
    getClientUserDefs,
    (): RosterUser[] => [],
  ) as RosterUser[];
  const totalClientUsers = allRosterUsers.length;
  const auditEntries = useAuditLog();
  const totalAuditEntries = auditEntries.length;
  const pendingApprovals = useAllPendingApprovals();
  const pendingCount = pendingApprovals.length;

  type PerClientEntry = {
    client: (typeof adminClients)[number];
    userCount: number;
    totalCapsGranted: number;
  };
  const perClient = useMemo(() => {
    return adminClients.map((client) => {
      const users: RosterUser[] = getUserDefsForClient(client.id);
      const totalCapsGranted = users.reduce((sum: number, def: RosterUser) => {
        // Don't count role-floor caps (viewBuilder for clients) — they
        // aren't a "grant", they're the floor.
        const floor = new Set<Capability>(CLIENT_DEFAULTS);
        let count = 0;
        for (const cap of def.capabilities as Set<Capability>) {
          if (!floor.has(cap)) count++;
        }
        return sum + count;
      }, 0);
      return { client, userCount: users.length, totalCapsGranted };
    });
    // allRosterUsers is not used directly but is the reactive signal that
    // the in-memory roster cache changed — without it, perClient wouldn't
    // recompute when getUserDefsForClient's underlying data updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminClients, allRosterUsers]) as PerClientEntry[];

  const totalCapsGrantedAcrossAll = useMemo(
    () => perClient.reduce((s: number, c: PerClientEntry) => s + c.totalCapsGranted, 0),
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
      >
        <SettingsPanel>
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
                value={pendingCount.toString()}
                meta="website submissions waiting"
                tone={pendingCount > 0 ? 'warn' : 'quiet'}
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
            <ForcePublishLog entries={auditEntries} />
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
