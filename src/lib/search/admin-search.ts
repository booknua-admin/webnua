// =============================================================================
// Global search — operator stub (admin Screen 35). Cross-client results for
// the canonical query "sarah". Decorative for the stub layer: the page renders
// this regardless of the actual query string.
// =============================================================================

import type { SearchResults } from './types';

export const adminSearchResults: SearchResults = {
  query: 'sarah',
  scopeLabel: 'leads, bookings, reviews, conversations across all clients',
  groups: [
    {
      kind: 'lead',
      label: 'Leads',
      results: [
        {
          id: 'lead-sarah-davies',
          kind: 'lead',
          avatar: 'SD',
          title: 'Sarah Davies',
          meta: 'FreshHome · 3-bed Mt Hawthorn · new lead · 32 min ago',
          href: '/leads/sarah-davies',
        },
        {
          id: 'lead-sarah-hawthorne',
          kind: 'lead',
          avatar: 'SH',
          title: 'Sarah Hawthorne',
          meta: 'KeyHero · lockout · contacted · 3 days ago',
          href: '/leads/sarah-hawthorne',
        },
        {
          id: 'lead-sarah-jane-patel',
          kind: 'lead',
          avatar: 'SP',
          title: 'Sarah-Jane Patel',
          meta: 'FreshHome · bond clean · booked · 8 days ago',
          href: '/leads/sarah-jane-patel',
        },
        {
          id: 'lead-sarah-mcallister',
          kind: 'lead',
          avatar: 'SM',
          title: 'Sarah McAllister',
          meta: 'NeatWorks · end-of-tenancy · completed · 12 days ago',
          href: '/leads/sarah-mcallister',
        },
      ],
    },
    {
      kind: 'booking',
      label: 'Bookings',
      results: [
        {
          id: 'booking-davies',
          kind: 'booking',
          avatar: '▦',
          title: 'Sarah Davies · Wed 2pm',
          meta: 'FreshHome · powerpoint install + light fittings · $145 · scheduled',
          href: '/bookings/booking-davies',
        },
        {
          id: 'booking-patel',
          kind: 'booking',
          avatar: '▦',
          title: 'Sarah-Jane Patel · 8 days ago',
          meta: 'FreshHome · bond clean · $285 · completed',
          href: '/bookings/booking-patel',
        },
        {
          id: 'booking-mcallister',
          kind: 'booking',
          avatar: '▦',
          title: 'Sarah McAllister · 12 days ago',
          meta: 'NeatWorks · end-of-tenancy · $240 · completed',
          href: '/bookings/booking-mcallister',
        },
      ],
    },
    {
      kind: 'review',
      label: 'Reviews',
      results: [
        {
          id: 'review-mcallister',
          kind: 'review',
          avatar: '★',
          title: '5★ from Sarah McAllister',
          meta: 'NeatWorks · "Best end-of-tenancy clean I\'ve had." · 12 days ago',
          href: '/reviews',
        },
        {
          id: 'review-patel',
          kind: 'review',
          avatar: '★',
          title: '5★ from Sarah-Jane Patel',
          meta: 'FreshHome · "Lisa is amazing, photo proof every visit." · 8 days ago',
          href: '/reviews',
        },
        {
          id: 'review-tindall',
          kind: 'review',
          avatar: '★',
          title: '4★ from Sarah Tindall',
          meta: 'NeatWorks · "Cleaner was 20 mins late but great work." · 14 days ago',
          href: '/reviews',
        },
      ],
    },
    {
      kind: 'conversation',
      label: 'Conversations',
      results: [
        {
          id: 'conversation-davies',
          kind: 'conversation',
          avatar: '✉',
          title: 'Conversation with Sarah Davies',
          meta: 'FreshHome · 4 messages · last reply 14 min ago',
          href: '/leads/sarah-davies/conversation',
        },
        {
          id: 'conversation-patel',
          kind: 'conversation',
          avatar: '✉',
          title: 'Conversation with Sarah-Jane Patel',
          meta: 'FreshHome · 8 messages · last reply 8 days ago',
          href: '/leads/sarah-jane-patel/conversation',
        },
      ],
    },
  ],
};
