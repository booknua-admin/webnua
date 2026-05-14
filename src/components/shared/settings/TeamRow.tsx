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
  actions: { label: string; tone?: 'default' | 'danger' }[];
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
        'grid grid-cols-[44px_1fr_160px_140px_90px] items-center gap-4 border-b border-paper-2 py-4 last:border-b-0',
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
      <div>
        <div className="text-[13px] font-semibold text-ink">{role}</div>
        <div className="mt-0.5 font-mono text-[10px] font-semibold tracking-[0.04em] text-ink-quiet">
          {roleSub}
        </div>
      </div>
      <span
        data-slot="team-status"
        className={cn(
          'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
          status === 'active' ? 'bg-good-soft text-good' : 'bg-rust-soft text-rust',
        )}
      >
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 rounded-full', status === 'active' ? 'bg-good' : 'bg-rust')}
        />
        {statusLabel}
      </span>
      <div className="flex justify-end gap-1.5">
        {actions.map((action) => (
          <span
            key={action.label}
            data-slot="team-action-btn"
            data-tone={action.tone ?? 'default'}
            className={cn(
              'cursor-pointer rounded-md border border-rule bg-paper-2 px-2.5 py-[5px] font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink-soft hover:bg-ink hover:text-paper',
              action.tone === 'danger' && 'hover:border-warn hover:bg-warn',
            )}
          >
            {action.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export { TeamRow };
