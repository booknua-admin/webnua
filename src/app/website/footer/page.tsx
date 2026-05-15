'use client';

// =============================================================================
// /website/footer — singleton editor for the website's Footer section.
// Mirror of /website/header. See design doc §2.6.
// =============================================================================

import Link from 'next/link';
import { useUser } from '@/lib/auth/user-stub';
import { findVersion, findWebsiteByClient } from '@/lib/website/data-stub';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

import { SectionEditor } from '@/components/shared/website/SectionEditor';
import { Button } from '@/components/ui/button';

export default function WebsiteFooterEditorPage() {
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
  if (!draft) {
    return <NotFoundState message={`No draft version on ${website.name}.`} />;
  }

  return (
    <SectionEditor
      mode={{
        kind: 'singleton',
        website,
        section: draft.snapshot.footer,
        label: 'Footer',
      }}
    />
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
