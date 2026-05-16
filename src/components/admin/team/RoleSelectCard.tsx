'use client';

import { cn } from '@/lib/utils';

type RoleSelectCardProps = {
  /** Single-glyph icon for the icon tile. */
  icon: string;
  name: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
};

function RoleSelectCard({
  icon,
  name,
  description,
  selected,
  onSelect,
}: RoleSelectCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-slot="role-select-card"
      data-selected={selected}
      aria-pressed={selected}
      className={cn(
        'block cursor-pointer rounded-[10px] border px-[18px] py-4 text-left transition-colors hover:border-rust',
        selected ? 'border-rust bg-rust-soft/60' : 'border-rule bg-paper',
      )}
    >
      <div
        data-slot="role-select-card-icon"
        className={cn(
          'mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg font-sans text-[13px] font-extrabold',
          selected ? 'bg-rust text-paper' : 'bg-ink text-rust-light',
        )}
      >
        {icon}
      </div>
      <div className="mb-1 font-sans text-[14px] font-bold text-ink">
        {name}
      </div>
      <div className="font-sans text-[12px] leading-[1.4] text-ink-quiet">
        {description}
      </div>
    </button>
  );
}

export { RoleSelectCard };
export type { RoleSelectCardProps };
