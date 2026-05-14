import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { ClientBookingActionTone } from '@/lib/bookings/types';

type BookingActionBtnProps = {
  icon: string;
  label: string;
  tone?: ClientBookingActionTone;
  href?: string;
  onClick?: () => void;
  className?: string;
};

const TONE_CLASSES: Record<
  Exclude<ClientBookingActionTone, undefined>,
  string
> = {
  primary:
    'border-rust bg-rust text-paper hover:bg-rust-deep hover:border-rust-deep',
  secondary:
    'border-rule bg-paper text-ink hover:bg-ink hover:text-paper hover:border-ink',
  danger:
    'border-rule bg-paper text-warn hover:bg-warn hover:text-paper hover:border-warn',
};

function BookingActionBtn({
  icon,
  label,
  tone = 'secondary',
  href,
  onClick,
  className,
}: BookingActionBtnProps) {
  const classes = cn(
    'mb-2 flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-[13px] font-semibold transition-colors last:mb-0',
    TONE_CLASSES[tone],
    className,
  );

  const body = (
    <>
      <span
        aria-hidden
        className="w-[18px] text-center font-mono"
      >
        {icon}
      </span>
      {label}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {body}
    </button>
  );
}

export { BookingActionBtn };
export type { BookingActionBtnProps };
