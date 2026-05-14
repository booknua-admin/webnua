import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const statusDotVariants = cva('inline-block size-1.5 shrink-0 rounded-full', {
  variants: {
    tone: {
      good: 'bg-good',
      warn: 'bg-warn',
      info: 'bg-info',
      rust: 'bg-rust',
      quiet: 'bg-ink-quiet',
    },
  },
  defaultVariants: {
    tone: 'good',
  },
});

type StatusDotProps = React.ComponentProps<'span'> &
  VariantProps<typeof statusDotVariants>;

function StatusDot({ className, tone = 'good', ...props }: StatusDotProps) {
  return (
    <span
      data-slot="status-dot"
      data-tone={tone}
      role="status"
      className={cn(statusDotVariants({ tone }), className)}
      {...props}
    />
  );
}

export { StatusDot, statusDotVariants };
