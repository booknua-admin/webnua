'use client';

// =============================================================================
// AdEditModal — per-ad image editor + shared-copy editor for the parent set.
//
// Phase 7.5 · Session 2.3 (v3). Each ad is an IMAGE variant within its
// ad set; the set's COPY is shared across every ad. To keep the
// experiment design honest (within a set, only image varies), the
// modal exposes BOTH:
//   • Image (this ad only — selection + URL + Storage upload)
//   • Copy (shared across every ad in this set — change here flips
//     all ads in the set)
//
// Side-by-side layout. Live full-size MetaAdPreview on the right shows
// the result of the operator's typing in real time.
// =============================================================================

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUploadAdImage } from '@/lib/integrations/meta-ads/use-meta-ads';

import type { BlueprintBrief, CtaType } from './CampaignBlueprint';
import { MetaAdPreview } from './MetaAdPreview';

const CTA_OPTIONS: ReadonlyArray<CtaType> = [
  'LEARN_MORE',
  'BOOK_NOW',
  'GET_QUOTE',
  'CONTACT_US',
  'GET_OFFER',
  'SIGN_UP',
  'APPLY_NOW',
];

const HEADLINE_MAX = 40;
const PRIMARY_TEXT_MAX = 125;
const DESCRIPTION_MAX = 27;

export type AdDraft = {
  /** Per-ad fields (this image variant). */
  id: string;
  label: string;
  imageUrl: string;
  selected: boolean;
  /** Shared-copy fields — changes write through to the AD-SET level
   *  on save, applying to every ad in the set. */
  sharedHeadline: string;
  sharedPrimaryText: string;
  sharedDescription: string;
  sharedCtaType: CtaType;
  /** Context for the modal header — which ad set this ad sits in. */
  adSetLabel: string;
  adSetAngleId: string;
};

export type AdEditModalProps = {
  open: boolean;
  draft: AdDraft;
  brief: BlueprintBrief | null;
  onChange: (next: AdDraft) => void;
  onClose: () => void;
};

export function AdEditModal({
  open,
  draft: initial,
  brief,
  onChange,
  onClose,
}: AdEditModalProps) {
  const [draft, setDraft] = useState<AdDraft>(initial);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const upload = useUploadAdImage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(initial);
    setUploadError(null);
  }, [initial, open]);

  async function handleFilePicked(file: File) {
    setUploadError(null);
    try {
      const result = await upload.mutateAsync({
        clientId: brief?.clientId ?? '',
        file,
      });
      setDraft((d) => ({ ...d, imageUrl: result.url }));
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Upload failed — try again or paste a URL instead.',
      );
    }
  }

  function handleSave() {
    onChange(draft);
    onClose();
  }

  const linkHost = brief?.primaryDomain ?? undefined;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      {/* Viewport-safe sizing — the lg dialog default has no max-h
          so the side-by-side image+copy+preview layout overflows on
          standard laptop viewports. max-h:calc + overflow-y:auto on
          the content + an inner flex column lets the body scroll
          while header + footer pin to the dialog edges. */}
      <DialogContent
        size="lg"
        className="max-h-[calc(100vh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            {draft.adSetLabel} · {draft.label}
          </DialogTitle>
          <DialogDescription>
            Tweak this ad&rsquo;s image, or edit the copy shared by every ad
            in this set. Preview updates as you type.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* --- left: editable fields --- */}
          <div className="flex flex-col gap-6">
            {/* Section 1 — per-ad: image + selection */}
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[13px] font-semibold text-ink">
                  This ad ({draft.label})
                </h3>
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  {'// IMAGE ONLY'}
                </span>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.selected}
                  onChange={(e) =>
                    setDraft({ ...draft, selected: e.target.checked })
                  }
                  className="h-4 w-4 cursor-pointer accent-rust"
                />
                <span className="text-[13px] text-ink">
                  Include this image in the launch
                </span>
              </label>

              <FieldRow
                label="Ad label"
                sub="The badge that appears on this preview."
              >
                <Input
                  type="text"
                  value={draft.label}
                  onChange={(e) =>
                    setDraft({ ...draft, label: e.target.value })
                  }
                  maxLength={20}
                />
              </FieldRow>

              <FieldRow
                label="Image"
                sub="Upload your own or paste a hosted URL."
              >
                <div className="flex flex-col gap-2">
                  <Input
                    type="url"
                    value={draft.imageUrl}
                    onChange={(e) =>
                      setDraft({ ...draft, imageUrl: e.target.value })
                    }
                    placeholder="https://…"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFilePicked(file);
                        e.target.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={upload.isPending || !brief?.clientId}
                      className="h-9"
                    >
                      {upload.isPending ? 'Uploading…' : 'Upload image…'}
                    </Button>
                    {uploadError ? (
                      <span className="text-[12px] text-warn">{uploadError}</span>
                    ) : null}
                  </div>
                </div>
              </FieldRow>
            </section>

            {/* Section 2 — shared: copy (writes through to the whole ad set) */}
            <section className="flex flex-col gap-3 rounded-md border border-rule bg-paper/40 px-3 py-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[13px] font-semibold text-ink">
                  Copy (shared across this ad set)
                </h3>
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-rust">
                  {'// EVERY AD IN SET'}
                </span>
              </div>
              <p className="text-[11px] leading-snug text-ink-quiet">
                Every ad in <strong className="font-semibold text-ink">{draft.adSetLabel}</strong> uses
                the same copy. Editing here updates every image variant in
                this set — the experiment design tests image-vs-image with
                copy held constant.
              </p>

              <FieldRow
                label="Headline"
                count={draft.sharedHeadline.length}
                max={HEADLINE_MAX}
              >
                <Input
                  type="text"
                  value={draft.sharedHeadline}
                  onChange={(e) =>
                    setDraft({ ...draft, sharedHeadline: e.target.value })
                  }
                  maxLength={80}
                />
              </FieldRow>

              <FieldRow
                label="Primary text"
                count={draft.sharedPrimaryText.length}
                max={PRIMARY_TEXT_MAX}
              >
                <Textarea
                  value={draft.sharedPrimaryText}
                  onChange={(e) =>
                    setDraft({ ...draft, sharedPrimaryText: e.target.value })
                  }
                  rows={3}
                  maxLength={250}
                />
              </FieldRow>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldRow
                  label="Description"
                  count={draft.sharedDescription.length}
                  max={DESCRIPTION_MAX}
                >
                  <Input
                    type="text"
                    value={draft.sharedDescription}
                    onChange={(e) =>
                      setDraft({ ...draft, sharedDescription: e.target.value })
                    }
                    maxLength={60}
                  />
                </FieldRow>

                <FieldRow label="CTA button">
                  <select
                    value={draft.sharedCtaType}
                    onChange={(e) =>
                      setDraft({ ...draft, sharedCtaType: e.target.value as CtaType })
                    }
                    className="w-full rounded-md border border-rule bg-paper/40 px-3 py-2 text-[14px] text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust"
                  >
                    {CTA_OPTIONS.map((cta) => (
                      <option key={cta} value={cta}>
                        {humaniseCta(cta)}
                      </option>
                    ))}
                  </select>
                </FieldRow>
              </div>
            </section>
          </div>

          {/* --- right: live preview --- */}
          <div className="flex flex-col gap-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
              {'// LIVE PREVIEW'}
            </span>
            <div className="rounded-xl border border-rule bg-paper-2/40 p-4">
              <MetaAdPreview
                pageName={brief?.businessName ?? 'Your business'}
                pageLogoUrl={null}
                primaryText={draft.sharedPrimaryText}
                headline={draft.sharedHeadline}
                description={draft.sharedDescription}
                ctaType={draft.sharedCtaType}
                imageUrl={draft.imageUrl || null}
                accentColor={brief?.accentColor}
                linkHost={linkHost}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- sub-components --------------------------------------------------------

function FieldRow({
  label,
  sub,
  count,
  max,
  children,
}: {
  label: string;
  sub?: string;
  count?: number;
  max?: number;
  children: React.ReactNode;
}) {
  const over = count != null && max != null && count > max;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        {count != null && max != null ? (
          <span
            className={`font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${
              over ? 'text-warn' : 'text-ink-quiet'
            }`}
          >
            {count} / {max}
          </span>
        ) : null}
      </div>
      {sub ? (
        <span className="text-[11px] leading-snug text-ink-quiet">{sub}</span>
      ) : null}
      {children}
    </div>
  );
}

function humaniseCta(cta: CtaType): string {
  return cta
    .toLowerCase()
    .split('_')
    .map((s) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)))
    .join(' ');
}
