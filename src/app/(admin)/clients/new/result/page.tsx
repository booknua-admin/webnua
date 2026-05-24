'use client';

// =============================================================================
// /clients/new/result — the post-generation review screen. Reads the freshly
// created client's website + funnel back from Supabase (?c=<client slug>) and
// renders the generated sections as live previews, with "Open in editor"
// links into the real /website and /funnels surfaces.
// =============================================================================

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { useAdminClients } from '@/lib/clients/clients-store';
import { useFunnelsForClient, useFunnelWithDraft } from '@/lib/funnel/queries';
import { getSectionDefinition } from '@/lib/website/sections';
import {
  useBrandForClient,
  useEffectiveDraft,
  useWebsiteForClient,
} from '@/lib/website/queries';
import type { BrandObject, Section } from '@/lib/website/types';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

type View = 'website' | 'funnel';

export default function GeneratedClientResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultBody />
    </Suspense>
  );
}

function ResultBody() {
  const router = useRouter();
  const params = useSearchParams();
  const slug = params.get('c');
  const { setActiveClientId } = useWorkspace();

  const clients = useAdminClients();
  const client = clients.find((c) => c.id === slug);

  const website = useWebsiteForClient(slug);
  const draft = useEffectiveDraft(website.data?.id ?? null);
  const brand = useBrandForClient(slug);

  const funnels = useFunnelsForClient(slug);
  const funnel = funnels.data?.[0] ?? null;
  const funnelDraft = useFunnelWithDraft(funnel?.id ?? null);

  const hasWebsite = !!website.data;
  const hasFunnel = !!funnel;
  const [view, setView] = useState<View>('website');
  const activeView: View = view === 'website' && !hasWebsite ? 'funnel' : view;

  const loading =
    website.isLoading || funnels.isLoading || brand.isLoading ||
    (hasWebsite && draft.isLoading) ||
    (hasFunnel && funnelDraft.isLoading);

  const openWebsiteEditor = () => {
    if (slug) setActiveClientId(slug);
    router.push('/website');
  };
  const openFunnelEditor = () => {
    if (slug) setActiveClientId(slug);
    router.push('/funnels');
  };

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
      <div className="px-4 py-6 md:px-10 md:py-10">
        <div className="mb-7 flex items-start justify-between gap-6">
          <PageHeader
            eyebrow="Generated"
            title={<>{client?.name ?? slug ?? 'Generated client'}</>}
            subtitle={
              <>
                Created in Supabase — live in the roster, the picker, and the
                editors.
              </>
            }
          />
          <div className="flex shrink-0 gap-2">
            {hasWebsite ? (
              <Button onClick={openWebsiteEditor}>Open website editor →</Button>
            ) : null}
            {hasFunnel ? (
              <Button
                variant={hasWebsite ? 'secondary' : 'default'}
                onClick={openFunnelEditor}
              >
                Open funnel editor →
              </Button>
            ) : null}
            <Button variant="secondary" asChild>
              <Link href="/clients/new">← New</Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="rounded-xl border border-dashed border-rule bg-card px-8 py-14 text-center text-[13px] text-ink-quiet">
            Loading the generated client…
          </p>
        ) : !hasWebsite && !hasFunnel ? (
          <p className="rounded-xl border border-dashed border-rule bg-card px-8 py-14 text-center text-[13px] text-ink-quiet">
            Nothing generated for this client.
          </p>
        ) : (
          <>
            {hasWebsite && hasFunnel ? (
              <div className="mb-6 flex gap-2">
                <ViewTab label="Website" active={activeView === 'website'} onClick={() => setView('website')} />
                <ViewTab label="Funnel" active={activeView === 'funnel'} onClick={() => setView('funnel')} />
              </div>
            ) : null}

            {activeView === 'website' && draft.data && brand.data ? (
              <>
                {draft.data.snapshot.header ? (
                  <ArtifactBlock
                    label="Header"
                    sections={[draft.data.snapshot.header]}
                    brand={brand.data}
                  />
                ) : null}
                {draft.data.snapshot.pages.map((page) => (
                  <ArtifactBlock
                    key={page.id}
                    label={`Page · ${page.title}`}
                    sections={page.sections}
                    brand={brand.data as BrandObject}
                  />
                ))}
                {draft.data.snapshot.footer ? (
                  <ArtifactBlock
                    label="Footer"
                    sections={[draft.data.snapshot.footer]}
                    brand={brand.data}
                  />
                ) : null}
              </>
            ) : null}

            {activeView === 'funnel' && funnelDraft.data && brand.data
              ? funnelDraft.data.draft.snapshot.steps.map((step) => (
                  <ArtifactBlock
                    key={step.id}
                    label={`Step · ${step.title}`}
                    sections={step.sections}
                    brand={brand.data as BrandObject}
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
