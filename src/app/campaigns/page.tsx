'use client';

import { useRole } from '@/lib/auth/user-stub';
import { useIsAgencyMode } from '@/lib/workspace/workspace-stub';

import { AdminCampaignsContent } from './_admin-content';
import { ClientCampaignsContent } from './_client-content';
import { SubAccountCampaignsContent } from './_sub-account-content';

export default function CampaignsPage() {
  const { role } = useRole();
  const isAgencyMode = useIsAgencyMode();

  if (role === 'admin') {
    return isAgencyMode ? (
      <AdminCampaignsContent />
    ) : (
      <SubAccountCampaignsContent />
    );
  }
  return <ClientCampaignsContent />;
}
