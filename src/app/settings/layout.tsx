'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { ClientSidebar } from '@/components/client/ClientSidebar';
import { AppShell } from '@/components/shared/AppShell';
import { useRole } from '@/lib/auth/user-stub';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

// =============================================================================
// /settings layout — role + workspace-mode dispatch + direct-URL guard.
//
// Three guard categories per route:
//
//   AGENCY_ONLY        — operator-only tabs that exist on adminSettingsNav
//                        (workspace, plans, defaults, seat limit, API &
//                        services, platform templates). Reached only by
//                        operators in agency mode. A client direct-URL-ing
//                        any of these is bounced to /settings.
//
//   SUB_ACCOUNT_ONLY   — operator-only tabs that exist on
//                        subAccountSettingsNav but NOT on clientSettingsNav
//                        (access, email, sms, danger zone). An operator
//                        with no client picked is bounced to /settings; a
//                        client direct-URL-ing is also bounced.
//
//   (universal)        — every other /settings/* path. Both operators and
//                        clients see them (each their own per-role body):
//                        integrations, domains, profile, team, notifications,
//                        billing, security, help, brand.
//
// Clients are bounced by AGENCY_ONLY + SUB_ACCOUNT_ONLY both. Pattern B
// critical fixes · Session 2 added the client-side branch — previously
// the guard only redirected operators. The redirect target is /settings
// (the index page itself dispatches to a role/mode-appropriate landing).
// =============================================================================

const AGENCY_ONLY = [
  '/settings/workspace',
  '/settings/plans',
  '/settings/defaults',
  '/settings/seats',
  '/settings/api',
  '/settings/platform-templates',
];

const SUB_ACCOUNT_ONLY = [
  '/settings/email',
  '/settings/sms',
];

// Routes operators can reach (sub-account or agency) but clients should
// not see — separated out because the AGENCY_ONLY / SUB_ACCOUNT_ONLY split
// is about WHICH operator mode lands you there; for clients the split
// doesn't matter, both buckets are off-limits PLUS these governance routes.
const OPERATOR_ONLY = [
  '/settings/access', // capability grants — managed by the operator on behalf
  '/settings/danger', // workspace destruction — operator concern
];

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

    // Client-role users: bounce off any operator-only surface. Sub-account
    // mode doesn't apply to clients (they don't have a picker); every
    // operator-mode tab is out-of-scope for them.
    if (role === 'client') {
      if (
        matches(pathname, AGENCY_ONLY) ||
        matches(pathname, SUB_ACCOUNT_ONLY) ||
        matches(pathname, OPERATOR_ONLY)
      ) {
        router.replace('/settings');
      }
      return;
    }

    // Operator dispatch — needs workspace mode to be hydrated.
    if (!workspaceHydrated) return;
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
    </>
  );
}
