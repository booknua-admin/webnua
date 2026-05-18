'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCustomerSearch } from '@/lib/customers/queries';
import type { SelectedCustomer } from '@/lib/customers/queries';
import { cn } from '@/lib/utils';

type CustomerPickerProps = {
  /** Client UUID — scopes the search and the quick-add insert. */
  clientId: string;
  value: SelectedCustomer | null;
  onChange: (customer: SelectedCustomer | null) => void;
};

/** Search-and-pick a customer, or quick-add a new one. The picker only
 *  produces a `SelectedCustomer`; the actual `customers` INSERT for a new
 *  customer happens in the booking-write flow. */
function CustomerPicker({ clientId, value, onChange }: CustomerPickerProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const { data: matches, isLoading } = useCustomerSearch(clientId, query);

  // ---- A customer is already chosen ----------------------------------------
  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[10px] border border-rust bg-rust-soft px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-ink">
            {value.name}
            {value.kind === 'new' ? (
              <span className="ml-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-rust">
                New
              </span>
            ) : null}
          </div>
          <div className="truncate text-[12px] text-ink-quiet">
            {value.phone ?? 'No phone'}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-8 shrink-0 text-[12px]"
          onClick={() => onChange(null)}
        >
          Change
        </Button>
      </div>
    );
  }

  // ---- Quick-add a new customer --------------------------------------------
  if (mode === 'new') {
    const canAdd = newName.trim().length > 0;
    return (
      <div className="rounded-[10px] border border-rule bg-paper p-3.5">
        <div className="mb-2.5 grid grid-cols-2 gap-2.5">
          <Input
            className="bg-card"
            placeholder="Customer name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            className="bg-card"
            placeholder="Phone (optional)"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink-quiet transition-colors hover:text-ink"
            onClick={() => setMode('search')}
          >
            ← Back to search
          </button>
          <Button
            type="button"
            variant="default"
            className="h-8 text-[12px]"
            disabled={!canAdd}
            onClick={() =>
              onChange({
                kind: 'new',
                name: newName.trim(),
                phone: newPhone.trim() || null,
              })
            }
          >
            Use customer
          </Button>
        </div>
      </div>
    );
  }

  // ---- Search --------------------------------------------------------------
  const showResults = query.trim().length >= 2;
  return (
    <div className="rounded-[10px] border border-rule bg-paper p-2.5">
      <Input
        className="bg-card"
        placeholder="Search customer by name or phone"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {showResults ? (
        <div className="mt-2 flex flex-col gap-1">
          {isLoading ? (
            <p className="px-2 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-quiet">
              Searching…
            </p>
          ) : matches && matches.length > 0 ? (
            matches.map((m) => (
              <button
                key={m.id}
                type="button"
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors',
                  'hover:border-rust hover:bg-rust-soft',
                )}
                onClick={() =>
                  onChange({
                    kind: 'existing',
                    id: m.id,
                    name: m.name,
                    phone: m.phone,
                  })
                }
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-ink">
                    {m.name}
                  </span>
                  <span className="block truncate text-[12px] text-ink-quiet">
                    {[m.phone, m.suburb].filter(Boolean).join(' · ') ||
                      'No contact details'}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-2 py-2 text-[12px] text-ink-quiet">
              No customer matches “{query.trim()}”.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 px-2 text-[12px] text-ink-quiet">
          Type at least two characters to search existing customers.
        </p>
      )}
      <button
        type="button"
        className="mt-1.5 w-full rounded-lg border border-dashed border-rule px-2.5 py-2 text-center font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-rust transition-colors hover:border-rust hover:bg-rust-soft"
        onClick={() => {
          setNewName(query.trim());
          setMode('new');
        }}
      >
        + Add a new customer
      </button>
    </div>
  );
}

export { CustomerPicker };
export type { CustomerPickerProps };
