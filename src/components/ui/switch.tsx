'use client';

import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  label?: React.ReactNode;
};

function Switch({ className, label, id, ...props }: SwitchProps) {
  const generatedId = React.useId();
  const switchId = id ?? generatedId;

  const root = (
    <SwitchPrimitive.Root
      data-slot="switch"
      id={switchId}
      className={cn(
        'peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-rule transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-good',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none absolute top-[3px] left-[3px] block size-[18px] rounded-full bg-card shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200 data-[state=checked]:translate-x-5"
      />
    </SwitchPrimitive.Root>
  );

  if (label === undefined) return root;

  return (
    <span data-slot="switch-row" className="inline-flex items-center gap-2">
      {root}
      <label
        data-slot="switch-label"
        htmlFor={switchId}
        className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-quiet uppercase select-none peer-data-[state=checked]:text-good"
      >
        {label}
      </label>
    </span>
  );
}

export { Switch };
