import * as React from 'react';

import { cn } from '@/lib/utils';

const sizeMap = {
  sm: {
    wordmark: 'text-lg gap-2',
    diamond: 'size-2.5',
  },
  default: {
    wordmark: 'text-2xl gap-2.5',
    diamond: 'size-3',
  },
  lg: {
    wordmark: 'text-3xl gap-3',
    diamond: 'size-3.5',
  },
} as const;

type BrandMarkProps = React.ComponentProps<'div'> & {
  size?: keyof typeof sizeMap;
};

function BrandMark({
  className,
  size = 'default',
  ...props
}: BrandMarkProps) {
  const s = sizeMap[size];
  return (
    <div
      data-slot="brand-mark"
      className={cn(
        'flex items-center font-extrabold tracking-[-0.03em]',
        s.wordmark,
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn('rotate-45 bg-rust', s.diamond)}
        style={{ borderRadius: 2 }}
      />
      Webnua
    </div>
  );
}

export { BrandMark };
