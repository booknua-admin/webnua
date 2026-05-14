'use client';

import { useRole } from '@/lib/auth/role-stub';

import { AdminLeadsContent } from './_admin-content';
import { ClientLeadsContent } from './_client-content';

export default function LeadsPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminLeadsContent />;
  return <ClientLeadsContent />;
}
