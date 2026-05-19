// =============================================================================
// signup/types — shared shapes for the cold-traffic signup flow.
// =============================================================================

import type { TradeId } from './guarantee';

export type { GuaranteeEstimate } from './guarantee';

/** The business brief, captured progressively across the flow. */
export type SignupBrief = {
  trade: TradeId | '';
  serviceArea: string;
  businessName: string;
  mainService: string;
  /** 1–3 brand hex colours; index 0 is the accent. */
  brandColors: string[];
};

/** The prospect's contact details — the lead itself. */
export type ContactDetails = {
  name: string;
  email: string;
  phone: string;
};

/** The linear step machine. */
export type SignupStep =
  | 'hook'
  | 'splash1'
  | 'guarantee'
  | 'brief'
  | 'splash2'
  | 'gate'
  | 'reveal'
  | 'offer'
  | 'done';

export const EMPTY_BRIEF: SignupBrief = {
  trade: '',
  serviceArea: '',
  businessName: '',
  mainService: '',
  brandColors: ['#d24317'],
};
