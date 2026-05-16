'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { ClientSidebar } from '@/components/client/ClientSidebar';
import { AppShell } from '@/components/shared/AppShell';
import { DevRoleSwitcher } from '@/components/shared/DevRoleSwitcher';
import { useRole } from '@/lib/auth/user-stub';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

// Tabs that exist in exactly one workspace mode. An operator who reaches a
// wrong-mode tab by URL is bounced to the settings index, which redirects to
// a mode-appropriate landing tab. The settings nav itself never lists a
// wrong-mode tab — this only guards direct navigation.
const AGENCY_ONLY = [
  '/settings/workspace',
  '/settings/plans',
  '/settings/defaults',
  '/settings/integration-defaults',
  '/settings/seats',
  '/settings/api',
];
const SUB_ACCOUNT_ONLY = ['/settings/profile', '/settings/notifications'];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, hydrated } = useRole();
  const { activeClientId, hydrated: workspaceHydrated } = useWorkspace();

  useEffect(() => {
    if (!hydrated) return;
    if (!role) {
      router.replace('/login');
      return;
    }
    if (role !== 'admin' || !workspaceHydrated) return;
    const agencyMode = activeClientId === null;
    if (agencyMode && matches(pathname, SUB_ACCOUNT_ONLY)) {
      router.replace('/settings');
    } else if (!agencyMode && matches(pathname, AGENCY_ONLY)) {
      router.replace('/settings');
    }
  }, [hydrated, role, workspaceHydrated, activeClientId, pathname, router]);

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
