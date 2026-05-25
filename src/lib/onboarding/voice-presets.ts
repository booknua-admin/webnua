// =============================================================================
// onboarding/voice-presets — the three wizard voice-tone presets and their
// mapping onto the brand row's voice axes (formality / urgency / technicality).
//
// SHARED between the wizard's Step 4 (writes the axes to the brand row when
// the customer hits Continue) and lib/onboarding/derive-brief.ts (reads the
// step 4 tone preset to compose the ClientBrief the generators consume).
//
// The three presets are locked (CLAUDE.md "Pattern B onboarding wizard"):
//   friendly      → {2, 2, 2}  warm + welcoming; the default for most trades
//   professional  → {4, 2, 3}  crisp + measured; commercial work
//   casual        → {1, 3, 2}  relaxed + plainspoken; no-nonsense
//
// Pure module — no I/O, no React. Safe to import from both the wizard step
// (browser) and the deriver (any surface).
// =============================================================================

import type { VoiceToneAxis } from '@/lib/website/types';

export type WizardTonePreset = 'friendly' | 'professional' | 'casual';

export type VoiceAxes = {
  formality: VoiceToneAxis;
  urgency: VoiceToneAxis;
  technicality: VoiceToneAxis;
};

/** Map the wizard's three-preset tone choice onto the brand row's voice
 *  axes. VoiceToneAxis is the literal union 1|2|3|4|5; inline literals would
 *  widen to `number` through the switch return, so each value is annotated. */
export function toneToVoice(tone: WizardTonePreset): VoiceAxes {
  switch (tone) {
    case 'friendly':
      return {
        formality: 2 as VoiceToneAxis,
        urgency: 2 as VoiceToneAxis,
        technicality: 2 as VoiceToneAxis,
      };
    case 'professional':
      return {
        formality: 4 as VoiceToneAxis,
        urgency: 2 as VoiceToneAxis,
        technicality: 3 as VoiceToneAxis,
      };
    case 'casual':
      return {
        formality: 1 as VoiceToneAxis,
        urgency: 3 as VoiceToneAxis,
        technicality: 2 as VoiceToneAxis,
      };
  }
}

/** Neutral midpoint (3/3/3) — what signup seeds when no tone has been
 *  picked yet. Used by the deriver when step 4 was skipped entirely. */
export const NEUTRAL_VOICE: VoiceAxes = {
  formality: 3 as VoiceToneAxis,
  urgency: 3 as VoiceToneAxis,
  technicality: 3 as VoiceToneAxis,
};
