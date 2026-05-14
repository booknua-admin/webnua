import { cn } from '@/lib/utils';
import type { TicketCategory } from '@/lib/tickets/types';

const CATEGORY_GLYPH: Record<TicketCategory, string> = {
  website: '▦',
  marketing: '↗',
  campaigns: '⌖',
  reviews: '★',
  billing: '$',
  other: '·',
};

const CATEGORY_BG: Record<TicketCategory, string> = {
  website: 'bg-rust',
  marketing: 'bg-info',
  campaigns: 'bg-[#6b4ea6]',
  reviews: 'bg-[#c8941e]',
  billing: 'bg-good',
  other: 'bg-[#5a5a5a]',
};

type CategoryTileProps = {
  category: TicketCategory;
  size?: 'sm' | 'md';
  className?: string;
};

function CategoryTile({ category, size = 'md', className }: CategoryTileProps) {
  const dim = size === 'sm' ? 'size-8 text-[14px] rounded-[8px]' : 'size-[38px] text-base rounded-[10px]';
  return (
    <div
      data-slot="category-tile"
      data-category={category}
      className={cn(
        'flex items-center justify-center font-mono font-semibold text-paper shrink-0',
        dim,
        CATEGORY_BG[category],
        className,
      )}
    >
      {CATEGORY_GLYPH[category]}
    </div>
  );
}

export { CategoryTile };
export type { CategoryTileProps };
