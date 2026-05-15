'use client';

// =============================================================================
// /funnels layout — shared between client + admin (Session 7).
//
// Same pattern as `/website/`: a `'use client'` layout reads useRole(), picks
// the correct sidebar, and mounts the dev switcher. Until the page itself
// resolves a workspace, layout stays neutral.
// =============================================================================

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { ClientSidebar } from '@/components/client/ClientSidebar';
import { AppShell } from '@/components/shared/AppShell';
import { DevRoleSwitcher } from '@/components/shared/DevRoleSwitcher';
import { useRole } from '@/lib/auth/user-stub';

export default function FunnelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { role, hydrated } = useRole();

  useEffect(() => {
    if (hydrated && !role) router.replace('/login');
  }, [hydrated, role, router]);

  if (!hydrated || !role) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-paper">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// Resolving role…'}
        </div>
      </div>
    );
  }

  return (
    <>
      <AppShell sidebar={role === 'admin' ? <AdminSidebar /> : <ClientSidebar />}>
        {children}
      </AppShell>
      <DevRoleSwitcher />
    </>
  );
}
