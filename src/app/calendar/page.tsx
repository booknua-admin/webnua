'use client';

import { useRole } from '@/lib/auth/user-stub';
import { useIsAgencyMode } from '@/lib/workspace/workspace-stub';

import { AdminCalendarContent } from './_admin-content';
import { ClientCalendarContent } from './_client-content';
import { SubAccountCalendarContent } from './_sub-account-content';

export default function CalendarPage() {
  const { role } = useRole();
  const isAgencyMode = useIsAgencyMode();

  if (role === 'admin') {
    return isAgencyMode ? <AdminCalendarContent /> : <SubAccountCalendarContent />;
  }
  return <ClientCalendarContent />;
}
