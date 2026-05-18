'use client';

import { AddBookingButton } from '@/components/shared/bookings/AddBookingButton';
import { CalendarGrid } from '@/components/shared/calendar/CalendarGrid';
import { CalendarToolbar } from '@/components/shared/calendar/CalendarToolbar';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { normalizeError } from '@/lib/errors';
import { useClientCalendar } from '@/lib/bookings/queries';
import { voltlineCalendar } from '@/lib/calendar/client-calendar';

function ClientCalendarContent() {
  const { hero } = voltlineCalendar;
  const { data: week, isLoading, error } = useClientCalendar();

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Home']} current="Calendar" />}
      />
      <div className="flex flex-col gap-3.5 px-10 py-10">
        <PageHeader
          eyebrow={hero.eyebrow}
          title={hero.title}
          subtitle={hero.subtitle}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" className="h-9" asChild>
            <a href="/recurring/new">+ Recurring</a>
          </Button>
          <AddBookingButton />
        </div>
        {isLoading ? (
          <CalendarNotice>{'// Loading calendar…'}</CalendarNotice>
        ) : error || !week ? (
          <CalendarNotice>
            {`// ${error ? normalizeError(error).message : 'Calendar unavailable'}`}
          </CalendarNotice>
        ) : (
          <>
            <CalendarToolbar periodLabel={week.periodLabel} />
            <CalendarGrid week={week} />
          </>
        )}
      </div>
    </>
  );
}

function CalendarNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-ink/8 bg-card px-[18px] py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export { ClientCalendarContent };
