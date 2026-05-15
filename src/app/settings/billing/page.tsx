'use client';

import { useRole } from '@/lib/auth/user-stub';

import { AdminBillingContent } from './_admin-content';
import { ClientBillingContent } from './_client-content';

export default function SettingsBillingPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminBillingContent />;
  return <ClientBillingContent />;
}
