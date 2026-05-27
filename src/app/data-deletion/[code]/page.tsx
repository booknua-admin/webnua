// =============================================================================
// /data-deletion/[code] — public status page for Meta-required data deletion.
//
// Meta's User Data Deletion contract requires the webhook response to
// include a publicly-reachable URL the user can visit to verify the
// deletion happened. This is that page. It reads meta_data_deletion_log
// by the opaque code (RLS allows public select) and displays the safe
// columns. PII (the Meta user id) is intentionally NOT exposed — the
// SELECT below is column-scoped to enforce that even if RLS were lax.
//
// Lives outside every role group so it is reachable WITHOUT a Webnua
// account — Meta reviewers + end users will hit it directly.
// =============================================================================

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';

// Untyped view of the supabase client — meta_data_deletion_log isn't in
// the generated Database type until the Phase-7-style regen pass; same
// shape every other Phase 7 table uses (see CLAUDE.md inventory).
function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export const metadata: Metadata = {
  title: 'Data deletion confirmation — Webnua',
  robots: { index: false, follow: false },
};

type Row = {
  code: string;
  client_ids_count: number;
  deleted_resources: string[];
  initiated_by: string;
  deleted_at: string;
};

const RESOURCE_LABEL: Record<string, string> = {
  meta_ads_insights: 'Daily ad campaign performance metrics',
  meta_lead_forms: 'Lead form definitions',
  meta_campaigns: 'Ad campaign records',
  client_meta_ad_accounts: 'Ad account assignment',
  integration_connections: 'OAuth connection + access tokens',
};

const INITIATOR_LABEL: Record<string, string> = {
  meta_webhook: 'Triggered by Facebook (you removed our app from your Facebook settings)',
  in_app: 'Triggered in-app (you clicked "Disconnect & delete data" on Webnua)',
};

export default async function DataDeletionStatusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Read with the anon-key client + column-scoped select so the meta_user_id
  // can never leak even if the RLS policy was misconfigured.
  const { data, error } = await db()
    .from('meta_data_deletion_log')
    .select('code, client_ids_count, deleted_resources, initiated_by, deleted_at')
    .eq('code', code)
    .maybeSingle();

  if (error || !data) notFound();

  const row = data as Row;
  const when = new Date(row.deleted_at).toLocaleString('en-IE', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const resources = (row.deleted_resources ?? []).filter(Boolean);

  return (
    <main className="mx-auto flex min-h-svh max-w-[640px] flex-col gap-6 px-6 py-12">
      <header>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rust">
          {'// WEBNUA · DATA DELETION'}
        </p>
        <h1 className="mt-2 text-[28px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
          Your Meta data has been <em className="not-italic text-rust">deleted</em>.
        </h1>
        <p className="mt-2 text-[14px] leading-[1.5] text-ink-quiet">
          Webnua removed every record we received from Meta on your behalf.
          The OAuth connection has been revoked and the tokens destroyed.
        </p>
      </header>

      <section className="rounded-xl border border-rule bg-paper/70 p-5">
        <dl className="grid gap-3 text-[13px]">
          <div className="flex items-baseline justify-between gap-4 border-b border-dotted border-rule-soft pb-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
              Confirmation code
            </dt>
            <dd className="font-mono text-[12px] text-ink">{row.code}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-dotted border-rule-soft pb-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
              Completed
            </dt>
            <dd className="text-ink">{when}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
              Accounts affected
            </dt>
            <dd className="text-ink">{row.client_ids_count}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// What was removed'}
        </h2>
        {resources.length === 0 ? (
          <p className="rounded-md border border-dashed border-rule bg-paper px-3 py-3 text-[13px] text-ink-quiet">
            No Webnua data was associated with this Meta account at the
            time of the request. Nothing to remove.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-[13px] text-ink-soft">
            {resources.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-good">✓</span>
                <span>{RESOURCE_LABEL[r] ?? r}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// How this was initiated'}
        </h2>
        <p className="text-[13px] leading-[1.5] text-ink-soft">
          {INITIATOR_LABEL[row.initiated_by] ?? row.initiated_by}
        </p>
      </section>

      <section className="border-t border-rule pt-4 text-[12px] leading-[1.5] text-ink-quiet">
        <p>
          Questions about this deletion? Reach out to{' '}
          <a href="mailto:hello@webnua.com" className="text-rust hover:underline">
            hello@webnua.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
