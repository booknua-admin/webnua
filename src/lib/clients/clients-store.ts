// =============================================================================
// clients-store — in-memory cache of client records, hydrated from Supabase.
//
// This is the lynchpin of the Phase 5 data conversion: slug↔UUID translation
// for every other store that keys on client slug (public surface) but needs
// UUID for Supabase I/O. Must hydrate before any other store that translates
// UUIDs.
//
// Snapshot discipline (CLAUDE.md): getAdminClients() must be reference-stable.
// Version counter bumps on every write; snapshot cached against that counter.
// =============================================================================

'use client';

import {
  dashboardIsInPreOnboarding,
  lifecyclePhrase,
} from '@/lib/auth/lifecycle';
import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import type { AdminClient } from '@/lib/nav/admin-clients';
export type { AdminClient };

const CHANGE_EVENT = 'webnua:clients-change';

// ---- Internal cache --------------------------------------------------------

type ClientRow = {
  id: string; // UUID
  name: string;
  slug: string;
  industry: string;
  lifecycle_status: string;
};

let cache: ClientRow[] = [];
let version = 0;

// Snapshot caches for reference stability
let snapshotVersion = -1;
let snapshotValue: AdminClient[] = [];

// UUID↔slug lookup maps
let uuidToSlug: Map<string, string> = new Map();
let slugToUuid: Map<string, string> = new Map();

function rowToAdminClient(row: ClientRow): AdminClient {
  return {
    id: row.slug, // public id = slug
    initial: row.name[0].toUpperCase(),
    name: row.name,
    meta: `${row.industry.charAt(0).toUpperCase() + row.industry.slice(1)} · ${lifecyclePhrase(row.lifecycle_status)}`,
    // Legacy `status` bucket: any pre-published state collapses to 'setup'
    // so old surfaces that key on this binary still work; the raw
    // lifecycle_status (Pattern B's source of truth) lives on lifecycleStatus.
    status: dashboardIsInPreOnboarding(row.lifecycle_status) ? 'setup' : 'active',
    lifecycleStatus: row.lifecycle_status,
  };
}

function rebuildMaps() {
  uuidToSlug = new Map(cache.map((r) => [r.id, r.slug]));
  slugToUuid = new Map(cache.map((r) => [r.slug, r.id]));
}

function dispatch() {
  version++;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

// ---- Hydration -------------------------------------------------------------

export async function hydrateClients(): Promise<void> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, slug, industry, lifecycle_status');

  if (error) {
    console.error('[clients-store] hydrate failed:', normalizeError(error).message);
    return;
  }

  cache = (data ?? []) as ClientRow[];
  rebuildMaps();
  dispatch();
}

// ---- Writes ----------------------------------------------------------------

/**
 * Permanently delete a client. Operator-only (enforced by RLS). Cascades to
 * the client's brand, websites, funnels, leads, bookings, etc. Fails if the
 * client still has team members (`users.client_id` is ON DELETE RESTRICT).
 */
export async function deleteClient(
  slug: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const uuid = slugToUuid.get(slug);
  if (!uuid) {
    return { ok: false, message: 'That client no longer exists.' };
  }

  const { error } = await supabase.from('clients').delete().eq('id', uuid);
  if (error) {
    if (error.code === '23503') {
      return {
        ok: false,
        message:
          'This client still has team members. Remove their accounts before deleting the client.',
      };
    }
    return { ok: false, message: normalizeError(error).message };
  }

  await hydrateClients();
  return { ok: true };
}

/**
 * Move a client to the active (published) lifecycle. Operator-only (RLS
 * `clients_update` requires `is_operator()`). Used both by:
 *   • Pattern B's operator "concierge close" — payment was collected
 *     out-of-band, manually flip a 'preview' workspace to 'active'.
 *   • Session 1's legacy operator-activate-after-onboarding panel.
 *
 * Writes 'active' (Pattern B's canonical published state). Existing 'live'
 * rows (Session 1 default) keep that value — the lifecycle helpers treat
 * both 'active' and 'live' as published.
 */
export async function activateClient(
  slug: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const uuid = slugToUuid.get(slug);
  if (!uuid) {
    return { ok: false, message: 'That client no longer exists.' };
  }

  const { error } = await supabase
    .from('clients')
    .update({ lifecycle_status: 'active' })
    .eq('id', uuid);
  if (error) {
    return { ok: false, message: normalizeError(error).message };
  }

  await hydrateClients();
  return { ok: true };
}

// ---- Reads -----------------------------------------------------------------

/** All clients as AdminClient objects. Reference-stable. */
export function getAdminClients(): AdminClient[] {
  if (version === snapshotVersion) return snapshotValue;
  snapshotVersion = version;
  snapshotValue = cache.map(rowToAdminClient);
  return snapshotValue;
}

/** Translate a client UUID to its slug (public id). Null if unknown. */
export function getClientSlugByUuid(uuid: string): string | null {
  return uuidToSlug.get(uuid) ?? null;
}

/** Translate a client slug to its UUID. Null if unknown. */
export function getClientUuidBySlug(slug: string): string | null {
  return slugToUuid.get(slug) ?? null;
}

/** Subscribe to changes in the clients cache. */
export function subscribeClients(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

// ---- Hook ------------------------------------------------------------------

import { useSyncExternalStore } from 'react';

const EMPTY: AdminClient[] = [];

export function useAdminClients(): AdminClient[] {
  return useSyncExternalStore(
    subscribeClients,
    getAdminClients,
    () => EMPTY,
  );
}
