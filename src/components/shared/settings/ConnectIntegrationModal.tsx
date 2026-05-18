'use client';

// =============================================================================
// Connect-integration flow (admin prototype Screen 25). A stub modal that the
// IntegrationCard "Connect" / "Reauthorize" / "Manage" actions open. One
// status-driven component: the four-step OAuth-style flow is the same shape in
// every mode, only the per-step state + the framing copy differ.
//
// STUB: no real OAuth — the footer actions just close the modal.
// =============================================================================

import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ConnectIntegrationMode = 'connect' | 'reauthorize' | 'manage';

type ConnectIntegrationTarget = {
  name: string;
  logoInitial: string;
};

type ConnectIntegrationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ConnectIntegrationMode;
  integration: ConnectIntegrationTarget;
};

type StepState = 'done' | 'current' | 'pending';

type StepCopy = {
  title: string;
  desc: string;
};

const STEPS: StepCopy[] = [
  {
    title: 'Authorize Webnua',
    desc: 'Standard OAuth handshake — Webnua requests only the access it needs to manage this on your behalf.',
  },
  {
    title: 'Select account',
    desc: 'Pick the account this integration should connect to.',
  },
  {
    title: 'Review permissions',
    desc: 'Confirm the access scope. You can revoke it anytime from the provider or from Settings → Integrations.',
  },
  {
    title: 'Confirm + sync',
    desc: 'The first sync pulls in your existing data. Everything flows automatically after that.',
  },
];

// Per-mode step states + framing. connect = fresh flow, reauthorize = token
// refresh on an already-linked account, manage = everything already done.
const STEP_STATES: Record<ConnectIntegrationMode, StepState[]> = {
  connect: ['current', 'pending', 'pending', 'pending'],
  reauthorize: ['current', 'done', 'done', 'pending'],
  manage: ['done', 'done', 'done', 'done'],
};

const MODE_TAG: Record<ConnectIntegrationMode, string> = {
  connect: '// Connect integration',
  reauthorize: '// Reauthorize integration',
  manage: '// Manage integration',
};

function ConnectIntegrationModal({
  open,
  onOpenChange,
  mode,
  integration,
}: ConnectIntegrationModalProps) {
  const states = STEP_STATES[mode];
  const sub =
    mode === 'manage'
      ? 'Connected and syncing.'
      : mode === 'reauthorize'
        ? 'Reconnect to resume syncing — about 30 seconds.'
        : 'About 30 seconds to connect.';
  const primaryLabel =
    mode === 'manage'
      ? 'Done'
      : mode === 'reauthorize'
        ? 'Reauthorize →'
        : `Connect ${integration.name} →`;
  const cancelLabel = mode === 'manage' ? 'Close' : 'Cancel';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="default"
        showCloseButton={false}
        className="flex max-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[14px] border-rule bg-card p-0 gap-0"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-paper-2 px-7 pb-4 pt-5.5">
          <div className="flex-1">
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
              {MODE_TAG[mode]}
            </div>
            <DialogTitle className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.025em] text-ink">
              {integration.name}
            </DialogTitle>
          </div>
          <DialogPrimitive.Close
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 font-mono text-[16px] text-ink-quiet transition-colors hover:bg-ink hover:text-paper"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <div className="mb-5 border-b border-paper-2 pb-4 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[14px] bg-ink text-[28px] font-extrabold text-rust-light">
              {integration.logoInitial}
            </div>
            <div className="mb-1 text-[20px] font-extrabold tracking-[-0.02em] text-ink">
              {integration.name}
            </div>
            <div className="text-[13px] text-ink-quiet">{sub}</div>
          </div>

          <div>
            {STEPS.map((step, i) => (
              <ConnectStep
                key={step.title}
                num={i + 1}
                state={states[i]}
                title={step.title}
                desc={step.desc}
              />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-paper-2 bg-paper px-7 py-4">
          <div className="flex-1 text-[12px] leading-[1.45] text-ink-quiet">
            Permissions can be revoked anytime from the provider&apos;s account settings or Settings
            → Integrations.
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="h-9" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            {mode !== 'manage' ? (
              <Button variant="default" className="h-9" onClick={() => onOpenChange(false)}>
                {primaryLabel}
              </Button>
            ) : null}
            {mode === 'manage' ? (
              <Button variant="default" className="h-9" onClick={() => onOpenChange(false)}>
                {primaryLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ConnectStepProps = {
  num: number;
  state: StepState;
  title: string;
  desc: string;
};

function ConnectStep({ num, state, title, desc }: ConnectStepProps) {
  return (
    <div className="grid grid-cols-[28px_1fr] items-start gap-3.5 border-b border-dotted border-rule py-3.5 last:border-b-0">
      <div
        className={cn(
          'mt-0.5 flex h-7 w-7 items-center justify-center rounded-full font-mono text-[12px] font-bold',
          state === 'done' && 'bg-good text-white',
          state === 'current' && 'bg-rust text-white shadow-[0_0_0_4px_rgba(210,67,23,0.18)]',
          state === 'pending' && 'bg-ink text-rust-light',
        )}
      >
        {state === 'done' ? '✓' : num}
      </div>
      <div>
        <div className="mb-1 text-[14px] font-bold text-ink">{title}</div>
        <div className="text-[12px] leading-[1.5] text-ink-quiet">{desc}</div>
        {state === 'done' ? (
          <span className="mt-1.5 inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-good">
            ✓ Done
          </span>
        ) : null}
      </div>
    </div>
  );
}

export { ConnectIntegrationModal };
export type { ConnectIntegrationMode, ConnectIntegrationModalProps, ConnectIntegrationTarget };
