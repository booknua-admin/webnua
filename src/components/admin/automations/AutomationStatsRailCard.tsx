'use client';

import { useAutomationStats } from '@/lib/automations/queries';

type AutomationStatsRailCardProps = {
  automationId: string;
  heading?: string;
};

/**
 * Right-rail stats card — last-30-day completion / pause / failure rates and
 * average completion time. Replaces the placeholder `AutomationPerformanceCard`
 * (which renders "—" by default) on the editor surfaces.
 *
 * The stats are computed in `useAutomationStats` from `automation_runs` rows
 * the caller is allowed to see (SELECT RLS in 0076 — operators see their
 * accessible clients' runs; clients see their own). No new schema.
 */
function AutomationStatsRailCard({
  automationId,
  heading = '// PERFORMANCE · 30D',
}: AutomationStatsRailCardProps) {
  const { data, isLoading } = useAutomationStats(automationId);

  return (
    <div className="overflow-hidden rounded-[14px] border border-rule bg-card">
      <div className="border-b border-paper-2 bg-paper px-4.5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        {heading}
      </div>
      {isLoading || !data ? (
        <div className="px-4.5 py-6 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          {'// Crunching…'}
        </div>
      ) : (
        <ul className="divide-y divide-paper-2">
          <Row label="Triggered" value={String(data.totalRuns)} />
          <Row
            label="Completed"
            value={`${data.completedRuns} (${data.completionRate}%)`}
            tone="good"
          />
          <Row
            label="Paused (handoff)"
            value={`${data.pausedRuns} (${data.pauseRate}%)`}
            tone="accent"
          />
          <Row label="Failed" value={String(data.failedRuns)} tone="warn" />
          <Row
            label="Avg completion"
            value={
              data.avgCompletionSeconds === null
                ? '—'
                : formatDuration(data.avgCompletionSeconds)
            }
          />
        </ul>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'accent' | 'warn';
}) {
  return (
    <li className="flex items-center justify-between px-4.5 py-2.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        {label}
      </span>
      <span
        className={
          tone === 'good'
            ? 'font-sans text-[13px] font-bold text-good'
            : tone === 'accent'
            ? 'font-sans text-[13px] font-bold text-rust'
            : tone === 'warn'
            ? 'font-sans text-[13px] font-bold text-warn'
            : 'font-sans text-[13px] font-bold text-ink'
        }
      >
        {value}
      </span>
    </li>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.round((seconds % 86400) / 3600);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

export { AutomationStatsRailCard };
export type { AutomationStatsRailCardProps };
