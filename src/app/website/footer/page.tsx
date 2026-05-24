'use client';

// =============================================================================
// /website/footer — singleton editor for the website's Footer section.
// Same SectionEditor shell as page editing, in singleton mode. See §2.6.
// Phase 4 — website + draft snapshot read live (`lib/website/queries`).
// =============================================================================

import Link from 'next/link';

import { EditorMobileGuard } from '@/components/shared/EditorMobileGuard';
import { SectionEditor } from '@/components/shared/website/SectionEditor';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/auth/user-stub';
import { useEffectiveDraft, useWebsiteForClient } from '@/lib/website/queries';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export default function WebsiteFooterEditorPage() {
  return (
    <EditorMobileGuard>
      <WebsiteFooterEditorInner />
    </EditorMobileGuard>
  );
}

function WebsiteFooterEditorInner() {
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

  return (
    <SectionEditor
      mode={{
        kind: 'singleton',
        website,
        section: draftQuery.data.snapshot.footer,
        label: 'Footer',
      }}
    />
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
          {'// FOOTER NOT AVAILABLE'}
        </p>
        <p className="mb-5 text-[16px] text-ink">{message}</p>
        <Button asChild variant="secondary">
          <Link href="/website">← Back to website hub</Link>
        </Button>
      </div>
    </div>
  );
}
