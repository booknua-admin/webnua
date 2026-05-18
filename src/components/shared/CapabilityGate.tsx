'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CAP_EXPLAINER } from '@/lib/auth/explainers';
import type { Capability } from '@/lib/auth/capabilities';
import { useCan } from '@/lib/auth/user-stub';
import { buildRequestChangeHref } from '@/lib/tickets/request-change';
import { cn } from '@/lib/utils';

import { RequestChangeAffordance } from './RequestChangeAffordance';

// =============================================================================
// CapabilityGate — wraps any control with capability-aware presentation.
//
// Three modes (design doc §1.3):
//   - 'hide'    → render null when user lacks the cap
//   - 'disable' → render children inert + tooltip explainer
//   - 'request' → render children inert + hover affordance to open a
//                 request-change ticket. By default the affordance routes
//                 to the /tickets/new submit form, prefilled with the
//                 field context (design doc §1.3 / §3.3 Lane C). A caller
//                 may pass `onRequestChange` to override that behaviour.
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
  /** Field context carried into the request-change ticket in `request` mode. */
  requestContext?: RequestChangeContext;
  /**
   * Overrides the default request-change behaviour (route to /tickets/new).
   * Fired with the field context when the affordance is clicked.
   */
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
  const router = useRouter();

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

  const ctx = requestContext ?? {};
  const handleRequest = () => {
    if (onRequestChange) {
      onRequestChange(ctx);
      return;
    }
    router.push(buildRequestChangeHref({ capability, ...ctx }));
  };

  return (
    <RequestChangeAffordance
      label={explainer.requestLabel}
      onClick={handleRequest}
      className={className}
    >
      {children}
    </RequestChangeAffordance>
  );
}
