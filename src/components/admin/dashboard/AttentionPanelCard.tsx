import Link from 'next/link';

import type {
  AgencyTone,
  AttentionPanelData,
  AttentionRow,
} from '@/lib/dashboard/admin-dashboard-types';
import { cn } from '@/lib/utils';

const META_TONE: Record<AgencyTone, string> = {
  rust: 'text-rust',
  good: 'text-good',
  quiet: 'text-ink-quiet',
};

/**
 * One of the three triage panels on the agency dashboard — header (heading +
 * count chip + optional link) over a list of `AttentionRow`s. A panel with a
 * `placeholder` set renders an honest "awaiting integration" notice instead.
 */
function AttentionPanelCard({ panel }: { panel: AttentionPanelData }) {
  return (
    <div className="flex flex-col rounded-xl border border-rule bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-paper-2 px-5.5 py-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">
            {panel.heading}
          </h3>
          {panel.count != null ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-paper-2 px-1.5 font-mono text-[11px] font-bold text-ink-quiet">
              {panel.count}
            </span>
          ) : null}
        </div>
        {panel.link ? (
          <Link
            href={panel.link.href}
            className="font-mono text-[11px] font-bold uppercase tracking-[0.07em] text-rust transition-colors hover:text-rust-deep"
          >
            {panel.link.label}
          </Link>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col">
        {panel.placeholder ? (
          <PanelNotice>{panel.placeholder}</PanelNotice>
        ) : panel.rows.length === 0 ? (
          <PanelNotice>{'// All clear'}</PanelNotice>
        ) : (
          panel.rows.map((row) => <PanelRow key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}

function PanelNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex flex-1 items-center justify-center px-5.5 py-10 text-center font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
      {children}
    </p>
  );
}

function PanelRow({ row }: { row: AttentionRow }) {
  const inner = (
    <>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-ink font-sans text-[13px] font-extrabold text-rust-light">
        {row.initial}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-bold text-ink">
          {row.title}
        </div>
        <div
          className={cn(
            'mt-0.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
            META_TONE[row.metaTone ?? 'quiet'],
          )}
        >
          {row.meta}
        </div>
      </div>
    </>
  );

  const base =
    'flex items-center gap-3 border-b border-paper-2 px-5.5 py-3.5 last:border-b-0';

  return row.href ? (
    <Link
      href={row.href}
      className={cn(base, 'transition-colors hover:bg-paper-2/50')}
    >
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}

export { AttentionPanelCard };
