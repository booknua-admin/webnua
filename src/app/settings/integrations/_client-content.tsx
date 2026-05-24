'use client';

// =============================================================================
// /settings/integrations — client-role view.
//
// Pattern B critical-fix: this used to render a hardcoded Voltline stub
// (`clientIntegrations` list with `ConnectIntegrationModal` demo flows). After
// a client moved out of `preview` lifecycle they had no path to manage their
// own integrations.
//
// Now mounts the SAME `IntegrationConnectionsSection` the operator sub-account
// view uses — real OAuth Connect / Disconnect / Reconnect for GBP + Meta Ads
// against the signed-in client's UUID. `IntegrationConnectionsSection`'s
// underlying routes already accept client-role via `requireClientAccess`
// (Phase 7 GBP UI consolidation), so no auth widening is needed.
// =============================================================================

import { IntegrationConnectionsSection } from '@/components/shared/settings/IntegrationConnectionsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useUser } from '@/lib/auth/user-stub';
import { useAdminClients } from '@/lib/clients/clients-store';

export function ClientIntegrationsContent() {
  const user = useUser();
  const clients = useAdminClients();
  const client = user?.clientId
    ? clients.find((c) => c.id === user.clientId) ?? null
    : null;

  if (!user || !client) {
    return (
      <>
        <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Integrations" />} />
        <SettingsShell
          eyebrow="Your account"
          title={
            <>
              Your <em>integrations</em>.
            </>
          }
          subtitle={<>Resolving your workspace…</>}
        >
          <div className="rounded-lg border border-dashed border-rule bg-paper px-6 py-5 text-[13px] leading-[1.55] text-ink-quiet">
            One moment — loading your integrations.
          </div>
        </SettingsShell>
      </>
    );
  }

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Integrations" />} />
      <SettingsShell
        eyebrow={`${client.name} · your account`}
        title={
          <>
            Your <em>integrations</em>.
          </>
        }
        subtitle={
          <>
            Connect Google Business Profile and Meta so Webnua can manage your
            reviews, ads, and reputation directly. <strong>Each connect takes about
            a minute</strong> — sign into your business account and grant the
            permissions the wizard asks for.
          </>
        }
      >
        <IntegrationConnectionsSection
          clientSlug={user.clientId ?? ''}
          clientName={client.name}
        />

        <div className="mt-6 flex items-start gap-3.5 rounded-xl bg-paper-2 px-[22px] py-[18px]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-base text-paper">
            ?
          </div>
          <div className="text-[13px] leading-[1.55] text-ink/70 [&_strong]:text-ink">
            <strong>Stuck on a connection?</strong> Most integrations take 30 seconds.
            If something asks for permissions you don&apos;t recognise, that&apos;s
            normal — Webnua only requests what&apos;s needed to manage your account.
            Open a ticket from the sidebar and your operator will walk you through it.
          </div>
        </div>
      </SettingsShell>
    </>
  );
}
