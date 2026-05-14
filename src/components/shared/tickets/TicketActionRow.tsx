import { cn } from '@/lib/utils';

type TicketActionRowProps = {
  icon: string;
  label: string;
  onClick?: () => void;
  className?: string;
};

function TicketActionRow({
  icon,
  label,
  onClick,
  className,
}: TicketActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-slot="ticket-action-row"
      className={cn(
        'mt-1.5 flex w-full items-center gap-2 rounded-[10px] border border-ink/10 bg-transparent px-3 py-2.5 text-left text-[13px] text-ink transition-colors first:mt-0 hover:border-rust hover:text-rust',
        className,
      )}
    >
      <span aria-hidden className="text-[14px]">
        {icon}
      </span>
      {label}
    </button>
  );
}

export { TicketActionRow };
export type { TicketActionRowProps };
