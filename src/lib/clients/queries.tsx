// =============================================================================
// Clients — data access (Phase 3b).
//
// The workspace context + the stub users carry a client *slug* (`voltline`,
// `freshhome`, …); the operational tables key on the client UUID. This module
// resolves the slug → UUID so the booking-write flows have a real FK to write.
//
// queryFn throws `AppError`; a slug with no row resolves as `not_found`.
// =============================================================================

import { useQuery } from '@tanstack/react-query';

import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

async function fetchClientId(slug: string): Promise<string> {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single();
  if (error) throw normalizeError(error);
  return data.id;
}

/** Resolve a client slug to its UUID. Cached indefinitely — a client's id
 *  never changes. Disabled (and so idle) until a slug is supplied. */
export function useClientId(slug: string | null) {
  return useQuery({
    queryKey: ['clients', 'id', slug],
    queryFn: () => fetchClientId(slug as string),
    enabled: slug != null && slug.length > 0,
    staleTime: Infinity,
  });
}
