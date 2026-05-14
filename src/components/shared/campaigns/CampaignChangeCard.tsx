import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CampaignChangeCardData } from '@/lib/campaigns/types';

type CampaignChangeCardProps = {
  data: CampaignChangeCardData;
  className?: string;
};

/**
 * Bottom "want to change something?" CTA card on client `/campaigns`. White
 * card with body text + 1-2 right-aligned action buttons. Buttons render via
 * the canonical `Button` primitive (primary → rust default; non-primary →
 * secondary).
 */
function CampaignChangeCard({ data, className }: CampaignChangeCardProps) {
  return (
    <div
      data-slot="campaign-change-card"
      className={cn(
        'grid grid-cols-[1fr_auto] items-center gap-5 rounded-xl border border-rule bg-card px-6 py-5.5',
        className,
      )}
    >
      <p className="text-[14px] leading-[1.55] text-ink-soft [&_strong]:font-bold [&_strong]:text-ink">
        {data.body}
      </p>
      <div className="flex shrink-0 gap-2">
        {data.actions.map((action) => (
          <Button
            key={action.label}
            variant={action.primary ? 'default' : 'secondary'}
            className="h-9 text-[13px]"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export { CampaignChangeCard };
export type { CampaignChangeCardProps };
