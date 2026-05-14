'use client';

import { useRole } from '@/lib/auth/role-stub';

import { AdminAutomationsContent } from './_admin-content';
import { ClientAutomationsContent } from './_client-content';

export default function AutomationsPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminAutomationsContent />;
  return <ClientAutomationsContent />;
}
