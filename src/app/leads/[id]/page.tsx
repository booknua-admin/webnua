'use client';

import { useRole } from '@/lib/auth/role-stub';

import { AdminLeadDetailContent } from './_admin-content';
import { ClientLeadDetailContent } from './_client-content';

export default function LeadDetailPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminLeadDetailContent />;
  return <ClientLeadDetailContent />;
}
