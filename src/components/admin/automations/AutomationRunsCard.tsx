'use client';

import { useAutomationRuns } from '@/lib/automations/queries';
import type { AutomationEditorRun } from '@/lib/automations/types';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

type AutomationRunsCardProps = {
  automationId: string;
  /** Cap on the number of runs to render. The hook limits the fetch too. */
  limit?: number;
  heading?: string;
};

/**
 * Right-rail card listing the most-recent automation runs for one automation.
 * Each row shows the trigger event summary, the status pill (with paused
 * reason inline when applicable), the action position the run reached, and
 * a relative time.
 *
 * The data comes through `useAutomationRuns` which uses the SELECT RLS
 * policy on `automation_runs` (migration 0076 — operators see their
 * accessible clients' runs; clients see their own).
 */
function AutomationRunsCard({
  automationId,
  limit = 20,
  heading = '// RECENT RUNS',
}: AutomationRunsCardProps) {
  const { data: runs, isLoading, error } = useAutomationRuns(automationId, limit);

  return (
    <div className="overflow-hidden rounded-[14px] border border-rule bg-card">
      <div className="border-b border-paper-2 bg-paper px-4.5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        {heading}
      </div>
      {isLoading ? (
        <p className="px-4.5 py-6 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          {'// Loading runs…'}
        </p>
      ) : error ? (
        <p className="px-4.5 py-6 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-warn">
          {'// Could not load runs'}
        </p>
      ) : !runs || runs.length === 0 ? (
        <p className="px-4.5 py-6 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          {'// No runs yet. Trigger fires will land here.'}
        </p>
      ) : (
        <ul>
          {runs.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RunRow({ run }: { run: AutomationEditorRun }) {
  return (
    <li className="border-b border-paper-2 px-4.5 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <span className="font-sans text-[13px] font-semibold text-ink">
          {run.triggerSummary}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {relativeTime(run.startedAt)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <StatusPill status={run.status} pausedReason={run.pausedReason} />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          step {run.currentActionPosition}
        </span>
        {run.errorMessage ? (
          <span
            className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-warn"
            title={run.errorMessage}
          >
            err: {run.errorMessage.slice(0, 60)}
            {run.errorMessage.length > 60 ? '…' : ''}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function StatusPill({
  status,
  pausedReason,
}: {
  status: AutomationEditorRun['status'];
  pausedReason: AutomationEditorRun['pausedReason'];
}) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-good/12 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-good">
        ✓ completed
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft/40 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-warn">
        ✗ failed
      </span>
    );
  }
  if (status === 'paused') {
    const label =
      pausedReason === 'lead_replied'
        ? 'paused · lead replied'
        : pausedReason === 'client_took_over'
        ? 'paused · client took over'
        : 'paused';
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-info/12 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-info">
        {label}
      </span>
    );
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ink/8 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
        cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rust/12 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-rust">
      <span className={cn('size-1.5 rounded-full bg-rust animate-pulse')} />
      running
    </span>
  );
}

export { AutomationRunsCard };
export type { AutomationRunsCardProps };
