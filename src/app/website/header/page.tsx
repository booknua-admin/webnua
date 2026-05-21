'use client';

// =============================================================================
// /website/header — singleton editor for the website's Header section.
// Same SectionEditor shell as page editing, in singleton mode. See §2.6.
// Phase 4 — website + draft snapshot read live (`lib/website/queries`).
// =============================================================================

import Link from 'next/link';

import { SectionEditor } from '@/components/shared/website/SectionEditor';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/auth/user-stub';
import { useEffectiveDraft, useWebsiteForClient } from '@/lib/website/queries';
import {
  WebsiteNavProvider,
  resolveNavLinks,
} from '@/lib/website/sections/_shared/website-nav-slot';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export default function WebsiteHeaderEditorPage() {
  const user = useUser();
  const workspace = useWorkspace();

  const activeClientId = user
    ? user.role === 'client'
      ? user.clientId
      : workspace.activeClientId
    : null;

  const websiteQuery = useWebsiteForClient(activeClientId);
  const website = websiteQuery.data ?? null;
  const draftQuery = useEffectiveDraft(website?.id ?? null);

  if (!workspace.hydrated || !user) {
    return <StatusState message="// Resolving workspace…" />;
  }
  if (!activeClientId) {
    return (
      <NotFoundState message="No active workspace. Pick a client from the picker." />
    );
  }
  if (websiteQuery.isLoading || (website && draftQuery.isLoading)) {
    return <StatusState message="// Loading editor…" />;
  }
  if (!website) {
    return <NotFoundState message="No website on this workspace yet." />;
  }
  if (!draftQuery.data) {
    return <NotFoundState message={`No draft version on ${website.name}.`} />;
  }

  const snapshot = draftQuery.data.snapshot;
  // Feed the real Website.nav into the header preview (inert — the editor's
  // links select the element, they don't navigate). The preview then shows
  // the actual menu labels, not the placeholder sample links.
  return (
    <WebsiteNavProvider
      links={resolveNavLinks(snapshot.nav, snapshot.pages)}
      live={false}
    >
      <SectionEditor
        mode={{
          kind: 'singleton',
          website,
          section: snapshot.header,
          label: 'Header',
        }}
      />
    </WebsiteNavProvider>
  );
}

function StatusState({ message }: { message: string }) {
  return (
    <div className="flex h-svh items-center justify-center bg-paper">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {message}
      </p>
    </div>
  );
}

function NotFoundState({ message }: { message: string }) {
  return (
    <div className="flex h-svh items-center justify-center bg-paper px-6">
      <div className="max-w-[480px] text-center">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
          {'// HEADER NOT AVAILABLE'}
        </p>
        <p className="mb-5 text-[16px] text-ink">{message}</p>
        <Button asChild variant="secondary">
          <Link href="/website">← Back to website hub</Link>
        </Button>
      </div>
    </div>
  );
}
