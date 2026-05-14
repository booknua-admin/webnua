import { AddBookingButton } from '@/components/shared/bookings/AddBookingButton';
import { CalendarGrid } from '@/components/shared/calendar/CalendarGrid';
import { CalendarToolbar } from '@/components/shared/calendar/CalendarToolbar';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { voltlineCalendar } from '@/lib/calendar/client-calendar';
import { voltlineNewBooking } from '@/lib/bookings/new-booking-modal';

function ClientCalendarContent() {
  const { hero, week } = voltlineCalendar;
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
          <AddBookingButton data={voltlineNewBooking} />
        </div>
        <CalendarToolbar periodLabel={week.periodLabel} />
        <CalendarGrid week={week} />
      </div>
    </>
  );
}

export { ClientCalendarContent };
