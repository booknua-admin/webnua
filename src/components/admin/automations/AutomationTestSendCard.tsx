'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { AutomationTestSendModal } from '@/components/shared/automations/AutomationTestSendModal';
import type { AutomationTestSendData } from '@/lib/automations/types';
import { cn } from '@/lib/utils';

type AutomationTestSendCardProps = {
  heading: string;
  body: ReactNode;
  buttonLabel: string;
  data: AutomationTestSendData;
  className?: string;
};

function AutomationTestSendCard({
  heading,
  body,
  buttonLabel,
  data,
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
      />
    </>
  );
}

export { AutomationTestSendCard };
export type { AutomationTestSendCardProps };
