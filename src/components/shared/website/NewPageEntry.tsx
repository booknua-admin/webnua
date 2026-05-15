'use client';

// =============================================================================
// NewPageEntry — the "+ New page" CTA on /website. Encapsulates the two-cap
// gating story (design doc generation §5):
//
//   has editPages + useAI  → rust button, links to /website/new
//   has editPages only     → MVP: hidden (V2: manual new-page modal)
//   missing editPages      → CapabilityGate `request` mode reveals the
//                            "Request a new page" affordance for client users
//
// Why a wrapper component: the gating story is non-obvious. Inlining it on
// /website would force every reader to re-derive "why two caps + request
// fallback" from the JSX. Encapsulated, the hub stays readable.
// =============================================================================

import Link from 'next/link';

import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { Button } from '@/components/ui/button';
import { useCan } from '@/lib/auth/user-stub';

function NewPageEntry() {
  const canEditPages = useCan('editPages');
  const canUseAI = useCan('useAI');

  if (canEditPages && canUseAI) {
    return (
      <Button asChild size="sm">
        <Link href="/website/new">✦ New page</Link>
      </Button>
    );
  }

  if (canEditPages && !canUseAI) {
    // V2 manual-new-page modal would mount here. Hidden for Session 6.
    return null;
  }

  // Missing editPages — surface the request-change affordance instead.
  return (
    <CapabilityGate capability="editPages" mode="request">
      <Button size="sm">+ New page</Button>
    </CapabilityGate>
  );
}

export { NewPageEntry };
