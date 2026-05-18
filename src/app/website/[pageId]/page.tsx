'use client';

// =============================================================================
// /website/[pageId] — section editor for one page on the active workspace's
// website. Workspace context determines the active website; the [pageId]
// URL segment picks the page.
//
// Phase 4 — website + effective-draft snapshot read live from Supabase
// (`lib/website/queries`). The draft snapshot already merges the content_drafts
// autosave buffer + any generated pages, so SectionEditor seeds straight from
// it.
//
// /website/header and /website/footer are reserved sibling routes that take
// precedence over this dynamic [pageId].
// =============================================================================

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { SectionEditor } from '@/components/shared/website/SectionEditor';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/auth/user-stub';
import { useEffectiveDraft, useWebsiteForClient } from '@/lib/website/queries';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export default function WebsitePageEditorPage() {
  const params = useParams<{ pageId: string }>();
  const pageId = params?.pageId;
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

  const pages = draftQuery.data.snapshot.pages;
  const page = pages.find((p) => p.id === pageId);
  if (!page) {
    return (
      <NotFoundState
        message={`No page "${pageId}" on ${website.name}'s website.`}
      />
    );
  }

  return <SectionEditor mode={{ kind: 'page', website, pages, page }} />;
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
          {'// PAGE NOT FOUND'}
        </p>
        <p className="mb-5 text-[16px] text-ink">{message}</p>
        <Button asChild variant="secondary">
          <Link href="/website">← Back to website hub</Link>
        </Button>
      </div>
    </div>
  );
}
