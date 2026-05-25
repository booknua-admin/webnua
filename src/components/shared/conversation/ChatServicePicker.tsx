'use client';

// =============================================================================
// ChatServicePicker — turn-2 services-pick UI for the conversational signup.
//
// Visual language matches the GenerationBlueprint: the whole picker mounts
// inside a `SpecSheet` ("// SERVICES") so it reads as a labelled section
// on the architect's drawing rather than a card floating in the chat
// stream. Selected service rows use rust-soft bg + rust border (same
// "this is active / picked" cue the blueprint progress sheet uses).
//
// Two render modes driven by the catalogue size (per CLAUDE.md locked
// decision "Service picker: ≥6 → Dialog, ≤5 → inline"):
//
//   - ≤ SERVICE_PICKER_INLINE_LIMIT (5) services → inline checkbox column
//     mounted directly inside the SpecSheet.
//   - ≥ 6 services → a "Pick your services →" button inside the sheet that
//     opens a Dialog (the trade-default catalogues are 10-12 services per
//     industry, so this is the default path for nearly every signup).
//
// The AI extraction pre-ticks the customer's mentioned services from turn 1;
// the customer can tick / untick / add custom services from there.
//
// Custom additions: the customer can type a service name not in the
// catalogue. We keep them in a separate `customs` set so the catalogue
// order is preserved for the rest of the flow.
//
// 44px tap targets throughout. Mobile-first: the dialog mode uses a
// scrollable content area so a 12-service catalogue still fits on a 375px
// viewport without horizontal scroll.
// =============================================================================

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SERVICE_PICKER_INLINE_LIMIT } from '@/lib/onboarding/conversation-types';
import { cn } from '@/lib/utils';

import { SpecSheet } from './SpecSheet';

export type ChatServicePickerProps = {
  /** Display name of the industry — for the dialog title + the inline
   *  "Pick your N services" framing. */
  industryName: string;
  /** The industry's `defaultServices` catalogue. Source of truth for what
   *  the customer can tick. */
  options: readonly string[];
  /** AI-pre-ticked subset (from /api/onboarding/extract-business). May be
   *  empty when the model couldn't identify any. */
  preTicked: readonly string[];
  /** Hands back the customer's final list — order is catalogue order for
   *  in-catalogue services, with customs appended. */
  onSubmit: (services: string[]) => void;
  /** Customer chose "I'll come back to this" — pass empty array up. */
  onSkip: () => void;
  /** Optional initial selection (for resume — replaces preTicked). */
  initial?: readonly string[];
  /** Disable all inputs (e.g. while persisting state to the server). */
  disabled?: boolean;
};

export function ChatServicePicker(props: ChatServicePickerProps) {
  const useDialog = props.options.length > SERVICE_PICKER_INLINE_LIMIT;
  if (useDialog) {
    return <ServicePickerDialog {...props} />;
  }
  return <ServicePickerInline {...props} />;
}

// ---------------------------------------------------------------------------
// inline mode — small catalogues (≤5)

function ServicePickerInline({
  options,
  preTicked,
  initial,
  onSubmit,
  onSkip,
  disabled,
}: ChatServicePickerProps) {
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(initial ?? preTicked),
  );

  return (
    <SpecSheet label="// SERVICES" hint="services.json">
      <div className="flex flex-col gap-3">
        <p className="text-[12px] leading-[1.4] text-ink-mid">
          Tick the services you offer — we&apos;ll write your site around these.
        </p>
        <div className="flex flex-col gap-1.5">
          {options.map((service) => (
            <ServiceCheckboxRow
              key={service}
              label={service}
              checked={picked.has(service)}
              disabled={disabled}
              onChange={(next) =>
                setPicked((prev) => {
                  const out = new Set(prev);
                  if (next) out.add(service);
                  else out.delete(service);
                  return out;
                })
              }
            />
          ))}
        </div>
        <SubmitRow
          disabled={disabled}
          onSubmit={() => onSubmit(orderedFromSet(picked, options))}
          onSkip={onSkip}
          submitLabel="Continue →"
        />
      </div>
    </SpecSheet>
  );
}

// ---------------------------------------------------------------------------
// dialog mode — large catalogues (≥6)

function ServicePickerDialog({
  industryName,
  options,
  preTicked,
  initial,
  onSubmit,
  onSkip,
  disabled,
}: ChatServicePickerProps) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(initial ?? preTicked),
  );
  const [customs, setCustoms] = useState<string[]>(
    () => (initial ?? []).filter((s) => !options.includes(s)),
  );
  const [draftCustom, setDraftCustom] = useState('');

  // Initial pre-ticked summary — surfaced on the launcher button when the
  // dialog hasn't been opened yet.
  const launcherSummary = useMemo(() => {
    if (picked.size === 0 && customs.length === 0) {
      return preTicked.length > 0
        ? `${preTicked.length} pre-selected from your message`
        : 'None selected yet';
    }
    return `${picked.size + customs.length} selected`;
  }, [picked.size, customs.length, preTicked.length]);

  function handleAddCustom() {
    const next = draftCustom.trim();
    if (!next) return;
    if (customs.includes(next) || options.includes(next)) {
      setDraftCustom('');
      return;
    }
    setCustoms((prev) => [...prev, next]);
    setDraftCustom('');
  }

  function handleSubmit() {
    const inCatalogue = orderedFromSet(picked, options);
    const all = [...inCatalogue, ...customs];
    onSubmit(all);
    setOpen(false);
  }

  return (
    <SpecSheet label="// SERVICES" hint="services.json">
      <div className="flex flex-col gap-2.5">
        <p className="text-[12px] leading-[1.4] text-ink-mid">
          Tick what you offer — we&apos;ll write your site around these.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className={cn(
            'min-h-[44px] inline-flex items-center justify-between rounded-md',
            'border-2 border-ink/20 bg-paper/40 px-4 py-2.5',
            'text-left text-[14px] text-ink',
            'hover:border-rust focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/[0.2]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <span>
            <span className="font-bold">Pick your services →</span>
            <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-quiet">
              {launcherSummary}
            </span>
          </span>
        </button>
        <SubmitRow
          disabled={disabled || (picked.size === 0 && customs.length === 0)}
          onSubmit={handleSubmit}
          onSkip={onSkip}
          submitLabel={
            picked.size + customs.length > 0
              ? `Continue with ${picked.size + customs.length} →`
              : 'Continue →'
          }
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>{`${industryName} — services`}</DialogTitle>
            <DialogDescription>
              Tick what you offer. We pre-ticked services we picked up from
              your message — adjust freely.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto pr-1">
            <div className="flex flex-col gap-1.5 py-1">
              {options.map((service) => (
                <ServiceCheckboxRow
                  key={service}
                  label={service}
                  checked={picked.has(service)}
                  disabled={disabled}
                  onChange={(next) =>
                    setPicked((prev) => {
                      const out = new Set(prev);
                      if (next) out.add(service);
                      else out.delete(service);
                      return out;
                    })
                  }
                />
              ))}
            </div>

            <div className="mt-4 border-t border-ink/10 pt-4">
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                {'// Custom services'}
              </p>
              {customs.length > 0 ? (
                <div className="mb-3 flex flex-col gap-1.5">
                  {customs.map((c) => (
                    <div
                      key={c}
                      className="flex items-center justify-between rounded-md border-2 border-rust/50 bg-rust-soft/40 px-3 py-2 text-[14px] text-ink"
                    >
                      <span>{c}</span>
                      <button
                        type="button"
                        onClick={() => setCustoms((prev) => prev.filter((s) => s !== c))}
                        disabled={disabled}
                        aria-label={`Remove ${c}`}
                        className="font-mono text-[11px] uppercase tracking-[0.12em] text-rust hover:text-rust-deep disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-2">
                <Input
                  value={draftCustom}
                  onChange={(e) => setDraftCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustom();
                    }
                  }}
                  placeholder="e.g. PAT testing for landlords"
                  disabled={disabled}
                  className="min-h-[44px] flex-1 text-base sm:text-[14px]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddCustom}
                  disabled={disabled || draftCustom.trim().length === 0}
                  className="min-h-[44px]"
                >
                  + Add
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-[44px] px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-quiet hover:text-ink"
              disabled={disabled}
            >
              Cancel
            </button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={disabled || (picked.size === 0 && customs.length === 0)}
              className="min-h-[44px]"
            >
              {`Continue with ${picked.size + customs.length} →`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SpecSheet>
  );
}

// ---------------------------------------------------------------------------
// shared

function ServiceCheckboxRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-3 rounded-md border-2 px-3 py-3',
        'cursor-pointer transition-colors',
        checked
          ? 'border-rust bg-rust-soft/60'
          : 'border-ink/20 bg-paper/40 hover:border-ink/40',
        disabled && 'cursor-not-allowed opacity-50',
        'min-h-[44px]',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-5 w-5 cursor-pointer accent-rust"
      />
      <span className="text-[14px] text-ink">{label}</span>
    </label>
  );
}

function SubmitRow({
  disabled,
  onSubmit,
  onSkip,
  submitLabel,
}: {
  disabled?: boolean;
  onSubmit: () => void;
  onSkip: () => void;
  submitLabel: string;
}) {
  return (
    <div className="mt-1 flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
      <button
        type="button"
        onClick={onSkip}
        disabled={disabled}
        className="min-h-[44px] px-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-quiet hover:text-ink disabled:opacity-50"
      >
        Skip for now
      </button>
      <Button type="button" onClick={onSubmit} disabled={disabled} className="min-h-[44px]">
        {submitLabel}
      </Button>
    </div>
  );
}

/** Preserve the catalogue's natural order when projecting a set. */
function orderedFromSet(set: Set<string>, options: readonly string[]): string[] {
  return options.filter((opt) => set.has(opt));
}
