type DangerEntry = {
  id: string;
  heading: string;
  description: React.ReactNode;
  action: { label: string; solid?: boolean; tone?: 'neutral' | 'destructive' };
};

export const adminDangerWorkspace: DangerEntry[] = [
  {
    id: 'export',
    heading: 'Export workspace data',
    description: (
      <>
        Download every lead, booking, automation, review, and page version as a ZIP archive. ~2-5
        minutes to prepare. <strong>Recommended before any destructive action.</strong>
      </>
    ),
    action: { label: 'Request export', tone: 'neutral' },
  },
  {
    id: 'transfer',
    heading: 'Transfer workspace ownership',
    description: (
      <>
        Hand Webnua Perth to another team member. <strong>You&apos;ll lose Owner role.</strong>{' '}
        Useful if you&apos;re selling the agency or splitting it.
      </>
    ),
    action: { label: 'Transfer' },
  },
  {
    id: 'pause',
    heading: 'Pause workspace',
    description: (
      <>
        Suspend all automations, ad campaign read-syncs, and client-facing logins for 30 days.{' '}
        <strong>Pages stay live</strong> but no leads flow. Reversible.
      </>
    ),
    action: { label: 'Pause' },
  },
  {
    id: 'delete',
    heading: 'Delete workspace permanently',
    description: (
      <>
        Removes all data after a 14-day grace period. Pages go offline. Clients lose access
        immediately. <strong>This cannot be undone after day 14.</strong>
      </>
    ),
    action: { label: 'Delete workspace', solid: true },
  },
];

export const adminDangerClient: DangerEntry[] = [
  {
    id: 'offboard',
    heading: 'Offboard a client',
    description: (
      <>
        Walks through page archival, automation pause, GBP disconnect, final invoice, and data
        export. <strong>Takes ~15 minutes</strong> for a fully-set-up client.
      </>
    ),
    action: { label: 'Start offboarding', tone: 'neutral' },
  },
];
