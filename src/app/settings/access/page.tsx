'use client';

// =============================================================================
// /settings/access — admin-only tab for managing per-user-per-website
// capability grants + reviewing the force-publish audit log.
//
// Reached only from the admin settings nav. No runtime role gating here —
// mirrors the existing admin-tab convention (clients reach their own tabs
// from the client nav; URL-typed cross-traversal is a stub-era limitation
// fixed when real auth lands).
//
// The grid mutates grants via setUserGrant on the user-stub context, which
// persists to localStorage and fires a re-render across every consumer.
// =============================================================================

import { useMemo } from 'react';

import {
  CapabilityToggleGrid,
  type CapabilityToggleGridUser,
} from '@/components/shared/settings/CapabilityToggleGrid';
import { ForcePublishLog } from '@/components/shared/settings/ForcePublishLog';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { STUB_FORCE_PUBLISH_LOG } from '@/lib/auth/audit-stub';
import type { Capability } from '@/lib/auth/capabilities';
import {
  STUB_USER_DEFS,
  findWebsite,
  useUserContext,
} from '@/lib/auth/user-stub';
import { adminSettingsNav } from '@/lib/nav/admin-settings-nav';

export default function AdminSettingsAccessPage() {
  const ctx = useUserContext();

  // Client users only — operators have workspace-wide access through their
  // role and aren't editable in the grid.
  const gridUsers = useMemo<CapabilityToggleGridUser[]>(() => {
    return STUB_USER_DEFS.filter((def) => def.role === 'client').map((def) => {
      const liveUser = ctx.allUsers.find((u) => u.id === def.id);
      const websites = def.accessibleWebsiteIds
        .map((id) => findWebsite(id))
        .filter((w): w is NonNullable<typeof w> => w != null);
      return {
        id: def.id,
        displayName: def.displayName,
        email: def.email,
        role: def.role,
        websites,
        capabilities: liveUser?.capabilities ?? new Set<Capability>(),
      };
    });
  }, [ctx.allUsers]);

  const handleToggle = (
    userId: string,
    websiteId: string,
    capability: Capability,
    enabled: boolean,
  ) => {
    const user = ctx.allUsers.find((u) => u.id === userId);
    if (!user) return;
    // Compute the user's current non-default grant set for this website
    // by reading their resolved caps and subtracting their role default.
    // For the stub this collapses to: the cap is being toggled on/off.
    const currentNonFloor = new Set(user.capabilities);
    // Remove role-floor caps so we only track the explicit overrides.
    // (For the stub layer this is a slight inaccuracy if a user has
    // multiple websites — full per-website cap reading lands with the
    // website data model in Session 2.)
    const next = new Set(currentNonFloor);
    if (enabled) next.add(capability);
    else next.delete(capability);
    // Role default caps stay implicit — we never persist them as grants.
    const roleFloor =
      user.role === 'admin'
        ? new Set<Capability>()
        : new Set<Capability>(['viewBuilder']);
    const explicit: Capability[] = [];
    for (const cap of next) {
      if (!roleFloor.has(cap)) explicit.push(cap);
    }
    ctx.setUserGrant(userId, websiteId, explicit);
  };

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Access" />} />
      <SettingsShell
        eyebrow="Workspace · Webnua Perth"
        title={
          <>
            Settings + <em>integrations</em>.
          </>
        }
        subtitle="Manage what each client user is allowed to do inside the page builder."
        items={adminSettingsNav}
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Client <em>capabilities</em>
              </>
            }
            description={
              <>
                Every client user gets <strong>viewBuilder</strong> by default —
                they can see their pages. Anything beyond that is granted
                per-user, per-website. Toggling a capability writes a grant
                immediately and updates everyone&rsquo;s editor in real time.
              </>
            }
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
                <strong className="text-ink">{gridUsers.length}</strong>{' '}
                client {gridUsers.length === 1 ? 'user' : 'users'} ·
                editing scope: per-website
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
                Force-publish bypasses the approval queue. It&rsquo;s admin-only,
                requires a confirm-twice action, and demands a free-text reason.{' '}
                <strong>Every use is logged here and surfaced to the
                affected client user&rsquo;s version history.</strong>
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
