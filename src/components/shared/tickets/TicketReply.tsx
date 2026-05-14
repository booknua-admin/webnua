'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type TicketReplyTool = {
  icon: string;
  title: string;
};

type TicketReplyProps = {
  label?: string;
  placeholder: string;
  defaultValue?: string;
  chips?: string[];
  tools?: TicketReplyTool[];
  sendLabel?: string;
  className?: string;
};

const DEFAULT_TOOLS: TicketReplyTool[] = [
  { icon: '⤴', title: 'Attach file' },
];

function TicketReply({
  label,
  placeholder,
  defaultValue,
  chips,
  tools = DEFAULT_TOOLS,
  sendLabel = 'Send reply →',
  className,
}: TicketReplyProps) {
  const [value, setValue] = useState(defaultValue ?? '');

  return (
    <div
      data-slot="ticket-reply"
      className={cn('border-t border-ink/8 bg-paper-2 px-7 py-6', className)}
    >
      {label ? (
        <div className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
          {label}
        </div>
      ) : null}
      {chips && chips.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setValue(chip)}
              className="rounded-full border border-ink/12 bg-card px-3 py-1.5 text-[12px] text-ink transition-colors hover:border-rust hover:text-rust"
            >
              {chip}
            </button>
          ))}
        </div>
      ) : null}
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="min-h-[92px] resize-y rounded-[10px] border-ink/15 bg-card font-sans text-[14px] leading-[1.5]"
      />
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex gap-1.5">
          {tools.map((tool) => (
            <button
              key={tool.title}
              type="button"
              title={tool.title}
              aria-label={tool.title}
              className="flex size-8 items-center justify-center rounded-[8px] border border-ink/10 bg-card text-[14px] text-ink-quiet transition-colors hover:border-rust hover:text-rust"
            >
              {tool.icon}
            </button>
          ))}
        </div>
        <Button className="bg-rust text-paper hover:bg-rust-light">
          {sendLabel}
        </Button>
      </div>
    </div>
  );
}

export { TicketReply };
export type { TicketReplyProps, TicketReplyTool };
