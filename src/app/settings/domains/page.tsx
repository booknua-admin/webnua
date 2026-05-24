'use client';

// =============================================================================
// /settings/domains — Phase 9 custom-domain attachment.
//
// 2-way role dispatcher (matches the established /settings/* pattern). The
// admin-content dispatches a second time on workspace mode internally: agency
// → cross-client AllDomainsTable, sub-account → per-client CustomDomainSection.
// =============================================================================

import { useRole } from '@/lib/auth/user-stub';

import { AdminDomainsContent } from './_admin-content';
import { ClientDomainsContent } from './_client-content';

export default function SettingsDomainsPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminDomainsContent />;
  return <ClientDomainsContent />;
}
