// =============================================================================
// QuestionCard — single Q&A step inside the form-to-page generation flow at
// /website/new. One question per card, advance with `BuilderFooterActions`.
//
// Composes existing builder primitives so the visual frame matches the
// onboarding wizard. Body slot accepts any input — chip rows, textareas,
// or a chip-or-free-text dual mode (used for Q2 "Other").
// =============================================================================

import { BuilderStepHeader } from '@/components/shared/builder/BuilderStepHeader';
import { BuilderFooterActions } from '@/components/shared/builder/BuilderFooterActions';
import { Button } from '@/components/ui/button';

type QuestionCardProps = {
  /** "// QUESTION N OF 5" */
  eyebrow: string;
  /** Question text. Pass `<>...<em>verb</em>...</>` for rust highlight. */
  title: React.ReactNode;
  /** Helper sentence under the title. */
  helper?: React.ReactNode;
  /** The input — chip selector or textarea. */
  children: React.ReactNode;
  /** "Step N of 5" mono progress on the footer-left. */
  progressLabel: React.ReactNode;
  /** Required → disabled Continue when empty.
   *  Optional → "Skip →" + "Continue →" both enabled. */
  isAnswered: boolean;
  required: boolean;
  onBack?: () => void;
  onContinue: () => void;
  /** Continue label override — the review step says "✦ Generate page →". */
  continueLabel?: string;
};

function QuestionCard({
  eyebrow,
  title,
  helper,
  children,
  progressLabel,
  isAnswered,
  required,
  onBack,
  onContinue,
  continueLabel,
}: QuestionCardProps) {
  const showSkip = !required && !isAnswered;
  const continueDisabled = required && !isAnswered;
  return (
    <div className="mx-auto max-w-[640px] py-12">
      <BuilderStepHeader eyebrow={eyebrow} title={title} subtitle={helper} />
      <div className="mb-3">{children}</div>
      <BuilderFooterActions
        progress={progressLabel}
        actions={
          <>
            {onBack ? (
              <Button variant="ghost" onClick={onBack}>
                ← Back
              </Button>
            ) : null}
            {showSkip ? (
              <Button variant="secondary" onClick={onContinue}>
                Skip →
              </Button>
            ) : null}
            <Button onClick={onContinue} disabled={continueDisabled}>
              {continueLabel ?? 'Continue →'}
            </Button>
          </>
        }
      />
    </div>
  );
}

export { QuestionCard };
