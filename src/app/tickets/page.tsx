'use client';

import { useRole } from '@/lib/auth/user-stub';
import { useIsAgencyMode } from '@/lib/workspace/workspace-stub';

import { AdminTicketsContent } from './_admin-content';
import { ClientTicketsContent } from './_client-content';
import { SubAccountTicketsContent } from './_sub-account-content';

export default function TicketsPage() {
  const { role } = useRole();
  const isAgencyMode = useIsAgencyMode();

  if (role === 'admin') {
    return isAgencyMode ? <AdminTicketsContent /> : <SubAccountTicketsContent />;
  }
  return <ClientTicketsContent />;
}
