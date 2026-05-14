'use client';

import { useRole } from '@/lib/auth/role-stub';

import { AdminReviewsContent } from './_admin-content';
import { ClientReviewsContent } from './_client-content';

export default function ReviewsPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminReviewsContent />;
  return <ClientReviewsContent />;
}
