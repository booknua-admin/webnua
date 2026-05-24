'use client';

import { useMemo, useState } from 'react';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/client';
import type {
  AutomationEditorAction,
  AutomationTestSendData,
} from '@/lib/automations/types';

type AutomationTestSendModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AutomationTestSendData;
  /** Client UUID — passed to the test-send API. */
  clientId: string;
  /** The automation's ordered actions — drives channel pick + preview body. */
  actions: AutomationEditorAction[];
};

/** Curated sample values — mirror the route's SAMPLE_CONTEXT so the operator
 *  preview reads identical to what actually sends. */
const SAMPLE_CONTEXT: Record<string, string> = {
  'client.shortName': 'Voltline',
  'client.businessName': 'Voltline Electrical',
  'client.phone': '0412 345 678',
  'client.responseTime': '1 hour',
  'lead.firstName': 'Liam',
  'lead.lastNameSuffix': ' Reilly',
  'lead.fullName': 'Liam Reilly',
  'lead.email': 'liam@example.com',
  'lead.phone': '+61 412 345 678',
  'lead.service': 'kitchen power outlet replacement',
  'lead.preview':
    'Outlet by the sink keeps tripping the breaker — need someone today.',
  'review.link': 'https://g.page/voltline/review',
  'platform.inboxLink': 'https://app.webnua.com/leads',
};

function renderTemplate(template: string): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    return SAMPLE_CONTEXT[key] ?? '';
  });
}

type TestStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'success'; recipient: string }
  | { kind: 'error'; message: string };

function AutomationTestSendModal({
  open,
  onOpenChange,
  data,
  clientId,
  actions,
}: AutomationTestSendModalProps) {
  // Pick comm actions (SMS / email) and start with the first SMS if present.
  const commActions = useMemo(
    () =>
      actions.filter(
        (a) =>
          a.actionType === 'send_sms_to_lead' ||
          a.actionType === 'send_email_to_lead',
      ),
    [actions],
  );

  const hasSms = commActions.some((a) => a.actionType === 'send_sms_to_lead');
  const hasEmail = commActions.some(
    (a) => a.actionType === 'send_email_to_lead',
  );

  const initialChannel: 'sms' | 'email' = hasSms ? 'sms' : 'email';
  const [channel, setChannel] = useState<'sms' | 'email'>(initialChannel);
  const [status, setStatus] = useState<TestStatus>({ kind: 'idle' });

  const activeAction = useMemo(() => {
    return (
      commActions.find((a) =>
        channel === 'sms'
          ? a.actionType === 'send_sms_to_lead'
          : a.actionType === 'send_email_to_lead',
      ) ?? null
    );
  }, [channel, commActions]);

  const noCommActions = commActions.length === 0;

  const previewBody = useMemo(() => {
    if (!activeAction) return '';
    const raw = activeAction.body ?? '';
    return renderTemplate(raw);
  }, [activeAction]);

  const previewSubject = useMemo(() => {
    if (!activeAction || activeAction.actionType !== 'send_email_to_lead') {
      return '';
    }
    return renderTemplate(activeAction.subject ?? '');
  }, [activeAction]);

  const canSwitchChannel = hasSms && hasEmail;

  const handleSend = async () => {
    if (!activeAction) return;
    setStatus({ kind: 'sending' });
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setStatus({ kind: 'error', message: 'Sign in expired — refresh.' });
        return;
      }
      const res = await fetch('/api/automations/test-send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clientId, actionId: activeAction.id }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        recipient?: string;
      };
      if (!res.ok) {
        if (json.error === 'no-test-phone') {
          setStatus({
            kind: 'error',
            message:
              json.message ??
              'Add your phone in Settings to enable test SMS. Switch to email to test now.',
          });
        } else {
          setStatus({
            kind: 'error',
            message: json.message ?? json.error ?? 'Send failed.',
          });
        }
        return;
      }
      setStatus({
        kind: 'success',
        recipient: json.recipient ?? 'your operator address',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed.';
      setStatus({ kind: 'error', message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="default"
        showCloseButton={false}
        className="flex max-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[14px] border-rule bg-card p-0 gap-0"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-paper-2 px-7 pb-4 pt-5.5">
          <div className="flex-1">
            <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rust" />
              {data.tag}
            </div>
            <DialogTitle className="mb-1.5 text-[24px] font-extrabold leading-[1.1] tracking-[-0.025em] text-ink [&_em]:not-italic [&_em]:text-rust">
              {data.title}
            </DialogTitle>
            <p className="text-[13px] leading-[1.45] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
              {data.subtitle}
            </p>
          </div>
          <DialogPrimitive.Close
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 font-mono text-[16px] text-ink-quiet transition-colors hover:bg-ink hover:text-paper"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <FormRow label="Send to">
            <Input
              className="bg-paper"
              defaultValue={
                channel === 'email'
                  ? data.sendTo
                  : 'Your operator phone (none on file)'
              }
              readOnly
              aria-label="Test send recipient"
            />
            <p className="mt-1.5 text-[12px] text-ink-quiet">
              {data.sendToHint}
            </p>
          </FormRow>

          <FormRow
            label={`Preview · how the ${channel.toUpperCase()} will arrive`}
          >
            {noCommActions ? (
              <div className="rounded-[14px] bg-paper-2/50 px-4.5 py-6 text-center font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                {'// This automation has no SMS or email steps to preview'}
              </div>
            ) : channel === 'sms' && activeAction ? (
              <div
                data-slot="test-send-preview"
                className="rounded-[14px] bg-[#e7f3ff] px-4.5 pb-6 pt-4.5"
              >
                <div className="mb-3 text-center font-mono text-[11px] font-semibold text-ink-quiet">
                  {data.phoneBar}
                </div>
                <div
                  data-slot="test-send-sms"
                  className="relative max-w-[320px] rounded-[18px] bg-card px-4 py-3 font-sans text-[13px] leading-[1.45] text-ink shadow-[0_2px_6px_rgba(0,0,0,0.05)]"
                >
                  {previewBody || (
                    <em className="text-ink-quiet">No body set yet.</em>
                  )}
                </div>
                <div className="mt-3 font-mono text-[10px] tracking-[0.06em] text-ink-quiet">
                  Variables are filled with sample values for the test.
                </div>
              </div>
            ) : channel === 'email' && activeAction ? (
              <div
                data-slot="test-send-preview"
                className="rounded-[14px] bg-paper-2/40 px-4.5 py-4"
              >
                <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
                  Subject
                </div>
                <div className="mb-3 truncate font-sans text-[13px] font-semibold text-ink">
                  {previewSubject || (
                    <em className="text-ink-quiet">No subject set yet.</em>
                  )}
                </div>
                <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
                  Body
                </div>
                <div className="whitespace-pre-wrap rounded-md bg-card px-3 py-3 font-sans text-[13px] leading-[1.5] text-ink shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
                  {previewBody || (
                    <em className="text-ink-quiet">No body set yet.</em>
                  )}
                </div>
                <div className="mt-3 font-mono text-[10px] tracking-[0.06em] text-ink-quiet">
                  Variables are filled with sample values for the test.
                </div>
              </div>
            ) : (
              <div className="rounded-[14px] bg-paper-2/50 px-4.5 py-6 text-center font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                {`// No ${channel.toUpperCase()} action in this automation`}
              </div>
            )}
          </FormRow>

          <FormRow label="Test options" last>
            <div
              data-slot="test-send-options"
              className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[10px] bg-paper px-4 py-3.5"
            >
              <div className="font-sans text-[13px] text-ink [&_strong]:font-bold">
                <strong>
                  Send as {channel === 'sms' ? 'SMS' : 'email'} only
                </strong>
                <span className="mt-0.5 block text-[11px] text-ink-quiet">
                  {canSwitchChannel
                    ? `Switch to the ${channel === 'sms' ? 'email' : 'SMS'} action to preview that instead.`
                    : `This automation only has a ${channel === 'sms' ? 'SMS' : 'email'} action.`}
                </span>
              </div>
              {canSwitchChannel ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setChannel((c) => (c === 'sms' ? 'email' : 'sms'));
                    setStatus({ kind: 'idle' });
                  }}
                >
                  Switch to {channel === 'sms' ? 'email' : 'SMS'}
                </Button>
              ) : null}
            </div>
            {status.kind === 'error' ? (
              <p className="mt-3 rounded-md bg-warn/10 px-3 py-2 font-mono text-[11px] font-semibold text-warn">
                {status.message}
              </p>
            ) : null}
            {status.kind === 'success' ? (
              <p className="mt-3 rounded-md bg-good/10 px-3 py-2 font-mono text-[11px] font-semibold text-good">
                {`Test sent to ${status.recipient}. Check your inbox.`}
              </p>
            ) : null}
          </FormRow>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-paper-2 bg-paper px-7 py-4">
          <div className="font-sans text-[12px] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
            {data.footerInfo}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              {data.cancelLabel}
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={
                !activeAction ||
                status.kind === 'sending' ||
                status.kind === 'success'
              }
            >
              {status.kind === 'sending'
                ? 'Sending…'
                : status.kind === 'success'
                  ? 'Sent ✓'
                  : data.sendLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormRow({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? '' : 'mb-4.5'}>
      <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </div>
      {children}
    </div>
  );
}

export { AutomationTestSendModal };
export type { AutomationTestSendModalProps };
