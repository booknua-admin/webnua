'use client';

// =============================================================================
// EmailSenderSection — per-client email sender provisioning panel on the
// sub-account /settings/email surface.
//
// Phase 7 Resend session. Operator-facing. Each client gets ONE sender slug
// (lowercase letters / digits / hyphens, ≤30 chars) that forms the
// local-part of the sending address `{slug}@{EMAIL_SENDING_DOMAIN}`. The
// display name is the human label in the From header.
//
// No sender yet → an input + submit (slug + display name).
// A sender exists → its address + status, with a pause / resume affordance.
// =============================================================================

import { useState } from 'react';

import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { EmailSenderStatus } from '@/lib/integrations/resend/types';
import {
  useClientEmailSender,
  useRegisterEmailSender,
  useUpdateEmailSender,
} from '@/lib/integrations/resend/use-email';

const SLUG_RE = /^[a-z0-9-]{1,30}$/;

const STATUS_DISPLAY: Record<EmailSenderStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-good/12 text-good' },
  suspended: { label: 'Suspended', className: 'bg-warn/12 text-warn' },
};

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'brand';
}

function slugProblem(value: string): string | null {
  if (value.length === 0) return null;
  if (!SLUG_RE.test(value)) {
    return 'Use 1–30 lowercase letters, digits, or hyphens.';
  }
  return null;
}

export function EmailSenderSection({
  clientId,
  clientName,
  sendingDomain,
}: {
  clientId: string | null;
  clientName: string;
  sendingDomain: string;
}) {
  const sender = useClientEmailSender(clientId);
  const register = useRegisterEmailSender(clientId);
  const update = useUpdateEmailSender(clientId);

  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState(clientName);
  const problem = slugProblem(slug);
  const canSubmit =
    slug.length > 0 && problem === null && !register.isPending && clientId != null;

  const row = sender.data ?? null;

  return (
    <SettingsPanel>
      <SettingsSection
        heading={
          <>
            Email <em>sender</em>
          </>
        }
        description={
          <>
            <strong>
              The address customers see when {clientName} sends an email
            </strong>{' '}
            — the slug here becomes the local-part of{' '}
            <code className="font-mono text-[12px] text-ink">
              {`{slug}@${sendingDomain}`}
            </code>
            . Replies from this address route back to the Webnua inbox so the
            full conversation lives in one place.
          </>
        }
      >
        {sender.isLoading ? (
          <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px] text-[13px] text-ink-quiet">
            Loading sender…
          </div>
        ) : row ? (
          <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px]">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-[16px] font-bold tracking-[0.02em] text-ink">
                {`${row.slug}@${sendingDomain}`}
              </span>
              <StatusPill status={row.status} />
            </div>
            <p className="mb-3 text-[12px] leading-[1.5] text-ink-quiet">
              {row.status === 'active'
                ? `From-name: "${row.display_name}". This sender is active and in use on outbound emails.`
                : `From-name: "${row.display_name}". This sender is suspended — no emails will send until it is reactivated.`}
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    status: row.status === 'active' ? 'suspended' : 'active',
                  })
                }
              >
                {update.isPending
                  ? 'Updating…'
                  : row.status === 'active'
                    ? 'Suspend sending'
                    : 'Resume sending'}
              </Button>
            </div>
            {update.isError ? (
              <p className="mt-2 text-[12px] text-warn">{errorText(update.error)}</p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[10px] border border-dashed border-rule bg-paper px-5 py-[18px]">
            <p className="mb-3 text-[13px] leading-[1.5] text-ink-quiet">
              {`${clientName} has no email sender yet. Pick a slug (becomes the local-part of the address) and a display name (the From-name).`}
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="flex flex-col gap-2.5">
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
                    Slug
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      value={slug}
                      maxLength={30}
                      placeholder={slugFromName(clientName)}
                      aria-invalid={problem !== null}
                      onChange={(e) => setSlug(e.target.value.toLowerCase())}
                      className="w-[220px] font-mono"
                    />
                    <span className="font-mono text-[12px] text-ink-quiet">
                      {`@${sendingDomain}`}
                    </span>
                  </div>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
                    Display name
                  </span>
                  <Input
                    value={displayName}
                    maxLength={80}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-[260px]"
                  />
                </label>
              </div>
              <Button
                size="sm"
                disabled={!canSubmit}
                className="self-end"
                onClick={() =>
                  register.mutate({
                    slug: slug.trim().toLowerCase(),
                    displayName: displayName.trim() || clientName,
                  })
                }
              >
                {register.isPending ? 'Submitting…' : 'Provision sender →'}
              </Button>
            </div>
            {problem ? <p className="mt-2 text-[12px] text-warn">{problem}</p> : null}
            {register.isError ? (
              <p className="mt-2 text-[12px] text-warn">{errorText(register.error)}</p>
            ) : null}
            <p className="mt-3 text-[12px] leading-[1.5] text-ink-quiet">
              The sending domain ({sendingDomain}) is configured platform-wide —
              DKIM / SPF / DMARC live on the Resend account.
            </p>
          </div>
        )}
      </SettingsSection>
    </SettingsPanel>
  );
}

function StatusPill({ status }: { status: EmailSenderStatus }) {
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
