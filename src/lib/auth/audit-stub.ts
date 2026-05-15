// =============================================================================
// STUB — force-publish audit log shape + example entries.
//
// The real audit log fires whenever an admin uses the "Force publish (skip
// approval)" affordance. Session 5 (F) wires the overlay write path:
// `appendForcePublishEntry` pushes new entries into a localStorage overlay
// (`webnua.dev.audit-log`) that getEffectiveAuditLog merges with the seed
// list before returning. ForcePublishLog renders the merged result.
//
// When real backend ships: this module's seed + overlay both disappear,
// replaced by Supabase reads against an `audit_log` table.
// =============================================================================

export type ForcePublishEntry = {
  id: string;
  /** ISO 8601 timestamp. */
  at: string;
  /** Who triggered the force-publish. */
  actor: { displayName: string; email: string };
  /** Which client + website the publish affected. */
  target: { clientName: string; websiteId: string; pageTitle: string };
  /** Required free-text reason captured at confirm-time. */
  reason: string;
  /** Version id that became live as a result. */
  newVersionId: string;
};

const AUDIT_KEY = 'webnua.dev.audit-log';
export const AUDIT_EVENT = 'webnua:audit-change';

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function readOverlay(): ForcePublishEntry[] {
  const raw = safeGet(AUDIT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ForcePublishEntry[];
  } catch {
    return [];
  }
}

/** Merged seed + overlay, newest first. */
// Snapshot cache. `getSnapshot` for `useSyncExternalStore` must return a
// reference-stable value while the store is unchanged — a fresh array each
// call spins React into an infinite render loop. Keyed on the raw overlay
// string; `undefined` sentinel forces the first call to compute.
let auditLogRaw: string | null | undefined;
let auditLogCache: ForcePublishEntry[] = [];

/** Merged seed + overlay, newest first. Reference-stable between calls
 *  until the overlay record actually changes. */
export function getEffectiveAuditLog(): ForcePublishEntry[] {
  const raw = typeof window === 'undefined' ? null : safeGet(AUDIT_KEY);
  if (raw === auditLogRaw) return auditLogCache;
  auditLogRaw = raw;
  const overlay = raw ? readOverlay() : [];
  auditLogCache = [...STUB_FORCE_PUBLISH_LOG, ...overlay].sort((a, b) =>
    a.at < b.at ? 1 : -1,
  );
  return auditLogCache;
}

export function appendForcePublishEntry(entry: ForcePublishEntry): void {
  if (typeof window === 'undefined') return;
  const overlay = readOverlay();
  overlay.push(entry);
  safeSet(AUDIT_KEY, JSON.stringify(overlay));
  window.dispatchEvent(new Event(AUDIT_EVENT));
}

export function subscribeAudit(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(AUDIT_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(AUDIT_EVENT, callback);
  };
}

export const STUB_FORCE_PUBLISH_LOG: ForcePublishEntry[] = [
  {
    id: 'fp-001',
    at: '2026-05-12T22:47:00+08:00',
    actor: { displayName: 'Craig', email: 'craig@webnua.com' },
    target: {
      clientName: 'FreshHome',
      websiteId: 'website-freshhome',
      pageTitle: 'Emergency cleanup landing',
    },
    reason:
      'Anna sent a panicked SMS — wrong phone number went live overnight. Skipping review queue to fix.',
    newVersionId: 'v-2026-05-12T22-47',
  },
  {
    id: 'fp-002',
    at: '2026-04-28T09:12:00+08:00',
    actor: { displayName: 'Craig', email: 'craig@webnua.com' },
    target: {
      clientName: 'KeyHero',
      websiteId: 'website-keyhero',
      pageTitle: 'Schedule a callout',
    },
    reason:
      'Form submit endpoint returning 500 — emergency revert to last known-good template version.',
    newVersionId: 'v-2026-04-28T09-12',
  },
];
