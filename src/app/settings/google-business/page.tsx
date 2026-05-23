'use client';

// =============================================================================
// /settings/google-business — the per-client GBP operational surface
// (sub-account mode).
//
// Phase 7 GBP. Operator-only, sub-account only — the operator has drilled
// into one client. Three stacked sections:
//   1. GbpLocationSection — which Google listing is connected.
//   2. GbpReviewsSection — pulled reviews with inline reply UI.
//   3. GbpReviewRequestsSection — review-request audit log + manual send.
//
// OAuth connection itself stays on /settings/integrations — this surface
// is the operational layer that sits on top of an active connection.
//
// Agency mode is bounced to /settings by the settings layout guard; a
// client-role user has no GBP tab in their nav and is redirected here if
// they reach the URL directly.
// =============================================================================

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { GbpLocationSection } from '@/components/shared/settings/GbpLocationSection';
import { GbpReviewsSection } from '@/components/shared/settings/GbpReviewsSection';
import { GbpReviewRequestsSection } from '@/components/shared/settings/GbpReviewRequestsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useRole } from '@/lib/auth/user-stub';
import { useClientId } from '@/lib/clients/queries';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export default function SettingsGoogleBusinessPage() {
  const router = useRouter();
  const { role, hydrated } = useRole();
  const { activeClient, hydrated: workspaceHydrated } = useWorkspace();

  useEffect(() => {
    if (hydrated && role && role !== 'admin') {
      router.replace('/settings');
    }
  }, [hydrated, role, router]);

  if (!hydrated || !workspaceHydrated || !role) {
    return <Resolving />;
  }
  if (role !== 'admin' || !activeClient) {
    return <Resolving />;
  }

  return <Content clientSlug={activeClient.id} clientName={activeClient.name} />;
}

function Resolving() {
  return (
    <div className="flex flex-1 items-center justify-center px-10 py-12">
      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {'// Loading Google Business…'}
      </div>
    </div>
  );
}

function Content({
  clientSlug,
  clientName,
}: {
  clientSlug: string;
  clientName: string;
}) {
  const { data: clientId } = useClientId(clientSlug);

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Google Business" />}
      />
      <SettingsShell
        eyebrow={`Sub-account · ${clientName}`}
        title={
          <>
            Google Business for <em>{clientName}</em>.
          </>
        }
        subtitle={
          <>
            <strong>Reviews, replies, and review-request automation.</strong>{' '}
            Connect Google Business Profile on the Integrations tab first; pick
            a location here to start syncing reviews.
          </>
        }
      >
        <div className="flex flex-col gap-7">
          <GbpLocationSection clientId={clientId ?? null} clientName={clientName} />
          <GbpReviewsSection clientId={clientId ?? null} />
          <GbpReviewRequestsSection clientId={clientId ?? null} />
        </div>
      </SettingsShell>
    </>
  );
}
