'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type ConversationComposerSend = {
  channel: string;
  subject: string;
  body: string;
};

type ConversationComposerProps = {
  channels?: string[];
  channelToggle?: string;
  defaultChannelId?: string;
  placeholder: string;
  defaultValue?: string;
  defaultSubject?: string;
  /** When the active channel matches a value in this set, the composer
   *  renders a subject Input above the textarea — used for email replies. */
  subjectChannels?: string[];
  helpers?: string[];
  sendLabel?: string;
  className?: string;
  /** When provided, the Send button calls this with the current draft. The
   *  caller resets the composer (or the parent unmounts it) on success. */
  onSend?: (draft: ConversationComposerSend) => Promise<void> | void;
  isSending?: boolean;
  errorMessage?: string | null;
};

function ConversationComposer({
  channels,
  channelToggle,
  defaultChannelId,
  placeholder,
  defaultValue,
  defaultSubject,
  subjectChannels,
  helpers,
  sendLabel = 'Send →',
  className,
  onSend,
  isSending,
  errorMessage,
}: ConversationComposerProps) {
  const [value, setValue] = useState(defaultValue ?? '');
  const [subject, setSubject] = useState(defaultSubject ?? '');
  const [activeChannel, setActiveChannel] = useState<string | undefined>(
    defaultChannelId ?? channels?.[0],
  );

  const showChannelTabs = channels && channels.length > 0;
  const showChannelToggle = !!channelToggle && !showChannelTabs;
  const showSubject =
    !!subjectChannels &&
    !!activeChannel &&
    subjectChannels.includes(activeChannel);

  const canSend = !isSending && (value.trim().length > 0 || subject.trim().length > 0);

  async function handleSend() {
    if (!onSend || !canSend) return;
    await onSend({
      channel: activeChannel ?? channels?.[0] ?? 'SMS',
      subject: subject.trim(),
      body: value.trim(),
    });
    setValue('');
    if (showSubject) setSubject('');
  }

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

      {showSubject ? (
        <div className="mb-2.5">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="rounded-[10px] border-ink/15 bg-paper-2/40 font-sans text-[14px]"
          />
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
        <Button
          className="bg-rust text-paper hover:bg-rust-light"
          onClick={onSend ? handleSend : undefined}
          disabled={onSend ? !canSend : undefined}
        >
          {isSending ? 'Sending…' : sendLabel}
        </Button>
      </div>

      {errorMessage ? (
        <p className="mt-2 text-[12px] text-warn">{errorMessage}</p>
      ) : null}

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
