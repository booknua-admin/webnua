'use client';

import { useRole } from '@/lib/auth/user-stub';

import { AdminCampaignsContent } from './_admin-content';
import { ClientCampaignsContent } from './_client-content';

export default function CampaignsPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminCampaignsContent />;
  return <ClientCampaignsContent />;
}
