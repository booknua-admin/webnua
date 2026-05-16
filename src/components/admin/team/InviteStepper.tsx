import { cn } from '@/lib/utils';

type InviteStepperProps = {
  /** Total number of steps. */
  steps: number;
  /** The active step, 1-indexed. Steps before it render as done. */
  current: number;
};

function InviteStepper({ steps, current }: InviteStepperProps) {
  const items = Array.from({ length: steps }, (_, i) => i + 1);

  return (
    <div className="mb-[18px] flex items-center px-1">
      {items.map((step) => {
        const done = step < current;
        const isCurrent = step === current;
        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-sans text-[12px] font-extrabold',
                done && 'border-good bg-good text-white',
                isCurrent &&
                  'border-rust bg-rust text-paper shadow-[0_0_0_4px_rgba(210,67,23,0.18)]',
                !done &&
                  !isCurrent &&
                  'border-paper-2 bg-paper-2 text-ink-soft',
              )}
            >
              {done ? '✓' : step}
            </div>
            {step < steps ? (
              <div
                className={cn(
                  'mx-2 h-0.5 flex-1',
                  done ? 'bg-good' : 'bg-paper-2',
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export { InviteStepper };
export type { InviteStepperProps };
