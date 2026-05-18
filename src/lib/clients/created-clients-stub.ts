'use client';

// =============================================================================
// created-clients-stub — STUB. localStorage overlay for clients created
// through the "create client" modal, together with their generated website
// pages and / or funnel steps.
//
// The live client / website / funnel surfaces are Supabase-backed; generated
// content cannot be inserted there while the generator is a stub (the same
// reason `generated-pages-stub` exists). This overlay holds a created client
// + its generated artefacts so the create flow is testable end to end. The
// `/clients/new` index lists these; `/clients/new/result` views one.
//
// Replace when the generator becomes the real Claude API + the create flow
// writes real rows.
// =============================================================================

import { useSyncExternalStore } from 'react';

import type { Funnel, FunnelStep } from '@/lib/funnel/types';
import type { BrandObject, Page, Section } from '@/lib/website/types';

const STORAGE_KEY = 'webnua.dev.created-clients';
const CHANGE_EVENT = 'webnua:created-clients-change';

export type CreatedClient = {
  /** Slug-like public id. */
  id: string;
  name: string;
  industry: string;
  serviceArea: string;
  createdAt: number;
  brand: BrandObject;
  /** Generated website pages — null when no website was generated. */
  pages: Page[] | null;
  /** Generated website header / footer singletons. */
  header: Section | null;
  footer: Section | null;
  /** Generated funnel — null when no funnel was generated. */
  funnelName: string | null;
  funnel: Funnel | null;
  funnelSteps: FunnelStep[] | null;
};

// -- snapshot-cached read (reference stability — CLAUDE.md) ------------------

let cachedRaw: string | null = null;
let cachedValue: CreatedClient[] = [];

function readAll(): CreatedClient[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    cachedValue = raw ? (JSON.parse(raw) as CreatedClient[]) : [];
  } catch {
    cachedValue = [];
  }
  return cachedValue;
}

function writeAll(list: CreatedClient[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// -- public API -------------------------------------------------------------

export function getCreatedClients(): CreatedClient[] {
  return readAll();
}

export function findCreatedClient(id: string): CreatedClient | null {
  return readAll().find((c) => c.id === id) ?? null;
}

/** Add a created client (newest first). Returns the stored record. */
export function addCreatedClient(
  record: Omit<CreatedClient, 'id' | 'createdAt'>,
): CreatedClient {
  const id = `gc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const stored: CreatedClient = { ...record, id, createdAt: Date.now() };
  writeAll([stored, ...readAll()]);
  return stored;
}

export function removeCreatedClient(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id));
}

export function subscribeCreatedClients(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

const EMPTY: CreatedClient[] = [];

export function useCreatedClients(): CreatedClient[] {
  return useSyncExternalStore(subscribeCreatedClients, getCreatedClients, () => EMPTY);
}
