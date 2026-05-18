'use client';

import { CalendarLegend } from '@/components/admin/calendar/CalendarLegend';
import { CalendarTodayPanel } from '@/components/admin/calendar/CalendarTodayPanel';
import { AddBookingButton } from '@/components/shared/bookings/AddBookingButton';
import { CalendarGrid } from '@/components/shared/calendar/CalendarGrid';
import { CalendarToolbar } from '@/components/shared/calendar/CalendarToolbar';
import { FilterChips } from '@/components/shared/FilterChips';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { normalizeError } from '@/lib/errors';
import { useAdminCalendar } from '@/lib/bookings/queries';
import { adminCalendar } from '@/lib/calendar/admin-calendar';
import { freshhomeNewBooking } from '@/lib/bookings/new-booking-modal';

function AdminCalendarContent() {
  const { hero } = adminCalendar;
  const { data, isLoading, error } = useAdminCalendar();

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Calendar" />
        }
      />
      <div className="flex flex-col gap-3.5 px-10 py-10">
        <PageHeader
          eyebrow={hero.eyebrow}
          title={hero.title}
          subtitle={hero.subtitle}
        />
        {isLoading ? (
          <CalendarNotice>{'// Loading calendar…'}</CalendarNotice>
        ) : error || !data ? (
          <CalendarNotice>
            {`// ${error ? normalizeError(error).message : 'Calendar unavailable'}`}
          </CalendarNotice>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FilterChips
                label="// CLIENT"
                chips={data.filters}
                defaultActiveId="all"
              />
              <AddBookingButton data={freshhomeNewBooking} />
            </div>
            <CalendarToolbar periodLabel={data.week.periodLabel} />
            <CalendarLegend items={data.legend} meta={data.legendMeta} />
            <CalendarGrid week={data.week} />
            <CalendarTodayPanel panel={data.today} />
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

export { AdminCalendarContent };
