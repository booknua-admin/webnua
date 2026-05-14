'use client';

import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type { ConversationChannelTab } from '@/lib/leads/types';

type ConversationHeaderProps = {
  avatar: string;
  name: string;
  meta: ReactNode;
  channelTabs?: ConversationChannelTab[];
  defaultChannelId?: string;
  actions?: string[];
  className?: string;
};

function ConversationHeader({
  avatar,
  name,
  meta,
  channelTabs,
  defaultChannelId,
  actions,
  className,
}: ConversationHeaderProps) {
  const [activeChannel, setActiveChannel] = useState(
    defaultChannelId ?? channelTabs?.[0]?.id,
  );

  return (
    <div
      data-slot="conversation-header"
      className={cn(
        'flex items-center gap-4 border-b border-ink/8 px-7 py-4',
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-paper-2 font-sans text-sm font-extrabold text-ink">
        {avatar}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-ink">{name}</div>
        <div className="text-[12px] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
          {meta}
        </div>
      </div>
      {channelTabs && channelTabs.length > 0 ? (
        <div className="flex items-center gap-1.5">
          {channelTabs.map((tab) => {
            const isActive = tab.id === activeChannel;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveChannel(tab.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-colors',
                  isActive
                    ? 'bg-ink text-paper'
                    : 'text-ink-quiet hover:text-ink',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}
      {actions && actions.length > 0 ? (
        <div className="flex items-center gap-1.5">
          {actions.map((glyph, i) => (
            <button
              key={i}
              type="button"
              className="flex size-8 items-center justify-center rounded-full border border-ink/10 text-[14px] text-ink-quiet transition-colors hover:border-rust hover:text-rust"
            >
              {glyph}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { ConversationHeader };
export type { ConversationHeaderProps };
