'use client';

import { useRole } from '@/lib/auth/role-stub';

import { AdminTicketsContent } from './_admin-content';
import { ClientTicketsContent } from './_client-content';

export default function TicketsPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminTicketsContent />;
  return <ClientTicketsContent />;
}
