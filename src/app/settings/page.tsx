'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useRole } from '@/lib/auth/user-stub';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export default function SettingsIndexPage() {
  const router = useRouter();
  const { role, hydrated } = useRole();
  const { activeClientId, hydrated: workspaceHydrated } = useWorkspace();

  useEffect(() => {
    if (!hydrated || !workspaceHydrated) return;
    if (!role) {
      router.replace('/login');
      return;
    }
    // Client → their own account. Operator → agency HQ in agency mode, the
    // drilled-in sub-account's settings in sub-account mode.
    if (role !== 'admin') {
      router.replace('/settings/profile');
      return;
    }
    router.replace(activeClientId ? '/settings/profile' : '/settings/workspace');
  }, [hydrated, workspaceHydrated, role, activeClientId, router]);

  return (
    <div className="flex flex-1 items-center justify-center px-10 py-12">
      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {'// Loading settings…'}
      </div>
    </div>
  );
}
