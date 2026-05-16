// =============================================================================
// Global search — client stub. A client searches their own account only
// (Voltline here), so results are single-business and carry no `client` kind.
// Canonical query "emma". Decorative for the stub layer.
// =============================================================================

import type { SearchResults } from './types';

export const clientSearchResults: SearchResults = {
  query: 'emma',
  scopeLabel: 'your leads, bookings, reviews and conversations',
  groups: [
    {
      kind: 'lead',
      label: 'Leads',
      results: [
        {
          id: 'lead-emma-petrov',
          kind: 'lead',
          avatar: 'EP',
          title: 'Emma Petrov',
          meta: 'Switchboard upgrade · Mt Lawley · new lead · 1h ago',
          href: '/leads/emma-petrov',
        },
        {
          id: 'lead-emma-reilly',
          kind: 'lead',
          avatar: 'ER',
          title: 'Emma Reilly',
          meta: 'Downlights quote · Inglewood · contacted · 4 days ago',
          href: '/leads/emma-reilly',
        },
      ],
    },
    {
      kind: 'booking',
      label: 'Bookings',
      results: [
        {
          id: 'booking-petrov-inspection',
          kind: 'booking',
          avatar: '▦',
          title: 'Emma Petrov · Thu 10am',
          meta: 'Building inspection · electrical · $260 · scheduled',
          href: '/bookings/booking-petrov-inspection',
        },
        {
          id: 'booking-petrov-recurring',
          kind: 'booking',
          avatar: '▦',
          title: 'Emma Petrov · fortnightly',
          meta: 'Recurring · safety check · $140 · active',
          href: '/bookings/booking-petrov-recurring',
        },
      ],
    },
    {
      kind: 'review',
      label: 'Reviews',
      results: [
        {
          id: 'review-petrov',
          kind: 'review',
          avatar: '★',
          title: '5★ from Emma Petrov',
          meta: '"Fast, tidy, explained everything." · 6 days ago',
          href: '/reviews',
        },
      ],
    },
    {
      kind: 'conversation',
      label: 'Conversations',
      results: [
        {
          id: 'conversation-petrov',
          kind: 'conversation',
          avatar: '✉',
          title: 'Conversation with Emma Petrov',
          meta: '5 messages · last reply 1h ago',
          href: '/leads/emma-petrov/conversation',
        },
      ],
    },
  ],
};
