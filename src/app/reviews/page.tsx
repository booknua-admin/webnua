'use client';

import { useRole } from '@/lib/auth/user-stub';
import { useIsAgencyMode } from '@/lib/workspace/workspace-stub';

import { AdminReviewsContent } from './_admin-content';
import { ClientReviewsContent } from './_client-content';
import { SubAccountReviewsContent } from './_sub-account-content';

export default function ReviewsPage() {
  const { role } = useRole();
  const isAgencyMode = useIsAgencyMode();

  if (role === 'admin') {
    return isAgencyMode ? (
      <AdminReviewsContent />
    ) : (
      <SubAccountReviewsContent />
    );
  }
  return <ClientReviewsContent />;
}
