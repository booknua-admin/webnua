'use client';

// =============================================================================
// SettingsContextBanner — mounts the workspace-context pill on every settings
// page (via SettingsShell). Operators only: a client user has no
// agency/sub-account axis, so the banner would be meaningless for them.
// =============================================================================

import { WorkspaceContextBanner } from '@/components/shared/WorkspaceContextBanner';
import { useRole } from '@/lib/auth/user-stub';

export function SettingsContextBanner() {
  const { role } = useRole();
  if (role !== 'admin') return null;
  return <WorkspaceContextBanner />;
}
