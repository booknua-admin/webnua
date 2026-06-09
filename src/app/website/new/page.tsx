'use client';

// =============================================================================
// /website/new — new-page creation flow.
//
// Two entry lanes:
//   - AI draft        → the existing 5-question form-to-page flow
//   - Starter template → curated builder-facing page starters that drop
//                        straight into the editor with intentional section
//                        stacks and seeded copy.
//
// State lives in URL search params (?step=N&q1=...&q2=...) so back/forward
// and refresh work natively. No localStorage — see design doc §1.
//
// Capability gating:
//   - AI lane        → `editPages` AND `useAI`
//   - starter lane   → `editPages`
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
import { useCan, useUser } from '@/lib/auth/user-stub';
import { useWorkspace } from '@/lib/workspace/workspace-stub';
import {
  getBrandForClient,
  DEFAULT_PREVIEW_BRAND,
} from '@/lib/website/data-stub';
import {
  useEffectiveDraft,
  useWebsiteForClient,
} from '@/lib/website/queries';
import { addGeneratedPage } from '@/lib/website/generated-pages-stub';
import {
  buildStarterPage,
  getPageStarter,
  getPageStarters,
  type PageStarterId,
} from '@/lib/website/page-starters';
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
type CreationMode = 'ai' | 'starter';

export default function WebsiteNewPage() {
  const user = useUser();
  const workspace = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canEditPages = useCan('editPages');
  const canUseAI = useCan('useAI');
  const canGenerate = canEditPages && canUseAI;

  const [generating, setGenerating] = useState<null | {
    ctx: GenerationContext;
  }>(null);

  const activeClientId = user
    ? user.role === 'client'
      ? user.clientId
      : workspace.activeClientId
    : null;
  const websiteQuery = useWebsiteForClient(activeClientId);
  const website = websiteQuery.data ?? null;
  const draftQuery = useEffectiveDraft(website?.id ?? null);
  const draftPages = draftQuery.data?.snapshot.pages ?? [];

  const step = Math.max(1, Math.min(6, Number(searchParams.get('step') ?? '1'))) as Step;
  const modeParam = searchParams.get('mode');
  const mode: CreationMode | null =
    modeParam === 'ai' || modeParam === 'starter' ? modeParam : null;
  const pageType = (searchParams.get('pageType') as PageType | null) ?? null;
  const starterId = (searchParams.get('starterId') as PageStarterId | null) ?? null;
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

  if (!activeClientId) {
    return (
      <Shell>
        <NoContextState />
      </Shell>
    );
  }

  if (websiteQuery.isLoading) {
    return (
      <Shell>
        <p className="mx-auto max-w-[640px] py-12 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// Loading website…'}
        </p>
      </Shell>
    );
  }

  if (!website) {
    return (
      <Shell>
        <NoContextState reason="no-website" />
      </Shell>
    );
  }

  const brand = getBrandForClient(activeClientId) ?? DEFAULT_PREVIEW_BRAND;
  const existingPages: ExistingPageSnapshot[] = draftPages.map(snapshotFromPage);
  const starterOptions = pageType ? getPageStarters(pageType) : [];
  const selectedStarter = starterId ? getPageStarter(starterId) : null;

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

  if (!canEditPages) {
    return (
      <Shell>
        <NoAccessState />
      </Shell>
    );
  }

  if (!mode) {
    return (
      <Shell>
        <div className="mx-auto max-w-[760px] py-12">
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-rust">
            {'// START A NEW PAGE'}
          </p>
          <h1 className="mb-2 text-[36px] font-extrabold leading-[1.05] tracking-[-0.025em] text-ink">
            How do you want to <em className="not-italic text-rust">start</em>?
          </h1>
          <p className="mb-8 max-w-[620px] text-[15px] leading-[1.55] text-ink-mid">
            Use AI when you want a fresh draft from a brief. Use a starter
            template when you want a solid page structure you can edit by hand.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <ModeCard
              eyebrow="// AI DRAFT"
              title="Answer a few questions"
              body="Best when you want the builder to draft the copy, section order, and CTA direction for you."
              actionLabel={canGenerate ? 'Start AI draft →' : 'AI access required'}
              disabled={!canGenerate}
              onClick={() =>
                updateSearch(router, searchParams, {
                  mode: 'ai',
                  step: '1',
                  pageType: null,
                  starterId: null,
                })
              }
            />
            <ModeCard
              eyebrow="// STARTER TEMPLATE"
              title="Drop in a page starter"
              body="Best when you want a curated section stack with intentional layouts, then edit the copy yourself."
              actionLabel="Choose a starter →"
              onClick={() =>
                updateSearch(router, searchParams, {
                  mode: 'starter',
                  step: '1',
                  pageType: null,
                  starterId: null,
                  intent: null,
                  intentOther: null,
                  audience: null,
                  specifics: null,
                  avoid: null,
                })
              }
            />
          </div>
        </div>
      </Shell>
    );
  }

  if (mode === 'starter') {
    const starterStep = Math.max(1, Math.min(3, step)) as 1 | 2 | 3;
    const goToStarterStep = (s: 1 | 2 | 3) =>
      updateSearch(router, searchParams, { step: String(s) });

    if (starterStep === 1) {
      return (
        <Shell>
          <QuestionCard
            eyebrow="// STARTER 1 OF 3"
            title={
              <>
                What <em>kind of page</em> do you want to start from?
              </>
            }
            helper="Pick the page type first — we’ll show the strongest starter templates for that job."
            progressLabel={
              <>
                Starter <strong>1</strong> of 3
              </>
            }
            isAnswered={!!pageType}
            required
            onBack={() =>
              updateSearch(router, searchParams, {
                mode: null,
                step: null,
                pageType: null,
                starterId: null,
              })
            }
            onContinue={() => goToStarterStep(2)}
          >
            <ChipSelector
              options={PAGE_TYPE_CHIPS.map((c) => ({ id: c.id, label: c.label }))}
              value={pageType ?? undefined}
              onChange={(id) =>
                updateSearch(router, searchParams, {
                  pageType: id,
                  starterId: null,
                })
              }
              layout="wrap"
            />
          </QuestionCard>
        </Shell>
      );
    }

    if (starterStep === 2) {
      return (
        <Shell>
          <QuestionCard
            eyebrow="// STARTER 2 OF 3"
            title={
              <>
                Pick a <em>starter template</em>.
              </>
            }
            helper="These are curated page starters — section stacks plus layout choices you can edit immediately."
            progressLabel={
              <>
                Starter <strong>2</strong> of 3
              </>
            }
            isAnswered={!!selectedStarter}
            required
            onBack={() => goToStarterStep(1)}
            onContinue={() => goToStarterStep(3)}
          >
            <div className="grid gap-3">
              {starterOptions.map((starter) => (
                <StarterCard
                  key={starter.id}
                  active={starterId === starter.id}
                  label={starter.label}
                  description={starter.description}
                  sections={starter.sections.map((section) => section.type)}
                  onClick={() =>
                    updateSearch(router, searchParams, { starterId: starter.id })
                  }
                />
              ))}
            </div>
          </QuestionCard>
        </Shell>
      );
    }

    const handleCreateStarter = () => {
      if (!website || !selectedStarter) return;
      const stored = addGeneratedPage(
        website.id,
        buildStarterPage({
          websiteId: website.id,
          starterId: selectedStarter.id,
          existingPages: draftPages,
          brand,
        }),
      );
      router.push(`/website/${stored.id}`);
    };

    return (
      <Shell>
        <div className="mx-auto max-w-[640px] py-12">
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-rust">
            {'// READY TO CREATE'}
          </p>
          <h1 className="mb-2 text-[36px] font-extrabold leading-[1.05] tracking-[-0.025em] text-ink">
            Review your <em className="not-italic text-rust">starter page</em>.
          </h1>
          <p className="mb-7 text-[15px] leading-[1.55] text-ink-mid">
            We&rsquo;ll add this page to{' '}
            <strong className="font-bold text-ink">{website.name}</strong> with
            its starter sections ready to edit.
          </p>

          <div className="mb-6 overflow-hidden rounded-xl border border-rule bg-card">
            <ReviewRow
              label="Mode"
              value="Starter template"
              onEdit={() =>
                updateSearch(router, searchParams, { mode: null, step: null })
              }
            />
            <ReviewRow
              label="Page type"
              value={pageType ? describePageType(pageType) : '—'}
              onEdit={() => goToStarterStep(1)}
            />
            <ReviewRow
              label="Starter"
              value={
                selectedStarter ? (
                  <>
                    <strong className="text-ink">{selectedStarter.label}</strong>
                    <span className="block text-[13px] text-ink-mid">
                      {selectedStarter.description}
                    </span>
                  </>
                ) : (
                  '—'
                )
              }
              onEdit={() => goToStarterStep(2)}
            />
          </div>

          <BuilderFooterActions
            progress={
              <>
                Starter <strong>3</strong> of 3
              </>
            }
            actions={
              <>
                <Button variant="ghost" onClick={() => goToStarterStep(2)}>
                  ← Back
                </Button>
                <Button onClick={handleCreateStarter} disabled={!selectedStarter}>
                  Create starter page →
                </Button>
              </>
            }
          />
        </div>
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
          onBack={() =>
            updateSearch(router, searchParams, {
              mode: null,
              step: null,
              pageType: null,
              starterId: null,
              intent: null,
              intentOther: null,
              audience: null,
              specifics: null,
              avoid: null,
            })
          }
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
      const stored = addGeneratedPage(
        website.id,
        withDedupedSlug(result.page, draftPages),
      );
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
            label="Mode"
            value="AI draft"
            onEdit={() =>
              updateSearch(router, searchParams, { mode: null, step: null })
            }
          />
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

function NoAccessState() {
  return (
    <div className="mx-auto max-w-[480px] py-16 text-center">
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
        {'// PAGE CREATION LOCKED'}
      </p>
      <p className="mb-5 text-[16px] text-ink">
        You can view the builder, but you don&rsquo;t have permission to create pages in
        this workspace.
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

/** Avoid title / slug collisions with existing pages. */
function withDedupedSlug(page: Page, existing: readonly Page[]): Page {
  const existingTitles = new Set(existing.map((p) => p.title.toLowerCase()));
  const existingSlugs = new Set(existing.map((p) => p.slug.toLowerCase()));
  if (!existingTitles.has(page.title.toLowerCase()) && !existingSlugs.has(page.slug.toLowerCase())) {
    return page;
  }
  let n = 2;
  while (
    existingTitles.has(`${page.title.toLowerCase()} ${n}`) ||
    existingSlugs.has(`${page.slug.toLowerCase()}-${n}`)
  ) {
    n += 1;
  }
  return { ...page, slug: `${page.slug}-${n}`, title: `${page.title} ${n}` };
}

function updateSearch(
  router: ReturnType<typeof useRouter>,
  searchParams: ReturnType<typeof useSearchParams>,
  patch: Record<string, string | null>,
) {
  const next = new URLSearchParams(searchParams.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === '') next.delete(k);
    else next.set(k, v);
  }
  router.push(`/website/new?${next.toString()}`);
}

function ModeCard({
  eyebrow,
  title,
  body,
  actionLabel,
  onClick,
  disabled = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  actionLabel: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-rule bg-card px-5 py-5 text-left transition-colors hover:border-rust disabled:cursor-not-allowed disabled:opacity-55"
    >
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
        {eyebrow}
      </p>
      <p className="mb-2 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
        {title}
      </p>
      <p className="mb-5 text-[14px] leading-[1.55] text-ink-mid">{body}</p>
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
        {actionLabel}
      </span>
    </button>
  );
}

function StarterCard({
  active,
  label,
  description,
  sections,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  sections: readonly string[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-4 text-left transition-colors ${
        active
          ? 'border-rust bg-rust-soft/40'
          : 'border-rule bg-card hover:border-rust/60'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="text-[18px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
          {label}
        </p>
        {active ? (
          <span className="rounded-pill bg-rust px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-paper">
            Selected
          </span>
        ) : null}
      </div>
      <p className="mb-3 text-[14px] leading-[1.55] text-ink-mid">{description}</p>
      <div className="flex flex-wrap gap-1.5">
        {sections.map((section, index) => (
          <span
            key={`${section}-${index}`}
            className="rounded-pill bg-paper-2 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink-quiet"
          >
            {section}
          </span>
        ))}
      </div>
    </button>
  );
}
