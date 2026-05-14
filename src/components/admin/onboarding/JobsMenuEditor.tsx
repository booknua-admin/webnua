import type { JobsMenuItem } from '@/lib/onboarding/types';
import { cn } from '@/lib/utils';

type JobsMenuEditorProps = {
  jobs: JobsMenuItem[];
  className?: string;
};

function JobsMenuEditor({ jobs, className }: JobsMenuEditorProps) {
  const flatCount = jobs.filter((j) => j.type === 'flat').length;
  const quoteCount = jobs.filter((j) => j.type === 'quote').length;

  return (
    <div
      data-slot="jobs-editor"
      className={cn(
        'overflow-hidden rounded-lg border border-rule bg-card',
        className,
      )}
    >
      <div
        data-slot="jobs-editor-header"
        className="flex items-center justify-between border-b border-rule bg-paper-2 px-4.5 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-quiet [&_strong]:text-ink"
      >
        <span>
          <strong>{jobs.length} jobs</strong> · {flatCount} flat-rate ·{' '}
          {quoteCount} quote-only
        </span>
        <span className="cursor-pointer">Reorder ↕</span>
      </div>
      {jobs.map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
      <div
        data-slot="add-job-row"
        className="flex cursor-pointer items-center gap-1.5 border-t border-rule bg-paper px-4.5 py-3 font-sans text-[13px] font-bold text-rust"
      >
        ⊕ Add job to menu
      </div>
    </div>
  );
}

function JobRow({ job }: { job: JobsMenuItem }) {
  return (
    <div
      data-slot="job-row"
      className="grid grid-cols-[1fr_90px_100px_24px] items-center gap-3 border-b border-paper-2 px-4.5 py-2.5 last:border-b-0"
    >
      <span className="font-sans text-[14px] font-semibold text-ink">
        {job.name}
      </span>
      <input
        data-slot="job-row-price-input"
        readOnly
        value={job.price}
        className="rounded-[5px] border border-rule bg-paper px-2.5 py-1.5 text-right font-sans text-[13px] font-bold text-rust"
      />
      <span
        data-slot="job-row-flag"
        data-type={job.type}
        className={cn(
          'rounded-full px-1.5 py-1 text-center font-mono text-[9px] font-bold uppercase tracking-[0.1em]',
          job.type === 'flat'
            ? 'bg-good-soft text-good'
            : 'bg-info-soft text-info',
        )}
      >
        {job.type === 'flat' ? 'FLAT' : 'QUOTE'}
      </span>
      <span className="cursor-grab text-center font-mono text-rule">⋮⋮</span>
    </div>
  );
}

export { JobsMenuEditor };
