'use client';

import { useState } from 'react';

import { ChipSelector } from '@/components/shared/ChipSelector';
import { ConflictModal } from '@/components/shared/bookings/ConflictModal';
import { FrequencyGrid } from '@/components/shared/bookings/FrequencyGrid';
import { RecurringCustomerHeader } from '@/components/shared/bookings/RecurringCustomerHeader';
import { RecurringPreviewList } from '@/components/shared/bookings/RecurringPreviewList';
import { RecurringSummaryBar } from '@/components/shared/bookings/RecurringSummaryBar';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Input } from '@/components/ui/input';
import { voltlineConflict } from '@/lib/bookings/conflict-modal';
import { voltlineRecurring } from '@/lib/bookings/recurring-setup';

export default function ClientRecurringNewPage() {
  const r = voltlineRecurring;
  const [conflictOpen, setConflictOpen] = useState(false);
  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Calendar']} current="New recurring" />
        }
      />
      <div className="px-10 py-10">
        <PageHeader
          eyebrow={r.hero.eyebrow}
          title={r.hero.title}
          subtitle={r.hero.subtitle}
        />

        <div className="mb-4.5 rounded-[12px] border border-rule bg-card px-8 py-7">
          <RecurringCustomerHeader
            initial={r.customer.initial}
            name={r.customer.name}
            meta={r.customer.meta}
          />

          <RecurringSection heading="Frequency">
            <FrequencyGrid
              options={r.frequencies}
              defaultId={r.defaultFrequencyId}
            />
          </RecurringSection>

          <RecurringSection heading="Day of week">
            <ChipSelector
              options={r.days}
              defaultId={r.defaultDayId}
              variant="mono"
            />
          </RecurringSection>

          <RecurringSection heading="Time">
            <div className="grid grid-cols-2 gap-3.5">
              <LabeledInput label="Start" value={r.time.start} />
              <LabeledInput label="Duration" value={r.time.duration} />
            </div>
          </RecurringSection>

          <RecurringSection heading="Job type + price">
            <div className="grid grid-cols-2 gap-3.5">
              <LabeledInput label="Service" value={r.job.service} />
              <LabeledInput label="Price per visit" value={r.job.pricePerVisit} />
            </div>
          </RecurringSection>

          <RecurringSection heading={<><strong>Next 4 bookings</strong> · preview</>}>
            <RecurringPreviewList
              heading={
                <>
                  Will be added to your calendar ·{' '}
                  <strong>customer auto-confirmed for each</strong>
                </>
              }
              rows={r.preview}
            />
          </RecurringSection>
        </div>

        <RecurringSummaryBar
          summary={r.summary}
          summaryDetail={r.summaryDetail}
          totalLabel={r.totalLabel}
          ctaLabel={r.ctaLabel}
          onCta={() => setConflictOpen(true)}
          className="mb-4.5"
        />

        <ConflictModal
          open={conflictOpen}
          onOpenChange={setConflictOpen}
          data={voltlineConflict}
          onSaveHref="/calendar"
        />

        <p className="mx-auto max-w-[720px] text-center text-[13px] leading-[1.5] text-ink-quiet [&_strong]:text-ink">
          {r.note}
        </p>
      </div>
    </>
  );
}

function RecurringSection({
  heading,
  children,
}: {
  heading: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5.5 last:mb-0">
      <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet [&_strong]:text-ink">
        // {heading}
      </div>
      {children}
    </section>
  );
}

function LabeledInput({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </label>
      <Input className="bg-paper" defaultValue={value} readOnly />
    </div>
  );
}
