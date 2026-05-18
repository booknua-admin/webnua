'use client';

// =============================================================================
// useBrandFonts — reactive read of a client's brand-font overrides
// (Phase 6 · font editor). Backed by brand-style-stub's localStorage overlay.
// The editor merges the result over the resolved brand so font changes
// propagate to every section preview.
// =============================================================================

import { useSyncExternalStore } from 'react';

import {
  getBrandFontChoice,
  subscribeBrandFonts,
  type BrandFontChoice,
} from './brand-style-stub';

const SERVER_EMPTY: BrandFontChoice = {};

export function useBrandFonts(clientId: string | null): BrandFontChoice {
  return useSyncExternalStore(
    subscribeBrandFonts,
    () => (clientId ? getBrandFontChoice(clientId) : SERVER_EMPTY),
    () => SERVER_EMPTY,
  );
}
