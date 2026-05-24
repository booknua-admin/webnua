'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { AutomationTestSendModal } from '@/components/shared/automations/AutomationTestSendModal';
import type {
  AutomationEditorAction,
  AutomationTestSendData,
} from '@/lib/automations/types';
import { cn } from '@/lib/utils';

type AutomationTestSendCardProps = {
  heading: string;
  body: ReactNode;
  buttonLabel: string;
  data: AutomationTestSendData;
  /** Client UUID — drives the API call to enqueue the test send job. */
  clientId: string;
  /** The automation's ordered actions — drives channel pick (first comm
   *  action) and preview body. */
  actions: AutomationEditorAction[];
  className?: string;
};

function AutomationTestSendCard({
  heading,
  body,
  buttonLabel,
  data,
  clientId,
  actions,
  className,
}: AutomationTestSendCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        data-slot="automation-test-send-card"
        className={cn(
          'rounded-[10px] border border-rule bg-card px-5 py-4.5',
          className,
        )}
      >
        <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {heading}
        </div>
        <div className="mb-3 font-sans text-[13px] leading-[1.45] text-ink-quiet">
          {body}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full cursor-pointer rounded-md bg-ink py-2.5 font-sans text-[13px] font-bold text-paper transition-colors hover:bg-rust"
        >
          {buttonLabel}
        </button>
      </div>
      <AutomationTestSendModal
        open={open}
        onOpenChange={setOpen}
        data={data}
        clientId={clientId}
        actions={actions}
      />
    </>
  );
}

export { AutomationTestSendCard };
export type { AutomationTestSendCardProps };
