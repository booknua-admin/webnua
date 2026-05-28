// =============================================================================
// Meta Ads — creative template overlay system.
//
// Phase 7.5 · Session 1.4b.1. The customer-uploaded base image becomes a
// composited image at launch time, layered with one of N template designs.
// Operator picks the template per image in the wizard's step 4; the
// composite (rendered browser-side via the 2D canvas) is uploaded to
// Supabase Storage and that URL is what the launch orchestrator sends
// to Meta.
//
// Five single-image templates (Story Carousel ships in 1.4b.2):
//
//   • plain        — no overlay; the raw upload goes through.
//   • banner       — top or bottom text strip with chunky bold copy.
//   • offer_card   — corner call-out card with headline + subline.
//   • quote_drop   — bold testimonial-headline dropped over the bottom
//                    of the photo with accent-coloured phrases + optional
//                    circular inset image + quotation marks + dark gradient.
//   • split        — two stacked images (operator uploads a secondary
//                    base image) with a thin text divider between them.
//
// The matrix architecture (Session 1.4a) is unchanged — composites slot
// into the ad axis as ordinary 1.91:1 images. The orchestrator + Meta
// API see only image URLs and never know about templates.
//
// Canvas rendering target: 1080 × 566 (Meta News Feed link-ad aspect).
// Live preview uses canvas.toDataURL('image/jpeg', 0.85); the launch-time
// upload uses canvas.toBlob('image/jpeg', 0.92) for higher quality.
//
// Fonts: the system stack 'Inter Tight, Inter, system-ui, …' already
// loaded by the rest of the app — no extra font load needed inside the
// canvas. Brand fonts (the curated Google Fonts list in
// lib/website/google-fonts.ts) is a V2 upgrade.
// =============================================================================

// --- ids + closed sets ------------------------------------------------------

export type CreativeTemplateId =
  | 'plain'
  | 'banner'
  | 'offer_card'
  | 'quote_drop'
  | 'split';

export const CREATIVE_TEMPLATE_IDS: readonly CreativeTemplateId[] = [
  'plain',
  'banner',
  'offer_card',
  'quote_drop',
  'split',
] as const;

export type BannerPosition = 'top' | 'bottom';
export type OfferCardCorner = 'tl' | 'tr' | 'bl' | 'br';

// --- per-template overlay shapes --------------------------------------------
//
// Discriminated by `kind` so the wizard, compositor, and renderers can
// share one type without each repeating the field set.

export type CreativeTemplateOverlay =
  | { kind: 'plain' }
  | {
      kind: 'banner';
      position: BannerPosition;
      text: string;
    }
  | {
      kind: 'offer_card';
      corner: OfferCardCorner;
      headline: string;
      subline: string;
    }
  | {
      kind: 'quote_drop';
      /** The testimonial / headline body. Newlines preserved. */
      quote: string;
      /** Substrings inside `quote` that render in the brand accent
       *  colour. Each phrase is matched case-insensitively as a contiguous
       *  substring — first match per phrase wins. Empty phrases ignored. */
      accentPhrases: string[];
      author: string;
      /** Optional secondary line below the author (e.g. "Cottesloe"). */
      subtitle: string;
      /** When true, the secondary base image renders as a circular inset
       *  top-right with a white border. Falls back to false silently
       *  when no secondary image is uploaded. */
      useInset: boolean;
    }
  | {
      kind: 'split';
      /** Thin text strip between the two images. Empty = no divider. */
      dividerText: string;
    };

// --- registry --------------------------------------------------------------

export type CreativeTemplateRegistryEntry = {
  id: CreativeTemplateId;
  label: string;
  blurb: string;
  /** True for templates that consume an optional or required secondary
   *  base image (Quote Drop's inset photo, Split's second base). The
   *  wizard's per-template editor surfaces a secondary-upload affordance
   *  when this is set. */
  supportsSecondary: boolean;
  /** True for templates whose secondary base image is REQUIRED (not
   *  optional) — the wizard blocks launch until one is uploaded. */
  requiresSecondary: boolean;
};

export const CREATIVE_TEMPLATE_REGISTRY: Record<
  CreativeTemplateId,
  CreativeTemplateRegistryEntry
> = {
  plain: {
    id: 'plain',
    label: 'Plain',
    blurb: 'Just the image — no overlay. Best when the photo IS the message.',
    supportsSecondary: false,
    requiresSecondary: false,
  },
  banner: {
    id: 'banner',
    label: 'Banner',
    blurb: 'A bold text strip across the top or bottom of the photo.',
    supportsSecondary: false,
    requiresSecondary: false,
  },
  offer_card: {
    id: 'offer_card',
    label: 'Offer Card',
    blurb: 'Corner call-out card with the offer headline + a tight subline.',
    supportsSecondary: false,
    requiresSecondary: false,
  },
  quote_drop: {
    id: 'quote_drop',
    label: 'Quote Drop',
    blurb:
      "Chunky testimonial headline dropped over the bottom of the photo, with accent words highlighted. Optional circular inset image top-right.",
    supportsSecondary: true,
    requiresSecondary: false,
  },
  split: {
    id: 'split',
    label: 'Split',
    blurb:
      'Two stacked photos with a thin text divider between them — before / after, then / now.',
    supportsSecondary: true,
    requiresSecondary: true,
  },
};

export function listCreativeTemplates(): CreativeTemplateRegistryEntry[] {
  return CREATIVE_TEMPLATE_IDS.map((id) => CREATIVE_TEMPLATE_REGISTRY[id]);
}

// --- defaults --------------------------------------------------------------

/** Default overlay for a freshly-picked template. Operator can edit
 *  every field after. */
export function defaultOverlayFor(
  id: CreativeTemplateId,
): CreativeTemplateOverlay {
  switch (id) {
    case 'plain':
      return { kind: 'plain' };
    case 'banner':
      return { kind: 'banner', position: 'bottom', text: '' };
    case 'offer_card':
      return {
        kind: 'offer_card',
        corner: 'tl',
        headline: '',
        subline: '',
      };
    case 'quote_drop':
      return {
        kind: 'quote_drop',
        quote: '',
        accentPhrases: [],
        author: '',
        subtitle: '',
        useInset: false,
      };
    case 'split':
      return { kind: 'split', dividerText: '' };
  }
}

/** Coerce an arbitrary overlay onto the target template's shape — used
 *  when the operator switches template on an existing image. Carries
 *  any overlap of fields across; resets the rest to defaults. */
export function coerceOverlayTo(
  target: CreativeTemplateId,
  from: CreativeTemplateOverlay | null,
): CreativeTemplateOverlay {
  const def = defaultOverlayFor(target);
  if (!from) return def;
  // Preserve text-shaped carry-over where it makes sense.
  if (def.kind === 'banner' && from.kind === 'offer_card') {
    return { ...def, text: from.headline || from.subline || '' };
  }
  if (def.kind === 'offer_card' && from.kind === 'banner') {
    return { ...def, headline: from.text };
  }
  if (def.kind === 'offer_card' && from.kind === 'quote_drop') {
    return { ...def, headline: from.quote.split('\n')[0] || '' };
  }
  if (def.kind === 'quote_drop' && from.kind === 'banner') {
    return { ...def, quote: from.text };
  }
  if (def.kind === 'quote_drop' && from.kind === 'offer_card') {
    return { ...def, quote: from.headline, subtitle: from.subline };
  }
  return def;
}

// --- brand context ---------------------------------------------------------

export type CreativeBrandContext = {
  /** Brand accent — used for highlighted text in Quote Drop, the offer
   *  card border, banner background, etc. Hex string. */
  accentColor: string;
  /** Optional secondary highlight colour (e.g. for the second accent
   *  phrase in Quote Drop). When unset, falls back to a derived warm
   *  yellow. */
  secondaryColor?: string;
  /** Brand display name — used as fallback initial in the Quote Drop
   *  inset when no secondary image is uploaded. */
  brandName?: string;
};

// --- canvas size -----------------------------------------------------------

/** Meta News Feed link-ad image — 1.91:1, 1080 × 566. The composite is
 *  always rendered at this size regardless of the base image's actual
 *  dimensions (the renderers crop with object-cover style fit). */
export const COMPOSITE_WIDTH = 1080;
export const COMPOSITE_HEIGHT = 566;

// --- canvas helpers --------------------------------------------------------

/** Load a remote image into an HTMLImageElement. Crossorigin set so the
 *  canvas can read pixels back via toBlob / toDataURL. The Supabase
 *  Storage bucket the wizard uses is public — public-URL fetches don't
 *  taint the canvas. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`Could not load image for compositor: ${url}`));
    img.src = url;
  });
}

/** Cover-fit: draws `img` inside `(dx, dy, dw, dh)` with object-cover
 *  semantics (centred, fills, may crop). */
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const sAspect = img.naturalWidth / img.naturalHeight;
  const dAspect = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (sAspect > dAspect) {
    // Source wider than destination — crop sides.
    sw = img.naturalHeight * dAspect;
    sx = (img.naturalWidth - sw) / 2;
  } else if (sAspect < dAspect) {
    // Source taller — crop top/bottom.
    sh = img.naturalWidth / dAspect;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/** Rounded-rect path on the current context (does not stroke / fill). */
export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** Wrap `text` into lines that fit inside `maxWidth` at the current
 *  context font. Splits on whitespace; hard-newlines preserved. Returns
 *  the wrapped line array (caller decides where to draw). */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  const paragraphs = text.split(/\r?\n/);
  for (const para of paragraphs) {
    if (para.length === 0) {
      out.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let line = '';
    for (const word of words) {
      const candidate = line.length === 0 ? word : `${line} ${word}`;
      const w = ctx.measureText(candidate).width;
      if (w <= maxWidth || line.length === 0) {
        line = candidate;
      } else {
        out.push(line);
        line = word;
      }
    }
    if (line.length > 0) out.push(line);
  }
  return out;
}

/** Draw left-aligned wrapped text at (x, y). Returns the y-coordinate
 *  one line below the last drawn line (useful for follow-on content). */
export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
): number {
  let cy = y;
  for (const line of lines) {
    ctx.fillText(line, x, cy);
    cy += lineHeight;
  }
  return cy;
}

/** Resolve case-insensitive accent-phrase ranges inside `text`. Each
 *  phrase contributes at most one range (first match wins); overlapping
 *  matches are clipped (an earlier range wins over a later one). */
export function resolveAccentRanges(
  text: string,
  phrases: string[],
): Array<{ start: number; end: number }> {
  const lower = text.toLowerCase();
  const ranges: Array<{ start: number; end: number }> = [];
  for (const raw of phrases) {
    const phrase = raw.trim();
    if (phrase.length === 0) continue;
    const needle = phrase.toLowerCase();
    let idx = 0;
    while (idx <= lower.length - needle.length) {
      const hit = lower.indexOf(needle, idx);
      if (hit === -1) break;
      const end = hit + needle.length;
      // Reject if it overlaps an existing range.
      const collides = ranges.some(
        (r) => !(end <= r.start || hit >= r.end),
      );
      if (!collides) {
        ranges.push({ start: hit, end });
        break;
      }
      idx = hit + 1;
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}

// --- compositor dispatcher -------------------------------------------------

/** Inputs to `composeImage`. Mirrors the wizard's per-image state shape
 *  closely so call-site adaptation is one mapping step. */
export type ComposeInput = {
  templateId: CreativeTemplateId;
  overlay: CreativeTemplateOverlay;
  baseUrl: string;
  /** For templates that consume a secondary base image (Split needs one;
   *  Quote Drop optionally uses one as the inset photo). */
  secondaryUrl: string | null;
  brand: CreativeBrandContext;
};

/** Output dimensions of `composeToCanvas`. */
export type CanvasOutput = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

/** Render the composite onto a fresh canvas. Returns the canvas so
 *  callers can convert to data URL (preview) or Blob (upload) without
 *  re-rendering. */
export async function composeToCanvas(
  input: ComposeInput,
): Promise<CanvasOutput> {
  const canvas = document.createElement('canvas');
  canvas.width = COMPOSITE_WIDTH;
  canvas.height = COMPOSITE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not allocate a 2D canvas context.');
  }
  // White background — every renderer fills the full canvas, but a
  // fallback bg avoids a transparent strip if a renderer leaves a gap.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, COMPOSITE_WIDTH, COMPOSITE_HEIGHT);

  // Defer to the renderer module; import is dynamic to keep the module
  // graph cycle-free (renderers import this module for helpers).
  const { renderTemplate } = await import('./creative-template-renderers');
  await renderTemplate(ctx, input);
  return { canvas, width: COMPOSITE_WIDTH, height: COMPOSITE_HEIGHT };
}

/** Render + convert to a data URL — used by the live preview in the
 *  wizard. JPEG at quality 0.85 for a compact preview asset. */
export async function composeToDataUrl(input: ComposeInput): Promise<string> {
  const { canvas } = await composeToCanvas(input);
  return canvas.toDataURL('image/jpeg', 0.85);
}

/** Render + convert to a Blob — used at launch time before the upload.
 *  Higher quality (0.92) for the final asset Meta will fetch. */
export async function composeToBlob(input: ComposeInput): Promise<Blob> {
  const { canvas } = await composeToCanvas(input);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob returned null.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.92,
    );
  });
}

// --- validation ------------------------------------------------------------

/** Returns null when the overlay is launch-valid for the given template,
 *  or a human-readable reason why it isn't. Used by the wizard to block
 *  launch on a half-configured overlay (e.g. Split with no secondary
 *  image, Quote Drop with no quote). */
export function validateOverlay(
  templateId: CreativeTemplateId,
  overlay: CreativeTemplateOverlay,
  secondaryUrl: string | null,
): string | null {
  // Belt-and-braces: an overlay whose kind drifts from the template
  // shouldn't crash a render — but it IS a launch blocker because the
  // composite would not match the operator's intent.
  if (overlay.kind !== templateId) {
    return `Overlay shape mismatch (${overlay.kind} vs ${templateId}). Pick the template again.`;
  }
  switch (overlay.kind) {
    case 'plain':
      return null;
    case 'banner':
      if (overlay.text.trim().length === 0) {
        return 'Banner text is empty — add a line of copy or switch to Plain.';
      }
      return null;
    case 'offer_card':
      if (
        overlay.headline.trim().length === 0 &&
        overlay.subline.trim().length === 0
      ) {
        return 'Offer card needs a headline or subline.';
      }
      return null;
    case 'quote_drop':
      if (overlay.quote.trim().length === 0) {
        return 'Quote Drop needs a quote.';
      }
      if (overlay.useInset && !secondaryUrl) {
        return 'Inset photo turned on but no secondary image uploaded — upload one or turn off the inset.';
      }
      return null;
    case 'split':
      if (!secondaryUrl) {
        return 'Split needs a second base image — upload one or switch templates.';
      }
      return null;
  }
}
