'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type ConversationComposerSend = {
  channel: string;
  /** Empty string when replying in-thread (server derives `Re: …` from the
   *  most recent inbound). Non-empty when the operator opted to start a new
   *  thread via the "Start new thread" checkbox. */
  subject: string;
  body: string;
};

type ConversationComposerProps = {
  channels?: string[];
  channelToggle?: string;
  defaultChannelId?: string;
  /** Controlled active channel — when provided, the composer surrenders
   *  its local state and the parent owns the channel selection (so the
   *  conversation header and the composer stay in sync). */
  activeChannelId?: string;
  onChannelChange?: (id: string) => void;
  placeholder: string;
  defaultValue?: string;
  defaultSubject?: string;
  /** When the active channel matches a value in this set, the composer
   *  offers the in-thread / new-thread toggle and an optional subject
   *  field (subject only shows when the operator chooses "new thread").
   *  SMS doesn't carry a subject — channels NOT in this set never show
   *  the subject UI. */
  subjectChannels?: string[];
  helpers?: string[];
  sendLabel?: string;
  className?: string;
  /** When provided, the Send button calls this with the current draft. The
   *  caller resets the composer (or the parent unmounts it) on success. */
  onSend?: (draft: ConversationComposerSend) => Promise<void> | void;
  isSending?: boolean;
  errorMessage?: string | null;
  /** When true on first mount, autofocus the textarea + scroll it into view.
   *  Used by the lead detail page when entered with `?compose=true` from a
   *  cold-lead surface. */
  autoFocus?: boolean;
};

function ConversationComposer({
  channels,
  channelToggle,
  defaultChannelId,
  activeChannelId,
  onChannelChange,
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
  autoFocus,
}: ConversationComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const el = textareaRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.focus();
      try {
        const end = el.value.length;
        el.setSelectionRange(end, end);
      } catch {
        // setSelectionRange can throw on some browsers/types; ignore.
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    // autoFocus is a one-shot signal at mount; ignore later changes so
    // composer state doesn't fight the operator after the first focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [value, setValue] = useState(defaultValue ?? '');
  const [subject, setSubject] = useState(defaultSubject ?? '');
  const [internalChannel, setInternalChannel] = useState<string | undefined>(
    defaultChannelId ?? channels?.[0],
  );
  const isControlled = activeChannelId !== undefined;
  const activeChannel = isControlled ? activeChannelId : internalChannel;
  const setActiveChannel = (id: string) => {
    if (!isControlled) setInternalChannel(id);
    onChannelChange?.(id);
  };

  // Threading: defaults to in-thread (server derives subject from the
  // latest inbound). The "new thread" toggle reveals a subject input.
  // SMS doesn't carry a subject so this whole UI is suppressed when
  // the active channel isn't in `subjectChannels`.
  const [newThread, setNewThread] = useState(false);
  const channelHasSubject =
    !!subjectChannels && !!activeChannel && subjectChannels.includes(activeChannel);
  const showThreadToggle = channelHasSubject;
  const showSubject = channelHasSubject && newThread;

  const showChannelTabs = channels && channels.length > 0;
  const showChannelToggle = !!channelToggle && !showChannelTabs;

  const canSend =
    !isSending &&
    value.trim().length > 0 &&
    (!showSubject || subject.trim().length > 0);

  async function handleSend() {
    if (!onSend || !canSend) return;
    await onSend({
      channel: activeChannel ?? channels?.[0] ?? 'SMS',
      // Empty subject = "reply in thread" → server derives Re: from the
      // most-recent inbound. Non-empty = explicit new-thread send.
      subject: showSubject ? subject.trim() : '',
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

      {/* Threading toggle — replies stay in-thread by default. Operator
       *  ticks the box to start a new thread (revealing the subject
       *  input). SMS doesn't render this. */}
      {showThreadToggle ? (
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-[12px] text-ink-quiet">
          <input
            type="checkbox"
            checked={newThread}
            onChange={(e) => setNewThread(e.target.checked)}
            className="size-3.5 cursor-pointer accent-rust"
          />
          Start a new thread
          <span className="text-ink/45">
            ({newThread
              ? 'recipient sees this as a new email'
              : 'replies in the current thread'}
            )
          </span>
        </label>
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
          ref={textareaRef}
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
