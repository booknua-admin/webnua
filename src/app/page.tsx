'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { ROLE_LANDING, useRole } from '@/lib/auth/user-stub';

export default function RootPage() {
  const router = useRouter();
  const { role, hydrated } = useRole();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(role ? ROLE_LANDING[role] : '/login');
  }, [hydrated, role, router]);

  return (
    <div className="flex flex-1 items-center justify-center bg-paper">
      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {'// Resolving role…'}
      </div>
    </div>
  );
}
