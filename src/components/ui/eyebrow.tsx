import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const eyebrowVariants = cva(
  "inline-flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.14em] uppercase before:hidden data-[bullet=true]:before:block data-[bullet=true]:before:size-1.5 data-[bullet=true]:before:rounded-full",
  {
    variants: {
      tone: {
        rust: 'text-rust data-[bullet=true]:before:bg-rust',
        ink: 'text-ink data-[bullet=true]:before:bg-ink',
        quiet: 'text-ink-quiet data-[bullet=true]:before:bg-ink-quiet',
      },
    },
    defaultVariants: {
      tone: 'rust',
    },
  },
);

type EyebrowProps = React.ComponentProps<'span'> &
  VariantProps<typeof eyebrowVariants> & {
    bullet?: boolean;
  };

function Eyebrow({
  className,
  tone = 'rust',
  bullet = false,
  ...props
}: EyebrowProps) {
  return (
    <span
      data-slot="eyebrow"
      data-tone={tone}
      data-bullet={bullet}
      className={cn(eyebrowVariants({ tone }), className)}
      {...props}
    />
  );
}

export { Eyebrow, eyebrowVariants };
