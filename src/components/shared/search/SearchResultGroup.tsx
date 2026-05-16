import type { SearchResultGroup as SearchResultGroupData } from '@/lib/search/types';

import { SearchResultRow } from './SearchResultRow';

type SearchResultGroupProps = {
  group: SearchResultGroupData;
  query: string;
};

/** One per-entity-kind group on the search results surface: a mono label +
 *  count chip header, then a bordered card of `SearchResultRow`s. */
function SearchResultGroup({ group, query }: SearchResultGroupProps) {
  return (
    <section data-slot="search-result-group">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {group.label}
        </span>
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink px-1.5 font-mono text-[10px] font-bold text-paper">
          {group.results.length}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 rounded-xl border border-rule bg-card p-2">
        {group.results.map((result) => (
          <SearchResultRow key={result.id} result={result} query={query} />
        ))}
      </div>
    </section>
  );
}

export { SearchResultGroup };
export type { SearchResultGroupProps };
