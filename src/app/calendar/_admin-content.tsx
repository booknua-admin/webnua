import { CalendarLegend } from '@/components/admin/calendar/CalendarLegend';
import { CalendarTodayPanel } from '@/components/admin/calendar/CalendarTodayPanel';
import { AddBookingButton } from '@/components/shared/bookings/AddBookingButton';
import { CalendarGrid } from '@/components/shared/calendar/CalendarGrid';
import { CalendarToolbar } from '@/components/shared/calendar/CalendarToolbar';
import { FilterChips } from '@/components/shared/FilterChips';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { adminCalendar } from '@/lib/calendar/admin-calendar';
import { freshhomeNewBooking } from '@/lib/bookings/new-booking-modal';

function AdminCalendarContent() {
  const { hero, filters, legend, legendMeta, week, today } = adminCalendar;
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips label="// CLIENT" chips={filters} defaultActiveId="all" />
          <AddBookingButton data={freshhomeNewBooking} />
        </div>
        <CalendarToolbar periodLabel={week.periodLabel} />
        <CalendarLegend items={legend} meta={legendMeta} />
        <CalendarGrid week={week} />
        <CalendarTodayPanel panel={today} />
      </div>
    </>
  );
}

export { AdminCalendarContent };
