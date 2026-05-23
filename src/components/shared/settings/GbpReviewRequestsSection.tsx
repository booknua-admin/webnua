'use client';

// =============================================================================
// GbpReviewRequestsSection — review-request log + manual send modal.
//
// Lives below GbpReviewsSection on /settings/google-business. Two parts:
//
//   • A "+ Send review request" button that opens an inline form modal.
//   • A reverse-chronological table of past requests with status + the
//     "did this lead to a review" attribution (linked to the review when
//     the sync job matched it).
//
// The automatic booking-completion trigger does most of the work — this
// surface is the manual override for off-platform jobs or re-sends.
// =============================================================================

import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GbpReviewRequestRow } from '@/lib/integrations/gbp/types';
import {
  useClientGbpReviewRequests,
  useSendGbpReviewRequest,
} from '@/lib/integrations/gbp/use-gbp';

const STATUS_DISPLAY: Record<GbpReviewRequestRow['status'], { label: string; className: string }> = {
  queued: { label: 'Queued', className: 'bg-info/12 text-info' },
  sent: { label: 'Sent', className: 'bg-good/12 text-good' },
  delivered: { label: 'Delivered', className: 'bg-good/12 text-good' },
  failed: { label: 'Failed', className: 'bg-warn/12 text-warn' },
};

const PHONE_RE = /^[+0-9\s()-]{6,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function GbpReviewRequestsSection({ clientId }: { clientId: string | null }) {
  const requests = useClientGbpReviewRequests(clientId);
  const [open, setOpen] = useState(false);

  const rows = requests.data ?? [];

  return (
    <SettingsPanel>
      <SettingsSection
        heading={
          <>
            Review <em>requests</em>
          </>
        }
        description={
          <>
            <strong>Automatic on job completion.</strong> Two hours after a
            booking moves to &ldquo;completed&rdquo;, Webnua texts (or emails)
            the customer with the review link. Use the manual send for jobs
            that weren&apos;t tracked here.
          </>
        }
      >
        <div className="mb-3 flex justify-end">
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            disabled={!clientId}
          >
            + Send review request
          </Button>
        </div>

        {requests.isLoading ? (
          <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px] text-[13px] text-ink-quiet">
            Loading requests…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-rule bg-paper px-5 py-6 text-center text-[13px] text-ink-quiet">
            No review requests sent yet. As bookings complete, they&apos;ll
            queue here automatically.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[10px] border border-rule">
            <table className="w-full text-[13px]">
              <thead className="border-b border-rule bg-paper-2 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
                <tr>
                  <th className="px-3.5 py-2 text-left">When</th>
                  <th className="px-3.5 py-2 text-left">Recipient</th>
                  <th className="px-3.5 py-2 text-left">Channel</th>
                  <th className="px-3.5 py-2 text-left">Status</th>
                  <th className="px-3.5 py-2 text-left">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <RequestRow
                    key={row.id}
                    row={row}
                    isLast={idx === rows.length - 1}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ManualSendModal
          open={open}
          onOpenChange={setOpen}
          clientId={clientId}
        />
      </SettingsSection>
    </SettingsPanel>
  );
}

function RequestRow({
  row,
  isLast,
}: {
  row: GbpReviewRequestRow;
  isLast: boolean;
}) {
  const status = STATUS_DISPLAY[row.status];
  return (
    <tr className={isLast ? '' : 'border-b border-rule-soft'}>
      <td className="px-3.5 py-2.5 font-mono text-[11px] text-ink-quiet">
        {new Date(row.sent_at).toLocaleString()}
      </td>
      <td className="px-3.5 py-2.5">
        <div className="text-[13px] text-ink">{row.recipient_name ?? '—'}</div>
        <div className="font-mono text-[10px] text-ink-quiet">
          {row.recipient_phone ?? row.recipient_email ?? ''}
        </div>
      </td>
      <td className="px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
        {row.channel}
      </td>
      <td className="px-3.5 py-2.5">
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${status.className}`}
        >
          {status.label}
        </span>
        {row.error_message ? (
          <div className="mt-0.5 font-mono text-[10px] text-warn">{row.error_message}</div>
        ) : null}
      </td>
      <td className="px-3.5 py-2.5">
        {row.resulted_in_review_id ? (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-good">
            ✓ Review left
          </span>
        ) : row.clicked_at ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-info">
            Link clicked
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
            —
          </span>
        )}
      </td>
    </tr>
  );
}

function ManualSendModal({
  open,
  onOpenChange,
  clientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
}) {
  const send = useSendGbpReviewRequest(clientId);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const phoneProblem = phone.length > 0 && !PHONE_RE.test(phone) ? 'Phone looks invalid.' : null;
  const emailProblem =
    email.length > 0 && !EMAIL_RE.test(email) ? 'Email looks invalid.' : null;
  const channelMissing = phone.trim().length === 0 && email.trim().length === 0;
  const canSubmit =
    !channelMissing && phoneProblem === null && emailProblem === null && !send.isPending && clientId !== null;

  async function submit() {
    try {
      await send.mutateAsync({
        recipientName: name.trim() || undefined,
        recipientPhone: phone.trim() || undefined,
        recipientEmail: email.trim() || undefined,
      });
      setName('');
      setPhone('');
      setEmail('');
      onOpenChange(false);
    } catch {
      /* error surfaced via send.error */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>Send a review request</DialogTitle>
          <DialogDescription>
            We&apos;ll text the customer first (SMS has the best response
            rate), falling back to email if no phone is available.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Customer name (optional)">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Davies"
            />
          </Field>
          <Field
            label="Phone (E.164 or local)"
            problem={phoneProblem}
          >
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+61 4 1234 5678"
            />
          </Field>
          <Field label="Email" problem={emailProblem}>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              type="email"
            />
          </Field>
          {channelMissing && (phone.length > 0 || email.length > 0) ? null : channelMissing ? (
            <div className="rounded-md bg-paper-2 px-3 py-2 text-[12px] text-ink-quiet">
              Provide a phone OR an email — we pick the channel automatically.
            </div>
          ) : null}
          {send.error ? (
            <div className="rounded-md border border-warn/30 bg-warn/8 px-3 py-2 text-[12px] text-warn">
              {(send.error as Error).message}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={send.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {send.isPending ? 'Sending…' : 'Send request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  problem,
  children,
}: {
  label: string;
  problem?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </div>
      {children}
      {problem ? (
        <div className="mt-1 text-[11px] text-warn">{problem}</div>
      ) : null}
    </label>
  );
}
