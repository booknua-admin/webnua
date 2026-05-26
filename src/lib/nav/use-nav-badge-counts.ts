// =============================================================================
// Sidebar nav badge counts (operator + client).
//
// Replaces the hardcoded `badge: { text: '23' }` / `{ text: '7' }` constants
// that used to live in admin-nav.ts / client-nav.ts. Both are derived live
// from the existing TanStack-cached inbox hooks (zero extra round-trips —
// the inbox surfaces query the same data), and operator badges are
// workspace-mode aware: agency mode counts every accessible client;
// sub-account mode counts only the active client.
//
// Definition (shared with the corresponding hero stat tiles):
//   * Leads badge   = unread lead count    (LeadRow.unread === true)
//   * Tickets badge = open ticket count    (TicketRow.status === 'open')
//
// `SidebarItem` hides the badge when the rendered text is `'0'` / empty, so
// returning 0 here means the badge disappears entirely from the rail —
// honest empty state with no manual gating in the consumer.
// =============================================================================

'use client';

import { useMemo } from 'react';

import { useAdminLeadsInbox, useClientLeadsInbox } from '@/lib/leads/queries';
import {
  useAdminTicketsInbox,
  useClientTicketsInbox,
} from '@/lib/tickets/queries';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export type NavBadgeCounts = {
  leads: number;
  tickets: number;
};

/** Live counts for the operator sidebar. Filters by workspace mode:
 *  agency = all accessible clients; sub-account = active client only. */
export function useAdminNavBadgeCounts(): NavBadgeCounts {
  const { activeClientId } = useWorkspace();
  const { data: leads } = useAdminLeadsInbox();
  const { data: tickets } = useAdminTicketsInbox();

  return useMemo(() => {
    const inScopeSlug = (slug: string) =>
      activeClientId === null || slug === activeClientId;

    const leadCount = (leads ?? []).filter(
      (row) => inScopeSlug(row.clientSlug) && row.unread,
    ).length;

    const ticketCount = (tickets ?? []).filter(
      (row) => inScopeSlug(row.client.slug) && row.status === 'open',
    ).length;

    return { leads: leadCount, tickets: ticketCount };
  }, [leads, tickets, activeClientId]);
}

/** Live counts for the client sidebar — single-tenant, no workspace mode. */
export function useClientNavBadgeCounts(): NavBadgeCounts {
  const { data: leads } = useClientLeadsInbox();
  const { data: tickets } = useClientTicketsInbox();

  return useMemo(() => {
    const leadCount = (leads ?? []).filter((row) => row.unread).length;
    // A client viewing their own tickets cares about "awaiting your reply",
    // not raw open count — the prototype tag literally said "N need your
    // reply". `awaiting === 'client'` maps to that meaning.
    const ticketCount = (tickets ?? []).filter(
      (row) => row.awaiting === 'client',
    ).length;
    return { leads: leadCount, tickets: ticketCount };
  }, [leads, tickets]);
}
