'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { GlobalSearchInput } from '@/components/shared/search/GlobalSearchInput';
import { SearchResultsView } from '@/components/shared/search/SearchResultsView';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useRole } from '@/lib/auth/user-stub';
import { adminSearchResults } from '@/lib/search/admin-search';
import { clientSearchResults } from '@/lib/search/client-search';

function SearchPageInner() {
  const { role } = useRole();
  const params = useSearchParams();

  // Operators search across every client; a client searches their own account.
  const data = role === 'admin' ? adminSearchResults : clientSearchResults;
  // Stub layer: the query routes here but the canonical result set renders
  // regardless. `?q=` still drives the displayed query + highlighting.
  const query = params.get('q')?.trim() || data.query;

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb current="Search" />}
        search={<GlobalSearchInput defaultValue={query} />}
      />
      <SearchResultsView data={data} query={query} />
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
