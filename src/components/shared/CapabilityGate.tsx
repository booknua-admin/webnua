'use client';

import { type ReactNode } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CAP_EXPLAINER } from '@/lib/auth/explainers';
import type { Capability } from '@/lib/auth/capabilities';
import { useCan } from '@/lib/auth/user-stub';
import { cn } from '@/lib/utils';

import { RequestChangeAffordance } from './RequestChangeAffordance';

// =============================================================================
// CapabilityGate — wraps any control with capability-aware presentation.
//
// Three modes (design doc §1.3):
//   - 'hide'    → render null when user lacks the cap
//   - 'disable' → render children inert + tooltip explainer
//   - 'request' → render children inert + hover affordance to open a
//                 request-change ticket (callback stubbed in 1a; real
//                 ticket creation wires up in a later session)
//
// `request` mode falls back to `hide` when the cap's explainer has no
// requestLabel (viewBuilder, approve). This is deliberate — those caps
// have no meaningful request-change message, so we don't render a
// labelless affordance.
// =============================================================================

export type RequestChangeContext = {
  pageId?: string;
  sectionId?: string;
  fieldKey?: string;
};

export type CapabilityGateProps = {
  capability: Capability;
  mode: 'hide' | 'disable' | 'request';
  children: ReactNode;
  /** Override the default CAP_EXPLAINER short text in `disable` mode. */
  disabledExplainer?: string;
  /** Forwarded to onRequestChange in `request` mode. */
  requestContext?: RequestChangeContext;
  /** Fired when the user clicks the request-change affordance. */
  onRequestChange?: (ctx: RequestChangeContext) => void;
  className?: string;
};

export function CapabilityGate({
  capability,
  mode,
  children,
  disabledExplainer,
  requestContext,
  onRequestChange,
  className,
}: CapabilityGateProps) {
  const has = useCan(capability);

  if (has) {
    return <>{children}</>;
  }

  const explainer = CAP_EXPLAINER[capability];

  if (mode === 'hide') {
    return null;
  }

  if (mode === 'disable') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-disabled
            data-slot="capability-gate-disabled"
            className={cn(
              'inline-flex cursor-not-allowed opacity-55 [&_*]:pointer-events-none',
              className,
            )}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent>{disabledExplainer ?? explainer.short}</TooltipContent>
      </Tooltip>
    );
  }

  // mode === 'request' — fall back to hide for caps without a request label.
  if (!explainer.requestLabel) {
    return null;
  }

  return (
    <RequestChangeAffordance
      label={explainer.requestLabel}
      onClick={() => onRequestChange?.(requestContext ?? {})}
      className={className}
    >
      {children}
    </RequestChangeAffordance>
  );
}
