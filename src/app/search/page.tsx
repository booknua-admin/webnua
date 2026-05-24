'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { GlobalSearchInput } from '@/components/shared/search/GlobalSearchInput';
import { SearchResultsView } from '@/components/shared/search/SearchResultsView';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useRole } from '@/lib/auth/user-stub';
import { normalizeError } from '@/lib/errors';
import { useSearch } from '@/lib/search/queries';
import { useActiveClient, useWorkspace } from '@/lib/workspace/workspace-stub';

function SearchNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-6 md:px-10 md:py-10">
      <p className="rounded-xl border border-rule bg-card px-5.5 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {children}
      </p>
    </div>
  );
}

function SearchPageInner() {
  const { role } = useRole();
  const params = useSearchParams();
  const { activeClientId } = useWorkspace();
  const activeClient = useActiveClient();

  // Operator + sub-account mode: narrow to the active client by default;
  //   operator may toggle to "search across all clients" to widen.
  // Operator + agency mode: always cross-client (toggle is meaningless).
  // Client role: always own data (unchanged).
  const inSubAccount = role === 'admin' && activeClientId != null;
  const [searchAllClients, setSearchAllClients] = useState(false);
  const widenScope = inSubAccount && searchAllClients;
  const scope = role === 'admin' ? 'admin' : 'client';
  const query = params.get('q')?.trim() ?? '';

  const { data, isLoading, error } = useSearch(
    query,
    scope,
    inSubAccount && !widenScope ? activeClientId : null,
  );

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb current="Search" />}
        search={<GlobalSearchInput defaultValue={query} />}
      />
      {inSubAccount ? (
        <div className="flex items-center justify-between gap-3 border-b border-ink/8 bg-paper-2/40 px-10 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {searchAllClients ? (
              <>
                {'// SEARCHING ALL CLIENTS · '}
                <strong className="text-ink">cross-tenant scope</strong>
              </>
            ) : (
              <>
                {'// SEARCHING '}
                <strong className="text-ink">
                  {(activeClient?.name ?? activeClientId).toUpperCase()}
                </strong>
                {' ONLY · narrowed to active client'}
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setSearchAllClients((v) => !v)}
            className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
          >
            {searchAllClients
              ? 'Narrow to active client →'
              : 'Search across all clients →'}
          </button>
        </div>
      ) : null}
      {query.length === 0 ? (
        <SearchNotice>{'// Type a query to search'}</SearchNotice>
      ) : isLoading ? (
        <SearchNotice>{'// Searching…'}</SearchNotice>
      ) : error || !data ? (
        <SearchNotice>
          {`// ${error ? normalizeError(error).message : 'Search unavailable'}`}
        </SearchNotice>
      ) : (
        <SearchResultsView data={data} query={query} />
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  );
}
