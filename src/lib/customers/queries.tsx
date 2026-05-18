// =============================================================================
// Customers — data access (Phase 3b).
//
// Backs the CustomerPicker used by the booking-write flows. `useCustomerSearch`
// is an `ilike` lookup over `customers`, RLS-scoped and additionally filtered
// to one client so an operator in sub-account mode searches only that client.
//
// The picker resolves an existing `customer_id`, or hands back a `new`
// customer the write flow inserts at booking-create time.
// =============================================================================

import { useQuery } from '@tanstack/react-query';

import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

export type CustomerMatch = {
  id: string;
  name: string;
  phone: string | null;
  suburb: string | null;
};

/** A customer chosen in the CustomerPicker — either an existing row, or a new
 *  one the write flow inserts (client_id + name + phone) before it is used. */
export type SelectedCustomer =
  | { kind: 'existing'; id: string; name: string; phone: string | null }
  | { kind: 'new'; name: string; phone: string | null };

/** Strip the characters PostgREST treats as filter syntax so a user-typed
 *  query can never break the `.or()` string. */
function sanitizeQuery(query: string): string {
  return query
    .replace(/[,()*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchCustomers(
  clientId: string,
  query: string,
): Promise<CustomerMatch[]> {
  const q = sanitizeQuery(query);
  if (q.length < 2) return [];

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone, suburb')
    .eq('client_id', clientId)
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
    .order('name', { ascending: true })
    .limit(8);
  if (error) throw normalizeError(error);
  return data as CustomerMatch[];
}

/** Search one client's customers by name or phone. Disabled until a client is
 *  resolved and the query has at least two meaningful characters. */
export function useCustomerSearch(clientId: string, query: string) {
  const q = sanitizeQuery(query);
  return useQuery({
    queryKey: ['customers', 'search', clientId, q],
    queryFn: () => searchCustomers(clientId, query),
    enabled: clientId.length > 0 && q.length >= 2,
  });
}
