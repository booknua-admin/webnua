'use client';

import { useRole } from '@/lib/auth/user-stub';
import { useIsAgencyMode } from '@/lib/workspace/workspace-stub';

import { AdminLeadsContent } from './_admin-content';
import { ClientLeadsContent } from './_client-content';
import { SubAccountLeadsContent } from './_sub-account-content';

export default function LeadsPage() {
  const { role } = useRole();
  const isAgencyMode = useIsAgencyMode();

  if (role === 'admin') {
    return isAgencyMode ? <AdminLeadsContent /> : <SubAccountLeadsContent />;
  }
  return <ClientLeadsContent />;
}
