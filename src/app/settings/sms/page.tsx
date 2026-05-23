'use client';

// =============================================================================
// /settings/sms — the per-client SMS sender provisioning surface
// (sub-account mode).
//
// Phase 7 Twilio SMS session. Operator-facing, sub-account only — the operator
// has drilled into one client. Single section: the alphanumeric sender
// provisioning panel.
//
// SMS template editing lives with the Automations feature (not yet fully
// built) — the message bodies are tied to the automations that fire them, so
// managing them in isolation here would be misleading. The four per-client
// templates are still seeded by migration 0060 so the send_sms job has a body
// to render; an operator-facing editor surfaces once Automations is wired.
//
// Agency mode is bounced to /settings by the settings layout guard
// (/settings/sms is in its SUB_ACCOUNT_ONLY list); a client-role user has no
// SMS tab in their nav and is redirected here if they reach the URL directly.
// =============================================================================

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { SmsSenderSection } from '@/components/shared/settings/SmsSenderSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useRole } from '@/lib/auth/user-stub';
import { useClientId } from '@/lib/clients/queries';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export default function SettingsSmsPage() {
  const router = useRouter();
  const { role, hydrated } = useRole();
  const { activeClient, hydrated: workspaceHydrated } = useWorkspace();

  // A client-role user has no SMS settings tab — send them to their settings.
  useEffect(() => {
    if (hydrated && role && role !== 'admin') {
      router.replace('/settings');
    }
  }, [hydrated, role, router]);

  if (!hydrated || !workspaceHydrated || !role) {
    return <Resolving />;
  }
  if (role !== 'admin' || !activeClient) {
    // Wrong role / agency mode — a redirect is in flight (here or the layout).
    return <Resolving />;
  }

  return <SmsSettingsContent clientSlug={activeClient.id} clientName={activeClient.name} />;
}

function Resolving() {
  return (
    <div className="flex flex-1 items-center justify-center px-10 py-12">
      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {'// Loading SMS settings…'}
      </div>
    </div>
  );
}

// --- content -----------------------------------------------------------------

function SmsSettingsContent({
  clientSlug,
  clientName,
}: {
  clientSlug: string;
  clientName: string;
}) {
  const { data: clientId } = useClientId(clientSlug);

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="SMS" />} />
      <SettingsShell
        eyebrow={`Sub-account · ${clientName}`}
        title={
          <>
            SMS for <em>{clientName}</em>.
          </>
        }
        subtitle={
          <>
            <strong>The alphanumeric sender id customers see</strong> when {clientName} sends a
            transactional text. Message bodies live with the automations that fire them — manage
            them from the Automations feature.
          </>
        }
      >
        <SmsSenderSection clientId={clientId ?? null} clientName={clientName} />
      </SettingsShell>
    </>
  );
}
