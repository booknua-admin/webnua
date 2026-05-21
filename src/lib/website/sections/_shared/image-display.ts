// =============================================================================
// image-display — per-image display controls (fit / aspect / focal point).
//
// A small companion object stored next to an image URL — the same pattern as
// the per-section `theme` companion object. It lets a section's image fit its
// slot properly instead of cropping or stretching badly:
//
//   fit    — object-fit: 'cover' fills the slot (cropping overflow);
//            'contain' shows the whole image (may letterbox).
//   aspect — the slot's shape. 'auto' keeps the section's own slot ratio
//            (so existing pages render unchanged); a fixed ratio forces it;
//            'original' lets the image flow at its natural ratio (no crop).
//   focal  — object-position: which part of the image stays in frame when
//            'cover' crops it.
//
// No `'use client'` — pure types + data, safe to import anywhere (including
// the server-reachable generation paths).
// =============================================================================

export type ImageFit = 'cover' | 'contain';
export type ImageAspect = 'auto' | 'original' | '16:9' | '4:3' | '1:1';
export type ImageFocal =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export type ImageDisplay = {
  fit: ImageFit;
  aspect: ImageAspect;
  focal: ImageFocal;
};

/** The display every image starts at — `auto` keeps each section's existing
 *  slot ratio, so adding the field changes nothing until a user edits it. */
export const DEFAULT_IMAGE_DISPLAY: ImageDisplay = {
  fit: 'cover',
  aspect: 'auto',
  focal: 'center',
};

export function defaultImageDisplay(): ImageDisplay {
  return { ...DEFAULT_IMAGE_DISPLAY };
}

const FIT_VALUES: readonly ImageFit[] = ['cover', 'contain'];
const ASPECT_VALUES: readonly ImageAspect[] = ['auto', 'original', '16:9', '4:3', '1:1'];
const FOCAL_VALUES: readonly ImageFocal[] = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];

/** Normalise an unknown value (old / generated data has no display object)
 *  into a complete `ImageDisplay`, filling any missing or invalid field. */
export function coerceImageDisplay(value: unknown): ImageDisplay {
  if (!value || typeof value !== 'object') return defaultImageDisplay();
  const v = value as Record<string, unknown>;
  return {
    fit: FIT_VALUES.includes(v.fit as ImageFit) ? (v.fit as ImageFit) : 'cover',
    aspect: ASPECT_VALUES.includes(v.aspect as ImageAspect) ? (v.aspect as ImageAspect) : 'auto',
    focal: FOCAL_VALUES.includes(v.focal as ImageFocal) ? (v.focal as ImageFocal) : 'center',
  };
}

// -- Tailwind class maps ----------------------------------------------------
// Written as literal strings so Tailwind's source scanner picks them up; the
// runtime lookup just selects one. Object-position uses arbitrary percentage
// values so the names are stable across Tailwind versions.

const FIT_CLASS: Record<ImageFit, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
};

const FOCAL_CLASS: Record<ImageFocal, string> = {
  center: 'object-[50%_50%]',
  top: 'object-[50%_0%]',
  bottom: 'object-[50%_100%]',
  left: 'object-[0%_50%]',
  right: 'object-[100%_50%]',
  'top-left': 'object-[0%_0%]',
  'top-right': 'object-[100%_0%]',
  'bottom-left': 'object-[0%_100%]',
  'bottom-right': 'object-[100%_100%]',
};

const ASPECT_CLASS: Record<Exclude<ImageAspect, 'auto' | 'original'>, string> = {
  '16:9': 'aspect-[16/9]',
  '4:3': 'aspect-[4/3]',
  '1:1': 'aspect-square',
};

export type ImageBoxClasses = {
  /** True → the image should flow at its natural ratio: no fixed-ratio box,
   *  no cropping. The caller renders the `<img>` in normal flow. */
  isOriginal: boolean;
  /** A forced aspect-ratio class, or `null` when the section's own slot ratio
   *  applies (`auto`). Irrelevant when `isOriginal`. */
  aspectClass: string | null;
  /** object-fit + object-position classes for a box-cropped `<img>`. */
  fitClass: string;
};

/** Resolve a (possibly absent) display object into the classes a section's
 *  Preview applies to its image slot. */
export function imageBoxClasses(display: unknown): ImageBoxClasses {
  const d = coerceImageDisplay(display);
  return {
    isOriginal: d.aspect === 'original',
    aspectClass:
      d.aspect === 'auto' || d.aspect === 'original' ? null : ASPECT_CLASS[d.aspect],
    fitClass: `${FIT_CLASS[d.fit]} ${FOCAL_CLASS[d.focal]}`,
  };
}

// -- Editor control option lists -------------------------------------------

export const IMAGE_FIT_OPTIONS: readonly { id: ImageFit; label: string }[] = [
  { id: 'cover', label: 'Fill' },
  { id: 'contain', label: 'Show all' },
];

export const IMAGE_ASPECT_OPTIONS: readonly { id: ImageAspect; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: '16:9', label: '16:9' },
  { id: '4:3', label: '4:3' },
  { id: '1:1', label: 'Square' },
  { id: 'original', label: 'Original' },
];
