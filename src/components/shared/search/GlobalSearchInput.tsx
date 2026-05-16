'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib/utils';

type GlobalSearchInputProps = {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
};

/**
 * The global-search field. Lives in the `Topbar` `search` slot and at the top
 * of the `/search` results page. Enter routes to `/search?q=…`; the stub layer
 * renders the canonical result set regardless, so this is the entry point, not
 * a live filter.
 */
function GlobalSearchInput({
  defaultValue = '',
  placeholder = 'Search leads, bookings, reviews…',
  className,
}: GlobalSearchInputProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  const submit = () => {
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  return (
    <div
      data-slot="global-search-input"
      className={cn(
        'flex h-9 w-full max-w-[440px] items-center gap-2 rounded-pill border border-rule bg-card px-3.5',
        className,
      )}
    >
      <span aria-hidden className="text-[13px] text-ink-quiet">
        ⌕
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit();
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-quiet focus:outline-none"
      />
      <kbd className="rounded border border-rule px-1.5 py-0.5 font-mono text-[9px] font-bold text-ink-quiet">
        ⌘K
      </kbd>
    </div>
  );
}

export { GlobalSearchInput };
export type { GlobalSearchInputProps };
