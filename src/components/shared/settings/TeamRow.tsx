import { cn } from '@/lib/utils';

type TeamRowProps = {
  initial: string;
  name: string;
  isYou?: boolean;
  email: string;
  role: string;
  roleSub: string;
  status: 'active' | 'pending';
  statusLabel: string;
  actions: { label: string; tone?: 'default' | 'danger'; onClick?: () => void }[];
  className?: string;
};

function TeamRow({
  initial,
  name,
  isYou,
  email,
  role,
  roleSub,
  status,
  statusLabel,
  actions,
  className,
}: TeamRowProps) {
  return (
    <div
      data-slot="team-row"
      className={cn(
        // Mobile: avatar + identity on the first row, role / status / actions
        // wrap underneath. Desktop (md+): the original 5-column table row.
        'grid grid-cols-[44px_1fr] items-center gap-x-4 gap-y-2.5 border-b border-paper-2 py-4 last:border-b-0 md:grid-cols-[44px_1fr_160px_140px_90px]',
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-rust to-rust-deep text-[14px] font-extrabold text-paper">
        {initial}
      </div>
      <div className="min-w-0">
        <div className="mb-0.5 flex items-center gap-2 text-[14px] font-bold text-ink">
          {name}
          {isYou ? (
            <span className="rounded-full bg-rust-soft px-1.5 py-[2px] font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-rust">
              You
            </span>
          ) : null}
        </div>
        <div className="font-mono text-[11px] tracking-[0.02em] text-ink-quiet">{email}</div>
      </div>
      <div className="col-start-2 md:col-start-auto">
        <div className="text-[13px] font-semibold text-ink">{role}</div>
        <div className="mt-0.5 font-mono text-[10px] font-semibold tracking-[0.04em] text-ink-quiet">
          {roleSub}
        </div>
      </div>
      <span
        data-slot="team-status"
        className={cn(
          'col-start-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] md:col-start-auto',
          status === 'active' ? 'bg-good-soft text-good' : 'bg-rust-soft text-rust',
        )}
      >
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 rounded-full', status === 'active' ? 'bg-good' : 'bg-rust')}
        />
        {statusLabel}
      </span>
      <div className="col-start-2 flex flex-wrap gap-1.5 md:col-start-auto md:justify-end">
        {actions.map((action) => {
          const baseClass = cn(
            'cursor-pointer rounded-md border border-rule bg-paper-2 px-2.5 py-[5px] font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink-soft hover:bg-ink hover:text-paper',
            action.tone === 'danger' && 'hover:border-warn hover:bg-warn',
          );
          if (action.onClick) {
            return (
              <button
                key={action.label}
                type="button"
                data-slot="team-action-btn"
                data-tone={action.tone ?? 'default'}
                onClick={action.onClick}
                className={baseClass}
              >
                {action.label}
              </button>
            );
          }
          return (
            <span
              key={action.label}
              data-slot="team-action-btn"
              data-tone={action.tone ?? 'default'}
              className={baseClass}
            >
              {action.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export { TeamRow };
