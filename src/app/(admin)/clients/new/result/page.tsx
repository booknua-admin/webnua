'use client';

// =============================================================================
// /clients/new/result — the generated-client result viewer. Reads ?c=<id>
// from the created-clients overlay and renders the generated website pages
// and / or funnel steps as stacked section previews (the registry Preview
// components, the same render the editor uses).
// =============================================================================

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { findCreatedClient } from '@/lib/clients/created-clients-stub';
import { getSectionDefinition } from '@/lib/website/sections';
import type { BrandObject, Section } from '@/lib/website/types';

type View = 'website' | 'funnel';

export default function GeneratedClientResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultBody />
    </Suspense>
  );
}

function ResultBody() {
  const params = useSearchParams();
  const id = params.get('c');
  const client = id ? findCreatedClient(id) : null;

  const hasWebsite = !!client?.pages?.length;
  const hasFunnel = !!client?.funnelSteps?.length;
  const [view, setView] = useState<View>('website');
  const activeView: View = view === 'website' && !hasWebsite ? 'funnel' : view;

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Clients', 'New']}
            current={client?.name ?? 'Result'}
          />
        }
      />
      <div className="px-10 py-10">
        {!client ? (
          <div className="rounded-xl border border-dashed border-rule bg-card px-8 py-14 text-center">
            <p className="text-[14px] text-ink-mid">
              That generated client could not be found.
            </p>
            <Button variant="secondary" asChild className="mt-4">
              <Link href="/clients/new">← Back to generated clients</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-7 flex items-start justify-between gap-6">
              <PageHeader
                eyebrow="Generated"
                title={<>{client.name}</>}
                subtitle={
                  <>
                    {client.industry} · {client.serviceArea}
                  </>
                }
              />
              <div className="flex shrink-0 gap-2">
                <Button asChild>
                  <Link href={`/clients/new/result/edit?c=${id}&view=${activeView}`}>
                    Open {activeView} in editor →
                  </Link>
                </Button>
                <Button variant="secondary" asChild>
                  <Link href="/clients/new">← All generated</Link>
                </Button>
              </div>
            </div>

            {hasWebsite && hasFunnel ? (
              <div className="mb-6 flex gap-2">
                <ViewTab label="Website" active={activeView === 'website'} onClick={() => setView('website')} />
                <ViewTab label="Funnel" active={activeView === 'funnel'} onClick={() => setView('funnel')} />
              </div>
            ) : null}

            {activeView === 'website' && client.pages ? (
              <>
                {client.header ? (
                  <ArtifactBlock
                    label="Header"
                    sections={[client.header]}
                    brand={client.brand}
                  />
                ) : null}
                {client.pages.map((page) => (
                  <ArtifactBlock
                    key={page.id}
                    label={`Page · ${page.title}`}
                    sections={page.sections}
                    brand={client.brand}
                  />
                ))}
                {client.footer ? (
                  <ArtifactBlock
                    label="Footer"
                    sections={[client.footer]}
                    brand={client.brand}
                  />
                ) : null}
              </>
            ) : null}

            {activeView === 'funnel' && client.funnelSteps
              ? client.funnelSteps.map((stepEntry) => (
                  <ArtifactBlock
                    key={stepEntry.id}
                    label={`Step · ${stepEntry.title}`}
                    sections={stepEntry.sections}
                    brand={client.brand}
                  />
                ))
              : null}
          </>
        )}
      </div>
    </>
  );
}

function ViewTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-ink px-4 py-1.5 text-[13px] font-semibold text-paper'
          : 'rounded-full bg-paper-2 px-4 py-1.5 text-[13px] font-semibold text-ink-mid'
      }
    >
      {label}
    </button>
  );
}

function ArtifactBlock({
  label,
  sections,
  brand,
}: {
  label: string;
  sections: Section[];
  brand: BrandObject;
}) {
  const enabled = sections.filter((s) => s.enabled);
  return (
    <section className="mb-8">
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-quiet">
        {`// ${label}`}
      </p>
      <div className="overflow-hidden rounded-xl border border-rule">
        {enabled.length === 0 ? (
          <p className="bg-card px-6 py-8 text-center text-[13px] text-ink-quiet">
            No sections.
          </p>
        ) : (
          enabled.map((section) => {
            const def = getSectionDefinition(section.type);
            if (!def) return null;
            const Preview = def.Preview;
            return <Preview key={section.id} data={section.data} brand={brand} />;
          })
        )}
      </div>
    </section>
  );
}
