'use client';

// =============================================================================
// Generate-API-key flow (admin /settings/api). A stub modal behind the
// "+ Generate new key" button: name the key → Generate reveals a single stub
// token, shown once with a copy affordance.
//
// STUB: nothing persists — closing discards the key and the API-keys list is
// unchanged. Wire to a real key store when the backend lands.
// =============================================================================

import { useState } from 'react';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type GenerateApiKeyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function makeStubKey(): string {
  let body = '';
  for (let i = 0; i < 32; i += 1) {
    body += KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)];
  }
  return `whk_live_${body}`;
}

function GenerateApiKeyModal({ open, onOpenChange }: GenerateApiKeyModalProps) {
  const [name, setName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName('');
      setGeneratedKey(null);
      setCopied(false);
    }
    onOpenChange(next);
  }

  async function handleCopy() {
    if (!generatedKey) return;
    try {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
    } catch {
      // Clipboard unavailable — leave the button in its un-copied state.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="default"
        showCloseButton={false}
        className="flex flex-col overflow-hidden rounded-[14px] border-rule bg-card p-0 gap-0"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-paper-2 px-7 pb-4 pt-5.5">
          <div className="flex-1">
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
              {'// Generate API key'}
            </div>
            <DialogTitle className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.025em] text-ink">
              New API key
            </DialogTitle>
          </div>
          <DialogPrimitive.Close
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 font-mono text-[16px] text-ink-quiet transition-colors hover:bg-ink hover:text-paper"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          {generatedKey === null ? (
            <div className="flex flex-col gap-2">
              <label
                htmlFor="api-key-name"
                className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet"
              >
                Key name
              </label>
              <Input
                id="api-key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zapier integration"
                autoComplete="off"
              />
              <p className="mt-1 text-[12px] leading-[1.5] text-ink-quiet">
                Give the key a name you&apos;ll recognise later — it shows in the keys list so you
                know what each one is for.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                {name.trim() || 'New API key'}
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-rule bg-paper px-3.5 py-3">
                <code className="min-w-0 flex-1 truncate font-mono text-[12px] tracking-[0.03em] text-ink">
                  {generatedKey}
                </code>
                <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
                  {copied ? 'Copied ✓' : 'Copy'}
                </Button>
              </div>
              <p className="rounded-lg bg-warn-soft px-3.5 py-2.5 text-[12px] leading-[1.5] text-warn">
                Copy this key now — for security it&apos;s shown only once. If you lose it, revoke
                it and generate a new one.
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-paper-2 bg-paper px-7 py-4">
          {generatedKey === null ? (
            <>
              <Button variant="secondary" className="h-9" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="default"
                className="h-9"
                disabled={name.trim().length === 0}
                onClick={() => setGeneratedKey(makeStubKey())}
              >
                Generate key →
              </Button>
            </>
          ) : (
            <Button variant="default" className="h-9" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { GenerateApiKeyModal };
export type { GenerateApiKeyModalProps };
