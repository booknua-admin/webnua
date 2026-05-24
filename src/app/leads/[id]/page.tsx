'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { useRole } from '@/lib/auth/user-stub';

import { AdminLeadDetailContent } from './_admin-content';
import { ClientLeadDetailContent } from './_client-content';

export default function LeadDetailPage() {
  const { role } = useRole();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Cold-lead deep-link: `/leads/[id]?compose=true` redirects to the
  // conversation view (where the composer lives) with the same flag, so
  // the composer mounts focused. Phase 8 · Session 3 · Item 4.
  useEffect(() => {
    if (searchParams.get('compose') !== 'true') return;
    const id = params.id;
    if (!id) return;
    router.replace(`/leads/${id}/conversation?compose=true`);
  }, [params.id, router, searchParams]);

  if (role === 'admin') return <AdminLeadDetailContent />;
  return <ClientLeadDetailContent />;
}
