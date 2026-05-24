'use client';

import { useState } from 'react';

import { AddBookingButton } from '@/components/shared/bookings/AddBookingButton';
import { CalendarGrid } from '@/components/shared/calendar/CalendarGrid';
import { CalendarMonthGrid } from '@/components/shared/calendar/CalendarMonthGrid';
import { CalendarToolbar } from '@/components/shared/calendar/CalendarToolbar';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { useClientCalendar } from '@/lib/bookings/queries';
import { shiftAnchor, todayIso } from '@/lib/calendar/anchor';
import { voltlineCalendar } from '@/lib/calendar/client-calendar';
import type { CalendarView } from '@/lib/calendar/types';
import { normalizeError } from '@/lib/errors';

function ClientCalendarContent() {
  const { hero } = voltlineCalendar;
  const [view, setView] = useState<CalendarView>('week');
  const [anchorIso, setAnchorIso] = useState(todayIso);
  const { data, error } = useClientCalendar(view, anchorIso);

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Home']} current="Calendar" />}
      />
      <div className="flex flex-col gap-3.5 px-4 py-6 md:px-10 md:py-10">
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
        {!data ? (
          <CalendarNotice>
            {error
              ? `// ${normalizeError(error).message}`
              : '// Loading calendar…'}
          </CalendarNotice>
        ) : (
          <>
            <CalendarToolbar
              periodLabel={
                data.mode === 'grid'
                  ? data.week.periodLabel
                  : data.month.periodLabel
              }
              view={view}
              onViewChange={setView}
              onPrev={() => setAnchorIso((iso) => shiftAnchor(iso, view, -1))}
              onNext={() => setAnchorIso((iso) => shiftAnchor(iso, view, 1))}
              onToday={() => setAnchorIso(todayIso())}
            />
            {data.mode === 'grid' ? (
              <CalendarGrid week={data.week} />
            ) : (
              <CalendarMonthGrid
                month={data.month}
                onSelectDay={(iso) => {
                  setView('day');
                  setAnchorIso(iso);
                }}
              />
            )}
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
