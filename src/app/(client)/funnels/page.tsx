import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ui/eyebrow';
import { FunnelStepThumbnail } from '@/components/client/funnels/FunnelStepThumbnail';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusDot } from '@/components/ui/status-dot';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { voltlineFunnel } from '@/lib/funnels/client-detail';

export default function ClientFunnelsListPage() {
  const funnel = voltlineFunnel;

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Funnels" />} />
      <div className="px-10 py-7">
        <PageHeader
          eyebrow="Funnels"
          title={
            <>
              Your booking <em>funnels</em>.
            </>
          }
          subtitle={
            <>
              The conversion pipelines Webnua built for you. Click a funnel to
              see step-by-step performance, drop-off, insights and version
              history. <strong>Webnua manages updates</strong> — text Craig to
              change anything.
            </>
          }
        />

        <div className="grid grid-cols-1 gap-3.5">
          <Link
            href={`/funnels/${funnel.id}`}
            className="group flex items-center gap-6 rounded-[14px] border border-rule bg-card px-6 py-5 transition-colors hover:border-rust"
          >
            <div className="flex items-center gap-1.5">
              <FunnelStepThumbnail variant="landing" className="w-28" />
              <span className="font-mono text-[12px] text-ink-quiet">→</span>
              <FunnelStepThumbnail variant="schedule" className="w-28" />
              <span className="font-mono text-[12px] text-ink-quiet">→</span>
              <FunnelStepThumbnail variant="thanks" className="w-28" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2">
                <Eyebrow tone="rust">{'// Webnua-managed'}</Eyebrow>
                <Badge variant="muted" className="gap-1.5">
                  <StatusDot tone="good" />
                  Live
                </Badge>
              </div>
              <div className="text-[20px] font-extrabold tracking-[-0.02em] text-ink [&_em]:not-italic [&_em]:text-rust">
                $99 <em>emergency call-out</em> funnel
              </div>
              <div className="mt-1 font-mono text-[11px] tracking-[0.04em] text-ink-quiet">
                book.voltline.com.au · v3 · 14d ago
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-7">
              <div className="text-right">
                <div className="text-[24px] font-extrabold leading-none tracking-[-0.02em] text-rust">
                  412
                </div>
                <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                  {'// Visits · 14d'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[24px] font-extrabold leading-none tracking-[-0.02em] text-good">
                  14
                </div>
                <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                  {'// Booked · 3.4%'}
                </div>
              </div>
              <span className="font-mono text-[12px] font-bold tracking-[0.04em] text-rust transition-transform group-hover:translate-x-0.5">
                Open →
              </span>
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}
