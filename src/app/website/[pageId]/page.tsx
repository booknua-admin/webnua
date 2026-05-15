'use client';

// =============================================================================
// /website/[pageId] — the section editor for one page on the active
// workspace's website. Workspace context determines which website's
// pages can be addressed; the [pageId] URL segment picks the specific
// page from that website's draft snapshot.
//
// If the pageId doesn't belong to a page in the active workspace's
// website, render a not-found state. Two reasons that can happen:
//   - operator navigated to an old page url after switching workspaces
//   - someone shared a url across workspaces
// =============================================================================

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { SectionEditor } from '@/components/shared/website/SectionEditor';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/auth/user-stub';
import { findVersion, findWebsiteByClient } from '@/lib/website/data-stub';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export default function WebsitePageEditorPage() {
  const params = useParams<{ pageId: string }>();
  const pageId = params?.pageId;
  const user = useUser();
  const workspace = useWorkspace();

  if (!workspace.hydrated || !user) {
    return (
      <div className="flex h-svh items-center justify-center bg-paper">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// Resolving workspace…'}
        </p>
      </div>
    );
  }

  const activeClientId =
    user.role === 'client' ? user.clientId : workspace.activeClientId;

  if (!activeClientId) {
    return <NotFoundState message="No active workspace. Pick a client from the picker." />;
  }

  const website = findWebsiteByClient(activeClientId);
  if (!website) {
    return <NotFoundState message="No website on this workspace yet." />;
  }

  const draft = findVersion(website.draftVersionId);
  const pages = draft?.snapshot.pages ?? [];
  const page = pages.find((p) => p.id === pageId);

  if (!page) {
    return (
      <NotFoundState
        message={`No page "${pageId}" on ${website.name}'s website.`}
      />
    );
  }

  return <SectionEditor website={website} pages={pages} page={page} />;
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
