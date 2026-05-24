'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  useDismissFollowup,
  useLeadAutomationState,
  useResumeAutomations,
  useTakeOverLead,
} from '@/lib/leads/queries';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

type LeadAutomationPanelProps = {
  leadId: string;
};

/**
 * Per-lead automation + handoff side-rail panel (Phase 8 Session 2).
 *
 * Renders three concerns in one card:
 *   1. The lead's current handoff state — automated / taken_over / completed /
 *      archived — with the Take over / Resume affordances mapped to the
 *      handoff API.
 *   2. The cold-lead state — needsFollowupAt + nudgeCount, with a Dismiss
 *      affordance when an undismissed nudge is pending.
 *   3. The list of in-flight automation runs on this lead (running + paused),
 *      each showing the automation name, current step, pause reason if any,
 *      and the next-action ETA.
 *
 * Data comes from GET /api/leads/[id]/automation-state which carries the
 * lead row + the active runs in one round-trip.
 */
function LeadAutomationPanel({ leadId }: LeadAutomationPanelProps) {
  const { data, isLoading, error } = useLeadAutomationState(leadId);
  const takeOver = useTakeOverLead();
  const resume = useResumeAutomations();
  const dismiss = useDismissFollowup();
  const [confirmingTakeOver, setConfirmingTakeOver] = useState(false);

  const lastOutboundAt = data?.lead.lastOutboundAt ?? null;
  const daysSinceLastOutbound = useMemo(() => {
    if (!lastOutboundAt) return null;
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    return Math.max(0, Math.floor((now - Date.parse(lastOutboundAt)) / 86_400_000));
  }, [lastOutboundAt]);

  return (
    <div className="overflow-hidden rounded-[14px] border border-ink/8 bg-card">
      <div className="border-b border-paper-2 bg-paper px-4.5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        {'// AUTOMATIONS'}
      </div>
      {isLoading ? (
        <p className="px-4.5 py-6 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          {'// Loading…'}
        </p>
      ) : error || !data ? (
        <p className="px-4.5 py-6 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-warn">
          {'// Could not load automation state'}
        </p>
      ) : (
        <>
          {/* (1) Handoff state */}
          <div className="px-4.5 py-3.5">
            <HandoffStateRow state={data.lead.automationState} />
            <div className="mt-3 flex flex-wrap gap-2">
              {data.lead.automationState === 'automated' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  disabled={takeOver.isPending || confirmingTakeOver}
                  onClick={() => {
                    setConfirmingTakeOver(true);
                    takeOver.mutate(leadId, {
                      onSettled: () => setConfirmingTakeOver(false),
                    });
                  }}
                >
                  {takeOver.isPending ? 'Taking over…' : 'Take over this lead'}
                </Button>
              ) : null}
              {data.lead.automationState === 'taken_over' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  disabled={resume.isPending}
                  onClick={() => resume.mutate(leadId)}
                >
                  {resume.isPending ? 'Resuming…' : 'Resume automations'}
                </Button>
              ) : null}
            </div>
            {data.lead.takenOverAt ? (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
                Taken over {relativeTime(data.lead.takenOverAt)}
              </p>
            ) : null}
          </div>

          {/* (2) Cold-lead state */}
          {data.lead.needsFollowupAt && !data.lead.followupDismissedAt ? (
            <div className="border-t border-paper-2 bg-warn-soft/30 px-4.5 py-3.5">
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-warn">
                <span aria-hidden>⚠</span>
                Cold — needs a personal nudge
              </div>
              <p className="mt-1 font-sans text-[12px] leading-[1.4] text-ink-soft">
                No customer reply for{' '}
                {daysSinceLastOutbound === null
                  ? 'some time'
                  : `${daysSinceLastOutbound} days`}{' '}
                · nudge #{data.lead.followupNudgeCount}
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 h-7"
                disabled={dismiss.isPending}
                onClick={() => dismiss.mutate(leadId)}
              >
                {dismiss.isPending ? 'Dismissing…' : 'Dismiss nudge'}
              </Button>
            </div>
          ) : null}

          {/* (3) Active runs */}
          {data.runs.length > 0 ? (
            <div className="border-t border-paper-2">
              <div className="bg-paper-2/40 px-4.5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                {`// ACTIVE RUNS · ${data.runs.length}`}
              </div>
              <ul>
                {data.runs.map((run) => (
                  <li
                    key={run.id}
                    className="border-b border-paper-2 px-4.5 py-2.5 last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-sans text-[12px] font-semibold text-ink">
                        {run.automationName}
                      </span>
                      <RunStatusPill
                        status={run.status}
                        pausedReason={run.pausedReason}
                      />
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
                      Step {run.currentActionPosition} / {run.totalActions}
                      {run.nextRunAt ? (
                        <span className="ml-2">
                          next: {relativeTime(run.nextRunAt)}
                        </span>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="border-t border-paper-2 px-4.5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
              {'// No active runs on this lead'}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HandoffStateRow({
  state,
}: {
  state: 'automated' | 'taken_over' | 'completed' | 'archived';
}) {
  const label =
    state === 'automated'
      ? 'Automated — Webnua handling'
      : state === 'taken_over'
      ? 'You took this over — automations paused'
      : state === 'completed'
      ? 'Completed — no more automations will fire'
      : 'Archived';
  const tone =
    state === 'automated'
      ? 'text-good bg-good/12'
      : state === 'taken_over'
      ? 'text-rust bg-rust/12'
      : state === 'completed'
      ? 'text-ink-quiet bg-ink/8'
      : 'text-ink-quiet bg-ink/8';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
        tone,
      )}
    >
      <span className={cn('size-1.5 rounded-full', state === 'automated' ? 'bg-good animate-pulse' : 'bg-current')} />
      {label}
    </span>
  );
}

function RunStatusPill({
  status,
  pausedReason,
}: {
  status: string;
  pausedReason: string | null;
}) {
  if (status === 'paused') {
    const label =
      pausedReason === 'lead_replied'
        ? 'paused · replied'
        : pausedReason === 'client_took_over'
        ? 'paused · taken over'
        : 'paused';
    return (
      <span className="inline-flex items-center rounded-full bg-info/12 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-info">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rust/12 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-rust">
      <span className="size-1.5 rounded-full bg-rust animate-pulse" />
      running
    </span>
  );
}

export { LeadAutomationPanel };
export type { LeadAutomationPanelProps };
