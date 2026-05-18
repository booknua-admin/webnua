'use client';

// =============================================================================
// /clients/new/result/edit — opens a generated artefact (website or funnel)
// in the wizard-frame section editor. Reads ?c=<id>&view=website|funnel from
// the created-clients overlay. A website's pages are walked as steps.
// =============================================================================

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { WizardSectionEditor } from '@/components/shared/website/WizardSectionEditor';
import { findCreatedClient, type CreatedClient } from '@/lib/clients/created-clients-stub';
import type { Funnel, FunnelStep } from '@/lib/funnel/types';

export default function GeneratedClientEditPage() {
  return (
    <Suspense fallback={null}>
      <EditBody />
    </Suspense>
  );
}

function EditBody() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('c');
  const view = params.get('view') === 'funnel' ? 'funnel' : 'website';
  const client = id ? findCreatedClient(id) : null;

  const resolved = client ? resolveEditable(client, view) : null;
  const backHref = id ? `/clients/new/result?c=${id}` : '/clients/new';

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Clients', 'New', client?.name ?? 'Result']}
            current={`Edit ${view}`}
          />
        }
      />
      <div className="flex h-[calc(100svh-57px)] flex-col">
        {!resolved ? (
          <div className="px-10 py-10">
            <p className="text-[14px] text-ink-mid">
              Nothing to edit for that artefact.
            </p>
            <Button variant="secondary" asChild className="mt-4">
              <Link href={backHref}>← Back</Link>
            </Button>
          </div>
        ) : (
          <WizardSectionEditor
            funnel={resolved.funnel}
            steps={resolved.steps}
            onExitForward={() => router.push(backHref)}
            onExitBack={() => router.push(backHref)}
          />
        )}
      </div>
    </>
  );
}

function resolveEditable(
  client: CreatedClient,
  view: 'website' | 'funnel',
): { funnel: Funnel; steps: FunnelStep[] } | null {
  if (view === 'funnel') {
    if (!client.funnel || !client.funnelSteps?.length) return null;
    return { funnel: client.funnel, steps: client.funnelSteps };
  }
  if (!client.pages?.length) return null;
  // The wizard editor walks funnel steps — adapt each website page into one.
  const id = `wsf-${client.id}`;
  const now = new Date().toISOString();
  const funnel: Funnel = {
    id,
    clientId: '__pending__',
    name: `${client.name} · website`,
    domain: { primary: '', aliases: [], sslStatus: 'pending' },
    draftVersionId: `${id}-draft`,
    publishedVersionId: null,
    createdAt: now,
    updatedAt: now,
  };
  const steps: FunnelStep[] = client.pages.map((page) => ({
    id: page.id,
    funnelId: id,
    slug: page.slug,
    title: page.title,
    type: 'landing',
    sections: page.sections,
    seo: { title: page.seo?.title, description: page.seo?.description },
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  }));
  return { funnel, steps };
}
