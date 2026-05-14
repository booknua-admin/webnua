import { cn } from '@/lib/utils';

type ApiKeyRowProps = {
  name: string;
  token: string;
  createdLabel: React.ReactNode;
  usedLabel: React.ReactNode;
  className?: string;
};

function ApiKeyRow({ name, token, createdLabel, usedLabel, className }: ApiKeyRowProps) {
  return (
    <div
      data-slot="api-key-row"
      className={cn(
        'mb-2 grid grid-cols-[1fr_130px_100px_80px] items-center gap-3.5 rounded-lg border border-rule bg-paper px-[18px] py-3.5',
        className,
      )}
    >
      <div>
        <div className="mb-1 text-[13px] font-bold text-ink">{name}</div>
        <div className="font-mono text-[11px] tracking-[0.04em] text-ink-quiet">{token}</div>
      </div>
      <div className="font-mono text-[10px] tracking-[0.04em] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
        {createdLabel}
      </div>
      <div className="font-mono text-[10px] tracking-[0.04em] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
        {usedLabel}
      </div>
      <span className="cursor-pointer text-right font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-warn">
        Revoke
      </span>
    </div>
  );
}

export { ApiKeyRow };
