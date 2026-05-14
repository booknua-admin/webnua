import { cn } from '@/lib/utils';

type BookingNotesBoxProps = {
  children: React.ReactNode;
  className?: string;
};

function BookingNotesBox({ children, className }: BookingNotesBoxProps) {
  return (
    <div
      data-slot="booking-notes-box"
      className={cn(
        'rounded-lg border-l-[3px] border-rule bg-paper px-4 py-3.5 text-[14px] leading-[1.55] text-ink-soft [&_strong]:font-bold [&_strong]:text-ink',
        className,
      )}
    >
      {children}
    </div>
  );
}

export { BookingNotesBox };
export type { BookingNotesBoxProps };
