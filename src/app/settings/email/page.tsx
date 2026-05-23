'use client';

// =============================================================================
// /settings/email — per-client email sender provisioning (sub-account mode).
//
// Phase 7 Resend session. Operator-facing, sub-account only — mirrors
// /settings/sms but for the Resend integration. One section: the sender
// slug + display name + status pause/resume.
//
// Template editing for the customer-facing emails (lead_followup,
// review_request, quote_followup) is deferred — those bodies are seeded
// per-client by migration 0062 and currently edited only via direct DB
// access; a future Automations editor will surface them. The default
// templates are kept in lockstep with src/lib/email/default-templates.ts.
// =============================================================================

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { EmailSenderSection } from '@/components/shared/settings/EmailSenderSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useRole } from '@/lib/auth/user-stub';
import { useClientId } from '@/lib/clients/queries';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

const SENDING_DOMAIN = 'mail.webnua.com';

export default function SettingsEmailPage() {
  const router = useRouter();
  const { role, hydrated } = useRole();
  const { activeClient, hydrated: workspaceHydrated } = useWorkspace();

  useEffect(() => {
    if (hydrated && role && role !== 'admin') {
      router.replace('/settings');
    }
  }, [hydrated, role, router]);

  if (!hydrated || !workspaceHydrated || !role) return <Resolving />;
  if (role !== 'admin' || !activeClient) return <Resolving />;
  return (
    <EmailSettingsContent clientSlug={activeClient.id} clientName={activeClient.name} />
  );
}

function Resolving() {
  return (
    <div className="flex flex-1 items-center justify-center px-10 py-12">
      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {'// Loading email settings…'}
      </div>
    </div>
  );
}

function EmailSettingsContent({
  clientSlug,
  clientName,
}: {
  clientSlug: string;
  clientName: string;
}) {
  const { data: clientId } = useClientId(clientSlug);

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Email" />} />
      <SettingsShell
        eyebrow={`Sub-account · ${clientName}`}
        title={
          <>
            Email for <em>{clientName}</em>.
          </>
        }
        subtitle={
          <>
            <strong>The address customers see and the inbox replies route to.</strong>{' '}
            Outbound emails go out under your sender slug; replies route back to the
            Webnua inbox so the full conversation lives in one place.
          </>
        }
      >
        <EmailSenderSection
          clientId={clientId ?? null}
          clientName={clientName}
          sendingDomain={SENDING_DOMAIN}
        />
      </SettingsShell>
    </>
  );
}
