'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type ConversationComposerProps = {
  channels?: string[];
  channelToggle?: string;
  defaultChannelId?: string;
  placeholder: string;
  defaultValue?: string;
  helpers?: string[];
  sendLabel?: string;
  className?: string;
};

function ConversationComposer({
  channels,
  channelToggle,
  defaultChannelId,
  placeholder,
  defaultValue,
  helpers,
  sendLabel = 'Send →',
  className,
}: ConversationComposerProps) {
  const [value, setValue] = useState(defaultValue ?? '');
  const [activeChannel, setActiveChannel] = useState(
    defaultChannelId ?? channels?.[0],
  );

  const showChannelTabs = channels && channels.length > 0;
  const showChannelToggle = !!channelToggle && !showChannelTabs;

  return (
    <div
      data-slot="conversation-composer"
      className={cn('border-t border-ink/8 bg-card px-7 py-5', className)}
    >
      {showChannelTabs ? (
        <div className="mb-3 flex items-center gap-1.5">
          {channels!.map((ch) => {
            const isActive = ch === activeChannel;
            return (
              <button
                key={ch}
                type="button"
                onClick={() => setActiveChannel(ch)}
                className={cn(
                  'rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition-colors',
                  isActive
                    ? 'bg-rust text-paper'
                    : 'text-ink-quiet hover:text-ink',
                )}
              >
                {ch}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex items-end gap-3">
        {showChannelToggle ? (
          <button
            type="button"
            className="rounded-full border border-rule bg-paper-2 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet"
          >
            {channelToggle}
          </button>
        ) : null}
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="min-h-[60px] flex-1 resize-y rounded-[10px] border-ink/15 bg-paper-2/40 font-sans text-[14px] leading-[1.5]"
        />
        <Button className="bg-rust text-paper hover:bg-rust-light">
          {sendLabel}
        </Button>
      </div>

      {helpers && helpers.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {helpers.map((helper) => (
            <button
              key={helper}
              type="button"
              className="rounded-full border border-rule bg-card px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet transition-colors hover:border-rust hover:text-rust"
            >
              {helper}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-good">
            Spell check ✓
          </span>
        </div>
      ) : null}
    </div>
  );
}

export { ConversationComposer };
export type { ConversationComposerProps };
