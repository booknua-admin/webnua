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
// inboxes + every detail thread). Website-approval realtime is deferred — the
// approval store is the `website_approval_submissions` table, but that table
// is not in the `supabase_realtime` publication, so the approvals tab
// refetches via React Query instead (see CLAUDE.md remaining-phases).
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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return <>{children}</>;
}
