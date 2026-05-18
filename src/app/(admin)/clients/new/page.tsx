'use client';

// =============================================================================
// /clients/new — the generated-clients index. Lists clients created through
// the create-client modal (from the created-clients overlay) and hosts the
// "+ New client" trigger. Each card opens the result viewer.
//
// (This replaces the old static onboarding-wizard redirect — the wizard
// steps under /clients/new/* are superseded by the modal flow.)
// =============================================================================

import Link from 'next/link';

import { CreateClientButton } from '@/components/admin/CreateClientButton';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useCreatedClients } from '@/lib/clients/created-clients-stub';

export default function NewClientIndexPage() {
  const clients = useCreatedClients();

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Clients']} current="New" />}
      />
      <div className="px-10 py-10">
        <div className="mb-8 flex items-start justify-between gap-6">
          <PageHeader
            eyebrow="Create"
            title={
              <>
                Generate a <em>client</em>.
              </>
            }
            subtitle={
              <>
                Answer a short brief once — generate a <strong>website</strong>,
                a <strong>funnel</strong>, or both.
              </>
            }
          />
          <CreateClientButton />
        </div>

        {clients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-rule bg-card px-8 py-14 text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
              {'// NOTHING GENERATED YET'}
            </p>
            <p className="mt-2 text-[14px] text-ink-mid">
              Click <strong>+ New client</strong> to capture a brief and
              generate their site.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => (
              <Link
                key={c.id}
                href={`/clients/new/result?c=${c.id}`}
                className="rounded-xl border border-rule bg-card px-5 py-5 transition-colors hover:border-rust/60"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-[15px] font-extrabold text-paper"
                    style={{ backgroundColor: c.brand.accentColor }}
                  >
                    {c.name[0]?.toUpperCase() ?? '?'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-ink">{c.name}</p>
                    <p className="truncate text-[12px] text-ink-quiet">
                      {c.industry} · {c.serviceArea}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {c.pages ? <Tag label={`Website · ${c.pages.length} pages`} /> : null}
                  {c.funnelSteps ? <Tag label={`Funnel · ${c.funnelSteps.length} steps`} /> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-paper-2 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-mid">
      {label}
    </span>
  );
}
