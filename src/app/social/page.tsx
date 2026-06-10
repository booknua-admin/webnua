'use client';

// =============================================================================
// /social — the social media calendar (shared route).
//
// Client role → their own calendar. Operator in sub-account mode → the
// active client's calendar. Operator in agency mode → pick-a-client notice
// (the calendar is a per-business surface; there is no cross-client roster
// for it in V1).
// =============================================================================

import { SocialCalendarContent } from '@/components/shared/social/SocialCalendarContent';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useRole, useUser } from '@/lib/auth/user-stub';
import { useClientId } from '@/lib/clients/queries';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-rule bg-card px-5.5 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export default function SocialPage() {
  const { role, hydrated } = useRole();
  const user = useUser();
  const { activeClientId } = useWorkspace();

  // Client role uses their own slug; operator uses the active sub-account's.
  const slug = role === 'client' ? (user?.clientId ?? null) : (activeClientId ?? null);
  const { data: clientUuid } = useClientId(slug);

  if (!hydrated) return null;

  if (role === 'admin' && !activeClientId) {
    return (
      <>
        <Topbar breadcrumb={<TopbarBreadcrumb current="Social" />} />
        <div className="flex flex-col gap-7 px-4 py-6 md:px-10 md:py-10">
          <Notice>{'// Pick a client from the sidebar to manage their social calendar'}</Notice>
        </div>
      </>
    );
  }

  return <SocialCalendarContent clientUuid={clientUuid ?? null} />;
}
