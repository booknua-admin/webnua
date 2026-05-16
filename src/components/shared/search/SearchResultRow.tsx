import Link from 'next/link';

import { highlightMatch } from '@/lib/search/highlight';
import type { SearchResult, SearchResultKind } from '@/lib/search/types';
import { cn } from '@/lib/utils';

type SearchResultRowProps = {
  result: SearchResult;
  /** The active query — highlighted within the title + meta. */
  query: string;
};

const KIND_TILE: Record<SearchResultKind, string> = {
  lead: 'bg-rust-soft text-rust',
  booking: 'bg-good-soft text-good',
  review: 'bg-[rgba(245,195,50,0.18)] text-[#b8870e]',
  conversation: 'bg-info-soft text-info',
  customer: 'bg-paper-2 text-ink-quiet',
  client: 'bg-ink text-rust-light',
};

function SearchResultRow({ result, query }: SearchResultRowProps) {
  return (
    <Link
      href={result.href}
      data-slot="search-result-row"
      className="grid grid-cols-[40px_1fr_auto] items-center gap-3.5 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-rule hover:bg-paper-2/60"
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold',
          KIND_TILE[result.kind],
        )}
      >
        {result.avatar}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold text-ink">
          {highlightMatch(result.title, query)}
        </div>
        <div className="truncate text-[12px] text-ink-quiet">
          {highlightMatch(result.meta, query)}
        </div>
      </div>
      <span aria-hidden className="text-[14px] text-ink-quiet">
        →
      </span>
    </Link>
  );
}

export { SearchResultRow };
export type { SearchResultRowProps };
