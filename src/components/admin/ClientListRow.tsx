import Link from 'next/link';

import { StatusDot } from '@/components/ui/status-dot';
import { cn } from '@/lib/utils';

type ClientStatus = 'live' | 'setup';

type ClientListRowProps = {
  id: string;
  initial: string;
  name: string;
  meta: string;
  status: ClientStatus;
  leadsPerWeek: number;
  spend: string;
  href: string;
};

const STATUS_LABEL: Record<ClientStatus, string> = {
  live: 'Live',
  setup: 'In setup',
};

function ClientListRow({
  initial,
  name,
  meta,
  status,
  leadsPerWeek,
  spend,
  href,
}: ClientListRowProps) {
  return (
    <Link
      href={href}
      data-slot="client-list-row"
      className="grid grid-cols-[32px_1fr_120px_100px_120px_80px] items-center gap-4 rounded-lg border border-rule bg-card px-[22px] py-4 transition-colors hover:border-rust/40 hover:bg-paper-2/40"
    >
      <div className="flex size-8 items-center justify-center rounded-[8px] bg-ink font-sans text-sm font-extrabold text-rust-light">
        {initial}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[15px] font-bold text-ink">{name}</div>
        <div className="mt-0.5 truncate text-[12px] text-ink-quiet">{meta}</div>
      </div>
      <div
        className={cn(
          'flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase',
          status === 'live' ? 'text-good' : 'text-rust',
        )}
      >
        <StatusDot tone={status === 'live' ? 'good' : 'rust'} />
        {STATUS_LABEL[status]}
      </div>
      <div className="text-sm font-bold text-ink">
        <span className="text-rust">{leadsPerWeek}</span>{' '}
        <span className="text-ink-quiet font-medium">leads/wk</span>
      </div>
      <div className="text-[13px] text-ink-quiet">{spend} spend</div>
      <div className="text-right text-[12px] font-bold text-rust">Open →</div>
    </Link>
  );
}

export { ClientListRow };
export type { ClientStatus };
