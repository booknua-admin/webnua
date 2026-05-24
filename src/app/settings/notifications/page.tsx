'use client';

// =============================================================================
// /settings/notifications — role-dispatched.
//
// Client-role users see their per-channel notification preferences (the
// existing stub — Voltline-themed channel toggles + quiet hours).
//
// Operator-role users see per-client notification RECIPIENTS — the
// NotificationPreferencesSection from Phase 7 Resend: add / edit / remove
// the operator addresses that receive new-lead emails for this client,
// with per-event flags and digest frequency.
//
// The settings layout already restricts this path to sub-account mode for
// operators, so the operator branch always has an active client.
// =============================================================================

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { NotificationRow } from '@/components/shared/settings/NotificationRow';
import { NotificationPreferencesSection } from '@/components/shared/settings/NotificationPreferencesSection';
import { QuietHoursSection } from '@/components/shared/settings/QuietHoursSection';
import { SettingsFieldRow } from '@/components/shared/settings/SettingsFieldRow';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Switch } from '@/components/ui/switch';
import { Eyebrow } from '@/components/ui/eyebrow';
import { useRole } from '@/lib/auth/user-stub';
import { useClientId } from '@/lib/clients/queries';
import { clientNotifications, clientQuietHours } from '@/lib/settings/client-notifications';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export default function SettingsNotificationsPage() {
  const router = useRouter();
  const { role, hydrated } = useRole();
  const { activeClient, hydrated: workspaceHydrated } = useWorkspace();

  // The settings layout already redirects operators in agency mode. A
  // client-role user reaches this page through their own nav (no active
  // client switch needed).
  useEffect(() => {
    if (hydrated && role === 'admin' && workspaceHydrated && !activeClient) {
      router.replace('/settings');
    }
  }, [hydrated, role, workspaceHydrated, activeClient, router]);

  if (!hydrated || !role) return <Resolving />;

  if (role === 'admin') {
    if (!workspaceHydrated || !activeClient) return <Resolving />;
    return (
      <OperatorContent clientSlug={activeClient.id} clientName={activeClient.name} />
    );
  }
  return <ClientContent />;
}

function Resolving() {
  return (
    <div className="flex flex-1 items-center justify-center px-10 py-12">
      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {'// Loading notifications…'}
      </div>
    </div>
  );
}

// --- operator branch ---------------------------------------------------------

function OperatorContent({
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
        breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Notifications" />}
      />
      <SettingsShell
        eyebrow={`Sub-account · ${clientName}`}
        title={
          <>
            Who hears about <em>{clientName}</em>.
          </>
        }
        subtitle={
          <>
            <strong>Per-client notification recipients.</strong> Add operator addresses
            that should receive new-lead emails, payment-failure alerts, and review
            pings. Each recipient can be set to immediate (with anti-spam throttle) or
            digested.
          </>
        }
      >
        <NotificationPreferencesSection
          clientId={clientId ?? null}
          clientName={clientName}
        />

        <SettingsPanel>
          <QuietHoursSection clientId={clientId ?? null} />
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}

// --- client branch (existing stub copy) --------------------------------------

function ClientContent() {
  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Notifications" />}
      />
      <SettingsShell
        eyebrow="Your account"
        title={
          <>
            Your <em>settings</em>.
          </>
        }
        subtitle={
          <>
            When and how Webnua tells you about leads, bookings, reviews, and alerts.{' '}
            <strong>SMS hits fast, email is good for end-of-day.</strong>
          </>
        }
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Notification <em>preferences</em>
              </>
            }
            description={
              <>
                Toggle the channels for each notification type.{' '}
                <strong>Critical alerts (negative reviews, missed bookings)</strong> are
                always sent via SMS regardless of these settings.
              </>
            }
          >
            <div className="flex flex-col gap-5">
              {clientNotifications.map((group) => (
                <div key={group.label}>
                  <Eyebrow tone="quiet" className="mb-1.5 block text-[10px]">
                    {`// ${group.label.toUpperCase()}`}
                  </Eyebrow>
                  {group.rows.map((row) => (
                    <NotificationRow
                      key={row.label}
                      label={row.label}
                      sub={row.sub}
                      channels={group.channels}
                      active={row.active}
                    />
                  ))}
                </div>
              ))}
            </div>
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Quiet <em>hours</em>
              </>
            }
            description={
              <>
                Pause non-critical SMS during these times.{' '}
                <strong>Critical alerts still come through</strong> regardless.
              </>
            }
          >
            <SettingsFieldRow
              label="Enabled"
              sub="Quiet hours active"
              value={
                <span className="flex items-center gap-2.5">
                  <Switch defaultChecked={clientQuietHours.enabled} />
                  <span>{clientQuietHours.window}</span>
                </span>
              }
              action={
                <span className="cursor-pointer font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-rust hover:text-rust-deep">
                  Edit ✎
                </span>
              }
            />
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
