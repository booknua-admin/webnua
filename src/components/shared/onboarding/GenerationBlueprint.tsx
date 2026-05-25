'use client';

// =============================================================================
// GenerationBlueprint — fullscreen "blueprint being drawn" overlay for the
// conversational onboarding's turn-5 site + funnel generation.
//
// REPLACES the previous in-chat-bubble `ChatGenerationBubble`. The chat
// bubble was too small + too quiet for what's actually a 45-90s wait the
// customer is locked into; this is a fullscreen takeover that gives the
// moment the weight it deserves.
//
// Visual concept — architect's drawing assembled in real time:
//   - Blueprint grid background (paper-cream, faint ink grid lines).
//   - SVG wireframe blocks for each section type drawing in one by one
//     via stroke-dasharray animation — like watching a hand sketch them.
//   - Site sheet (left) + funnel sheet (right) on desktop; stacked on
//     mobile.
//   - Mono-eyebrow + descriptive line cycling through 9 stages tracking
//     real progress (probe → generating-site → generating-funnel →
//     persisting → ready). Honest — only show "Drawing your funnel" once
//     the funnel-generation phase has fired.
//   - Final READY stamp + Continue CTA.
//
// Honest progress rule:
//   - The component takes `phase` (the real generator phase from
//     runConversationGeneration's onProgress callback).
//   - Visual blocks animate in on a fixed cadence (~2-3s each) for
//     pleasant rhythm — but the progress-text stage AT MINIMUM matches
//     the real phase. Visual can lead the text in (drawing the funnel
//     wireframe before "Drawing your funnel" text appears is fine), but
//     text NEVER claims a step before the real backend has reached it.
//   - When the real call finishes faster than the visual sequence, the
//     remaining blocks accelerate to completion and the READY state
//     mounts.
//
// Stack discipline (CLAUDE.md): no new deps — pure SVG + CSS via
// `stroke-dasharray` + `stroke-dashoffset`. Mobile-first responsive (the
// silhouette scales down on a 375px screen).
//
// Lifecycle:
//   - phase='idle'             — pre-trigger; the shell normally jumps
//                                straight to 'running' so this is rare.
//   - phase='probing'/...      — drawing in, progress text cycling.
//   - phase='ready'            — final stamp + Continue.
//   - phase='failed'           — error state + retry.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';

import { BrandMark } from '@/components/ui/BrandMark';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// public types

export type BlueprintPhase =
  | 'idle'
  | 'probing'
  | 'generating-site'
  | 'generating-funnel'
  | 'persisting'
  | 'ready'
  | 'failed';

export type GenerationBlueprintProps = {
  /** Real progress phase from runConversationGeneration. Drives the
   *  progress-text stage clamp + the success/error transitions. */
  phase: BlueprintPhase;
  /** Customer's industry display name ("Painters" / "Plumbers" / ...). Used
   *  to interpolate the progress messages so they read concrete. Falls back
   *  to "tradies" if missing. */
  industryDisplay?: string;
  /** Number of services the customer picked. Drives the "Adding all N
   *  services to your site…" line. */
  serviceCount?: number;
  /** Customer's business name. Used in the READY stamp. Falls back to "your
   *  site". */
  businessName?: string;
  /** Error message shown in the 'failed' state. */
  errorMessage?: string;
  /** Optional partial-success warning (one arm landed, the other had a
   *  soft error). Shown subtly in the 'ready' state. */
  softError?: string;
  /** Retry callback fired from the 'failed' state. */
  onRetry?: () => void;
  /** Primary "view your site" callback fired from the 'ready' state.
   *  Lands the customer in the website editor (where they can see what
   *  was built); the dashboard is the secondary path. */
  onViewEditor?: () => void;
  /** Secondary "go to dashboard" callback fired from the 'ready' state.
   *  Rendered as a small text link so the editor is the primary destination
   *  (the dashboard's billing CTA is intentionally NOT the first thing
   *  the customer sees post-generation). */
  onContinue?: () => void;
  /** Tag the run with a build attempt id so internal `key=` resets the
   *  visual sequence on retry without remounting the whole component. */
  attemptId?: string | number;
};

// ---------------------------------------------------------------------------
// stage table — message + which real phase must be reached before this
// stage's TEXT may show. The visual blocks animate on a fixed cadence
// (BLOCK_ANIMATION_MS); the text stage only advances when both the visual
// position AND the real-phase gate are satisfied.

type StageId =
  | 'reading'
  | 'layout'
  | 'hero'
  | 'offer'
  | 'services'
  | 'social-proof'
  | 'funnel'
  | 'blueprints'
  | 'ready';

type Stage = {
  id: StageId;
  /** Mono uppercase eyebrow. */
  eyebrow: string;
  /** Descriptive line. May interpolate via `format(ctx)`. */
  line: (ctx: { industryDisplay: string; serviceCount: number }) => string;
  /** The minimum real BlueprintPhase that must have been seen for this
   *  stage's TEXT to be revealed. The visual block may draw in earlier;
   *  the text waits for honesty. */
  unlockedAt: BlueprintPhase;
};

const STAGES: readonly Stage[] = [
  {
    id: 'reading',
    eyebrow: '// READING YOUR BRIEF',
    line: () => 'Understanding what you do and who you serve…',
    unlockedAt: 'probing',
  },
  {
    id: 'layout',
    eyebrow: '// CHOOSING YOUR LAYOUT',
    line: (ctx) => `Picking the right section structure for ${ctx.industryDisplay}…`,
    unlockedAt: 'generating-site',
  },
  {
    id: 'hero',
    eyebrow: '// WRITING YOUR HERO',
    line: () => 'Drafting your homepage headline…',
    unlockedAt: 'generating-site',
  },
  {
    id: 'offer',
    eyebrow: '// SHAPING YOUR OFFER',
    line: () => 'Putting your guarantee front and centre…',
    unlockedAt: 'generating-site',
  },
  {
    id: 'services',
    eyebrow: '// LISTING YOUR SERVICES',
    line: (ctx) =>
      ctx.serviceCount > 0
        ? `Adding all ${ctx.serviceCount} services to your site…`
        : 'Adding your services to your site…',
    unlockedAt: 'generating-site',
  },
  {
    id: 'social-proof',
    eyebrow: '// BUILDING SOCIAL PROOF',
    line: () => 'Setting up where your reviews will go…',
    unlockedAt: 'generating-site',
  },
  {
    id: 'funnel',
    eyebrow: '// DRAWING YOUR FUNNEL',
    line: () => 'Building a separate landing page for your ads…',
    unlockedAt: 'generating-funnel',
  },
  {
    id: 'blueprints',
    eyebrow: '// CHECKING THE BLUEPRINTS',
    line: () => "Making sure everything's connected…",
    unlockedAt: 'persisting',
  },
  {
    id: 'ready',
    eyebrow: '// READY',
    line: () => "Site built. Funnel built. Let's go.",
    unlockedAt: 'ready',
  },
];

/** How long each visual block takes to "draw in" on the happy path. With 9
 *  stages × 5s this gives a ~45s sequence; the real generators usually
 *  resolve in 60-90s, so the visual sequence finishes a touch ahead of
 *  the real call — when that happens we park on the final pre-ready
 *  stage waiting for the real phase to flip to 'ready'.
 *  When real generation resolves FASTER than the visual sequence (rare),
 *  the remaining blocks accelerate via the speed-up effect below. */
const BLOCK_ANIMATION_MS = 5000;
/** Once `phase === 'ready'` but the visual sequence hasn't reached the
 *  final block yet, accelerate by ticking every N ms instead. */
const SPEEDUP_TICK_MS = 600;

const PHASE_RANK: Record<BlueprintPhase, number> = {
  idle: -1,
  probing: 0,
  'generating-site': 1,
  'generating-funnel': 2,
  persisting: 3,
  ready: 4,
  failed: 99,
};

// ---------------------------------------------------------------------------
// component

export function GenerationBlueprint(props: GenerationBlueprintProps) {
  // Failure branch lives at the OUTER level so it short-circuits the
  // body (and its visual-cursor child) cleanly.
  if (props.phase === 'failed') {
    return (
      <BlueprintShell>
        <FailedPanel
          errorMessage={props.errorMessage}
          onRetry={props.onRetry}
        />
      </BlueprintShell>
    );
  }
  // Visual-cursor state lives in a child component keyed by `attemptId` so
  // a parent-driven retry is a clean remount (no setState-in-effect reset
  // is needed — the unmount/mount cycle IS the reset). Same pattern the
  // ChatGenerationBubble used with `key={status}` for its RunningProgress
  // sub-component.
  return <BlueprintRunningBody key={props.attemptId ?? 0} {...props} />;
}

function BlueprintRunningBody({
  phase,
  industryDisplay = 'service businesses',
  serviceCount = 0,
  businessName,
  softError,
  onContinue,
  onViewEditor,
}: GenerationBlueprintProps) {
  // The visual cursor — which block has drawn in. Independent of `phase`;
  // the text-stage rendering CLAMPS to whichever is more conservative
  // (visual cursor vs the highest unlocked-at index).
  const [visualCursor, setVisualCursor] = useState(0);

  // Visual cadence — advance the cursor on a fixed interval until the
  // sequence completes. Slow tick by default, fast tick once `phase ===
  // 'ready'` so we catch up if the real generators finished first.
  useEffect(() => {
    if (visualCursor >= STAGES.length - 1) return;
    const tickMs = phase === 'ready' ? SPEEDUP_TICK_MS : BLOCK_ANIMATION_MS;
    const t = window.setTimeout(() => setVisualCursor((c) => c + 1), tickMs);
    return () => window.clearTimeout(t);
  }, [visualCursor, phase]);

  // The displayed stage is the MIN of:
  //   - visual cursor (the block sequence)
  //   - the highest stage index whose `unlockedAt` ≤ current real phase
  // This is the honesty clamp.
  const honestStageIndex = useMemo(() => {
    const phaseRank = PHASE_RANK[phase];
    let highestUnlocked = -1;
    for (let i = 0; i < STAGES.length; i += 1) {
      if (PHASE_RANK[STAGES[i].unlockedAt] <= phaseRank) {
        highestUnlocked = i;
      }
    }
    return Math.min(visualCursor, highestUnlocked);
  }, [phase, visualCursor]);

  // The READY visual + state mounts when BOTH the real phase is 'ready'
  // AND the visual cursor has reached the final block.
  const showReadyOverlay =
    phase === 'ready' && visualCursor >= STAGES.length - 1;

  return (
    <BlueprintShell>
      <div className="relative z-10 flex h-full w-full flex-col">
        {/* header — brand + step label. Slim so the sheets get the
            viewport real estate. */}
        <header className="flex items-center justify-center gap-3 px-4 pt-4 sm:pt-5">
          <BrandMark size="default" className="text-ink" />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] font-bold text-ink-quiet">
            {'// step 5 of 5 · building'}
          </span>
        </header>

        {/* body — three blueprint sheets on desktop (progress / site /
            funnel). On mobile they stack vertically with the progress
            sheet condensed to a single active-step strip up top.
            DESIGN DECISION (Option A from the integration brief): the
            progress checklist is rendered as a third blueprint sheet
            with the same chrome as the site + funnel sheets (rounded
            border-2 on ink/20, paper/40 surface, mono `// LABEL`
            corner eyebrow + mono filename-style hint, SVG glyphs in
            the same stroke-draw aesthetic), so the whole screen reads
            as one architect's drawing rather than a checklist sitting
            on top of a drawing. The previous v1 layout stacked a
            centred max-w-2xl ProgressMessages block ABOVE the
            wireframe sheets, which ate the top half of a 1080p
            viewport and pushed the wireframes (the "hero of the
            screen" per the user) below the fold; the sheet framing
            folds it into the layout instead of stacking above it. */}
        <div className="flex flex-1 flex-col gap-4 overflow-hidden px-4 pt-4 pb-6 sm:gap-5 sm:px-8 sm:pt-6 sm:pb-8">
          {/* Mobile-only: compact strip showing just the active step.
              Hides the full progress list (it lives in the sheet below
              on tablet+; on phone the list collapses entirely so the
              wireframes stay above the fold). */}
          <div className="sm:hidden">
            <ProgressStripMobile
              stages={STAGES}
              stageIndex={honestStageIndex}
              industryDisplay={industryDisplay}
              serviceCount={serviceCount}
            />
          </div>

          {/* Three-sheet grid. The progress sheet is fixed 260px on sm+
              so the site (the hero of the screen) gets the most width,
              with funnel sitting beside it. Below sm everything stacks. */}
          <div className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 gap-4 overflow-hidden sm:grid-cols-[260px_minmax(0,1.6fr)_minmax(0,1fr)] sm:gap-5">
            {/* The progress sheet is desktop-only. On mobile the strip
                above already covers the surface; rendering the full
                sheet below the wireframes would re-introduce the
                "list dominates the screen" problem on a 375px viewport. */}
            <div className="hidden sm:block">
              <ProgressSheet
                stages={STAGES}
                stageIndex={honestStageIndex}
                industryDisplay={industryDisplay}
                serviceCount={serviceCount}
              />
            </div>
            <BlueprintSheet
              label="// SITE"
              kind="site"
              activeBlocks={visualCursor}
            />
            <BlueprintSheet
              label="// FUNNEL"
              kind="funnel"
              activeBlocks={visualCursor}
            />
          </div>
        </div>

        {showReadyOverlay ? (
          <ReadyOverlay
            businessName={businessName}
            softError={softError}
            onContinue={onContinue}
            onViewEditor={onViewEditor}
          />
        ) : null}
      </div>
    </BlueprintShell>
  );
}

// ---------------------------------------------------------------------------
// blueprint shell — fullscreen + grid background

function BlueprintShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-paper"
      role="dialog"
      aria-modal="true"
      aria-label="Building your site"
    >
      {/* Blueprint grid backdrop. Pure CSS — no SVG asset. Two layered
          backgrounds: faint 40px grid + subtle 10px sub-grid. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(10 10 10 / 1) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(10 10 10 / 1) 1px, transparent 1px),
            linear-gradient(to right, rgb(10 10 10 / 1) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(10 10 10 / 1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px, 40px 40px, 10px 10px, 10px 10px',
          backgroundPosition: '0 0, 0 0, 0 0, 0 0',
        }}
      />
      {/* Sub-grid (lighter) — separate so the opacity stacks correctly. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(10 10 10 / 1) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(10 10 10 / 1) 1px, transparent 1px)
          `,
          backgroundSize: '10px 10px, 10px 10px',
        }}
      />
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// progress sheet — Option A: the checklist rendered as a third blueprint
// sheet sitting beside the site + funnel sheets. Same chrome: rounded
// border-2 on ink/20, paper/40 surface, mono `// PROGRESS` corner label,
// mono filename hint. Each step row is `[ stroke-drawn status glyph ]
// [ mono eyebrow ] [ descriptive line ]`. Done glyphs are SVG checkmarks
// that draw in via the same stroke-dashoffset @keyframes draw animation
// the wireframe blocks use — so the checklist feels sketched onto the
// same blueprint sheet, not pasted on top.

function ProgressSheet({
  stages,
  stageIndex,
  industryDisplay,
  serviceCount,
}: {
  stages: readonly Stage[];
  stageIndex: number;
  industryDisplay: string;
  serviceCount: number;
}) {
  const fmtCtx = { industryDisplay, serviceCount };
  const totalSteps = stages.length;
  // Progress as a fraction so the corner indicator reads concrete
  // (e.g. "4/9") — keeps the sheet feeling like a real artefact with a
  // status field, mirroring how the site/funnel sheet labels carry a
  // file-name hint in their header.
  const shownIndex = Math.min(
    Math.max(0, stageIndex) + 1,
    totalSteps,
  );

  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border-2 border-ink/20 bg-paper/40 px-4 py-4 sm:px-5 sm:py-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] font-bold text-ink-quiet">
          {'// PROGRESS'}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-quiet/60">
          {shownIndex.toString().padStart(2, '0')}/
          {totalSteps.toString().padStart(2, '0')}
        </span>
      </div>
      <ol
        aria-live="polite"
        aria-busy={stageIndex < totalSteps - 1}
        className="flex flex-1 flex-col gap-2.5 overflow-y-auto"
      >
        {stages.map((stage, i) => {
          const state: 'done' | 'active' | 'pending' =
            i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'pending';
          return (
            <li key={stage.id} className="flex items-start gap-2.5">
              <StatusGlyph state={state} />
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'font-mono text-[9px] uppercase tracking-[0.14em] font-bold leading-tight',
                    state === 'done' && 'text-ink-quiet',
                    state === 'active' && 'text-rust',
                    state === 'pending' && 'text-ink-quiet/50',
                  )}
                >
                  {stage.eyebrow.replace('// ', '')}
                </div>
                {state === 'active' ? (
                  // Only the active row carries the descriptive line —
                  // keeps the sheet from getting wordy when 6 steps are
                  // marked done. Done rows compress to just the eyebrow
                  // (struck through), pending rows are eyebrow-only too.
                  <div className="mt-1 text-[12px] leading-[1.4] text-ink animate-in fade-in duration-300">
                    {stage.line(fmtCtx)}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** SVG status glyph for the progress sheet. Drawn in the same stroke
 *  aesthetic as the wireframe blocks: pending = dashed empty square,
 *  active = a small pulsing rust dot, done = an ink checkmark that
 *  draws in via the shared @keyframes draw on first reveal. */
function StatusGlyph({ state }: { state: 'done' | 'active' | 'pending' }) {
  return (
    <span
      aria-hidden
      className="relative mt-[2px] inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center"
    >
      <svg viewBox="0 0 14 14" className="h-full w-full" aria-hidden>
        {/* Outline square — drawn for every state so the glyph always
            occupies the same footprint. Pending = dashed thin, active
            = solid rust ring, done = solid ink ring. */}
        <rect
          x="1.5"
          y="1.5"
          width="11"
          height="11"
          rx="1.5"
          fill="none"
          strokeWidth={state === 'pending' ? '1' : '1.4'}
          strokeDasharray={state === 'pending' ? '2 2' : undefined}
          className={cn(
            state === 'done' && 'stroke-ink/70',
            state === 'active' && 'stroke-rust',
            state === 'pending' && 'stroke-ink/30',
          )}
        />
        {state === 'done' ? (
          // Checkmark — draws in on mount via the shared @keyframes
          // draw animation. Path length is ~10 units, the dasharray
          // 24 is comfortably longer than that so the animation runs
          // cleanly to offset 0.
          <path
            d="M3.8 7.2 L6 9.4 L10.4 4.6"
            fill="none"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-ink [stroke-dasharray:24] [stroke-dashoffset:24] animate-[draw_0.45s_ease-out_forwards]"
          />
        ) : null}
        {state === 'active' ? (
          // Pulsing rust dot — keeps the glyph honest about where the
          // build currently is. Reuses tailwind's animate-pulse rather
          // than a bespoke keyframe.
          <circle
            cx="7"
            cy="7"
            r="2"
            className="animate-pulse fill-rust"
          />
        ) : null}
      </svg>
    </span>
  );
}

/** Mobile-only compact strip: single-line summary of the active step
 *  with a thin paper-2 progress bar underneath. Renders above the
 *  stacked site + funnel sheets so the wireframes themselves still get
 *  the bulk of the viewport. The full step list is intentionally NOT
 *  exposed on mobile — the wireframes are the hero of the screen and a
 *  9-step list collapsed inside a sheet would re-introduce the
 *  "checklist dominates the screen" problem on a 375px viewport. */
function ProgressStripMobile({
  stages,
  stageIndex,
  industryDisplay,
  serviceCount,
}: {
  stages: readonly Stage[];
  stageIndex: number;
  industryDisplay: string;
  serviceCount: number;
}) {
  const fmtCtx = { industryDisplay, serviceCount };
  const active = stages[Math.min(Math.max(0, stageIndex), stages.length - 1)];
  const completedFraction =
    Math.max(0, Math.min(stageIndex, stages.length - 1)) /
    Math.max(1, stages.length - 1);

  return (
    <div className="rounded-lg border-2 border-ink/20 bg-paper/40 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <StatusGlyph state="active" />
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] font-bold text-rust">
          {active.eyebrow.replace('// ', '')}
        </span>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-ink-quiet/60">
          {(Math.min(stageIndex + 1, stages.length))
            .toString()
            .padStart(2, '0')}
          /{stages.length.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="mt-1.5 text-[12px] leading-[1.4] text-ink">
        {active.line(fmtCtx)}
      </div>
      {/* Thin progress bar — the only progress indicator the mobile
          surface gets beyond the active-step copy. paper-2 track, rust
          fill. */}
      <div
        aria-hidden
        className="mt-2 h-1 overflow-hidden rounded-full bg-paper-2"
      >
        <div
          className="h-full bg-rust transition-all duration-500 ease-out"
          style={{ width: `${completedFraction * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// blueprint sheets — SVG wireframes drawing in

type SheetKind = 'site' | 'funnel';

/** The blocks per sheet — order = draw order. Each block has an SVG
 *  drawing fn + an aspect-ratio hint so the sheet's height stays
 *  predictable. The site sheet has more blocks (a full home page) than
 *  the funnel sheet (3-step landing). */
const SITE_BLOCKS: readonly BlockSpec[] = [
  { kind: 'hero', label: 'HERO' },
  { kind: 'offer', label: 'OFFER' },
  { kind: 'services', label: 'SERVICES' },
  { kind: 'reviews', label: 'REVIEWS' },
  { kind: 'cta', label: 'CTA' },
  { kind: 'footer', label: 'FOOTER' },
];
const FUNNEL_BLOCKS: readonly BlockSpec[] = [
  { kind: 'funnel-hero', label: 'LANDING' },
  { kind: 'funnel-form', label: 'FORM' },
  { kind: 'funnel-thanks', label: 'THANKS' },
];

type BlockSpec = {
  kind: 'hero' | 'offer' | 'services' | 'reviews' | 'cta' | 'footer' | 'funnel-hero' | 'funnel-form' | 'funnel-thanks';
  label: string;
};

function BlueprintSheet({
  label,
  kind,
  activeBlocks,
}: {
  label: string;
  kind: SheetKind;
  activeBlocks: number;
}) {
  const blocks = kind === 'site' ? SITE_BLOCKS : FUNNEL_BLOCKS;
  // Site stages: visualCursor 0..5 reveals blocks; funnel stages: 6..8.
  // We dispatch on overall cursor index across the 9 stages.
  //   site:    revealed when cursor ≥ blockIdx (0..5)
  //   funnel:  revealed when cursor ≥ 6 + blockIdx (6..8) — the funnel
  //            block list starts revealing only once visualCursor crosses
  //            6 ("DRAWING YOUR FUNNEL").
  const offsetFor = (blockIdx: number) =>
    kind === 'site' ? blockIdx : 6 + blockIdx;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border-2 border-ink/20 bg-paper/40 px-4 py-4 sm:px-5 sm:py-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] font-bold text-ink-quiet">
          {label}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-quiet/60">
          {kind === 'site' ? 'home.html' : 'funnel/step-1.html'}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5">
        {blocks.map((block, i) => {
          const revealed = activeBlocks >= offsetFor(i);
          const drawing = activeBlocks === offsetFor(i);
          return (
            <WireframeBlock
              key={block.kind}
              spec={block}
              state={revealed ? (drawing ? 'drawing' : 'done') : 'pending'}
            />
          );
        })}
      </div>
    </div>
  );
}

function WireframeBlock({
  spec,
  state,
}: {
  spec: BlockSpec;
  state: 'pending' | 'drawing' | 'done';
}) {
  // Pending → dashed placeholder. Drawing → SVG stroke-dasharray animation.
  // Done → solid SVG (animation completed).
  if (state === 'pending') {
    return (
      <div
        className="flex h-14 items-center justify-center rounded-sm border border-dashed border-ink/20 sm:h-16"
        aria-hidden
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-quiet/40">
          {spec.label}
        </span>
      </div>
    );
  }

  // SVG block — fixed aspect via viewBox; height set by container.
  // `animate-blueprint-draw` is defined inline below using arbitrary CSS
  // values via Tailwind's `[stroke-dashoffset:N]` shape; we set it via
  // a real <style> tag at module scope to avoid bringing in a new dep.

  return (
    <div
      className={cn(
        'relative h-14 sm:h-16',
        state === 'drawing' && 'animate-pulse',
      )}
      aria-hidden
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 200 50"
        preserveAspectRatio="none"
      >
        <BlockGlyph spec={spec} animate={state === 'drawing'} />
      </svg>
    </div>
  );
}

/** Per-kind SVG glyph. Each one is a minimal silhouette that reads as the
 *  section type. All stroke-based so the draw-in animation works. */
function BlockGlyph({ spec, animate }: { spec: BlockSpec; animate: boolean }) {
  // Class for the stroke-draw animation — when `animate=true` we apply
  // dasharray + offset; otherwise the path renders solid.
  const strokeClass = cn(
    'stroke-ink',
    animate ? '[stroke-dasharray:300] [stroke-dashoffset:300] animate-[draw_5s_ease-out_forwards]' : '',
  );
  const fillSoft = 'rgb(210 67 23 / 0.06)'; // rust at very low opacity
  switch (spec.kind) {
    case 'hero':
      return (
        <g strokeWidth="1.5" fill="none" className={strokeClass}>
          <rect x="2" y="2" width="196" height="46" rx="2" />
          {/* image hint — diagonal lines */}
          <line x1="120" y1="6" x2="190" y2="44" strokeWidth="0.8" />
          <line x1="140" y1="6" x2="190" y2="34" strokeWidth="0.8" />
          {/* headline + sub bars */}
          <rect x="10" y="14" width="80" height="6" fill={fillSoft} stroke="none" />
          <rect x="10" y="26" width="60" height="3" />
          <rect x="10" y="32" width="40" height="3" />
          {/* CTA pill */}
          <rect x="10" y="38" width="36" height="7" rx="3.5" fill="rgb(210 67 23 / 0.5)" stroke="none" />
        </g>
      );
    case 'offer':
      return (
        <g strokeWidth="1.5" fill="none" className={strokeClass}>
          <rect x="40" y="2" width="120" height="46" rx="3" fill={fillSoft} />
          <rect x="50" y="10" width="60" height="4" />
          <rect x="50" y="18" width="100" height="3" />
          <rect x="50" y="24" width="80" height="3" />
          <rect x="50" y="36" width="34" height="6" rx="3" fill="rgb(210 67 23 / 0.5)" stroke="none" />
        </g>
      );
    case 'services':
      return (
        <g strokeWidth="1.5" fill="none" className={strokeClass}>
          <rect x="2" y="2" width="60" height="46" rx="2" />
          <rect x="70" y="2" width="60" height="46" rx="2" />
          <rect x="138" y="2" width="60" height="46" rx="2" />
          {[2, 70, 138].map((x) => (
            <g key={x}>
              <circle cx={x + 30} cy={12} r="4" />
              <rect x={x + 6} y={22} width="48" height="3" />
              <rect x={x + 6} y={28} width="40" height="3" />
              <rect x={x + 6} y={34} width="36" height="3" />
            </g>
          ))}
        </g>
      );
    case 'reviews':
      return (
        <g strokeWidth="1.5" fill="none" className={strokeClass}>
          {[2, 70, 138].map((x) => (
            <g key={x}>
              <rect x={x} y="2" width="60" height="46" rx="2" />
              {/* stars row */}
              <text x={x + 6} y={14} fontSize="6" fill="rgb(210 67 23 / 0.6)" stroke="none">★ ★ ★ ★ ★</text>
              <rect x={x + 6} y={20} width="46" height="3" />
              <rect x={x + 6} y={26} width="40" height="3" />
              <rect x={x + 6} y={36} width="20" height="3" />
            </g>
          ))}
        </g>
      );
    case 'cta':
      return (
        <g strokeWidth="1.5" fill="none" className={strokeClass}>
          <rect x="2" y="2" width="196" height="46" rx="2" fill="rgb(10 10 10 / 0.85)" stroke="none" />
          <rect x="40" y="14" width="120" height="5" fill="rgb(245 241 234 / 0.6)" stroke="none" />
          <rect x="70" y="22" width="60" height="3" fill="rgb(245 241 234 / 0.3)" stroke="none" />
          <rect x="78" y="32" width="44" height="8" rx="4" fill="rgb(210 67 23)" stroke="none" />
        </g>
      );
    case 'footer':
      return (
        <g strokeWidth="1.5" fill="none" className={strokeClass}>
          <rect x="2" y="2" width="196" height="46" rx="2" />
          <rect x="10" y="10" width="40" height="3" />
          <rect x="10" y="16" width="30" height="3" />
          <rect x="60" y="10" width="40" height="3" />
          <rect x="60" y="16" width="32" height="3" />
          <rect x="110" y="10" width="40" height="3" />
          <rect x="110" y="16" width="30" height="3" />
          <line x1="10" y1="36" x2="190" y2="36" />
          <rect x="10" y="40" width="80" height="3" />
        </g>
      );
    case 'funnel-hero':
      return (
        <g strokeWidth="1.5" fill="none" className={strokeClass}>
          <rect x="2" y="2" width="196" height="46" rx="2" fill={fillSoft} />
          <rect x="50" y="10" width="100" height="6" />
          <rect x="60" y="20" width="80" height="3" />
          <rect x="70" y="26" width="60" height="3" />
          <rect x="70" y="36" width="60" height="7" rx="3.5" fill="rgb(210 67 23 / 0.5)" stroke="none" />
        </g>
      );
    case 'funnel-form':
      return (
        <g strokeWidth="1.5" fill="none" className={strokeClass}>
          <rect x="20" y="2" width="160" height="46" rx="2" />
          <rect x="30" y="10" width="140" height="6" rx="1" />
          <rect x="30" y="20" width="140" height="6" rx="1" />
          <rect x="30" y="30" width="140" height="6" rx="1" />
          <rect x="62" y="40" width="76" height="6" rx="3" fill="rgb(210 67 23 / 0.6)" stroke="none" />
        </g>
      );
    case 'funnel-thanks':
      return (
        <g strokeWidth="1.5" fill="none" className={strokeClass}>
          <rect x="2" y="2" width="196" height="46" rx="2" fill={fillSoft} />
          <circle cx="100" cy="18" r="6" fill="rgb(30 107 58 / 0.5)" stroke="rgb(30 107 58)" />
          <path d="M96 18 l3 3 l5 -5" strokeWidth="1.5" stroke="rgb(30 107 58)" />
          <rect x="60" y="30" width="80" height="4" />
          <rect x="70" y="38" width="60" height="3" />
        </g>
      );
  }
}

// ---------------------------------------------------------------------------
// ready overlay — final stamp + Continue

function ReadyOverlay({
  businessName,
  softError,
  onContinue,
  onViewEditor,
}: {
  businessName?: string;
  softError?: string;
  onContinue?: () => void;
  onViewEditor?: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-paper/95 px-4 py-6 animate-in fade-in duration-500"
      role="status"
    >
      <div className="flex flex-col items-center text-center">
        {/* Stamp visual — rotated rust square with "READY" inside */}
        <div className="relative mb-7 inline-flex items-center justify-center">
          <div
            aria-hidden
            className="absolute inset-0 -m-2 rounded-full bg-rust/10 blur-2xl"
          />
          <div
            className="rotate-[-6deg] rounded-md border-[3px] border-rust px-6 py-3 animate-in zoom-in-50 duration-500"
          >
            <span className="font-mono text-[18px] font-bold uppercase tracking-[0.16em] text-rust sm:text-[22px]">
              ✓ Ready
            </span>
          </div>
        </div>

        <div className="font-mono text-[10px] uppercase tracking-[0.14em] font-bold text-ink-quiet">
          {'// site + funnel built'}
        </div>
        <h2 className="mt-3 max-w-md text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">
          {businessName ? (
            <>
              <em className="font-extrabold not-italic text-rust">{businessName}</em>{' '}
              is ready to go.
            </>
          ) : (
            <>Your site is ready.</>
          )}
        </h2>
        <p className="mt-3 max-w-md text-[14px] leading-[1.55] text-ink-mid">
          Open the editor to see what we built — every page, your funnel, the
          colours and copy. You can preview and tweak anything before going live.
        </p>

        {softError ? (
          <p className="mt-4 max-w-md rounded border border-warn/30 bg-warn/[0.06] px-3 py-2 font-mono text-[11px] text-warn">
            Note: {softError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onViewEditor}
          className="mt-7 inline-flex h-12 min-h-[44px] items-center justify-center rounded-md bg-rust px-7 text-[14px] font-bold text-paper hover:bg-rust-deep"
        >
          View in editor →
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="mt-3 inline-flex min-h-[28px] items-center justify-center px-2 text-[12px] text-ink-quiet underline-offset-2 hover:text-ink hover:underline"
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// failed panel

function FailedPanel({
  errorMessage,
  onRetry,
}: {
  errorMessage?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-4 py-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <div
          aria-hidden
          className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-warn/15 text-[24px] font-bold text-warn"
        >
          !
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] font-bold text-warn">
          {'// build interrupted'}
        </div>
        <h2 className="mt-3 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[26px]">
          Something stopped the build.
        </h2>
        <p className="mt-3 text-[14px] leading-[1.55] text-ink-mid">
          {errorMessage ?? 'We could not finish building your site. This is almost always a transient hiccup — try again and it should go through.'}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex h-12 min-h-[44px] items-center justify-center rounded-md bg-rust px-7 text-[14px] font-bold text-paper hover:bg-rust-deep"
          >
            ↻ Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
