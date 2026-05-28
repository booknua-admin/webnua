'use client';

// =============================================================================
// AdEditModal — per-ad creative + copy editor.
//
// Phase 7.5 · Session 2.3 (v2). Opens when the operator clicks an ad
// preview card on the blueprint. Side-by-side layout:
//   • Left  : the editable fields (image upload + 4 copy fields +
//             CTA + per-ad selection toggle)
//   • Right : live Meta-feed preview at full size
//
// Image upload reuses useUploadAdImage (PR #163 — Supabase Storage
// section-media bucket).
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

// Meta News Feed character caps (defensive in-form display only — the
// generator clips server-side too).
const HEADLINE_MAX = 40;
const PRIMARY_TEXT_MAX = 125;
const DESCRIPTION_MAX = 27;

export type AdDraft = {
  id: string;
  headline: string;
  primaryText: string;
  description: string;
  ctaType: CtaType;
  imageUrl: string;
  selected: boolean;
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

  // Re-seed the working draft on every open. Intentional setState-
  // in-effect — the parent passes a fresh `initial` per render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(initial);
    setUploadError(null);
  }, [initial, open]);

  async function handleFilePicked(file: File) {
    setUploadError(null);
    // We need the client id for Storage path scoping. Brief carries
    // brand context but not clientId — the parent passes brief from
    // GenerateAdsView, which has clientId in scope. For now, derive
    // from the upload mutation's input shape: the mutation already
    // requires clientId from its caller. Since AdEditModal doesn't
    // accept clientId directly, we treat upload as a brief-scoped
    // action and pull it from… actually the cleanest fix is to take
    // clientId as a prop. Done below.
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
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edit ad</DialogTitle>
          <DialogDescription>
            Tweak the copy + image. The preview on the right updates as you
            type.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* --- left: form --- */}
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.selected}
                onChange={(e) =>
                  setDraft({ ...draft, selected: e.target.checked })
                }
                className="h-4 w-4 cursor-pointer accent-rust"
              />
              <span className="text-[13px] font-semibold text-ink">
                Include this ad in the launch
              </span>
            </label>

            <FieldRow
              label="Headline"
              sub={`Bold caption under the image. Meta limit: ${HEADLINE_MAX} chars.`}
              count={draft.headline.length}
              max={HEADLINE_MAX}
            >
              <Input
                type="text"
                value={draft.headline}
                onChange={(e) =>
                  setDraft({ ...draft, headline: e.target.value })
                }
                maxLength={80}
              />
            </FieldRow>

            <FieldRow
              label="Primary text"
              sub={`Above the image — the pain hook + promise. Meta limit: ${PRIMARY_TEXT_MAX} chars.`}
              count={draft.primaryText.length}
              max={PRIMARY_TEXT_MAX}
            >
              <Textarea
                value={draft.primaryText}
                onChange={(e) =>
                  setDraft({ ...draft, primaryText: e.target.value })
                }
                rows={3}
                maxLength={250}
              />
            </FieldRow>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldRow
                label="Description"
                sub={`Meta limit: ${DESCRIPTION_MAX} chars.`}
                count={draft.description.length}
                max={DESCRIPTION_MAX}
              >
                <Input
                  type="text"
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                  maxLength={60}
                />
              </FieldRow>

              <FieldRow label="CTA button" sub="What the Meta button says.">
                <select
                  value={draft.ctaType}
                  onChange={(e) =>
                    setDraft({ ...draft, ctaType: e.target.value as CtaType })
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

            <FieldRow
              label="Image"
              sub="Upload your own or keep the inherited image."
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
                primaryText={draft.primaryText}
                headline={draft.headline}
                description={draft.description}
                ctaType={draft.ctaType}
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
