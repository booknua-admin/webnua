import { CalendarGrid } from '@/components/shared/calendar/CalendarGrid';
import { CalendarToolbar } from '@/components/shared/calendar/CalendarToolbar';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { voltlineCalendar } from '@/lib/calendar/client-calendar';

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
        <CalendarToolbar periodLabel={week.periodLabel} />
        <CalendarGrid week={week} />
      </div>
    </>
  );
}

export { ClientCalendarContent };
