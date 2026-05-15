'use client';

// =============================================================================
// PreflightChecklist — Session 8. Renders a PreflightReport: a summary row
// (pass / warn / fail counts) plus the list of warn + fail results. Passing
// rules collapse to the green count — only issues get a row.
//
// Hard-fail results block publish; warnings allow publish with confirmation.
// The publish gating itself lives on the review surface; this component is
// presentation only.
// =============================================================================

import Link from 'next/link';

import { cn } from '@/lib/utils';
import type {
  PreflightReport,
  PreflightResult,
  PreflightStatus,
} from '@/lib/website/preflight';

const STATUS_META: Record<
  PreflightStatus,
  { glyph: string; dot: string; text: string; chipBg: string }
> = {
  pass: {
    glyph: '✓',
    dot: 'bg-good',
    text: 'text-good',
    chipBg: 'bg-good-soft',
  },
  warn: {
    glyph: '!',
    dot: 'bg-warn',
    text: 'text-warn',
    chipBg: 'bg-warn/15',
  },
  fail: {
    glyph: '✕',
    dot: 'bg-warn',
    text: 'text-warn',
    chipBg: 'bg-warn/20',
  },
};

export type PreflightChecklistProps = {
  report: PreflightReport;
  className?: string;
};

export function PreflightChecklist({
  report,
  className,
}: PreflightChecklistProps) {
  const issues = report.results.filter((r) => r.status !== 'pass');

  return (
    <div
      data-slot="preflight-checklist"
      className={cn(
        'overflow-hidden rounded-xl border border-rule bg-card',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-rule bg-paper-2 px-5 py-3">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
          {'// PREFLIGHT'}
        </p>
        <div className="flex items-center gap-2">
          <CountChip status="pass" count={report.counts.pass} label="passed" />
          <CountChip status="warn" count={report.counts.warn} label="warnings" />
          <CountChip status="fail" count={report.counts.fail} label="blockers" />
        </div>
      </div>

      <div className="px-5 py-4">
        {report.allClear ? (
          <div className="flex items-center gap-3 rounded-lg bg-good-soft px-4 py-3">
            <span className="flex size-6 items-center justify-center rounded-full bg-good text-[12px] font-bold text-paper">
              ✓
            </span>
            <p className="text-[13.5px] font-semibold text-ink">
              All clear — every preflight rule passed. Ready to publish.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {issues
              .slice()
              .sort((a, b) => (a.status === 'fail' ? -1 : 1) - (b.status === 'fail' ? -1 : 1))
              .map((result, i) => (
                <PreflightRow key={`${result.ruleId}-${i}`} result={result} />
              ))}
          </ul>
        )}
        {!report.canPublish ? (
          <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-warn">
            {report.counts.fail} blocker
            {report.counts.fail === 1 ? '' : 's'} must be fixed before publishing.
          </p>
        ) : report.counts.warn > 0 ? (
          <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
            Warnings don&rsquo;t block publish — you can ship and fix later.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CountChip({
  status,
  count,
  label,
}: {
  status: PreflightStatus;
  count: number;
  label: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
        count > 0 ? meta.chipBg : 'bg-paper-2',
        count > 0 ? meta.text : 'text-ink-quiet',
      )}
    >
      <span className={cn('size-1.5 rounded-full', count > 0 ? meta.dot : 'bg-rule')} />
      {count} {label}
    </span>
  );
}

function PreflightRow({ result }: { result: PreflightResult }) {
  const meta = STATUS_META[result.status];
  return (
    <li className="flex items-start gap-3 rounded-lg border border-rule bg-paper px-3.5 py-3">
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-paper',
          meta.dot,
        )}
      >
        {meta.glyph}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-ink">{result.title}</p>
        <p className="mt-0.5 text-[12.5px] leading-[1.5] text-ink-mid">
          {result.message}
        </p>
      </div>
      {result.fixHref ? (
        <Link
          href={result.fixHref}
          className="mt-0.5 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-rust hover:text-rust-deep"
        >
          Fix →
        </Link>
      ) : null}
    </li>
  );
}
