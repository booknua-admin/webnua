// =============================================================================
// Notification feed — data access (Phase 3).
//
// The client notification bell + feed reads the `notifications` table; RLS
// scopes rows to the recipient (`recipient_user_id = auth.uid()`), so the feed
// is inherently per-user. Read-state is the `notification_reads` join (same
// shape as `lead_reads`, design §5 #12) — a notification is `read` when a
// join row exists for the signed-in user.
//
// The `title` column stores templated plain text (design §5 — the stub's
// ReactNode title bends to text). The action chips are UI affordances derived
// here from `kind` + `source_entity_type` / `source_entity_id`, not data.
//
// queryFn throws `AppError`; React Query catches it into a typed `error`.
// =============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { relativeTime } from '@/lib/time';

import type {
  NotificationAction,
  NotificationItem,
  NotificationKind,
} from './types';

// ---- Row shapes -------------------------------------------------------------

type NotificationRow = {
  id: string;
  kind: NotificationKind;
  title: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  created_at: string;
};

const NOTIFICATION_SELECT =
  'id, kind, title, source_entity_type, source_entity_id, created_at';

// ---- Derivations ------------------------------------------------------------

/** The primary "open" affordance for a notification — derived from its source
 *  entity (design: action chips are UI, composed here, not stored). */
function openAction(
  entityType: string | null,
  entityId: string | null,
): NotificationAction | null {
  if (!entityId) {
    // Ticket notifications carry no entity id — the ticket detail route keys
    // on the display reference, not the uuid — so they link to the inbox.
    if (entityType === 'review') return { label: 'View review', href: '/reviews' };
    if (entityType === 'ticket') return { label: 'Open ticket', href: '/tickets' };
    return null;
  }
  switch (entityType) {
    case 'lead':
      return { label: 'Open lead', href: `/leads/${entityId}` };
    case 'booking':
      return { label: 'Open booking', href: `/bookings/${entityId}` };
    case 'review':
      return { label: 'View review', href: '/reviews' };
    case 'ticket':
      return { label: 'Open ticket', href: `/tickets/${entityId}` };
    default:
      return null;
  }
}

function deriveActions(row: NotificationRow): NotificationAction[] {
  const actions: NotificationAction[] = [];
  const open = openAction(row.source_entity_type, row.source_entity_id);
  if (open) actions.push(open);
  actions.push({ label: 'Mark read', secondary: true });
  return actions;
}

function mapNotification(
  row: NotificationRow,
  readIds: Set<string>,
): NotificationItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    actions: deriveActions(row),
    time: relativeTime(row.created_at),
    read: readIds.has(row.id),
  };
}

// ---- Fetch ------------------------------------------------------------------

async function fetchNotifications(): Promise<NotificationItem[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const [notificationsResult, readsResult] = await Promise.all([
    supabase
      .from('notifications')
      .select(NOTIFICATION_SELECT)
      .order('created_at', { ascending: false }),
    supabase
      .from('notification_reads')
      .select('notification_id')
      .eq('user_id', user.id),
  ]);

  if (notificationsResult.error) {
    throw normalizeError(notificationsResult.error);
  }
  if (readsResult.error) throw normalizeError(readsResult.error);

  const readIds = new Set(
    (readsResult.data ?? []).map((r) => r.notification_id),
  );

  return (notificationsResult.data as NotificationRow[]).map((row) =>
    mapNotification(row, readIds),
  );
}

const NOTIFICATIONS_KEY = ['notifications', 'feed'] as const;

/** The signed-in user's notification feed — RLS scopes rows to the recipient,
 *  read-state resolves through the `notification_reads` join. */
export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: fetchNotifications,
  });
}

// ---- Mutation: mark read ----------------------------------------------------

async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  // Insert one `notification_reads` row per notification; the composite PK
  // makes a re-mark idempotent.
  const readAt = new Date().toISOString();
  const { error } = await supabase.from('notification_reads').upsert(
    ids.map((notification_id) => ({
      notification_id,
      user_id: user.id,
      read_at: readAt,
    })),
    { onConflict: 'notification_id,user_id', ignoreDuplicates: true },
  );

  if (error) throw normalizeError(error);
}

/** Mark one or more notifications read — persists `notification_reads` rows
 *  and invalidates the feed so the read-state reflows. */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}
