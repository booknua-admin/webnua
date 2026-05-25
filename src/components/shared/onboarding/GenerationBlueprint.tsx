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
  /** Continue callback fired from the 'ready' state. */
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
  industryDisplay = 'tradies',
  serviceCount = 0,
  businessName,
  softError,
  onContinue,
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
        {/* header — brand + step label */}
        <header className="flex items-center justify-center gap-3 px-4 pt-5 sm:pt-7">
          <BrandMark size="default" className="text-ink" />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] font-bold text-ink-quiet">
            {'// step 5 of 5 · building'}
          </span>
        </header>

        {/* body — drawings + progress text. Responsive: drawings stack
            below the progress on small screens, side-by-side above sm. */}
        <div className="flex flex-1 flex-col gap-6 px-4 pt-6 pb-8 sm:px-10 sm:pt-10 sm:pb-12">
          {/* Progress block — kept on top so on mobile it's seen first. */}
          <div className="mx-auto w-full max-w-2xl">
            <ProgressMessages
              stages={STAGES}
              stageIndex={honestStageIndex}
              industryDisplay={industryDisplay}
              serviceCount={serviceCount}
            />
          </div>

          {/* Sheets — site + funnel side-by-side on sm+, stacked below */}
          <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 gap-5 sm:grid-cols-[1.5fr_1fr]">
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
// progress messages — list of stages with done/active/pending styles

function ProgressMessages({
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

  // Show only the stages up to the active stage + ONE upcoming, so the
  // list doesn't dominate the viewport on small screens. The animation
  // fades each one in as it activates.
  const visibleEnd = Math.min(stages.length - 1, Math.max(0, stageIndex) + 1);
  const visibleStages = stages.slice(0, visibleEnd + 1);

  return (
    <ol
      aria-live="polite"
      aria-busy={stageIndex < stages.length - 1}
      className="flex flex-col gap-3"
    >
      {visibleStages.map((stage, i) => {
        const state: 'done' | 'active' | 'pending' =
          i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'pending';
        return (
          <li
            key={stage.id}
            className={cn(
              'animate-in fade-in slide-in-from-bottom-2 duration-300',
              'flex items-start gap-3',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                state === 'done' && 'bg-good text-paper',
                state === 'active' && 'animate-pulse bg-rust text-paper',
                state === 'pending' && 'border border-rule text-transparent',
              )}
            >
              {state === 'done' ? '✓' : state === 'active' ? '◆' : '·'}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  'font-mono text-[10px] uppercase tracking-[0.14em] font-bold',
                  state === 'done' && 'text-ink-quiet',
                  state === 'active' && 'text-rust',
                  state === 'pending' && 'text-ink-quiet/60',
                )}
              >
                {stage.eyebrow}
              </div>
              <div
                className={cn(
                  'mt-0.5 text-[14px] leading-[1.45]',
                  state === 'done' && 'text-ink-quiet line-through decoration-ink-quiet/30',
                  state === 'active' && 'font-semibold text-ink',
                  state === 'pending' && 'text-ink-quiet/60',
                )}
              >
                {stage.line(fmtCtx)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
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
}: {
  businessName?: string;
  softError?: string;
  onContinue?: () => void;
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
          Preview, edit, and publish from your dashboard. Every change you make
          lands in your preview immediately.
        </p>

        {softError ? (
          <p className="mt-4 max-w-md rounded border border-warn/30 bg-warn/[0.06] px-3 py-2 font-mono text-[11px] text-warn">
            Note: {softError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onContinue}
          className="mt-7 inline-flex h-12 min-h-[44px] items-center justify-center rounded-md bg-rust px-7 text-[14px] font-bold text-paper hover:bg-rust-deep"
        >
          Open my dashboard →
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
