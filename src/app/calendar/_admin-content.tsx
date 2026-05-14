import { CalendarClientFilterBar } from '@/components/admin/calendar/CalendarClientFilterBar';
import { CalendarLegend } from '@/components/admin/calendar/CalendarLegend';
import { CalendarTodayPanel } from '@/components/admin/calendar/CalendarTodayPanel';
import { CalendarGrid } from '@/components/shared/calendar/CalendarGrid';
import { CalendarToolbar } from '@/components/shared/calendar/CalendarToolbar';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { adminCalendar } from '@/lib/calendar/admin-calendar';

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
        <CalendarClientFilterBar filters={filters} defaultActiveId="all" />
        <CalendarToolbar periodLabel={week.periodLabel} />
        <CalendarLegend items={legend} meta={legendMeta} />
        <CalendarGrid week={week} />
        <CalendarTodayPanel panel={today} />
      </div>
    </>
  );
}

export { AdminCalendarContent };
