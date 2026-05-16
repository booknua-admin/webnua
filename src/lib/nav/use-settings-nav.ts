'use client';

// =============================================================================
// useSettingsNav — resolves the settings tab nav for the current role +
// workspace mode. The /settings/* URL space is shared; which tabs show is a
// runtime decision, not a per-page constant.
//
//   client role                  → their own account nav.
//   operator + agency mode        → agency HQ nav.
//   operator + sub-account mode   → the drilled-in sub-account nav.
// =============================================================================

import { useRole } from '@/lib/auth/user-stub';
import { useIsAgencyMode } from '@/lib/workspace/workspace-stub';
import { adminSettingsNav } from './admin-settings-nav';
import { clientSettingsNav } from './client-settings-nav';
import { subAccountSettingsNav } from './sub-account-settings-nav';
import type { SettingsNavItem } from './types';

export function useSettingsNav(): SettingsNavItem[] {
  const { role } = useRole();
  const isAgencyMode = useIsAgencyMode();

  if (role !== 'admin') return clientSettingsNav;
  return isAgencyMode ? adminSettingsNav : subAccountSettingsNav;
}
