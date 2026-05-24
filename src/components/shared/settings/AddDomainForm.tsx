'use client';

// =============================================================================
// AddDomainForm — the "Connect your own domain" composer.
//
// Phase 9. Validates the input client-side via lib/domains/validation, posts
// to /api/domains, surfaces server errors inline. Used by CustomDomainSection
// in both initial-add and add-another modes.
// =============================================================================

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAttachDomain } from '@/lib/domains/queries';
import { validateDomain } from '@/lib/domains/validation';

export function AddDomainForm({
  clientId,
  onCancel,
}: {
  clientId: string;
  onCancel: (() => void) | null;
}) {
  const [value, setValue] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const attach = useAttachDomain();

  // Live validation — only show the error once the user has typed at least a
  // dot (avoids "invalid" flashing as they type the first letters).
  const localError = useMemo(() => {
    if (!value.trim() || !value.includes('.')) return null;
    const v = validateDomain(value);
    return v.valid ? null : v.errors[0] ?? null;
  }, [value]);

  const disabled = attach.isPending || !value.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const v = validateDomain(value);
    if (!v.valid) {
      setServerError(v.errors[0] ?? 'Invalid domain.');
      return;
    }
    try {
      await attach.mutateAsync({ clientId, domain: v.normalized });
      setValue('');
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Could not attach the domain.',
      );
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label
        htmlFor="custom-domain-input"
        className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet"
      >
        Your domain
      </label>
      <div className="flex gap-2.5">
        <Input
          id="custom-domain-input"
          type="text"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="voltline.ie"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 font-mono"
          aria-invalid={localError != null || serverError != null}
        />
        <Button type="submit" disabled={disabled}>
          {attach.isPending ? 'Connecting…' : 'Connect domain →'}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setValue('');
              setServerError(null);
              onCancel();
            }}
          >
            Cancel
          </Button>
        ) : null}
      </div>
      {localError ? (
        <p className="font-mono text-[11px] text-warn">{localError}</p>
      ) : null}
      {serverError ? (
        <p className="font-mono text-[11px] text-warn">{serverError}</p>
      ) : null}
      <p className="text-[13px] leading-relaxed text-ink-quiet">
        After you add the domain, we&apos;ll give you DNS records to set at your domain provider.
        Most domains go live within 5–60 minutes.
      </p>
    </form>
  );
}
