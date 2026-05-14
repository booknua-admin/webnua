import type { IntegrationLogoTone } from '@/components/shared/settings/IntegrationCard';
import { cn } from '@/lib/utils';

type MatrixCellStatus = 'connected' | 'warning' | 'missing';

type MatrixIntegrationColumn = {
  id: string;
  label: string;
  logo: { initial: string; tone: IntegrationLogoTone };
};

type MatrixClientAvatarTone = 'voltline' | 'freshhome' | 'keyhero' | 'flowline' | 'generic';

type MatrixClientRow = {
  id: string;
  name: string;
  meta: string;
  initial: string;
  tone?: MatrixClientAvatarTone;
  cells: Record<string, MatrixCellStatus>;
  progress: { connected: number; total: number };
};

type MatrixFilter = {
  id: string;
  label: string;
};

type IntegrationMatrixProps = {
  title: React.ReactNode;
  filters: MatrixFilter[];
  activeFilter: string;
  columns: MatrixIntegrationColumn[];
  rows: MatrixClientRow[];
  className?: string;
};

const logoToneClass: Record<IntegrationLogoTone, string> = {
  gbp: 'bg-[#4285F4]',
  meta: 'bg-[#1877F2]',
  ga: 'bg-[#E37400]',
  gads: 'bg-[#34A853]',
  stripe: 'bg-[#635BFF]',
  generic: 'bg-ink',
};

const avatarToneClass: Record<MatrixClientAvatarTone, string> = {
  voltline: 'bg-rust',
  freshhome: 'bg-[#2d4a3a]',
  keyhero: 'bg-[#6a5230]',
  flowline: 'bg-[#2d4a6a]',
  generic: 'bg-ink',
};

const cellStatusClass: Record<MatrixCellStatus, string> = {
  connected: 'bg-good/15 text-good',
  warning: 'bg-warn/15 text-warn',
  missing: 'border border-dashed border-ink/20 bg-ink/[0.06] text-ink/35',
};

const cellGlyph: Record<MatrixCellStatus, string> = {
  connected: '✓',
  warning: '!',
  missing: '×',
};

function progressTone(connected: number, total: number): 'good' | 'warn' | 'bad' {
  if (connected === total) return 'good';
  if (connected / total < 0.5) return 'bad';
  return 'warn';
}

function IntegrationMatrix({
  title,
  filters,
  activeFilter,
  columns,
  rows,
  className,
}: IntegrationMatrixProps) {
  return (
    <div
      data-slot="integration-matrix"
      className={cn('overflow-hidden rounded-2xl border border-ink/[0.08] bg-paper', className)}
    >
      <div className="flex items-center justify-between border-b border-ink/[0.06] px-[22px] py-4">
        <div className="text-[14px] font-semibold text-ink [&_em]:not-italic [&_em]:font-medium [&_em]:text-rust">
          {title}
        </div>
        <div className="flex gap-1">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              data-active={filter.id === activeFilter || undefined}
              className={cn(
                'cursor-pointer rounded-full border border-ink/10 bg-transparent px-2.5 py-[5px] text-[11px] text-ink/65 transition-colors hover:border-ink hover:text-ink',
                'data-[active=true]:border-ink data-[active=true]:bg-ink data-[active=true]:text-paper',
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="grid w-full"
        style={{
          gridTemplateColumns: `220px repeat(${columns.length}, 1fr) 100px`,
        }}
      >
        {/* Column headers */}
        <div className="flex items-center justify-start gap-2 border-b border-ink/[0.08] bg-paper-2 py-3.5 pl-[22px] pr-3 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/55">
          {'// Client'}
        </div>
        {columns.map((col) => (
          <div
            key={col.id}
            className="flex items-center justify-center gap-2 border-b border-ink/[0.08] bg-paper-2 px-3 py-3.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/55"
          >
            <span
              className={cn(
                'flex h-[22px] w-[22px] items-center justify-center rounded-md text-[11px] font-bold text-white',
                logoToneClass[col.logo.tone],
              )}
            >
              {col.logo.initial}
            </span>
            {col.label}
          </div>
        ))}
        <div className="flex items-center justify-center border-b border-ink/[0.08] bg-paper-2 px-3 py-3.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/55">
          Setup
        </div>

        {/* Body rows */}
        {rows.map((row) => {
          const tone = progressTone(row.progress.connected, row.progress.total);
          const pct = Math.round((row.progress.connected / row.progress.total) * 100);
          return (
            <div key={row.id} className="contents group/row cursor-pointer">
              <div className="flex items-center justify-start gap-3 border-b border-ink/[0.06] py-[18px] pl-[22px] pr-3 last:border-b-0 group-hover/row:bg-paper-2">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-paper',
                    avatarToneClass[row.tone ?? 'generic'],
                  )}
                >
                  {row.initial}
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold leading-[1.2] text-ink">{row.name}</div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-ink/50">
                    {row.meta}
                  </div>
                </div>
              </div>

              {columns.map((col) => {
                const status = row.cells[col.id] ?? 'missing';
                return (
                  <div
                    key={col.id}
                    className="flex items-center justify-center border-b border-ink/[0.06] px-3 py-[18px] last:border-b-0 group-hover/row:bg-paper-2"
                  >
                    <span
                      className={cn(
                        'flex h-[38px] w-[38px] items-center justify-center rounded-full text-[18px] font-bold',
                        cellStatusClass[status],
                      )}
                    >
                      {cellGlyph[status]}
                    </span>
                  </div>
                );
              })}

              <div className="flex items-center justify-center border-b border-ink/[0.06] px-3 py-[18px] last:border-b-0 group-hover/row:bg-paper-2">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      'font-mono text-[13px] font-semibold',
                      tone === 'good' && 'text-good',
                      tone === 'warn' && 'text-rust',
                      tone === 'bad' && 'text-warn',
                    )}
                  >
                    {row.progress.connected}/{row.progress.total}
                  </div>
                  <div className="h-1 w-[60px] overflow-hidden rounded-full bg-ink/[0.08]">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        tone === 'good' && 'bg-good',
                        tone === 'warn' && 'bg-rust',
                        tone === 'bad' && 'bg-warn',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { IntegrationMatrix };
export type {
  MatrixCellStatus,
  MatrixIntegrationColumn,
  MatrixClientRow,
  MatrixClientAvatarTone,
  MatrixFilter,
};
