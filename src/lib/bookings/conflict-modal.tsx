// Conflict-modal shapes. The modal is data-driven — the recurring-booking
// page builds a `ConflictModalData` from the real overlap-check result.

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
  /** "// SCHEDULING CONFLICT · 1 OF 10 VISITS" */
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
  /** Primary-action label — varies per scenario. */
  saveLabel: string;
};

export type { ConflictCardSide, ConflictModalData, ConflictOption };
