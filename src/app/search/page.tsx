'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { GlobalSearchInput } from '@/components/shared/search/GlobalSearchInput';
import { SearchResultsView } from '@/components/shared/search/SearchResultsView';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useRole } from '@/lib/auth/user-stub';
import { normalizeError } from '@/lib/errors';
import { useSearch } from '@/lib/search/queries';

function SearchNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-10 py-10">
      <p className="rounded-xl border border-rule bg-card px-5.5 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {children}
      </p>
    </div>
  );
}

function SearchPageInner() {
  const { role } = useRole();
  const params = useSearchParams();

  // Operators search across every client; a client searches their own account.
  const scope = role === 'admin' ? 'admin' : 'client';
  const query = params.get('q')?.trim() ?? '';

  const { data, isLoading, error } = useSearch(query, scope);

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb current="Search" />}
        search={<GlobalSearchInput defaultValue={query} />}
      />
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
