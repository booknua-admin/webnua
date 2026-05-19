'use client';

import type {
  AgencyTone,
  ClientPerformanceCardData,
} from '@/lib/dashboard/admin-dashboard-types';
import { StatusDot } from '@/components/ui/status-dot';
import { cn } from '@/lib/utils';

type ClientPerformanceCardProps = {
  card: ClientPerformanceCardData;
  /** Drills the workspace into this client's sub-account. */
  onSelect: (slug: string) => void;
};

const STATUS_TEXT: Record<AgencyTone, string> = {
  rust: 'text-rust',
  good: 'text-good',
  quiet: 'text-ink-quiet',
};

const STATUS_DOT: Record<AgencyTone, 'rust' | 'good' | 'quiet'> = {
  rust: 'rust',
  good: 'good',
  quiet: 'quiet',
};

/**
 * A single card in the agency dashboard's horizontal "Client performance"
 * rail. Clicking it drills the workspace into that client's sub-account.
 * At-risk clients carry a rust-soft surface so they read at a glance.
 */
function ClientPerformanceCard({ card, onSelect }: ClientPerformanceCardProps) {
  const atRisk = card.statusTone === 'rust';

  return (
    <button
      type="button"
      onClick={() => onSelect(card.slug)}
      className={cn(
        'flex w-[284px] shrink-0 flex-col gap-3.5 rounded-xl border px-5 py-5 text-left transition-colors',
        atRisk
          ? 'border-rust/35 bg-rust-soft hover:border-rust/60'
          : 'border-rule bg-card hover:border-rust/40',
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-ink text-sm font-extrabold text-rust-light">
          {card.initial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold text-ink">
            {card.name}
          </div>
          <div className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
            {card.meta}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          label="// Leads 7d"
          value={card.leads7d == null ? '—' : String(card.leads7d)}
        />
        <Metric
          label="// Booked 7d"
          value={card.booked7d == null ? '—' : String(card.booked7d)}
        />
      </div>

      <p className="text-[12px] leading-[1.4] text-ink-mid">{card.note}</p>

      <div className="flex items-center justify-between border-t border-paper-2 pt-3">
        <span
          className={cn(
            'flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
            STATUS_TEXT[card.statusTone],
          )}
        >
          <StatusDot tone={STATUS_DOT[card.statusTone]} />
          {card.statusLabel}
        </span>
        <span className="font-mono text-[11px] text-ink-quiet">
          {card.spend}
        </span>
      </div>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-paper-2 px-3 py-2.5">
      <div className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        {label}
      </div>
      <div className="mt-1 text-[20px] font-extrabold leading-none tracking-[-0.02em] text-ink">
        {value}
      </div>
    </div>
  );
}

export { ClientPerformanceCard };
