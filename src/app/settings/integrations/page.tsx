'use client';

import { useRole } from '@/lib/auth/user-stub';

import { AdminIntegrationsContent } from './_admin-content';
import { ClientIntegrationsContent } from './_client-content';

export default function SettingsIntegrationsPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminIntegrationsContent />;
  return <ClientIntegrationsContent />;
}
