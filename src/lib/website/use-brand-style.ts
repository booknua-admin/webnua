'use client';

// =============================================================================
// useBrandStyle — reactive read of a client's brand-level style overrides
// (fonts + colour defaults). Backed by brand-style-stub's localStorage
// overlay. The editor merges the result over the resolved brand so style
// changes propagate to every section preview.
// =============================================================================

import { useSyncExternalStore } from 'react';

import {
  getBrandStyle,
  subscribeBrandStyle,
  type BrandStyle,
} from './brand-style-stub';

const SERVER_EMPTY: BrandStyle = {};

export function useBrandStyle(clientId: string | null): BrandStyle {
  return useSyncExternalStore(
    subscribeBrandStyle,
    () => (clientId ? getBrandStyle(clientId) : SERVER_EMPTY),
    () => SERVER_EMPTY,
  );
}
