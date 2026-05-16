import type { SearchResults } from '@/lib/search/types';

import { SearchResultGroup } from './SearchResultGroup';

type SearchResultsViewProps = {
  data: SearchResults;
  /** The active query — drives the summary line and per-row highlighting. */
  query: string;
};

/** The shared body of the `/search` results page — a result-count summary
 *  strip plus the per-kind groups. Role-agnostic: operator and client pass
 *  their own role-scoped `SearchResults`. */
function SearchResultsView({ data, query }: SearchResultsViewProps) {
  const total = data.groups.reduce((sum, group) => sum + group.results.length, 0);

  return (
    <div className="flex flex-col gap-6 px-10 py-10">
      <div className="rounded-[10px] bg-ink px-5 py-3 text-paper">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-paper/70">
          <em className="not-italic text-rust-light">{total} results</em> for
          {' “'}
          {query}
          {'” '}· searching {data.scopeLabel}
        </span>
      </div>
      {data.groups.map((group) => (
        <SearchResultGroup key={group.kind} group={group} query={query} />
      ))}
    </div>
  );
}

export { SearchResultsView };
export type { SearchResultsViewProps };
