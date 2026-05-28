// =============================================================================
// Meta Ads — per-template canvas renderers.
//
// Phase 7.5 · Session 1.4b.1. Imported dynamically by
// `creative-templates.ts` `composeToCanvas`. Each renderer takes the
// 2D context + the compose input and draws the full 1080×566 composite.
//
// Renderers share a system font stack: 'Inter Tight, Inter, system-ui, …'
// (already loaded by the rest of the app) so we don't need to fetch a
// font into the canvas at render time. Brand-fonts via the curated
// Google Fonts list is a V1.1 upgrade.
//
// Anti-fabrication: no renderer invents text. Every drawn string comes
// from operator-typed overlay fields. Empty fields render as empty
// (the validateOverlay step in the wizard blocks launch on empty
// fields where empty would mean a half-built creative).
// =============================================================================

import {
  COMPOSITE_HEIGHT,
  COMPOSITE_WIDTH,
  type ComposeInput,
  type CreativeBrandContext,
  drawImageCover,
  drawWrappedText,
  loadImage,
  resolveAccentRanges,
  roundedRectPath,
  wrapText,
} from './creative-templates';

const FONT_STACK = "'Inter Tight', Inter, system-ui, -apple-system, sans-serif";

// --- top-level dispatcher --------------------------------------------------

export async function renderTemplate(
  ctx: CanvasRenderingContext2D,
  input: ComposeInput,
): Promise<void> {
  const baseImg = await loadImage(input.baseUrl);
  // Secondary image is needed for split (required) + quote_drop (optional
  // inset). Loaded lazily — only when the template + overlay actually
  // need it, so a Plain composite doesn't pay the cost.
  let secondaryImg: HTMLImageElement | null = null;
  const needsSecondary =
    (input.overlay.kind === 'split' && input.secondaryUrl) ||
    (input.overlay.kind === 'quote_drop' &&
      input.overlay.useInset &&
      input.secondaryUrl);
  if (needsSecondary && input.secondaryUrl) {
    try {
      secondaryImg = await loadImage(input.secondaryUrl);
    } catch {
      // A missing secondary degrades gracefully — the renderer's branch
      // for secondaryImg=null falls back to a sensible placeholder.
      secondaryImg = null;
    }
  }

  switch (input.overlay.kind) {
    case 'plain':
      renderPlain(ctx, baseImg);
      return;
    case 'banner':
      renderBanner(ctx, baseImg, input.overlay, input.brand);
      return;
    case 'offer_card':
      renderOfferCard(ctx, baseImg, input.overlay, input.brand);
      return;
    case 'quote_drop':
      renderQuoteDrop(
        ctx,
        baseImg,
        secondaryImg,
        input.overlay,
        input.brand,
      );
      return;
    case 'split':
      renderSplit(ctx, baseImg, secondaryImg, input.overlay, input.brand);
      return;
  }
}

// --- plain -----------------------------------------------------------------

function renderPlain(
  ctx: CanvasRenderingContext2D,
  baseImg: HTMLImageElement,
): void {
  drawImageCover(ctx, baseImg, 0, 0, COMPOSITE_WIDTH, COMPOSITE_HEIGHT);
}

// --- banner ----------------------------------------------------------------

function renderBanner(
  ctx: CanvasRenderingContext2D,
  baseImg: HTMLImageElement,
  overlay: Extract<ComposeInput['overlay'], { kind: 'banner' }>,
  brand: CreativeBrandContext,
): void {
  // Photo fills the canvas.
  drawImageCover(ctx, baseImg, 0, 0, COMPOSITE_WIDTH, COMPOSITE_HEIGHT);

  // The strip occupies ~22% of the canvas height — tall enough for two
  // wrapped lines without crowding the photo.
  const stripHeight = 124;
  const isTop = overlay.position === 'top';
  const stripY = isTop ? 0 : COMPOSITE_HEIGHT - stripHeight;

  // Brand accent + subtle dark gradient for legibility — works whether
  // the accent is warm or cool.
  ctx.save();
  ctx.fillStyle = brand.accentColor;
  ctx.fillRect(0, stripY, COMPOSITE_WIDTH, stripHeight);
  // Soft 18% black overlay so light accent colours (e.g. yellow) keep
  // contrast with white text.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, stripY, COMPOSITE_WIDTH, stripHeight);
  ctx.restore();

  // Text — chunky bold sans, white on the accent strip. Single-line auto-
  // shrink: if the text doesn't fit at 52px, drop the font size in
  // 4px steps to 32px before wrapping.
  const padX = 56;
  const maxWidth = COMPOSITE_WIDTH - padX * 2;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let fontSize = 52;
  let lines: string[];
  while (true) {
    ctx.font = `800 ${fontSize}px ${FONT_STACK}`;
    lines = wrapText(ctx, overlay.text, maxWidth);
    if (lines.length <= 2 || fontSize <= 32) break;
    fontSize -= 4;
  }
  const lineHeight = fontSize * 1.18;
  const blockH = lines.length * lineHeight;
  const blockTop = stripY + (stripHeight - blockH) / 2 + lineHeight / 2;
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], COMPOSITE_WIDTH / 2, blockTop + i * lineHeight);
  }
  ctx.restore();
}

// --- offer card ------------------------------------------------------------

function renderOfferCard(
  ctx: CanvasRenderingContext2D,
  baseImg: HTMLImageElement,
  overlay: Extract<ComposeInput['overlay'], { kind: 'offer_card' }>,
  brand: CreativeBrandContext,
): void {
  drawImageCover(ctx, baseImg, 0, 0, COMPOSITE_WIDTH, COMPOSITE_HEIGHT);

  // Card dimensions — sized for News Feed legibility, not so big it
  // covers the subject.
  const cardW = 440;
  const cardH = 220;
  const margin = 40;
  let cardX: number;
  let cardY: number;
  switch (overlay.corner) {
    case 'tl':
      cardX = margin;
      cardY = margin;
      break;
    case 'tr':
      cardX = COMPOSITE_WIDTH - margin - cardW;
      cardY = margin;
      break;
    case 'bl':
      cardX = margin;
      cardY = COMPOSITE_HEIGHT - margin - cardH;
      break;
    case 'br':
      cardX = COMPOSITE_WIDTH - margin - cardW;
      cardY = COMPOSITE_HEIGHT - margin - cardH;
      break;
  }

  // Card surface — paper (off-white) with brand-accent left border for
  // visual identity. Drop shadow underneath for separation from the
  // photo.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#fcfaf6';
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 12);
  ctx.fill();
  ctx.restore();

  // Brand accent left rail.
  ctx.save();
  roundedRectPath(ctx, cardX, cardY, 8, cardH, 4);
  ctx.fillStyle = brand.accentColor;
  ctx.fill();
  ctx.restore();

  // Headline + subline.
  const padX = 36;
  const padY = 32;
  const textX = cardX + padX;
  const maxTextW = cardW - padX * 2;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.fillStyle = brand.accentColor;
  ctx.font = `800 38px ${FONT_STACK}`;
  const headlineLines = overlay.headline.trim().length > 0
    ? wrapText(ctx, overlay.headline, maxTextW)
    : [];
  let cy = cardY + padY;
  cy = drawWrappedText(
    ctx,
    headlineLines.slice(0, 2),
    textX,
    cy,
    44,
  );
  if (overlay.subline.trim().length > 0) {
    ctx.fillStyle = '#2a2a28';
    ctx.font = `500 20px ${FONT_STACK}`;
    const sublineLines = wrapText(ctx, overlay.subline, maxTextW);
    drawWrappedText(ctx, sublineLines.slice(0, 3), textX, cy + 8, 26);
  }
  ctx.restore();
}

// --- quote drop ------------------------------------------------------------

function renderQuoteDrop(
  ctx: CanvasRenderingContext2D,
  baseImg: HTMLImageElement,
  secondaryImg: HTMLImageElement | null,
  overlay: Extract<ComposeInput['overlay'], { kind: 'quote_drop' }>,
  brand: CreativeBrandContext,
): void {
  drawImageCover(ctx, baseImg, 0, 0, COMPOSITE_WIDTH, COMPOSITE_HEIGHT);

  // Bottom dark gradient for legibility. Spans ~55% of the canvas
  // height — the quote sits inside this zone.
  const gradTop = Math.round(COMPOSITE_HEIGHT * 0.45);
  const grad = ctx.createLinearGradient(0, gradTop, 0, COMPOSITE_HEIGHT);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, gradTop, COMPOSITE_WIDTH, COMPOSITE_HEIGHT - gradTop);
  ctx.restore();

  // Optional inset photo — circle top-right with a white border.
  if (overlay.useInset) {
    const insetSize = 132;
    const insetX = COMPOSITE_WIDTH - 48 - insetSize;
    const insetY = 48;
    ctx.save();
    // White ring.
    ctx.beginPath();
    ctx.arc(
      insetX + insetSize / 2,
      insetY + insetSize / 2,
      insetSize / 2 + 5,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // Clip + draw inset.
    ctx.beginPath();
    ctx.arc(
      insetX + insetSize / 2,
      insetY + insetSize / 2,
      insetSize / 2,
      0,
      Math.PI * 2,
    );
    ctx.closePath();
    ctx.clip();
    if (secondaryImg) {
      drawImageCover(ctx, secondaryImg, insetX, insetY, insetSize, insetSize);
    } else {
      // Placeholder: brand-coloured circle with initial letter. Only
      // reached when the operator turned inset on but no secondary
      // image is loaded yet (live-preview transient state) — the
      // wizard's validateOverlay blocks launch in this case.
      ctx.fillStyle = brand.accentColor;
      ctx.fillRect(insetX, insetY, insetSize, insetSize);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 56px ${FONT_STACK}`;
      const initial = (brand.brandName?.trim()[0] ?? 'W').toUpperCase();
      ctx.fillText(initial, insetX + insetSize / 2, insetY + insetSize / 2);
    }
    ctx.restore();
  }

  // Quotation marks framing the headline — large rust-coloured glyphs.
  // The opening quote sits top-left of the text block; the closing
  // quote is decorative, baked into the layout below the author line.
  const padX = 56;
  const maxTextW = COMPOSITE_WIDTH - padX * 2;

  // Quote block — chunky bold sans, white text with accent-phrase
  // highlights. Auto-shrink from 56px down to 36px to fit ≤ 4 lines.
  let fontSize = 56;
  let quoteLines: string[];
  ctx.save();
  while (true) {
    ctx.font = `800 ${fontSize}px ${FONT_STACK}`;
    quoteLines = wrapText(ctx, overlay.quote, maxTextW);
    if (quoteLines.length <= 4 || fontSize <= 36) break;
    fontSize -= 4;
  }
  const lineHeight = Math.round(fontSize * 1.14);
  const blockH = quoteLines.length * lineHeight;

  // Position the block so the LAST line sits ~120px from the bottom
  // (leaves room for author + subtitle).
  const blockBottom = COMPOSITE_HEIGHT - 132;
  const blockTop = blockBottom - blockH + lineHeight; // textBaseline=alphabetic
  const textX = padX;
  const textY = blockTop;

  // Opening quote mark — large brand-accent glyph sitting above-left
  // of the first line.
  ctx.font = `900 140px Georgia, 'Times New Roman', serif`;
  ctx.fillStyle = brand.accentColor;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('“', textX - 14, blockTop - lineHeight + 20);

  // Draw the wrapped quote with per-range accent colouring.
  ctx.font = `800 ${fontSize}px ${FONT_STACK}`;
  ctx.textBaseline = 'alphabetic';

  // Resolve accent ranges across the full quote string, then segment
  // each wrapped line back to character offsets relative to the
  // original string.
  const ranges = resolveAccentRanges(overlay.quote, overlay.accentPhrases);
  drawLinesWithAccents(
    ctx,
    overlay.quote,
    quoteLines,
    ranges,
    textX,
    textY,
    lineHeight,
    '#ffffff',
    brand.accentColor,
    brand.secondaryColor ?? '#f5c25b',
  );
  ctx.restore();

  // Author + subtitle — mono-feeling uppercase, smaller, accent dot.
  if (overlay.author.trim().length > 0 || overlay.subtitle.trim().length > 0) {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    const authorY = COMPOSITE_HEIGHT - 56;
    ctx.fillStyle = brand.accentColor;
    ctx.beginPath();
    ctx.arc(padX + 5, authorY - 7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 22px ${FONT_STACK}`;
    const author = overlay.author.toUpperCase();
    ctx.fillText(author, padX + 22, authorY);
    if (overlay.subtitle.trim().length > 0) {
      const authorWidth = ctx.measureText(author).width;
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = `500 18px ${FONT_STACK}`;
      ctx.fillText(` · ${overlay.subtitle}`, padX + 22 + authorWidth, authorY);
    }
    ctx.restore();
  }
}

// --- helper: per-line accent draw ------------------------------------------

/** Draw wrapped lines of `originalText` with per-character-range colour
 *  changes. Each line is walked back to its character offsets inside
 *  the original string so accent ranges can be applied correctly even
 *  when wrapping inserts implicit breaks. */
function drawLinesWithAccents(
  ctx: CanvasRenderingContext2D,
  originalText: string,
  lines: string[],
  ranges: Array<{ start: number; end: number }>,
  startX: number,
  startY: number,
  lineHeight: number,
  baseColor: string,
  accentColor: string,
  secondaryAccentColor: string,
): void {
  // Build a flat per-character colour map for the original text.
  const colorAt: (idx: number) => string = (idx) => {
    for (let i = 0; i < ranges.length; i += 1) {
      const r = ranges[i];
      if (idx >= r.start && idx < r.end) {
        // Alternate accent colours per-range so two highlighted
        // phrases stand apart visually (operator-typed phrases that
        // align by index don't collide).
        return i % 2 === 0 ? accentColor : secondaryAccentColor;
      }
    }
    return baseColor;
  };

  // Walk each line back into a slice of `originalText`. Whitespace
  // between lines (the wrap point) is skipped in the line content but
  // present in the source; we re-find each line's offset starting
  // from the current cursor.
  let cursor = 0;
  for (let li = 0; li < lines.length; li += 1) {
    const line = lines[li];
    if (line.length === 0) {
      cursor += 1; // hard-newline
      continue;
    }
    const hit = originalText.indexOf(line, cursor);
    const lineStart = hit === -1 ? cursor : hit;
    cursor = lineStart + line.length;
    const y = startY + li * lineHeight;
    // Draw each character with its colour. measureText per char is
    // expensive but the volume here is tiny (≤ 4 lines × ~40 chars).
    let cx = startX;
    for (let ci = 0; ci < line.length; ci += 1) {
      const ch = line[ci];
      const globalIdx = lineStart + ci;
      ctx.fillStyle = colorAt(globalIdx);
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width;
    }
  }
}

// --- split ------------------------------------------------------------------

function renderSplit(
  ctx: CanvasRenderingContext2D,
  topImg: HTMLImageElement,
  bottomImg: HTMLImageElement | null,
  overlay: Extract<ComposeInput['overlay'], { kind: 'split' }>,
  brand: CreativeBrandContext,
): void {
  const hasDivider = overlay.dividerText.trim().length > 0;
  const dividerH = hasDivider ? 56 : 0;
  const halfH = Math.floor((COMPOSITE_HEIGHT - dividerH) / 2);

  // Top half.
  drawImageCover(ctx, topImg, 0, 0, COMPOSITE_WIDTH, halfH);
  // Bottom half — falls back to a paper background + placeholder text
  // when the operator hasn't uploaded the secondary image yet (live
  // preview transient state; validateOverlay blocks launch here).
  const bottomY = halfH + dividerH;
  if (bottomImg) {
    drawImageCover(ctx, bottomImg, 0, bottomY, COMPOSITE_WIDTH, halfH);
  } else {
    ctx.save();
    ctx.fillStyle = '#f5f1ea';
    ctx.fillRect(0, bottomY, COMPOSITE_WIDTH, halfH);
    ctx.fillStyle = '#6e685c';
    ctx.font = `700 22px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'Upload a second image',
      COMPOSITE_WIDTH / 2,
      bottomY + halfH / 2,
    );
    ctx.restore();
  }

  if (!hasDivider) return;

  // Divider strip — brand accent bg, chunky uppercase text centred,
  // separates the two photos.
  ctx.save();
  ctx.fillStyle = brand.accentColor;
  ctx.fillRect(0, halfH, COMPOSITE_WIDTH, dividerH);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(0, halfH, COMPOSITE_WIDTH, dividerH);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 24px ${FONT_STACK}`;
  ctx.fillText(
    overlay.dividerText.toUpperCase(),
    COMPOSITE_WIDTH / 2,
    halfH + dividerH / 2,
  );
  ctx.restore();
}
