type ConflictCardSide = {
  tag: string;
  /** "Thu 25 Jun · 10am" */
  time: string;
  /** "Emma Petrov · building inspection · 2hrs · $180" */
  detail: string;
};

type ConflictOption = {
  id: string;
  /** "1" */
  num: string;
  /** "Skip just this one visit" — `<strong>` is implicit on the title */
  title: string;
  /** Secondary line */
  sub: string;
  /** First option in the list defaults to recommended */
  recommended?: boolean;
};

type ConflictModalData = {
  /** "// SCHEDULING CONFLICT · 1 OF 4 BOOKINGS" */
  tag: string;
  /** "One visit <em>overlaps</em>" */
  title: React.ReactNode;
  /** Includes `<strong>Thu 25 June</strong>` */
  subtitle: React.ReactNode;
  attempted: ConflictCardSide;
  existing: ConflictCardSide;
  /** Explainer between the comparison cards and the option list — `<strong>` = ink */
  explainer: React.ReactNode;
  options: ConflictOption[];
  defaultOptionId: string;
  /** Three footer buttons (Back, Cancel, Save). The save label can vary per scenario. */
  saveLabel: string;
};

const voltlineConflict: ConflictModalData = {
  tag: '// SCHEDULING CONFLICT · 1 OF 4 BOOKINGS',
  title: (
    <>
      One visit <em>overlaps</em>
    </>
  ),
  subtitle: (
    <>
      Your recurring fortnightly booking for Emma Petrov has a conflict on{' '}
      <strong>Thu 25 June</strong> — you already have another job at that time.
    </>
  ),
  attempted: {
    tag: '// WANT TO BOOK',
    time: 'Thu 25 Jun · 10am',
    detail: 'Emma Petrov · building inspection · 2hrs · $180',
  },
  existing: {
    tag: '// ALREADY BOOKED',
    time: 'Thu 25 Jun · 11am',
    detail: 'Banner job · smart switch install × 6 · 2hrs · $420',
  },
  explainer: (
    <>
      <strong>3 of 4 recurring visits</strong> have no conflict and will be
      booked as-is. Choose what to do with the one that overlaps:
    </>
  ),
  options: [
    {
      id: 'skip',
      num: '1',
      title: 'Skip just this one visit',
      sub: "Emma's 25 June visit doesn't get booked. Recurring resumes Thu 9 Jul. Most common choice.",
      recommended: true,
    },
    {
      id: 'move',
      num: '2',
      title: 'Move Emma to 8am that day',
      sub: 'Earlier start. Webnua will text Emma to confirm the time change for that visit only.',
    },
    {
      id: 'reschedule_banner',
      num: '3',
      title: 'Reschedule Banner job',
      sub: 'Move the existing booking to a different time. Webnua will text Banner to confirm.',
    },
    {
      id: 'cancel_recurring',
      num: '4',
      title: 'Cancel recurring · individual bookings instead',
      sub: "Don't set up the recurring schedule. Book each visit manually as they come up.",
    },
  ],
  defaultOptionId: 'skip',
  saveLabel: 'Save recurring (skip 25 Jun) →',
};

export { voltlineConflict };
export type { ConflictCardSide, ConflictModalData, ConflictOption };
