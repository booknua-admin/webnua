'use client';

// =============================================================================
// Realtime — live invalidation for the genuinely-live surfaces (Phase 9).
//
// One Supabase Realtime channel per signed-in browser tab. postgres_changes
// events are RLS-scoped, so each subscription only delivers rows the user is
// allowed to see. On any event the matching React Query keys are invalidated —
// the surfaces refetch and reflow without a poll.
//
// Covered: notifications (the bell feed), tickets + ticket_messages (both
// inboxes + every detail thread), and website_approval_submissions (the
// operator approvals queue + every editor publish-state surface — B1: the
// approval write path is Supabase, so a second operator approving from
// another session now propagates without a manual refresh).
//
// The provider holds no context — it only runs the subscription effect and
// passes children straight through.
// =============================================================================

import { useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { useUser } from '@/lib/auth/user-stub';
import { supabase } from '@/lib/supabase/client';

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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'website_approval_submissions' },
        () => {
          // One approval write touches three reader hooks — the operator
          // queue, the per-website publish state, and the per-user pending
          // submission. Each is keyed under ['website', …]; invalidate the
          // three prefixes (not the broad ['website'] prefix, which would
          // also refetch unrelated builder queries).
          invalidate(['website', 'pending-all']);
          invalidate(['website', 'publish-state']);
          invalidate(['website', 'pending-for-user']);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return <>{children}</>;
}
