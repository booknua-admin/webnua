'use client';

// =============================================================================
// /clients/new — the create-client entry. Captures a brief and generates a
// client + website + funnel into Supabase. Created clients become first-class
// rows — they appear in the roster, the sidebar picker, and the editors — so
// this page is just the entry point.
// =============================================================================

import { CreateClientButton } from '@/components/admin/CreateClientButton';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';

export default function NewClientPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Clients']} current="New" />} />
      <div className="px-10 py-10">
        <PageHeader
          eyebrow="Create"
          title={
            <>
              Generate a new <em>client</em>.
            </>
          }
          subtitle={
            <>
              Answer a short brief once — generate a <strong>website</strong>,
              a <strong>funnel</strong>, or both. The client is created in
              Supabase and is ready to manage straight away.
            </>
          }
        />
        <div className="rounded-xl border border-dashed border-rule bg-card px-8 py-12 text-center">
          <p className="mb-4 text-[14px] text-ink-mid">
            A new client takes about a minute — business details, the offer,
            brand, and what to build.
          </p>
          <div className="flex justify-center">
            <CreateClientButton label="+ New client" />
          </div>
        </div>
      </div>
    </>
  );
}
