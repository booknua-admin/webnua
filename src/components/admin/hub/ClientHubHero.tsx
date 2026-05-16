import Link from 'next/link';

import { Button } from '@/components/ui/button';
import type { HubHero, ManagementState } from '@/lib/dashboard/hub-types';
import { INK_HERO_TAG_CLASS, inkHeroSurface } from '@/lib/ink-hero';
import { cn } from '@/lib/utils';

type ClientHubHeroProps = {
  hero: HubHero;
  className?: string;
};

function statusTag(hero: HubHero): string {
  const lifecycle = hero.lifecycle === 'live' ? 'LIVE' : 'ONBOARDING';
  return `// ${hero.clientName.toUpperCase()} · ${lifecycle} · DAY ${hero.liveDayCount}`;
}

/** Composed from `ManagementState` parts — never stored as prose. */
function managementLine(m: ManagementState): string {
  if (m.primary === 'operator') {
    return `${m.operatorName} is managing — client hands-off ${m.clientLastActiveDays} days`;
  }
  return `Client-managed — ${m.operatorName} on standby`;
}

/**
 * The single-client overview hub's ink hero (Screen 20). First consumer of the
 * `inkHero` styling recipe — see `lib/ink-hero.ts` for the resolved verdict.
 */
function ClientHubHero({ hero, className }: ClientHubHeroProps) {
  const focal = hero.leadFocal;
  const { breakdown } = focal;

  return (
    <div data-slot="client-hub-hero" className={inkHeroSurface(className)}>
      <span className={INK_HERO_TAG_CLASS}>{statusTag(hero)}</span>

      <h1 className="mt-3 text-[32px] font-extrabold leading-none tracking-[-0.03em]">
        {hero.clientName}
      </h1>
      <p className="mt-2.5 text-[13px] leading-[1.5] text-paper/65">
        {hero.identityFacts.join(' · ')}
        <span className="mt-1 block text-paper/55">{managementLine(hero.managementState)}</span>
      </p>

      <div className="mt-5 flex items-end gap-5 border-t border-paper/10 pt-5">
        <div className="font-mono text-[64px] font-semibold leading-none text-rust-light">
          {focal.count}
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold">{focal.label}</div>
          <div className="mt-1 text-[13px] leading-[1.5] text-paper/65">
            {breakdown.booked} booked, {breakdown.pendingCallback} pending callback,{' '}
            {breakdown.ghosted} ghosted
          </div>
        </div>
        <Button asChild>
          <Link href={focal.cta.href}>{focal.cta.label}</Link>
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3.5 border-t border-paper/10 pt-5">
        {hero.stats.map((stat) => (
          <div key={stat.kind} data-slot="client-hub-hero-stat">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-paper/50">
              {`// ${stat.label}`}
            </div>
            <div className="mt-1.5 text-[24px] font-extrabold tracking-[-0.02em]">{stat.value}</div>
            <div
              className={cn(
                'mt-0.5 text-[12px]',
                stat.captionTone === 'good' ? 'text-good' : 'text-paper/55',
              )}
            >
              {stat.caption}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { ClientHubHero };
export type { ClientHubHeroProps };
