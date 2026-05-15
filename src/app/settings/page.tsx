'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useRole } from '@/lib/auth/user-stub';

export default function SettingsIndexPage() {
  const router = useRouter();
  const { role, hydrated } = useRole();

  useEffect(() => {
    if (!hydrated) return;
    if (!role) {
      router.replace('/login');
      return;
    }
    router.replace(role === 'admin' ? '/settings/workspace' : '/settings/profile');
  }, [hydrated, role, router]);

  return (
    <div className="flex flex-1 items-center justify-center px-10 py-12">
      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {'// Loading settings…'}
      </div>
    </div>
  );
}
