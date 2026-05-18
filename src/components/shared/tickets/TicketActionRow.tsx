import Link from 'next/link';

import { cn } from '@/lib/utils';

type TicketActionRowProps = {
  icon: string;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

const ROW_CLASS =
  'mt-1.5 flex w-full items-center gap-2 rounded-[10px] border border-ink/10 bg-transparent px-3 py-2.5 text-left text-[13px] text-ink transition-colors first:mt-0';
const ENABLED_CLASS = 'hover:border-rust hover:text-rust';
const DISABLED_CLASS = 'cursor-not-allowed opacity-55';

function TicketActionRow({
  icon,
  label,
  href,
  onClick,
  disabled,
  className,
}: TicketActionRowProps) {
  const content = (
    <>
      <span aria-hidden className="text-[14px]">
        {icon}
      </span>
      {label}
    </>
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        data-slot="ticket-action-row"
        className={cn(ROW_CLASS, ENABLED_CLASS, className)}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-slot="ticket-action-row"
      className={cn(
        ROW_CLASS,
        disabled ? DISABLED_CLASS : ENABLED_CLASS,
        className,
      )}
    >
      {content}
    </button>
  );
}

export { TicketActionRow };
export type { TicketActionRowProps };
