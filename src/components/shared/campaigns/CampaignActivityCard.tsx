import { cn } from '@/lib/utils';
import type {
  CampaignActivityData,
  CampaignActivityIconTone,
  CampaignActivityItem as CampaignActivityItemData,
} from '@/lib/campaigns/types';

type CampaignActivityCardProps = {
  data: CampaignActivityData;
  className?: string;
};

/**
 * "What Webnua's done lately" activity log on client `/campaigns`. Structurally
 * similar to `LeadTimelineEventRow` (icon + body + age) but the meta vocabulary
 * diverges (no AUTO pill, no scheduled-future variant, 4 icon tones not 7).
 * Built as a sibling rather than reusing the lead-timeline row — revisit at
 * a third data point per the parked-decision discipline.
 */
function CampaignActivityCard({ data, className }: CampaignActivityCardProps) {
  return (
    <div
      data-slot="campaign-activity-card"
      className={cn(
        'rounded-xl border border-rule bg-card px-6 py-5.5',
        className,
      )}
    >
      <div className="mb-1.5 text-[16px] font-extrabold tracking-[-0.015em] text-ink [&_em]:not-italic [&_em]:text-rust">
        {data.title}
      </div>
      <p className="mb-4.5 text-[13px] leading-[1.5] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
        {data.sub}
      </p>
      <div className="flex flex-col">
        {data.items.map((item) => (
          <CampaignActivityRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

const iconToneClass: Record<CampaignActivityIconTone, string> = {
  creative: 'bg-info-soft text-info',
  audience: 'bg-[rgba(245,195,50,0.18)] text-[#b8870e]',
  budget: 'bg-good-soft text-good',
  tune: 'bg-rust-soft text-rust',
};

function CampaignActivityRow({ item }: { item: CampaignActivityItemData }) {
  return (
    <div className="grid grid-cols-[32px_1fr_auto] items-start gap-3.5 border-b border-dotted border-rule py-3.5 last:border-b-0">
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold',
          iconToneClass[item.tone],
        )}
      >
        {item.icon}
      </div>
      <div className="text-[13px] leading-[1.55] text-ink [&_strong]:font-bold">
        <span className="font-bold text-rust">{item.who}</span> {item.body}
        <span className="mt-1 block text-[12px] leading-[1.45] text-ink-quiet">
          {item.desc}
        </span>
      </div>
      <span className="mt-1.5 whitespace-nowrap text-right font-mono text-[10px] font-semibold tracking-[0.04em] text-ink-quiet">
        {item.time}
      </span>
    </div>
  );
}

export { CampaignActivityCard };
export type { CampaignActivityCardProps };
