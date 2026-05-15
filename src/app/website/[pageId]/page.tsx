'use client';

// =============================================================================
// /website/[pageId] — section editor for one page on the active workspace's
// website. Workspace context determines the active website; the [pageId]
// URL segment picks the page.
//
// Two URL slugs are reserved for the website-level singletons rather than
// being page ids — they live as sibling routes:
//   /website/header  → singleton editor for Website.header
//   /website/footer  → singleton editor for Website.footer
// Both are static routes that take precedence over this dynamic [pageId].
// =============================================================================

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { SectionEditor } from '@/components/shared/website/SectionEditor';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/auth/user-stub';
import { findVersion, findWebsiteByClient } from '@/lib/website/data-stub';
import { mergeGeneratedPages } from '@/lib/website/generated-pages-stub';
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
    return (
      <NotFoundState message="No active workspace. Pick a client from the picker." />
    );
  }

  const website = findWebsiteByClient(activeClientId);
  if (!website) {
    return <NotFoundState message="No website on this workspace yet." />;
  }

  const draft = findVersion(website.draftVersionId);
  const seedPages = draft?.snapshot.pages ?? [];
  const pages = mergeGeneratedPages(website.id, seedPages);
  const page = pages.find((p) => p.id === pageId);

  if (!page) {
    return (
      <NotFoundState
        message={`No page "${pageId}" on ${website.name}'s website.`}
      />
    );
  }

  return (
    <SectionEditor
      website={website}
      mode={{ kind: 'page', pages, page }}
    />
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
