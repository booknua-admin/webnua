'use client';

// =============================================================================
// GbpSendRequestButton — the manual "Send review request" affordance.
//
// Phase 7 GBP consolidation. The button + modal pair that lets an operator
// (or client) manually fire a review-request SMS / email outside the
// booking-completion auto-trigger. Mounted in:
//
//   • Lead detail QUICK ACTIONS rail (both operator + client views).
//   • Client booking detail action rail.
//   • Operator booking detail hero actions.
//
// Modal body extracted from the now-deleted GbpReviewRequestsSection.
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSendGbpReviewRequest } from '@/lib/integrations/gbp/use-gbp';

const PHONE_RE = /^[+0-9\s()-]{6,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type GbpSendRequestContext = {
  /** The client business id (UUID). Required to dispatch the underlying
   *  job. Null disables the button — surfaces should pass null while
   *  resolving and the button renders inert. */
  clientId: string | null;
  /** Pre-filled recipient info — the lead or booking the request is FOR.
   *  All optional; the operator can edit them in the modal. */
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  /** Linking ids — surface on `gbp_review_requests` for attribution. */
  leadId?: string | null;
  bookingId?: string | null;
};

type Variant = 'button' | 'action-row' | 'ghost';

export function GbpSendRequestButton({
  context,
  label = 'Send review request',
  variant = 'button',
  icon = '⭐',
  size,
}: {
  context: GbpSendRequestContext;
  label?: string;
  variant?: Variant;
  /** Glyph shown in the action-row variant (the leading icon). */
  icon?: string;
  size?: 'sm' | 'default' | 'lg';
}) {
  const [open, setOpen] = useState(false);
  const disabled = context.clientId === null;

  return (
    <>
      {variant === 'action-row' ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="mb-2 flex w-full items-center gap-3 rounded-md border border-rule bg-card px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:border-ink hover:bg-paper disabled:cursor-not-allowed disabled:opacity-55 last:mb-0"
        >
          <span className="text-[15px] leading-none text-rust">{icon}</span>
          {label}
        </button>
      ) : variant === 'ghost' ? (
        <Button
          variant="ghost"
          size={size ?? 'sm'}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          {icon} {label}
        </Button>
      ) : (
        <Button
          variant="outline"
          size={size ?? 'sm'}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          {icon} {label}
        </Button>
      )}
      <SendRequestModal
        open={open}
        onOpenChange={setOpen}
        context={context}
      />
    </>
  );
}

function SendRequestModal({
  open,
  onOpenChange,
  context,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: GbpSendRequestContext;
}) {
  const send = useSendGbpReviewRequest(context.clientId);
  const [name, setName] = useState(context.recipientName ?? '');
  const [phone, setPhone] = useState(context.recipientPhone ?? '');
  const [email, setEmail] = useState(context.recipientEmail ?? '');

  // Reset fields when the modal opens with a different context (e.g. the
  // operator opens the modal from a different lead).
  function handleOpenChange(next: boolean) {
    if (next) {
      setName(context.recipientName ?? '');
      setPhone(context.recipientPhone ?? '');
      setEmail(context.recipientEmail ?? '');
    }
    onOpenChange(next);
  }

  const phoneProblem = phone.length > 0 && !PHONE_RE.test(phone) ? 'Phone looks invalid.' : null;
  const emailProblem =
    email.length > 0 && !EMAIL_RE.test(email) ? 'Email looks invalid.' : null;
  const channelMissing = phone.trim().length === 0 && email.trim().length === 0;
  const canSubmit =
    !channelMissing &&
    phoneProblem === null &&
    emailProblem === null &&
    !send.isPending &&
    context.clientId !== null;

  async function submit() {
    try {
      await send.mutateAsync({
        recipientName: name.trim() || undefined,
        recipientPhone: phone.trim() || undefined,
        recipientEmail: email.trim() || undefined,
        leadId: context.leadId ?? undefined,
        bookingId: context.bookingId ?? undefined,
      });
      onOpenChange(false);
    } catch {
      /* error surfaced via send.error */
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
          <Field label="Phone (E.164 or local)" problem={phoneProblem}>
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
          {channelMissing ? (
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
