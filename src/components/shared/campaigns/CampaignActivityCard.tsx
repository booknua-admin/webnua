import { ActivityFeed } from '@/components/shared/ActivityFeed';
import type { ActivityRowData, ActivityTone } from '@/components/shared/ActivityRow';
import type { CampaignActivityData, CampaignActivityIconTone } from '@/lib/campaigns/types';

type CampaignActivityCardProps = {
  data: CampaignActivityData;
  className?: string;
};

/**
 * "What Webnua's done lately" activity log on client `/campaigns`. A thin
 * domain adapter over the shared `ActivityFeed` — it maps the campaign
 * activity-category vocabulary onto `ActivityFeed`'s colour-keyed tone slots.
 * `CampaignActivityItem` stays uncoupled from `ActivityRowData`; the shaping
 * happens here, at the consumer.
 */

const TONE_MAP: Record<CampaignActivityIconTone, ActivityTone> = {
  creative: 'info',
  audience: 'amber',
  budget: 'good',
  tune: 'rust',
};

function CampaignActivityCard({ data, className }: CampaignActivityCardProps) {
  const items: ActivityRowData[] = data.items.map((item) => ({
    id: item.id,
    icon: item.icon,
    tone: TONE_MAP[item.tone],
    actor: item.who,
    body: item.body,
    detail: item.desc,
    time: item.time,
  }));

  return <ActivityFeed title={data.title} sub={data.sub} items={items} className={className} />;
}

export { CampaignActivityCard };
export type { CampaignActivityCardProps };
