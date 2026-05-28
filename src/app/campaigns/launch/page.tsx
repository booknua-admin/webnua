'use client';

// =============================================================================
// /campaigns/launch — operator-only in-app Meta lead-form campaign builder.
//
// Phase 7.5 · Session 1.2. Promoted from a Dialog to a full page because
// the 5-step builder cramps a modal — the operator needs the canvas for
// the variant cards, the image upload, and the live Meta-feed-ad
// preview side-by-side. Lives at /campaigns/launch (NOT in the sidebar
// nav — reached via "+ New campaign" on /campaigns sub-account mode).
//
// Guards (page-level, defence in depth — the button hides itself when
// these aren't met but a direct URL visit needs the same protection):
//   • role === 'admin'                    — campaign creation is operator
//                                           governance; client redirects
//                                           to /campaigns
//   • activeClientId set (sub-account)    — agency mode → pick-a-client
//                                           empty state
//   • clientMetaAdAccount wired           — no row → wire-Meta-first CTA
//
// On Cancel → /campaigns. On successful launch → /campaigns + invalidate
// campaign query keys so the new campaign appears in the roster
// immediately.
// =============================================================================

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { LaunchCampaignWizard } from '@/components/admin/campaigns/LaunchCampaignWizard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { useRole } from '@/lib/auth/user-stub';
import { useClientId } from '@/lib/clients/queries';
import { useClientMetaAdAccount } from '@/lib/integrations/meta-ads/use-meta-ads';
import { useActiveClient, useWorkspace } from '@/lib/workspace/workspace-stub';

export default function LaunchCampaignPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role, hydrated } = useRole();
  const { activeClientId } = useWorkspace();
  const activeClient = useActiveClient();
  const { data: clientId } = useClientId(activeClientId);
  const adAccount = useClientMetaAdAccount(clientId ?? null);

  // Role guard — client-role users have no business on this page;
  // bounce them to /campaigns where their own view lives.
  useEffect(() => {
    if (hydrated && role === 'client') {
      router.replace('/campaigns');
    }
  }, [hydrated, role, router]);

  if (!hydrated || role === 'client') {
    return <LoadingFrame />;
  }

  const clientName = activeClient?.name ?? 'a client';

  function handleCancel() {
    router.push('/campaigns');
  }

  function handleLaunched() {
    // Invalidate every campaign query key so the new campaign appears
    // in the roster on landing. The wizard's mutation hook already
    // invalidates meta-campaigns; this picks up the cross-page keys.
    void queryClient.invalidateQueries({ queryKey: ['campaigns', 'admin'] });
    void queryClient.invalidateQueries({ queryKey: ['campaigns', 'sub-account'] });
    void queryClient.invalidateQueries({ queryKey: ['meta-campaigns'] });
    router.push('/campaigns');
  }

  // Empty states — render the page chrome (Topbar) so navigation feels
  // continuous, with an inline empty-state card explaining what's
  // missing.
  if (!activeClientId) {
    return (
      <EmptyState
        title="Pick a client first"
        body="Use the workspace picker in the sidebar to drill into one of your clients. The campaign builder runs per-client — it needs to know who the campaign is for."
        cta={{ label: 'Back to campaigns', href: '/campaigns' }}
      />
    );
  }

  if (clientId == null) {
    return <LoadingFrame trail={[clientName]} current="New campaign" />;
  }

  if (adAccount.isLoading) {
    return <LoadingFrame trail={[clientName]} current="New campaign" />;
  }

  if (!adAccount.data) {
    return (
      <EmptyState
        title="Meta isn't wired up for this client yet"
        body="The campaign builder posts to the customer's connected Meta ad account. Connect Meta on the Integrations tab + pick the ad account first, then come back."
        cta={{
          label: 'Open integrations →',
          href: '/settings/integrations',
        }}
        trail={[clientName]}
      />
    );
  }

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={[clientName, 'Campaigns']}
            current="New campaign"
          />
        }
      />
      <LaunchCampaignWizard
        clientId={clientId}
        onCancel={handleCancel}
        onLaunched={handleLaunched}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function LoadingFrame({
  trail,
  current,
}: {
  trail?: string[];
  current?: string;
}) {
  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={trail ?? ['Campaigns']}
            current={current ?? 'New campaign'}
          />
        }
      />
      <div className="flex min-h-[calc(100svh-200px)] items-center justify-center">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// Loading campaign builder…'}
        </div>
      </div>
    </>
  );
}

function EmptyState({
  title,
  body,
  cta,
  trail,
}: {
  title: string;
  body: string;
  cta: { label: string; href: string };
  trail?: string[];
}) {
  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={trail ?? ['Workspace', 'Campaigns']}
            current="New campaign"
          />
        }
      />
      <div className="flex flex-col items-center gap-4 px-4 py-16 text-center md:px-10 md:py-24">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
          {'// CAMPAIGN BUILDER'}
        </div>
        <h1 className="max-w-xl text-[24px] font-semibold tracking-tight text-ink md:text-[28px]">
          {title}
        </h1>
        <p className="max-w-md text-[14px] text-ink-soft">{body}</p>
        <Button asChild className="mt-2">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      </div>
    </>
  );
}
