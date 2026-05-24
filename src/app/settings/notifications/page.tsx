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

import { NotificationPreferencesSection } from '@/components/shared/settings/NotificationPreferencesSection';
import { QuietHoursSection } from '@/components/shared/settings/QuietHoursSection';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useNotificationPreferences } from '@/lib/integrations/resend/use-email';
import { useRole, useUser } from '@/lib/auth/user-stub';
import { useAdminClients } from '@/lib/clients/clients-store';
import { useClientId } from '@/lib/clients/queries';
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

// --- client branch (live data) ----------------------------------------------
//
// Pattern B critical-fix: the client branch used to render hardcoded
// `clientNotifications` + `clientQuietHours` stubs — no writes, no real
// state. Now mounts the SAME live data components the operator sub-account
// view uses, scoped to the signed-in client's clientId. The client owner
// holds the `publish` cap (clients_update RLS, migration 0087) so editing
// quiet hours on `clients` and managing notification recipients works.
//
// Operator's sub-account view (`OperatorContent` above) and this branch
// converge on the same component set — different auth shape, identical UI.

function ClientContent() {
  const user = useUser();
  const clients = useAdminClients();
  const client = user?.clientId
    ? clients.find((c) => c.id === user.clientId) ?? null
    : null;
  const { data: clientId } = useClientId(user?.clientId ?? null);

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Notifications" />}
      />
      <SettingsShell
        eyebrow={`${client?.name ?? 'Your account'} · notifications`}
        title={
          <>
            Your <em>notifications</em>.
          </>
        }
        subtitle={
          <>
            <strong>Quiet hours pause non-critical customer SMS</strong> during the
            window you choose. Below it: who Webnua emails on your behalf when a
            new lead lands. That recipient list is managed by your operator —
            text them if you need a change.
          </>
        }
      >
        <SettingsPanel>
          <QuietHoursSection clientId={clientId ?? null} />
        </SettingsPanel>

        <ClientNotificationRecipientsReadOnly
          clientId={clientId ?? null}
          clientName={client?.name ?? 'your business'}
        />
      </SettingsShell>
    </>
  );
}

// Read-only view of `notification_preferences` for clients. The table's RLS
// allows SELECT for any user with the client in scope, but writes are
// operator-only (route + RLS); rather than pretend clients can edit and
// ship a 403, surface it honestly as "managed by your operator".
function ClientNotificationRecipientsReadOnly({
  clientId,
  clientName,
}: {
  clientId: string | null;
  clientName: string;
}) {
  const { data: prefs, isLoading, error } = useNotificationPreferences(clientId);

  return (
    <SettingsPanel>
      <SettingsSection
        heading={
          <>
            New-lead <em>notifications</em>
          </>
        }
        description={
          <>
            Where Webnua emails new {clientName} leads.{' '}
            <strong>Recipients are managed by your operator</strong> — open a ticket
            from the sidebar if you want yourself, a teammate, or someone else added
            or removed.
          </>
        }
      >
        {isLoading ? (
          <p className="text-[13px] text-ink-quiet">Loading…</p>
        ) : error ? (
          <p className="text-[13px] text-warn">
            Could not load recipients: {error instanceof Error ? error.message : 'unknown error'}
          </p>
        ) : !prefs || prefs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-rule bg-paper px-5 py-4 text-[13px] text-ink-quiet">
            No recipients configured. Your operator hasn&rsquo;t added anyone yet —
            open a ticket and ask Craig to add your email.
          </p>
        ) : (
          <div className="flex flex-col">
            {prefs.map((pref) => {
              const events: string[] = [];
              if (pref.notify_on_new_lead) events.push('new leads');
              if (pref.notify_on_payment_failure) events.push('payment failures');
              if (pref.notify_on_review_received) events.push('reviews');
              return (
                <div
                  key={pref.id}
                  className="grid grid-cols-1 gap-1 border-b border-dotted border-paper-2 py-3 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-4"
                >
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{pref.operator_email}</div>
                    <div className="mt-0.5 text-[12px] text-ink-quiet">
                      {events.length > 0 ? events.join(' · ') : 'no events selected'}
                    </div>
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-quiet">
                    {pref.digest_frequency}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>
    </SettingsPanel>
  );
}
