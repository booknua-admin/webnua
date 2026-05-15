'use client';

// =============================================================================
// /website/new — form-to-page Q&A generation flow (Session 6).
//
// Five questions (locked in reference/builder-generation-design.md §2):
//   1. Page type   (required, chip)
//   2. Primary intent (required, chip + "Other" free-text fallback)
//   3. Audience    (required, chip)
//   4. Specifics   (optional, free text)
//   5. Avoid       (optional, free text)
// Then a review card → generation card → router push into the editor.
//
// State lives in URL search params (?step=N&q1=...&q2=...) so back/forward
// and refresh work natively. No localStorage — see design doc §1.
//
// Capability gating: entry requires `editPages` AND `useAI` (see /website
// hub for the gated CTA). This route itself doesn't re-check the caps —
// if you arrive here without them, the review card's Generate button is
// disabled with a tooltip pointing back to the hub.
// =============================================================================

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { QuestionCard } from '@/components/shared/website/QuestionCard';
import { GenerationStatusCard } from '@/components/shared/website/GenerationStatusCard';
import { ChipSelector } from '@/components/shared/ChipSelector';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import {
  BuilderField,
  BuilderInput,
  BuilderTextarea,
} from '@/components/shared/builder/BuilderField';
import { BuilderFooterActions } from '@/components/shared/builder/BuilderFooterActions';
import { Button } from '@/components/ui/button';
import { useUser, useCanAll } from '@/lib/auth/user-stub';
import { useWorkspace } from '@/lib/workspace/workspace-stub';
import {
  findWebsiteByClient,
  findVersion,
  getBrandForClient,
  DEFAULT_PREVIEW_BRAND,
} from '@/lib/website/data-stub';
import { addGeneratedPage } from '@/lib/website/generated-pages-stub';
import {
  generatePageStub,
  type GenerationResult,
} from '@/lib/website/generation-stub';
import {
  AUDIENCE_CHIPS,
  PAGE_TYPE_CHIPS,
  PRIMARY_INTENT_CHIPS,
  describeAudience,
  describeIntent,
  describePageType,
  type Audience,
  type ExistingPageSnapshot,
  type GenerationContext,
  type PrimaryIntent,
} from '@/lib/website/generation-context';
import type { Page, PageType } from '@/lib/website/types';
import Link from 'next/link';

type Step = 1 | 2 | 3 | 4 | 5 | 6; // 1-5 questions, 6 review

export default function WebsiteNewPage() {
  const user = useUser();
  const workspace = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canGenerate = useCanAll('editPages', 'useAI');

  const [generating, setGenerating] = useState<null | {
    ctx: GenerationContext;
  }>(null);

  const step = Math.max(1, Math.min(6, Number(searchParams.get('step') ?? '1'))) as Step;
  const pageType = (searchParams.get('pageType') as PageType | null) ?? null;
  const intentKind = searchParams.get('intent') as PrimaryIntent['kind'] | null;
  const intentOther = searchParams.get('intentOther') ?? '';
  const audience = searchParams.get('audience') as Audience | null;
  const specifics = searchParams.get('specifics') ?? '';
  const avoid = searchParams.get('avoid') ?? '';

  const intent: PrimaryIntent | null = useMemo(() => {
    if (!intentKind) return null;
    if (intentKind === 'other') {
      return intentOther.trim() ? { kind: 'other', text: intentOther.trim() } : null;
    }
    return { kind: intentKind } as PrimaryIntent;
  }, [intentKind, intentOther]);

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    router.push(`/website/new?${next.toString()}`);
  };

  const goToStep = (s: Step) => updateParams({ step: String(s) });

  if (!workspace.hydrated || !user) {
    return (
      <Shell>
        <p className="mx-auto max-w-[640px] py-12 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// Resolving workspace…'}
        </p>
      </Shell>
    );
  }

  const activeClientId =
    user.role === 'client' ? user.clientId : workspace.activeClientId;

  if (!activeClientId) {
    return (
      <Shell>
        <NoContextState />
      </Shell>
    );
  }

  const website = findWebsiteByClient(activeClientId);
  if (!website) {
    return (
      <Shell>
        <NoContextState reason="no-website" />
      </Shell>
    );
  }

  const brand = getBrandForClient(activeClientId) ?? DEFAULT_PREVIEW_BRAND;
  const draft = findVersion(website.draftVersionId);
  const existingPages: ExistingPageSnapshot[] = (draft?.snapshot.pages ?? []).map(
    snapshotFromPage,
  );

  if (generating) {
    return (
      <Shell>
        <GenerationStatusCard
          specifics={generating.ctx.specifics}
          avoid={generating.ctx.avoid}
        />
      </Shell>
    );
  }

  // -- Step 1 — Page type --------------------------------------------------
  if (step === 1) {
    return (
      <Shell>
        <QuestionCard
          eyebrow="// QUESTION 1 OF 5"
          title={
            <>
              What <em>kind of page</em> is this?
            </>
          }
          helper="Pick the closest match — the AI uses it to choose section structure."
          progressLabel={
            <>
              Question <strong>1</strong> of 5
            </>
          }
          isAnswered={!!pageType}
          required
          onContinue={() => goToStep(2)}
        >
          <ChipSelector
            options={PAGE_TYPE_CHIPS.map((c) => ({ id: c.id, label: c.label }))}
            value={pageType ?? undefined}
            onChange={(id) => updateParams({ pageType: id })}
            layout="wrap"
          />
        </QuestionCard>
      </Shell>
    );
  }

  // -- Step 2 — Primary intent --------------------------------------------
  if (step === 2) {
    const isOther = intentKind === 'other';
    return (
      <Shell>
        <QuestionCard
          eyebrow="// QUESTION 2 OF 5"
          title={
            <>
              What&rsquo;s the <em>one thing</em> a visitor should do?
            </>
          }
          helper="Drives the CTA copy and which conversion sections the AI picks."
          progressLabel={
            <>
              Question <strong>2</strong> of 5
            </>
          }
          isAnswered={!!intent}
          required
          onBack={() => goToStep(1)}
          onContinue={() => goToStep(3)}
        >
          <ChipSelector
            options={PRIMARY_INTENT_CHIPS.map((c) => ({ id: c.id, label: c.label }))}
            value={intentKind ?? undefined}
            onChange={(id) =>
              updateParams({
                intent: id,
                intentOther: id === 'other' ? intentOther : null,
              })
            }
            layout="wrap"
          />
          {isOther && (
            <div className="mt-4">
              <BuilderField
                label={<>Tell us what</>}
                helper="A short phrase — what should this page convince visitors to do?"
              >
                <BuilderInput
                  autoFocus
                  value={intentOther}
                  onChange={(e) =>
                    updateParams({ intentOther: e.target.value })
                  }
                  placeholder="e.g. show our portfolio + DM us"
                />
              </BuilderField>
            </div>
          )}
        </QuestionCard>
      </Shell>
    );
  }

  // -- Step 3 — Audience --------------------------------------------------
  if (step === 3) {
    return (
      <Shell>
        <QuestionCard
          eyebrow="// QUESTION 3 OF 5"
          title={
            <>
              Who&rsquo;s <em>coming</em> to this page?
            </>
          }
          helper="Calibrates the voice tone and how heavily trust signals are weighted."
          progressLabel={
            <>
              Question <strong>3</strong> of 5
            </>
          }
          isAnswered={!!audience}
          required
          onBack={() => goToStep(2)}
          onContinue={() => goToStep(4)}
        >
          <ChipSelector
            options={AUDIENCE_CHIPS.map((c) => ({ id: c.id, label: c.label }))}
            value={audience ?? undefined}
            onChange={(id) => updateParams({ audience: id })}
            layout="wrap"
          />
        </QuestionCard>
      </Shell>
    );
  }

  // -- Step 4 — Specifics (optional) -------------------------------------
  if (step === 4) {
    return (
      <Shell>
        <QuestionCard
          eyebrow="// QUESTION 4 OF 5"
          title={
            <>
              Anything <em>specific</em> to say?
            </>
          }
          helper="Optional. Paste the offer details, what's different about you, specific phrasing you want — anything the AI should treat as authoritative."
          progressLabel={
            <>
              Question <strong>4</strong> of 5 · optional
            </>
          }
          isAnswered={specifics.trim().length > 0}
          required={false}
          onBack={() => goToStep(3)}
          onContinue={() => goToStep(5)}
        >
          <BuilderTextarea
            value={specifics}
            onChange={(e) => updateParams({ specifics: e.target.value })}
            placeholder="e.g. ‘We're the only sparkies in Perth offering after-hours emergency callouts at the same price as business hours.’"
            rows={8}
            className="min-h-[160px]"
          />
        </QuestionCard>
      </Shell>
    );
  }

  // -- Step 5 — Avoid (optional) -----------------------------------------
  if (step === 5) {
    return (
      <Shell>
        <QuestionCard
          eyebrow="// QUESTION 5 OF 5"
          title={
            <>
              Anything to <em>avoid</em>?
            </>
          }
          helper="Optional. Terms you don't want used, claims you can't make (regulatory), tones that have failed before."
          progressLabel={
            <>
              Question <strong>5</strong> of 5 · optional
            </>
          }
          isAnswered={avoid.trim().length > 0}
          required={false}
          onBack={() => goToStep(4)}
          onContinue={() => goToStep(6)}
        >
          <BuilderTextarea
            value={avoid}
            onChange={(e) => updateParams({ avoid: e.target.value })}
            placeholder="e.g. ‘Don't say “cheapest” — we compete on quality not price.’"
            rows={6}
            className="min-h-[120px]"
          />
        </QuestionCard>
      </Shell>
    );
  }

  // -- Step 6 — Review + Generate ----------------------------------------
  const reviewIncomplete =
    !pageType || !intent || !audience;

  const handleGenerate = async () => {
    if (!pageType || !intent || !audience) return;
    const ctx: GenerationContext = {
      flavour: 'new-page',
      pageType,
      primaryIntent: intent,
      audience,
      specifics: specifics.trim() || null,
      avoid: avoid.trim() || null,
      brand,
      existingPages,
    };
    setGenerating({ ctx });
    try {
      const result: GenerationResult = await generatePageStub(ctx);
      const stored = addGeneratedPage(website.id, withDedupedSlug(result.page, existingPages));
      router.push(`/website/${stored.id}`);
    } catch (err) {
      // Aborted (e.g. browser back) — drop back to the review step.
      console.warn('Generation aborted:', err);
      setGenerating(null);
    }
  };

  return (
    <Shell>
      <div className="mx-auto max-w-[640px] py-12">
        <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-rust">
          {'// READY TO GENERATE'}
        </p>
        <h1 className="mb-2 text-[36px] font-extrabold leading-[1.05] tracking-[-0.025em] text-ink">
          Review your <em className="not-italic text-rust">answers</em>.
        </h1>
        <p className="mb-7 text-[15px] leading-[1.55] text-ink-mid">
          We&rsquo;ll draft a {pageType ? describePageType(pageType).toLowerCase() : 'page'} on{' '}
          <strong className="font-bold text-ink">{website.name}</strong>. Every field
          comes back marked AI-drafted — you edit before it goes live.
        </p>

        <div className="mb-6 overflow-hidden rounded-xl border border-rule bg-card">
          <ReviewRow
            label="Page type"
            value={pageType ? describePageType(pageType) : '—'}
            onEdit={() => goToStep(1)}
          />
          <ReviewRow
            label="Primary intent"
            value={intent ? describeIntent(intent) : '—'}
            onEdit={() => goToStep(2)}
          />
          <ReviewRow
            label="Audience"
            value={audience ? describeAudience(audience) : '—'}
            onEdit={() => goToStep(3)}
          />
          <ReviewRow
            label="Specifics"
            value={specifics.trim() || <span className="text-ink-quiet">(skipped)</span>}
            onEdit={() => goToStep(4)}
          />
          <ReviewRow
            label="Avoid"
            value={avoid.trim() || <span className="text-ink-quiet">(skipped)</span>}
            onEdit={() => goToStep(5)}
          />
        </div>

        {!canGenerate && (
          <div className="mb-4 rounded-lg border border-warn/40 bg-warn/[0.06] px-4 py-3 text-[13px] text-ink">
            You don&rsquo;t have AI generation permission on this workspace.{' '}
            <Link
              href="/website"
              className="font-bold text-rust hover:text-rust-deep"
            >
              Go back
            </Link>{' '}
            and ask your operator to generate this page.
          </div>
        )}

        <BuilderFooterActions
          progress={
            <>
              Step <strong>6</strong> of 6
            </>
          }
          actions={
            <>
              <Button variant="ghost" onClick={() => goToStep(5)}>
                ← Back
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={reviewIncomplete || !canGenerate}
              >
                ✦ Generate page →
              </Button>
            </>
          }
        />
      </div>
    </Shell>
  );
}

// -- Layout shell ------------------------------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Website']} current="New page" />}
      />
      <div className="px-10 pb-10">{children}</div>
    </>
  );
}

// -- Review row --------------------------------------------------------------

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr_auto] items-baseline gap-4 border-b border-paper-2 px-5 py-4 last:border-b-0">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </p>
      <p className="text-[14px] text-ink">{value}</p>
      <button
        type="button"
        onClick={onEdit}
        className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
      >
        Edit ✎
      </button>
    </div>
  );
}

// -- Empty states ------------------------------------------------------------

function NoContextState({
  reason,
}: {
  reason?: 'no-website';
}) {
  return (
    <div className="mx-auto max-w-[480px] py-16 text-center">
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
        {reason === 'no-website' ? '// NO WEBSITE YET' : '// NO WORKSPACE'}
      </p>
      <p className="mb-5 text-[16px] text-ink">
        {reason === 'no-website'
          ? 'This client doesn’t have a website yet. Scaffold one first.'
          : 'Pick a client from the sidebar to generate a page for them.'}
      </p>
      <Button asChild variant="secondary">
        <Link href="/website">← Back to website</Link>
      </Button>
    </div>
  );
}

// -- Helpers -----------------------------------------------------------------

function snapshotFromPage(p: Page): ExistingPageSnapshot {
  const heroSection = p.sections.find((s) => s.type === 'hero' && s.enabled);
  const ctaSection = p.sections.find((s) => s.type === 'cta' && s.enabled);
  const heroData = heroSection?.data as Record<string, unknown> | undefined;
  const ctaData = ctaSection?.data as Record<string, unknown> | undefined;
  return {
    pageTitle: p.title,
    h1: (heroData?.headline as string | undefined) ?? null,
    primaryCta:
      (heroData?.ctaPrimaryLabel as string | undefined) ??
      (ctaData?.ctaLabel as string | undefined) ??
      null,
    sectionTypes: p.sections.filter((s) => s.enabled).map((s) => s.type),
  };
}

/** Avoid slug collisions with existing pages. */
function withDedupedSlug(page: Page, existing: ExistingPageSnapshot[]): Page {
  const existingSlugs = new Set(existing.map((p) => p.pageTitle.toLowerCase()));
  // existing-pages snapshot doesn't carry slug; compare on title as a proxy.
  // The real backend will check against the actual slug column.
  if (!existingSlugs.has(page.title.toLowerCase())) return page;
  let n = 2;
  while (existingSlugs.has(`${page.title.toLowerCase()}-${n}`)) n += 1;
  return { ...page, slug: `${page.slug}-${n}`, title: `${page.title} ${n}` };
}
