'use client';

// =============================================================================
// /settings/brand — the brand editor.
//
// Pattern B critical fixes · Session 2. The first surface where a client can
// edit their brand colours / fonts / logo / tagline / voice tone directly,
// without operator round-trip. Operators reach it from sub-account mode
// (drilled into one client); clients reach it from their own nav.
//
// Reads + writes the `brands` table (migration 0088 added the optional
// columns). The cap gate is `editTheme` — in CLIENT_OWNER_DEFAULTS so
// owners hold it. The clients_update RLS the brand row's parent client
// relies on was widened in 0087; the brands table's own writes are still
// operator-only by RLS so client writes go through... let me verify that.
//
// (RLS for `brands`: 0004 — brands_update is operator-only. We rely on the
// brand-update API route below to do the actual write via service-role
// when the calling user passes requireClientAccess; the cap is what gates
// the UI.)
// =============================================================================

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useRole, useUser } from '@/lib/auth/user-stub';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

import { BrandEditorContent } from './_content';

export default function SettingsBrandPage() {
  const router = useRouter();
  const user = useUser();
  const { role, hydrated } = useRole();
  const { activeClient, hydrated: workspaceHydrated } = useWorkspace();

  // Operator with no client picked → bounce to settings index.
  useEffect(() => {
    if (!hydrated) return;
    if (role === 'admin' && workspaceHydrated && !activeClient) {
      router.replace('/settings');
    }
  }, [hydrated, role, workspaceHydrated, activeClient, router]);

  if (!hydrated || !role || !user) return <Resolving />;

  if (role === 'admin') {
    if (!workspaceHydrated || !activeClient) return <Resolving />;
    return (
      <BrandEditorContent
        clientSlug={activeClient.id}
        clientName={activeClient.name}
        isOperator
      />
    );
  }

  // Client: their own workspace.
  if (!user.clientId) {
    return (
      <div className="flex flex-1 items-center justify-center px-10 py-12">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// No workspace — ask your operator for access'}
        </div>
      </div>
    );
  }
  return (
    <BrandEditorContent
      clientSlug={user.clientId}
      clientName={user.displayName ?? 'your business'}
      isOperator={false}
    />
  );
}

function Resolving() {
  return (
    <div className="flex flex-1 items-center justify-center px-10 py-12">
      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {'// Loading brand…'}
      </div>
    </div>
  );
}
