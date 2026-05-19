'use client';

import { useMemo, useState } from 'react';

import { CalendarLegend } from '@/components/admin/calendar/CalendarLegend';
import { CalendarTodayPanel } from '@/components/admin/calendar/CalendarTodayPanel';
import { AddBookingButton } from '@/components/shared/bookings/AddBookingButton';
import { CalendarGrid } from '@/components/shared/calendar/CalendarGrid';
import { CalendarToolbar } from '@/components/shared/calendar/CalendarToolbar';
import { ClientMultiSelect } from '@/components/shared/ClientMultiSelect';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { normalizeError } from '@/lib/errors';
import { useAdminCalendar } from '@/lib/bookings/queries';
import { adminCalendar } from '@/lib/calendar/admin-calendar';

function AdminCalendarContent() {
  const { hero } = adminCalendar;
  const { data, isLoading, error } = useAdminCalendar();
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  // Per-client booking counts across the visible week — shown in the dropdown.
  const clientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const day of data?.week.days ?? []) {
      for (const b of day.bookings) {
        if (b.clientSlug) counts[b.clientSlug] = (counts[b.clientSlug] ?? 0) + 1;
      }
    }
    return counts;
  }, [data]);

  // The client filter narrows the grid bookings + the today panel jobs.
  const filtered = useMemo(() => {
    if (!data || selectedClients.length === 0) return data;
    const inFilter = (slug?: string) =>
      slug != null && selectedClients.includes(slug);
    return {
      ...data,
      week: {
        ...data.week,
        days: data.week.days.map((day) => ({
          ...day,
          bookings: day.bookings.filter((b) => inFilter(b.clientSlug)),
        })),
      },
      today: {
        ...data.today,
        jobs: data.today.jobs.filter((j) => inFilter(j.clientSlug)),
      },
    };
  }, [data, selectedClients]);

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
        ) : error || !filtered ? (
          <CalendarNotice>
            {`// ${error ? normalizeError(error).message : 'Calendar unavailable'}`}
          </CalendarNotice>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ClientMultiSelect
                label="// CLIENT"
                value={selectedClients}
                onChange={setSelectedClients}
                counts={clientCounts}
              />
              <AddBookingButton />
            </div>
            <CalendarToolbar periodLabel={filtered.week.periodLabel} />
            <CalendarLegend items={filtered.legend} meta={filtered.legendMeta} />
            <CalendarGrid week={filtered.week} />
            <CalendarTodayPanel panel={filtered.today} />
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
