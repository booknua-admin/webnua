'use client';

import { useRole } from '@/lib/auth/role-stub';

import { AdminTicketDetailContent } from './_admin-content';
import { ClientTicketDetailContent } from './_client-content';

export default function TicketDetailPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminTicketDetailContent />;
  return <ClientTicketDetailContent />;
}
