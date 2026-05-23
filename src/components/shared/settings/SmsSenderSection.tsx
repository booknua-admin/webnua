'use client';

// =============================================================================
// SmsSenderSection — the alphanumeric SMS sender provisioning panel on the
// sub-account /settings/sms surface.
//
// Phase 7 Twilio SMS session. Operator-facing. Each client gets ONE
// alphanumeric sender id (their brand name, max 11 characters) that appears as
// the "From" on every outbound SMS. Alphanumeric senders are one-way — the
// recipient cannot reply.
//
// No sender yet → an input + submit (1–11 letters/digits, at least one
// letter). A sender exists → its id + carrier-registration status, with a
// "Refresh status" affordance that polls Twilio for a pending registration.
// =============================================================================

import { useState } from 'react';

import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SmsSenderStatus } from '@/lib/integrations/twilio/types';
import {
  useClientSmsSender,
  useRefreshSmsSender,
  useRegisterSmsSender,
} from '@/lib/integrations/twilio/use-sms';

const STATUS_DISPLAY: Record<SmsSenderStatus, { label: string; className: string }> = {
  pending_approval: { label: 'Pending approval', className: 'bg-warn/12 text-warn' },
  approved: { label: 'Approved', className: 'bg-good/12 text-good' },
  rejected: { label: 'Rejected', className: 'bg-warn/12 text-warn' },
  suspended: { label: 'Suspended', className: 'bg-ink/[0.06] text-ink-quiet' },
};

const SENDER_ID_RE = /^[A-Za-z0-9]{1,11}$/;

/** A suggested sender id derived from the client name — strip non-alphanumeric
 *  characters and truncate to the 11-char limit. Just a placeholder hint; the
 *  operator types the real sender id. */
function senderIdFromName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 11);
  return cleaned || 'Brand';
}

function senderIdProblem(value: string): string | null {
  if (value.length === 0) return null;
  if (!SENDER_ID_RE.test(value)) return 'Use 1–11 letters and digits only — no spaces.';
  if (!/[A-Za-z]/.test(value)) return 'Must contain at least one letter.';
  return null;
}

export function SmsSenderSection({
  clientId,
  clientName,
}: {
  clientId: string | null;
  clientName: string;
}) {
  const sender = useClientSmsSender(clientId);
  const register = useRegisterSmsSender(clientId);
  const refresh = useRefreshSmsSender(clientId);

  const [draft, setDraft] = useState('');
  const problem = senderIdProblem(draft);
  const canSubmit = draft.length > 0 && problem === null && !register.isPending && clientId != null;

  const row = sender.data ?? null;

  return (
    <SettingsPanel>
      <SettingsSection
        heading={
          <>
            SMS <em>sender</em>
          </>
        }
        description={
          <>
            <strong>
              The name that appears as the &ldquo;From&rdquo; on {clientName}&apos;s texts.
            </strong>{' '}
            An alphanumeric sender id — up to 11 letters/digits, no spaces. These are one-way;
            customers cannot reply to them.
          </>
        }
      >
        {sender.isLoading ? (
          <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px] text-[13px] text-ink-quiet">
            Loading sender…
          </div>
        ) : row ? (
          <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px]">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="font-mono text-[18px] font-bold tracking-[0.04em] text-ink">
                {row.sender_id}
              </span>
              <StatusPill status={row.status} />
            </div>
            <p className="text-[12px] leading-[1.5] text-ink-quiet">
              {row.status === 'approved'
                ? 'This sender id is approved and in use on outbound SMS.'
                : row.status === 'pending_approval'
                  ? 'Registered with Twilio. Carrier approval of an alphanumeric sender typically takes 1–3 business days in countries that require registration — refresh to check.'
                  : row.status === 'rejected'
                    ? 'The carrier rejected this sender id. Contact Twilio support, or register a different id.'
                    : 'This sender id is suspended — no SMS will send until it is restored.'}
            </p>
            {row.status !== 'approved' ? (
              <div className="mt-3 flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={refresh.isPending}
                  onClick={() => refresh.mutate()}
                >
                  {refresh.isPending ? 'Checking…' : 'Refresh status'}
                </Button>
                <span className="text-[12px] text-ink-quiet">
                  Polls Twilio for the latest state.
                </span>
              </div>
            ) : null}
            {refresh.isError ? (
              <p className="mt-2 text-[12px] text-warn">{errorText(refresh.error)}</p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[10px] border border-dashed border-rule bg-paper px-5 py-[18px]">
            <p className="mb-3 text-[13px] leading-[1.5] text-ink-quiet">
              {`${clientName} has no SMS sender id yet. Submit one to start sending — usually the business's short brand name.`}
            </p>
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-1">
                <Input
                  value={draft}
                  maxLength={11}
                  placeholder={senderIdFromName(clientName)}
                  aria-invalid={problem !== null}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-[200px] font-mono"
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
                  {draft.length}/11
                </span>
              </div>
              <Button size="sm" disabled={!canSubmit} onClick={() => register.mutate(draft.trim())}>
                {register.isPending ? 'Submitting…' : 'Submit for approval →'}
              </Button>
            </div>
            {problem ? <p className="mt-2 text-[12px] text-warn">{problem}</p> : null}
            {register.isError ? (
              <p className="mt-2 text-[12px] text-warn">{errorText(register.error)}</p>
            ) : null}
            <p className="mt-3 text-[12px] leading-[1.5] text-ink-quiet">
              Approval of an alphanumeric sender typically takes 1–3 business days in countries that
              require carrier registration.
            </p>
          </div>
        )}
      </SettingsSection>
    </SettingsPanel>
  );
}

function StatusPill({ status }: { status: SmsSenderStatus }) {
  const { label, className } = STATUS_DISPLAY[status];
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${className}`}
    >
      {label}
    </span>
  );
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
