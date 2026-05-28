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

  // Strip height: 'standard' = 124px (~22% of canvas), 'tall' = 180px
  // (~32%) for louder presence or longer messages.
  const stripHeight = overlay.height === 'tall' ? 180 : 124;
  const isTop = overlay.position === 'top';
  const stripY = isTop ? 0 : COMPOSITE_HEIGHT - stripHeight;

  // Background variant. Brand accent (default) sits over a subtle dark
  // wash so light accent colours (yellow) still keep contrast with
  // white text. Dark variant is near-black with white text; light
  // variant is paper with ink text.
  const bgVariant = overlay.bg;
  const textColor = bgVariant === 'light' ? '#0a0a0a' : '#ffffff';
  ctx.save();
  if (bgVariant === 'accent') {
    ctx.fillStyle = brand.accentColor;
    ctx.fillRect(0, stripY, COMPOSITE_WIDTH, stripHeight);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, stripY, COMPOSITE_WIDTH, stripHeight);
  } else if (bgVariant === 'dark') {
    ctx.fillStyle = 'rgba(10,10,10,0.92)';
    ctx.fillRect(0, stripY, COMPOSITE_WIDTH, stripHeight);
  } else {
    ctx.fillStyle = 'rgba(245,241,234,0.95)';
    ctx.fillRect(0, stripY, COMPOSITE_WIDTH, stripHeight);
  }
  ctx.restore();

  // Text — chunky bold sans. Single-line auto-shrink: if the text
  // doesn't fit at base size for the strip height, drop in 4px steps.
  // Tall strips start at 64px; standard at 52px.
  const padX = 56;
  const maxWidth = COMPOSITE_WIDTH - padX * 2;
  ctx.save();
  ctx.fillStyle = textColor;
  // Canvas textAlign maps directly from the operator's choice; baseline
  // stays 'middle' so vertical centering works the same.
  ctx.textAlign = overlay.textAlign;
  ctx.textBaseline = 'middle';

  const baseFontSize = overlay.height === 'tall' ? 64 : 52;
  const minFontSize = 32;
  let fontSize = baseFontSize;
  let lines: string[];
  while (true) {
    ctx.font = `800 ${fontSize}px ${FONT_STACK}`;
    lines = wrapText(ctx, overlay.text, maxWidth);
    if (lines.length <= 2 || fontSize <= minFontSize) break;
    fontSize -= 4;
  }
  const lineHeight = fontSize * 1.18;
  const blockH = lines.length * lineHeight;
  const blockTop = stripY + (stripHeight - blockH) / 2 + lineHeight / 2;
  // x-anchor depends on textAlign so the operator's choice produces
  // visually-correct alignment (canvas measures from the anchor).
  const anchorX =
    overlay.textAlign === 'left'
      ? padX
      : overlay.textAlign === 'right'
        ? COMPOSITE_WIDTH - padX
        : COMPOSITE_WIDTH / 2;
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], anchorX, blockTop + i * lineHeight);
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

  // Card dimensions — size variant drives width + padding + font sizes.
  // Bigger cards work for a single bold offer; smaller cards stay out
  // of the way of the photo's subject.
  const dims = sizeDims(overlay.size);
  const cardW = dims.cardW;
  const cardH = dims.cardH;
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

  // Surface variant: paper (off-white, default), white (pure), dark
  // (near-black). Text colours flip on dark.
  const surface = overlay.surface;
  let cardFill: string;
  let headlineColor: string;
  let sublineColor: string;
  if (surface === 'dark') {
    cardFill = '#0a0a0a';
    headlineColor = brand.accentColor;
    sublineColor = 'rgba(245,241,234,0.78)';
  } else if (surface === 'white') {
    cardFill = '#ffffff';
    headlineColor = brand.accentColor;
    sublineColor = '#2a2a28';
  } else {
    cardFill = '#fcfaf6';
    headlineColor = brand.accentColor;
    sublineColor = '#2a2a28';
  }

  // Card surface with drop shadow.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = cardFill;
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 12);
  ctx.fill();
  ctx.restore();

  // Optional brand-accent left rail.
  if (overlay.accentRail) {
    ctx.save();
    roundedRectPath(ctx, cardX, cardY, 8, cardH, 4);
    ctx.fillStyle = brand.accentColor;
    ctx.fill();
    ctx.restore();
  }

  // Headline + subline.
  const padX = dims.padX;
  const padY = dims.padY;
  const textX = cardX + padX + (overlay.accentRail ? 4 : 0);
  const maxTextW = cardW - padX * 2 - (overlay.accentRail ? 4 : 0);
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.fillStyle = headlineColor;
  ctx.font = `800 ${dims.headlineFont}px ${FONT_STACK}`;
  const headlineLines = overlay.headline.trim().length > 0
    ? wrapText(ctx, overlay.headline, maxTextW)
    : [];
  let cy = cardY + padY;
  cy = drawWrappedText(
    ctx,
    headlineLines.slice(0, 2),
    textX,
    cy,
    dims.headlineLineH,
  );
  if (overlay.subline.trim().length > 0) {
    ctx.fillStyle = sublineColor;
    ctx.font = `500 ${dims.sublineFont}px ${FONT_STACK}`;
    const sublineLines = wrapText(ctx, overlay.subline, maxTextW);
    drawWrappedText(
      ctx,
      sublineLines.slice(0, 3),
      textX,
      cy + 8,
      dims.sublineLineH,
    );
  }
  ctx.restore();
}

/** Per-size dimensions for the Offer Card. Keeps the renderer body
 *  readable when the size knob varies the geometry by ~40%. */
function sizeDims(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm':
      return {
        cardW: 360,
        cardH: 180,
        padX: 28,
        padY: 24,
        headlineFont: 30,
        headlineLineH: 36,
        sublineFont: 16,
        sublineLineH: 22,
      };
    case 'lg':
      return {
        cardW: 540,
        cardH: 260,
        padX: 44,
        padY: 38,
        headlineFont: 46,
        headlineLineH: 54,
        sublineFont: 22,
        sublineLineH: 28,
      };
    default:
      return {
        cardW: 440,
        cardH: 220,
        padX: 36,
        padY: 32,
        headlineFont: 38,
        headlineLineH: 44,
        sublineFont: 20,
        sublineLineH: 26,
      };
  }
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

  // Bottom dark gradient for legibility. Intensity knob controls the
  // bottom-most opacity — 'standard' (78%) is the default; 'strong'
  // (92%) for photos with bright bottoms; 'none' skips the gradient
  // entirely (use only when the photo is already dim enough or the
  // operator wants the photo to dominate).
  if (overlay.gradientIntensity !== 'none') {
    const gradTop = Math.round(COMPOSITE_HEIGHT * 0.45);
    const grad = ctx.createLinearGradient(0, gradTop, 0, COMPOSITE_HEIGHT);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(
      1,
      overlay.gradientIntensity === 'strong'
        ? 'rgba(0,0,0,0.92)'
        : 'rgba(0,0,0,0.78)',
    );
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, gradTop, COMPOSITE_WIDTH, COMPOSITE_HEIGHT - gradTop);
    ctx.restore();
  }

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

  // Opening quote mark — large serif glyph sitting above-left of the
  // first line. Style knob: 'rust' = brand accent (default), 'subtle'
  // = faded white, 'none' = no glyph.
  if (overlay.quoteMarkStyle !== 'none') {
    ctx.font = `900 140px Georgia, 'Times New Roman', serif`;
    ctx.fillStyle =
      overlay.quoteMarkStyle === 'subtle'
        ? 'rgba(255,255,255,0.4)'
        : brand.accentColor;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('“', textX - 14, blockTop - lineHeight + 20);
  }

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

  // Author + subtitle — small uppercase line anchored left or right of
  // the canvas (operator's authorPosition choice).
  if (overlay.author.trim().length > 0 || overlay.subtitle.trim().length > 0) {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    const authorY = COMPOSITE_HEIGHT - 56;
    const isRight = overlay.authorPosition === 'right';

    // Measure widths up front so we can right-anchor when needed.
    const author = overlay.author.toUpperCase();
    ctx.font = `700 22px ${FONT_STACK}`;
    const authorWidth = ctx.measureText(author).width;
    let subtitleWidth = 0;
    if (overlay.subtitle.trim().length > 0) {
      ctx.font = `500 18px ${FONT_STACK}`;
      subtitleWidth = ctx.measureText(` · ${overlay.subtitle}`).width;
    }
    const totalWidth = authorWidth + subtitleWidth;

    // Dot + author start position.
    const dotX = isRight
      ? COMPOSITE_WIDTH - padX - totalWidth - 17
      : padX + 5;
    const authorStartX = dotX + 17;

    ctx.fillStyle = brand.accentColor;
    ctx.beginPath();
    ctx.arc(dotX, authorY - 7, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 22px ${FONT_STACK}`;
    ctx.fillText(author, authorStartX, authorY);

    if (overlay.subtitle.trim().length > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = `500 18px ${FONT_STACK}`;
      ctx.fillText(
        ` · ${overlay.subtitle}`,
        authorStartX + authorWidth,
        authorY,
      );
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
  baseImg: HTMLImageElement,
  secondaryImg: HTMLImageElement | null,
  overlay: Extract<ComposeInput['overlay'], { kind: 'split' }>,
  brand: CreativeBrandContext,
): void {
  const hasDivider = overlay.dividerText.trim().length > 0;
  const dividerH = hasDivider ? 56 : 0;
  const available = COMPOSITE_HEIGHT - dividerH;
  // Ratio knob — pick top:bottom proportion. 50-50 is the baseline;
  // 60-40 / 40-60 lets the operator favour either photo.
  const ratioTop =
    overlay.ratio === '60-40'
      ? 0.6
      : overlay.ratio === '40-60'
        ? 0.4
        : 0.5;
  const topH = Math.floor(available * ratioTop);
  const bottomH = available - topH;
  const bottomY = topH + dividerH;

  // Swap knob — toggles which uploaded image renders top vs bottom.
  // Default: primary on top, secondary on bottom. Operator can flip
  // for "after / before" framing.
  const topImg = overlay.swap ? secondaryImg : baseImg;
  const bottomImg = overlay.swap ? baseImg : secondaryImg;

  // Top half.
  if (topImg) {
    drawImageCover(ctx, topImg, 0, 0, COMPOSITE_WIDTH, topH);
  } else {
    drawSplitPlaceholder(ctx, 0, 0, COMPOSITE_WIDTH, topH);
  }
  // Bottom half — falls back to placeholder text when the operator
  // hasn't uploaded the secondary image yet (live preview transient
  // state; validateOverlay blocks launch here).
  if (bottomImg) {
    drawImageCover(ctx, bottomImg, 0, bottomY, COMPOSITE_WIDTH, bottomH);
  } else {
    drawSplitPlaceholder(ctx, 0, bottomY, COMPOSITE_WIDTH, bottomH);
  }

  if (!hasDivider) return;

  // Divider strip — bg variant honours operator pick. Text colour
  // auto-flips to ink on the light variant.
  const dividerBgFill =
    overlay.dividerBg === 'dark'
      ? '#0a0a0a'
      : overlay.dividerBg === 'light'
        ? '#fcfaf6'
        : brand.accentColor;
  const dividerTextColor = overlay.dividerBg === 'light' ? '#0a0a0a' : '#ffffff';
  ctx.save();
  ctx.fillStyle = dividerBgFill;
  ctx.fillRect(0, topH, COMPOSITE_WIDTH, dividerH);
  // Subtle dark wash on the accent variant so light accent colours
  // keep contrast with white text. Skip on the dark + light variants.
  if (overlay.dividerBg === 'accent') {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, topH, COMPOSITE_WIDTH, dividerH);
  }
  ctx.fillStyle = dividerTextColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 24px ${FONT_STACK}`;
  ctx.fillText(
    overlay.dividerText.toUpperCase(),
    COMPOSITE_WIDTH / 2,
    topH + dividerH / 2,
  );
  ctx.restore();
}

function drawSplitPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.fillStyle = '#f5f1ea';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#6e685c';
  ctx.font = `700 22px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Upload a second image', x + w / 2, y + h / 2);
  ctx.restore();
}
