'use client';

// =============================================================================
// Realtime — live invalidation for the genuinely-live surfaces (Phase 9 + A3).
//
// One Supabase Realtime channel per signed-in browser tab. postgres_changes
// events are RLS-scoped, so each subscription only delivers rows the user is
// allowed to see. On any event the matching React Query keys are invalidated —
// the surfaces refetch and reflow without a poll.
//
// Covered:
//   - notifications (the bell feed), tickets + ticket_messages (both inboxes
//     + every detail thread) — invalidate the matching query keys.
//   - lead_events (the leads inbox + detail + conversation surfaces) — any
//     insert (inbound email reply, outbound send, status change, form
//     submission) invalidates the leads queries so the conversation reflows
//     without a navigate-away-and-back.
//   - website / funnel approval submissions + version tables — fan a
//     BUILDER_EVENT via `notifyBuilder`, which every builder query subscribes
//     to. This is both editor-side liveness (a submitter's lock banner clears
//     when an operator resolves) and publication-side (a newly-published
//     version surfacing on the detail / roster surfaces).
//
// B1 first wired website_approval_submissions with targeted query-key
// invalidations; A3 unified all four builder tables under one BUILDER_EVENT
// fan, which subsumes B1's targeting because the affected hooks (operator
// queue, publish-state, pending submissions) are all useBuilderQuery-based.
//
// The tables are added to the supabase_realtime publication by migration 0032
// (notifications / tickets), 0046 (approval + version tables), and 0065
// (lead_events).
//
// The provider holds no context — it only runs the subscription effect and
// passes children straight through.
// =============================================================================

import { useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { useUser } from '@/lib/auth/user-stub';
import { supabase } from '@/lib/supabase/client';
import { notifyBuilder } from '@/lib/website/builder-events';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;

    const invalidate = (queryKey: readonly unknown[]) => {
      void queryClient.invalidateQueries({ queryKey });
    };

    const channel = supabase
      .channel(`app-realtime:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        () => invalidate(['notifications', 'feed']),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        () => invalidate(['tickets']),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ticket_messages' },
        () => invalidate(['tickets']),
      )
      // Leads — a new lead_event (inbound email reply, outbound send,
      // status change) invalidates every leads surface. Broad: the inbox
      // preview line + the detail rail + the conversation thread all
      // derive from lead_events, so one invalidation covers them all.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_events' },
        () => invalidate(['leads']),
      )
      // Builder approval lanes — a BUILDER_EVENT refetches every builder query
      // (publish state, approval queue, the editor lock, version history).
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'website_approval_submissions' },
        () => notifyBuilder(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'funnel_approval_submissions' },
        () => notifyBuilder(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'website_versions' },
        () => notifyBuilder(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'funnel_versions' },
        () => notifyBuilder(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return <>{children}</>;
}
