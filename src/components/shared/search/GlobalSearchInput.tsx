'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib/utils';

type GlobalSearchInputProps = {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  /** When set, the field renders as a click target that opens the command
   *  palette instead of a live input — the Topbar auto-render passes this so
   *  the chrome search affordance and ⌘K share one surface. Omit it (the
   *  `/search` page does) to keep a real type-and-enter input. */
  onTrigger?: () => void;
};

/**
 * The global-search field. Lives in the `Topbar` `search` slot and at the top
 * of the `/search` results page. In input mode, Enter routes to `/search?q=…`;
 * in trigger mode (`onTrigger`) it opens the `CommandPalette`.
 */
function GlobalSearchInput({
  defaultValue = '',
  placeholder = 'Search leads, bookings, reviews…',
  className,
  onTrigger,
}: GlobalSearchInputProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  const frame = cn(
    'flex h-9 w-full max-w-[440px] items-center gap-2 rounded-pill border border-rule bg-card px-3.5',
    className,
  );

  if (onTrigger) {
    return (
      <button
        type="button"
        data-slot="global-search-trigger"
        onClick={onTrigger}
        className={cn(
          frame,
          'cursor-pointer text-left transition-colors hover:border-rust/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust/40',
        )}
      >
        <span aria-hidden className="text-[13px] text-ink-quiet">
          ⌕
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-quiet">
          {placeholder}
        </span>
        <kbd className="rounded border border-rule px-1.5 py-0.5 font-mono text-[9px] font-bold text-ink-quiet">
          ⌘K
        </kbd>
      </button>
    );
  }

  const submit = () => {
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  return (
    <div data-slot="global-search-input" className={frame}>
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
