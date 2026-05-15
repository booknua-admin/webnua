'use client';

import { useRole } from '@/lib/auth/user-stub';

import { AdminCalendarContent } from './_admin-content';
import { ClientCalendarContent } from './_client-content';

export default function CalendarPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminCalendarContent />;
  return <ClientCalendarContent />;
}
