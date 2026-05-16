import { Fragment } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import type { DashboardUrgentHero, UrgentThreshold } from '@/lib/dashboard/client-dashboard-types';
import { INK_HERO_TAG_CLASS, inkHeroSurface } from '@/lib/ink-hero';
import { cn } from '@/lib/utils';

type ClientDashboardHeroProps = {
  hero: DashboardUrgentHero;
  className?: string;
};

const THRESHOLD_TAG: Record<UrgentThreshold, string> = {
  overdue: '// NEEDS YOU NOW',
  'due-today': '// DUE TODAY',
};

/**
 * The urgent ink-hero at the top of the client dashboard (Screen 1): a big
 * callback count + the named leads behind it + an inbox CTA. The sub-line is
 * composed from the structured `callouts` — never a stored sentence.
 */
function ClientDashboardHero({ hero, className }: ClientDashboardHeroProps) {
  return (
    <div
      data-slot="client-dashboard-hero"
      className={inkHeroSurface(cn('grid grid-cols-[1fr_auto] items-center gap-6', className))}
    >
      <div>
        <span className={INK_HERO_TAG_CLASS}>{THRESHOLD_TAG[hero.threshold]}</span>
        <div className="mt-3 text-[84px] font-black leading-[0.88] tracking-[-0.045em] text-rust-light">
          {hero.count}
        </div>
        <div className="mt-1.5 text-[20px] font-medium text-paper/85">{hero.label}</div>
        {hero.callouts.length > 0 ? (
          <p className="mt-2 max-w-[420px] text-[13px] leading-[1.45] text-paper/60">
            {hero.callouts.map((callout, i) => (
              <Fragment key={callout.name}>
                {i > 0 ? ' ' : null}
                <strong className="font-bold text-paper">
                  {callout.name} ({callout.age})
                </strong>{' '}
                — {callout.note}.
              </Fragment>
            ))}
          </p>
        ) : null}
      </div>
      <Button asChild size="lg">
        <Link href={hero.cta.href}>{hero.cta.label}</Link>
      </Button>
    </div>
  );
}

export { ClientDashboardHero };
export type { ClientDashboardHeroProps };
