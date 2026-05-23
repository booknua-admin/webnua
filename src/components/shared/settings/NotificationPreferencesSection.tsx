'use client';

// =============================================================================
// NotificationPreferencesSection — operator notification recipients for one
// client. Lives on the sub-account /settings/notifications surface for
// operator-role users.
//
// Phase 7 Resend session. Each row in notification_preferences is one
// recipient address with per-event flags + a digest frequency. Multiple rows
// per client = multiple recipients. The send_lead_notification handler
// reads this list when a lead lands; the operator can override the digest
// frequency to absorb very-busy clients into a single hourly summary.
// =============================================================================

import { useState } from 'react';

import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type {
  DigestFrequency,
  NotificationPreferenceRow,
} from '@/lib/integrations/resend/types';
import {
  useCreateNotificationPreference,
  useDeleteNotificationPreference,
  useNotificationPreferences,
  useTestNotification,
  useUpdateNotificationPreference,
} from '@/lib/integrations/resend/use-email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FREQUENCY_LABEL: Record<DigestFrequency, string> = {
  immediate: 'Immediate (throttled to 1/5min)',
  hourly: 'Hourly digest',
  daily: 'Daily digest (08:00 UTC)',
};

export function NotificationPreferencesSection({
  clientId,
  clientName,
}: {
  clientId: string | null;
  clientName: string;
}) {
  const prefs = useNotificationPreferences(clientId);
  const create = useCreateNotificationPreference(clientId);

  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState<DigestFrequency>('immediate');
  const [createError, setCreateError] = useState<string | null>(null);

  const canAdd = EMAIL_RE.test(email) && !create.isPending && clientId != null;

  async function handleAdd() {
    setCreateError(null);
    if (!EMAIL_RE.test(email)) {
      setCreateError('Enter a valid email address.');
      return;
    }
    try {
      await create.mutateAsync({
        operatorEmail: email.trim().toLowerCase(),
        notifyOnNewLead: true,
        notifyOnPaymentFailure: true,
        notifyOnReviewReceived: true,
        digestFrequency: frequency,
      });
      setEmail('');
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Could not add recipient.');
    }
  }

  return (
    <SettingsPanel>
      <SettingsSection
        heading={
          <>
            Notification <em>recipients</em>
          </>
        }
        description={
          <>
            <strong>People who should get notified about {clientName}.</strong>{' '}
            New leads, payment failures, and reviews fan to each recipient
            below. Use <em>Immediate</em> for one-off operators and the{' '}
            <em>Hourly digest</em> for shared inboxes that should not be
            spammed when leads come in bursts.
          </>
        }
      >
        {/* List of existing recipients */}
        <div className="mb-5 flex flex-col gap-3">
          {prefs.isLoading ? (
            <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px] text-[13px] text-ink-quiet">
              Loading recipients…
            </div>
          ) : !prefs.data || prefs.data.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-rule bg-paper px-5 py-[18px] text-[13px] text-ink-quiet">
              No notification recipients yet. Add one below.
            </div>
          ) : (
            prefs.data.map((pref) => (
              <PreferenceRow key={pref.id} clientId={clientId} preference={pref} />
            ))
          )}
        </div>

        {/* Add new recipient */}
        <div className="rounded-[10px] border border-dashed border-rule bg-paper px-5 py-[18px]">
          <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
            // Add a recipient
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_240px_auto]">
            <Input
              value={email}
              type="email"
              placeholder="ops@brand.com"
              onChange={(e) => setEmail(e.target.value)}
            />
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as DigestFrequency)}
              className="h-10 rounded-md border border-rule bg-card px-2 font-sans text-[14px] text-ink"
            >
              {(Object.keys(FREQUENCY_LABEL) as DigestFrequency[]).map((k) => (
                <option key={k} value={k}>
                  {FREQUENCY_LABEL[k]}
                </option>
              ))}
            </select>
            <Button size="sm" disabled={!canAdd} onClick={handleAdd}>
              {create.isPending ? 'Adding…' : 'Add recipient →'}
            </Button>
          </div>
          {createError ? (
            <p className="mt-2 text-[12px] text-warn">{createError}</p>
          ) : null}
        </div>
      </SettingsSection>
    </SettingsPanel>
  );
}

function PreferenceRow({
  clientId,
  preference,
}: {
  clientId: string | null;
  preference: NotificationPreferenceRow;
}) {
  const update = useUpdateNotificationPreference(clientId);
  const remove = useDeleteNotificationPreference(clientId);
  const test = useTestNotification(clientId);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  function toggle(field: 'notify_on_new_lead' | 'notify_on_payment_failure' | 'notify_on_review_received') {
    const fieldName =
      field === 'notify_on_new_lead'
        ? 'notifyOnNewLead'
        : field === 'notify_on_payment_failure'
          ? 'notifyOnPaymentFailure'
          : 'notifyOnReviewReceived';
    update.mutate({
      preferenceId: preference.id,
      [fieldName]: !preference[field],
    });
  }

  async function handleTest() {
    setTestStatus(null);
    try {
      await test.mutateAsync(preference.operator_email);
      setTestStatus('Test queued — should arrive within a few seconds.');
    } catch (error) {
      setTestStatus(error instanceof Error ? error.message : 'Test failed.');
    }
  }

  return (
    <div className="rounded-[10px] border border-rule bg-paper px-5 py-[14px]">
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[14px] font-bold text-ink">
          {preference.operator_email}
        </span>
        <select
          value={preference.digest_frequency}
          onChange={(e) =>
            update.mutate({
              preferenceId: preference.id,
              digestFrequency: e.target.value as DigestFrequency,
            })
          }
          className="h-8 rounded-md border border-rule bg-card px-2 font-sans text-[12px] text-ink"
        >
          {(Object.keys(FREQUENCY_LABEL) as DigestFrequency[]).map((k) => (
            <option key={k} value={k}>
              {FREQUENCY_LABEL[k]}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={test.isPending}
          >
            {test.isPending ? 'Sending…' : 'Test send'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm(`Remove ${preference.operator_email}?`)) {
                remove.mutate(preference.id);
              }
            }}
            className="text-warn hover:text-warn"
          >
            Remove
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-ink-quiet">
        <ToggleLine
          label="New lead"
          checked={preference.notify_on_new_lead}
          onChange={() => toggle('notify_on_new_lead')}
        />
        <ToggleLine
          label="Payment failure"
          checked={preference.notify_on_payment_failure}
          onChange={() => toggle('notify_on_payment_failure')}
        />
        <ToggleLine
          label="Review received"
          checked={preference.notify_on_review_received}
          onChange={() => toggle('notify_on_review_received')}
        />
      </div>
      {testStatus ? (
        <p className="mt-2 text-[12px] text-ink-quiet">{testStatus}</p>
      ) : null}
    </div>
  );
}

function ToggleLine({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
