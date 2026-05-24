'use client';

import { useRole } from '@/lib/auth/user-stub';
import { useIsAgencyMode } from '@/lib/workspace/workspace-stub';

import { AdminAutomationsContent } from './_admin-content';
import { ClientAutomationsContent } from './_client-content';
import { SubAccountAutomationsContent } from './_sub-account-content';

export default function AutomationsPage() {
  const { role } = useRole();
  const isAgencyMode = useIsAgencyMode();

  if (role === 'admin') {
    return isAgencyMode ? (
      <AdminAutomationsContent />
    ) : (
      <SubAccountAutomationsContent />
    );
  }
  return <ClientAutomationsContent />;
}
