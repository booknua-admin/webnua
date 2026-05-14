import { cn } from '@/lib/utils';

type AutomationStepConnectorProps = {
  className?: string;
};

function AutomationStepConnector({ className }: AutomationStepConnectorProps) {
  return (
    <div
      aria-hidden
      data-slot="automation-step-connector"
      className={cn('mx-auto my-1 h-5 w-0.5 bg-rule', className)}
    />
  );
}

export { AutomationStepConnector };
export type { AutomationStepConnectorProps };
