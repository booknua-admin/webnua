'use client';

// =============================================================================
// BrandEditorContent — the actual form behind /settings/brand.
//
// Reads + writes the brands row directly via supabase.from('brands').
// brands_update RLS was widened in migration 0088 so an owner with the
// editTheme cap can update their own brand row.
//
// Layout:
//   - Identity & voice section (tagline, audience line, industry)
//   - Palette section (accent color + 2 optional brand colors + 3 inherited
//     section defaults: heading / body / background color)
//   - Typography section (heading + body font from CURATED_FONTS)
//   - Logo section (Storage upload via uploadSectionImage)
//   - Voice tone section (formality / urgency / technicality sliders)
//
// Mobile-first: every row stacks on narrow screens. Color picker uses the
// native <input type="color"> on touch devices (no custom JS picker — works
// down to 320px without a complex react-color dep).
// =============================================================================

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/lib/auth/user-stub';
import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { CURATED_FONTS, DEFAULT_FONT_ID, getFont } from '@/lib/website/google-fonts';
import { uploadSectionImage } from '@/lib/website/upload-image';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

type BrandRow = {
  client_id: string;
  accent_color: string;
  brand_colors: string[];
  logo_url: string | null;
  favicon_url: string | null;
  voice_formality: number;
  voice_urgency: number;
  voice_technicality: number;
  audience_line: string;
  industry_category: string;
  top_jobs_to_be_booked: string[];
  heading_font: string | null;
  body_font: string | null;
  heading_color: string | null;
  body_color: string | null;
  background_color: string | null;
  tagline: string | null;
};

type Props = {
  clientSlug: string;
  clientName: string;
  isOperator: boolean;
};

export function BrandEditorContent({ clientSlug, clientName, isOperator }: Props) {
  const user = useUser();

  // Resolve clientId (uuid) from slug, then read the brand row.
  const clientQuery = useQuery({
    queryKey: ['settings', 'brand', 'client-id', clientSlug],
    queryFn: async (): Promise<{ id: string } | null> => {
      const { data, error } = await supabase
        .from('clients')
        .select('id')
        .eq('slug', clientSlug)
        .single();
      if (error) throw normalizeError(error);
      return data;
    },
    staleTime: Infinity,
  });
  const clientId = clientQuery.data?.id ?? null;

  const brandQuery = useQuery({
    queryKey: ['settings', 'brand', 'row', clientId],
    queryFn: async (): Promise<BrandRow | null> => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) throw normalizeError(error);
      return (data as BrandRow | null) ?? null;
    },
    enabled: clientId != null,
    staleTime: 30_000,
  });

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Brand" />} />
      <SettingsShell
        eyebrow={`${clientName} · brand`}
        title={
          <>
            Your <em>brand</em>.
          </>
        }
        subtitle={
          <>
            Colours, fonts, logo, and voice tone the website + funnel
            generator use to keep your pages on-brand.{' '}
            <strong>Changes apply to future generations</strong> and to the
            section defaults on existing pages.
          </>
        }
      >
        <CapabilityGate
          capability="editTheme"
          mode="disable"
          disabledExplainer="Brand editing is managed by your operator."
        >
          {clientQuery.isLoading || brandQuery.isLoading ? (
            <Loading />
          ) : clientQuery.error || brandQuery.error ? (
            <ErrorPanel
              message={
                clientQuery.error instanceof Error
                  ? clientQuery.error.message
                  : brandQuery.error instanceof Error
                    ? brandQuery.error.message
                    : 'Could not load your brand.'
              }
            />
          ) : !brandQuery.data || !clientId ? (
            <ErrorPanel message="No brand on this workspace yet — contact your operator." />
          ) : (
            <BrandForm
              brand={brandQuery.data}
              clientId={clientId}
              isOperator={isOperator}
              currentUserId={user?.id ?? ''}
            />
          )}
        </CapabilityGate>
      </SettingsShell>
    </>
  );
}

function BrandForm({
  brand,
  clientId,
}: {
  brand: BrandRow;
  clientId: string;
  isOperator: boolean;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();

  // Form state — initialized from the live row, re-synced when the source
  // row changes (state-in-effect canonical pattern, matches QuietHoursSection).
  const [tagline, setTagline] = useState(brand.tagline ?? '');
  const [audienceLine, setAudienceLine] = useState(brand.audience_line ?? '');
  const [industryCategory, setIndustryCategory] = useState(brand.industry_category ?? '');
  const [accentColor, setAccentColor] = useState(brand.accent_color);
  const [brandColor2, setBrandColor2] = useState(brand.brand_colors[1] ?? '');
  const [brandColor3, setBrandColor3] = useState(brand.brand_colors[2] ?? '');
  const [headingColor, setHeadingColor] = useState(brand.heading_color ?? '');
  const [bodyColor, setBodyColor] = useState(brand.body_color ?? '');
  const [backgroundColor, setBackgroundColor] = useState(brand.background_color ?? '');
  const [headingFont, setHeadingFont] = useState(brand.heading_font ?? DEFAULT_FONT_ID);
  const [bodyFont, setBodyFont] = useState(brand.body_font ?? DEFAULT_FONT_ID);
  const [logoUrl, setLogoUrl] = useState(brand.logo_url ?? '');
  const [formality, setFormality] = useState(brand.voice_formality);
  const [urgency, setUrgency] = useState(brand.voice_urgency);
  const [technicality, setTechnicality] = useState(brand.voice_technicality);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);

  // Re-sync local state if the source row refetches.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setTagline(brand.tagline ?? '');
    setAudienceLine(brand.audience_line ?? '');
    setIndustryCategory(brand.industry_category ?? '');
    setAccentColor(brand.accent_color);
    setBrandColor2(brand.brand_colors[1] ?? '');
    setBrandColor3(brand.brand_colors[2] ?? '');
    setHeadingColor(brand.heading_color ?? '');
    setBodyColor(brand.body_color ?? '');
    setBackgroundColor(brand.background_color ?? '');
    setHeadingFont(brand.heading_font ?? DEFAULT_FONT_ID);
    setBodyFont(brand.body_font ?? DEFAULT_FONT_ID);
    setLogoUrl(brand.logo_url ?? '');
    setFormality(brand.voice_formality);
    setUrgency(brand.voice_urgency);
    setTechnicality(brand.voice_technicality);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [brand]);

  async function handleLogoUpload(file: File) {
    setUploadError(null);
    setUploading(true);
    const result = await uploadSectionImage(file);
    setUploading(false);
    if (!result.ok) {
      setUploadError(result.error.message);
      return;
    }
    setLogoUrl(result.data.url);
  }

  const save = useMutation({
    mutationFn: async () => {
      setSaveError(null);

      // Validate hex colours. Accent is required; others are optional and
      // pass through when blank.
      if (!HEX_RE.test(accentColor)) {
        throw new Error('Primary color must be a valid hex (e.g. #d24317).');
      }
      const optColors = [brandColor2, brandColor3, headingColor, bodyColor, backgroundColor];
      for (const c of optColors) {
        if (c && !HEX_RE.test(c)) {
          throw new Error(`"${c}" is not a valid hex colour.`);
        }
      }
      if (logoUrl && !/^https?:\/\//.test(logoUrl)) {
        throw new Error('Logo URL must start with http:// or https://');
      }

      const brandColors = [accentColor, brandColor2, brandColor3].filter(
        (c): c is string => Boolean(c) && HEX_RE.test(c),
      );

      const { error } = await supabase
        .from('brands')
        .update({
          accent_color: accentColor,
          brand_colors: brandColors,
          tagline: tagline.trim() || null,
          audience_line: audienceLine.trim(),
          industry_category: industryCategory.trim(),
          heading_color: headingColor.trim() || null,
          body_color: bodyColor.trim() || null,
          background_color: backgroundColor.trim() || null,
          heading_font: headingFont || null,
          body_font: bodyFont || null,
          logo_url: logoUrl.trim() || null,
          voice_formality: formality,
          voice_urgency: urgency,
          voice_technicality: technicality,
        })
        .eq('client_id', clientId);
      if (error) throw normalizeError(error);
    },
    onSuccess: () => {
      setSavedHint(true);
      window.setTimeout(() => setSavedHint(false), 2000);
      queryClient.invalidateQueries({ queryKey: ['settings', 'brand'] });
      // The website editor reads brand fields via the same fetchBrandForClient
      // hook — bump its cache too so previews refresh.
      queryClient.invalidateQueries({ queryKey: ['website', 'brand'] });
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    },
  });

  return (
    <SettingsPanel>
      <SettingsSection
        heading={
          <>
            Identity <em>&amp; voice</em>
          </>
        }
        description="The short copy the generator weaves into hero, about, and footer sections. Update these if your tagline or audience shifts."
      >
        <div className="flex flex-col gap-4">
          <Field label="Tagline" sub="One short sentence">
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Same-day callouts. Fixed price."
              className="h-9"
            />
          </Field>
          <Field label="Audience line" sub="Who you serve, in one phrase">
            <Textarea
              value={audienceLine}
              onChange={(e) => setAudienceLine(e.target.value)}
              placeholder="Homeowners in Sydney's inner west who want their job done right the first time."
              rows={2}
            />
          </Field>
          <Field label="Industry / category" sub="A short trade label">
            <Input
              value={industryCategory}
              onChange={(e) => setIndustryCategory(e.target.value)}
              placeholder="Residential plumbing"
              className="h-9"
            />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        heading={
          <>
            Brand <em>palette</em>
          </>
        }
        description="Your primary colour drives section accents, buttons, and links across the site. Add 1–2 supporting colours for the generator to mix in."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ColorField label="Primary" required value={accentColor} onChange={setAccentColor} />
          <ColorField label="Supporting" value={brandColor2} onChange={setBrandColor2} />
          <ColorField label="Accent" value={brandColor3} onChange={setBrandColor3} />
        </div>
        <p className="mt-4 text-[12px] leading-[1.45] text-ink-quiet">
          <strong>Section defaults below</strong> are colours sections inherit
          when they don&apos;t override the colour themselves. Leave blank for
          the section&apos;s own default to apply.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ColorField label="Heading color" value={headingColor} onChange={setHeadingColor} />
          <ColorField label="Body color" value={bodyColor} onChange={setBodyColor} />
          <ColorField
            label="Background color"
            value={backgroundColor}
            onChange={setBackgroundColor}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        heading={
          <>
            Type <em>scale</em>
          </>
        }
        description="Pick a heading and body font. The generator loads both via Google Fonts on every generated page."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FontField label="Heading font" value={headingFont} onChange={setHeadingFont} />
          <FontField label="Body font" value={bodyFont} onChange={setBodyFont} />
        </div>
      </SettingsSection>

      <SettingsSection
        heading={
          <>
            Logo <em>&amp; mark</em>
          </>
        }
        description="Your logo appears in the website header and on the funnel pages. Upload a PNG / SVG / JPG (under 3 MB)."
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-rule bg-paper">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Brand logo"
                className="max-h-20 max-w-20 object-contain"
              />
            ) : (
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
                No logo
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…  (or upload below)"
              className="h-9"
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleLogoUpload(file);
                    e.target.value = ''; // reset so re-selecting the same file fires onChange
                  }}
                  className="hidden"
                  id="brand-logo-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="cursor-pointer"
                >
                  <span>
                    <label htmlFor="brand-logo-upload" className="cursor-pointer">
                      {uploading ? 'Uploading…' : 'Upload logo'}
                    </label>
                  </span>
                </Button>
              </label>
              {logoUrl ? (
                <Button variant="ghost" size="sm" onClick={() => setLogoUrl('')}>
                  Remove
                </Button>
              ) : null}
            </div>
            {uploadError ? (
              <p className="text-[12px] font-semibold text-warn">{uploadError}</p>
            ) : null}
            <p className="text-[12px] leading-[1.45] text-ink-quiet">
              PNG, SVG, or JPG. Under 3 MB. Square or rectangular both work — the
              renderer fits it to its container.
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        heading={
          <>
            Voice <em>tone</em>
          </>
        }
        description="Three sliders that nudge the generator's word choice. Tweak when you regenerate a page and the language feels off."
      >
        <div className="flex flex-col gap-5">
          <ToneSlider
            label="Formality"
            sub="Casual ⇆ Buttoned-up"
            value={formality}
            onChange={setFormality}
          />
          <ToneSlider
            label="Urgency"
            sub="Calm ⇆ Act-now"
            value={urgency}
            onChange={setUrgency}
          />
          <ToneSlider
            label="Technicality"
            sub="Plain English ⇆ Trade jargon OK"
            value={technicality}
            onChange={setTechnicality}
          />
        </div>
      </SettingsSection>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {saveError ? (
          <p className="text-[12px] font-semibold text-warn">{saveError}</p>
        ) : savedHint ? (
          <p className="text-[12px] font-semibold text-good">Saved ✓</p>
        ) : null}
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save brand'}
        </Button>
      </div>
    </SettingsPanel>
  );
}

function Field({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[220px_1fr] sm:items-start sm:gap-4">
      <div>
        <div className="text-[13px] font-semibold text-ink">{label}</div>
        {sub ? <div className="mt-0.5 text-[11.5px] text-ink-quiet">{sub}</div> : null}
      </div>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
}) {
  // Empty string for optional colours = inherit. We keep the input controlled
  // but skip the native <input type="color"> when the value isn't a valid
  // hex (it expects #rrggbb).
  const colorForPicker = HEX_RE.test(value) ? value : '#000000';
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-ink">
        {label}{' '}
        {required ? <span className="text-warn">*</span> : (
          <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-ink-quiet">
            optional
          </span>
        )}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={colorForPicker}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border border-rule bg-card"
          aria-label={`${label} color picker`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#d24317"
          className="h-9 font-mono text-[13px]"
          maxLength={7}
        />
      </div>
    </div>
  );
}

function FontField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const font = getFont(value);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-ink">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-card px-2 text-[13px]"
      >
        {CURATED_FONTS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.family} · {f.category}
          </option>
        ))}
      </select>
      <div
        className="rounded-md border border-rule bg-paper px-3 py-2 text-[18px] font-bold leading-snug text-ink"
        style={{ fontFamily: font.stack }}
      >
        The quick brown fox
      </div>
    </div>
  );
}

function ToneSlider({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-ink">{label}</div>
          <div className="mt-0.5 text-[11px] text-ink-quiet">{sub}</div>
        </div>
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-rust">
          {value} / 5
        </div>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 cursor-pointer accent-rust"
        aria-label={label}
      />
    </div>
  );
}

function Loading() {
  return (
    <div className="rounded-lg border border-dashed border-rule bg-paper px-6 py-5 text-[13px] leading-[1.55] text-ink-quiet">
      One moment — loading your brand.
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-warn/30 bg-warn/5 px-6 py-5 text-[13px] leading-[1.55] text-warn">
      {message}
    </div>
  );
}
