'use client';

// =============================================================================
// FormFieldTypePicker — a grid of the form field types. Used by "+ Add field"
// (to create a field) and by the per-field inspector (to re-type a field).
// =============================================================================

import type { FormFieldType } from '@/lib/website/form-config';
import { cn } from '@/lib/utils';

export const FORM_FIELD_TYPE_LABEL: Record<FormFieldType, string> = {
  text: 'Text',
  email: 'Email',
  phone: 'Phone',
  textarea: 'Long text',
  select: 'Dropdown',
  checkbox: 'Checkbox',
  image: 'Image upload',
};

const ORDER: readonly FormFieldType[] = [
  'text',
  'email',
  'phone',
  'textarea',
  'select',
  'checkbox',
  'image',
];

export function FormFieldTypePicker({
  value,
  onPick,
  disabled = false,
}: {
  value?: FormFieldType;
  onPick: (type: FormFieldType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ORDER.map((type) => (
        <button
          key={type}
          type="button"
          disabled={disabled}
          onClick={() => onPick(type)}
          className={cn(
            'rounded-md border px-3 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55',
            value === type
              ? 'border-rust bg-rust-soft text-rust'
              : 'border-rule bg-card text-ink-mid hover:border-rust/60',
          )}
        >
          {FORM_FIELD_TYPE_LABEL[type]}
        </button>
      ))}
    </div>
  );
}
