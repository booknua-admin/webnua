'use client';

// =============================================================================
// /settings/sms — the per-client SMS settings surface (sub-account mode).
//
// Phase 7 Twilio SMS session. Operator-facing, sub-account only — the operator
// has drilled into one client. Two sections: the alphanumeric sender
// provisioning panel, and the four editable SMS templates.
//
// Agency mode is bounced to /settings by the settings layout guard
// (/settings/sms is in its SUB_ACCOUNT_ONLY list); a client-role user has no
// SMS tab in their nav and is redirected here if they reach the URL directly.
// =============================================================================

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { SmsSenderSection } from '@/components/shared/settings/SmsSenderSection';
import { SmsTemplateEditor } from '@/components/shared/settings/SmsTemplateEditor';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useRole } from '@/lib/auth/user-stub';
import { useClientId } from '@/lib/clients/queries';
import { DEFAULT_SMS_TEMPLATES, SMS_TEMPLATE_KEYS } from '@/lib/sms/default-templates';
import { useClientSmsTemplates } from '@/lib/integrations/twilio/use-sms';
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
            <strong>One-way transactional texts.</strong> The sender id customers see, and the
            message templates Webnua sends on {clientName}&apos;s behalf — lead acknowledgments,
            confirmations, arrival notices and review requests.
          </>
        }
      >
        <div className="flex flex-col gap-7">
          <SmsSenderSection clientId={clientId ?? null} clientName={clientName} />
          <TemplatesPanel clientId={clientId ?? null} />
        </div>
      </SettingsShell>
    </>
  );
}

// --- templates panel ---------------------------------------------------------

function TemplatesPanel({ clientId }: { clientId: string | null }) {
  const templates = useClientSmsTemplates(clientId);

  if (templates.isLoading || clientId == null) {
    return (
      <div className="rounded-xl border border-rule bg-card px-6 py-5 text-[13px] text-ink-quiet">
        Loading templates…
      </div>
    );
  }
  if (templates.isError) {
    return (
      <div className="rounded-xl border border-rule bg-card px-6 py-5 text-[13px] text-warn">
        Could not load the SMS templates. Refresh to try again.
      </div>
    );
  }

  const rows = templates.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[16px] font-bold text-ink">Message templates</h2>
        <p className="mt-0.5 text-[13px] leading-[1.5] text-ink-quiet">
          Edit the body of each transactional SMS. Variables like{' '}
          <span className="font-mono text-[12px]">{'{{lead.firstName}}'}</span> are filled in at
          send time.
        </p>
      </div>
      {SMS_TEMPLATE_KEYS.map((key) => {
        const row = rows.find((r) => r.template_key === key);
        return (
          <SmsTemplateEditor
            key={key}
            clientId={clientId}
            templateKey={key}
            body={row?.body ?? DEFAULT_SMS_TEMPLATES[key]}
            isDefault={row?.is_default ?? true}
            lastEditedAt={row?.last_edited_at ?? null}
          />
        );
      })}
    </div>
  );
}
