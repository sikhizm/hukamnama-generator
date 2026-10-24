import type { BlockLayout, LayoutResult, Rect } from "./layout";
import { drawLine, measureAt } from "./text";
import { fontFor, setActiveFontStack, type PresetDef, type StudioState } from "./types";

/** Coordinates measured from the supplied 1080×1350 and 1080×1920 artwork. */
export const REFERENCE = {
  feed: {
    src: "/images/templates/1080.png", stripe: [0, 343, 1080, 36],
    original: [39, 394, 1002, 326], translation: [41, 725, 998, 506],
    date: [390, 1268, 640, 38], originalPx: 53, translationPx: 38,
    bodyTop: 379, bodyBottom: 1231, separatorY: 0,
    gapBeforeSeparator: 22, gapAfterSeparator: 16,
    authorX: 41, metaY: 369, metaPx: 24, rightX: 1029,
  },
  vertical: {
    src: "/images/templates/1920.png", stripe: [0, 429, 1080, 54],
    original: [88, 508, 904, 420], translation: [88, 1037, 904, 546],
    date: [140, 1645, 802, 45], originalPx: 56, translationPx: 37,
    bodyTop: 483, bodyBottom: 1583, separatorY: 974,
    gapBeforeSeparator: 26, gapAfterSeparator: 63,
    authorX: 90, metaY: 465, metaPx: 28, rightX: 992,
  },
} as const;

export function isReference(state: StudioState, presetId = state.presetId): boolean {
  return state.design === "reference" && (presetId === "feed" || presetId === "vertical");
}

export function referenceConfig(id: string) {
  return id === "feed" ? REFERENCE.feed : REFERENCE.vertical;
}

function rect(a: readonly number[]): Rect {
  return { x: a[0], y: a[1], w: a[2], h: a[3] };
}

export function referenceLayout(state: StudioState, preset: PresetDef, ctx: CanvasRenderingContext2D): LayoutResult {
  setActiveFontStack(state.fontId);
  const c = referenceConfig(preset.id);
  const warnings: string[] = [];
  const originalTop = c.original[1];
  const originalW = c.original[2];
  const translationW = c.translation[2];
  const lineHeight = 1.2;
  const minOriginalPx = 32;
  const minTranslationPx = 28;
  const maxOriginalPx = state.typo.autoFit ? c.originalPx : state.typo.originalSize;
  const maxTranslationPx = state.typo.autoFit ? c.translationPx : state.typo.translationSize;
  const ratio = Math.max(1, state.typo.originalSizeRatio);

  const measurePair = (originalPx: number, translationPx: number) => {
    const original = measureAt(ctx, state.original, originalPx, originalW, lineHeight, 400);
    const wantedDividerY = c.separatorY
      ? Math.max(c.separatorY, originalTop + original.contentH + c.gapBeforeSeparator)
      : originalTop + original.contentH + c.gapBeforeSeparator;
    const dividerY = Math.min(wantedDividerY, c.bodyBottom - c.gapAfterSeparator);
    const translationTop = Math.max(c.translation[1], dividerY + c.gapAfterSeparator);
    const translation = measureAt(ctx, state.translation, translationPx, translationW, lineHeight, 400);
    const originalBoxBottom = dividerY - (c.separatorY ? c.gapBeforeSeparator : 0);
    const originalBoxH = Math.max(0, originalBoxBottom - originalTop);
    const translationBoxH = Math.max(0, c.bodyBottom - translationTop);
    return { original, translation, dividerY, translationTop, originalBoxH, translationBoxH };
  };

  let originalPx = maxOriginalPx;
  let translationPx = maxTranslationPx;
  let pair = measurePair(originalPx, translationPx);
  if (state.typo.autoFit) {
    // Scale both scripts together so the chosen size ratio stays intact while
    // the divider and translation start are allowed to move with the content.
    const steps = Math.max(1, Math.ceil(maxOriginalPx - minOriginalPx));
    for (let step = 0; step <= steps; step++) {
      const candidateOriginalPx = Math.max(minOriginalPx, maxOriginalPx - step);
      const candidateTranslationPx = Math.max(
        minTranslationPx,
        Math.min(maxTranslationPx, Math.round(candidateOriginalPx / ratio)),
      );
      const candidate = measurePair(candidateOriginalPx, candidateTranslationPx);
      if (candidate.original.contentH <= candidate.originalBoxH
          && candidate.translation.contentH <= candidate.translationBoxH) {
        originalPx = candidateOriginalPx;
        translationPx = candidateTranslationPx;
        pair = candidate;
        break;
      }
      originalPx = candidateOriginalPx;
      translationPx = candidateTranslationPx;
      pair = candidate;
    }
  }

  const originalFits = pair.original.contentH <= pair.originalBoxH
    && pair.dividerY <= c.bodyBottom - c.gapAfterSeparator;
  const translationFits = pair.translation.contentH <= pair.translationBoxH;
  const textFits = (lines: string[], px: number, width: number) => lines.every(line => {
    ctx.font = fontFor(px, 400);
    return ctx.measureText(line).width <= width + 0.5;
  });
  const originalFitsWidth = textFits(pair.original.lines, originalPx, originalW);
  const translationFitsWidth = textFits(pair.translation.lines, translationPx, translationW);
  const originalRect = rect([c.original[0], originalTop, originalW, pair.originalBoxH]);
  const translationRect = rect([c.translation[0], pair.translationTop, translationW, pair.translationBoxH]);
  const blocks: BlockLayout[] = [
    { heading: "", rect: originalRect, textRect: originalRect, headingPx: 0, headingBaseline: 0,
      dividerY: pair.dividerY, px: originalPx, ...pair.original,
      fits: originalFits && originalFitsWidth, overflowPx: Math.max(0, pair.original.contentH - pair.originalBoxH), vOffset: 0 },
    { heading: "", rect: translationRect, textRect: translationRect, headingPx: 0, headingBaseline: 0,
      dividerY: 0, px: translationPx, ...pair.translation,
      fits: translationFits && translationFitsWidth, overflowPx: Math.max(0, pair.translation.contentH - pair.translationBoxH), vOffset: 0 },
  ];
  if (!blocks[0].fits) warnings.push("Gurbani does not fit. Export is blocked; reduce both text sizes or use additional slides.");
  if (!blocks[1].fits) warnings.push("Translation does not fit. Export is blocked; reduce both text sizes or use additional slides.");
  return { w: preset.w, h: preset.h, unit: 1, pad: c.original[0], safeInset: 80, landscape: false,
    header: { align: "center", x: 0, w: 1080, anchorX: 540, l1Px: 0, l1Y: 0, l2Px: 0, l2Y: 0 },
    date: { rect: rect(c.date), px: 28, baseline: c.date[1] + c.date[3] * .75 },
    chips: [], blocks, footer: null, cornerLogo: null, warnings };
}

/** Reference PNGs preserve all fixed artwork. Clear every variable region before drawing new text. */
export function referenceComposite(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, id: string, layout: LayoutResult) {
  const c = referenceConfig(id);
  ctx.fillStyle = "#fbd58c";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (img) ctx.drawImage(img, 0, 0);
  // Clear the complete variable body so both text blocks and the separator
  // can be positioned from the measured content instead of fixed PSD boxes.
  ctx.fillStyle = "#fbd58c";
  ctx.fillRect(0, c.bodyTop, 1080, c.date[1] - c.bodyTop);
  if (id === "vertical" && img) {
    const dividerY = layout.blocks[0].dividerY;
    const crop = { x: 400, y: 956, w: 280, h: 36 };
    ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h,
      crop.x, dividerY - crop.h / 2, crop.w, crop.h);
  }
  ctx.fillStyle = "#ba0000";
  ctx.fillRect(c.stripe[0], c.stripe[1], c.stripe[2], c.stripe[3]);
  ctx.fillStyle = "#9d0000";
  ctx.fillRect(c.date[0], c.date[1], c.date[2], c.date[3]);
}

export function drawReference(ctx: CanvasRenderingContext2D, layout: LayoutResult, state: StudioState) {
  const c = referenceConfig(state.presetId);
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.shadowBlur = 0;
  const label = (text: string, x: number, y: number, maxW: number, cap: number, align: CanvasTextAlign) => {
    let px = cap;
    const segments: { text: string; gurmukhi: boolean }[] = [];
    for (const char of text) {
      const gurmukhi = /[\u0A00-\u0A7F]/u.test(char);
      const previous = segments.at(-1);
      if (previous?.gurmukhi === gurmukhi) previous.text += char;
      else segments.push({ text: char, gurmukhi });
    }
    const setSegmentFont = (gurmukhi: boolean) => {
      ctx.font = gurmukhi
        ? fontFor(px * 1.28, 400)
        : `400 ${px}px 'LEMON MILK', Arial, sans-serif`;
    };
    const measure = () => segments.reduce((width, segment) => {
      setSegmentFont(segment.gurmukhi);
      return width + ctx.measureText(segment.text).width;
    }, 0);
    while (measure() > maxW && px > 10) px -= 1;
    let cursor = align === "center" ? x - measure() / 2 : align === "right" ? x - measure() : x;
    ctx.textAlign = "left";
    for (const segment of segments) {
      setSegmentFont(segment.gurmukhi);
      ctx.fillText(segment.text, cursor, y);
      cursor += ctx.measureText(segment.text).width;
    }
  };
  ctx.fillStyle = "#fff";
  label(state.banikar.toUpperCase(), c.authorX, c.metaY, 690, c.metaPx, "left");
  label(`SGGS * ${state.ang}`, c.rightX, c.metaY, 230, c.metaPx, "right");
  const d = c.date;
  label(state.dateText.replace(/^🗓️\s*/, "").toUpperCase(), d[0] + d[2] / 2, d[1] + d[3] * .75, d[2] - 8, state.presetId === "feed" ? 24 : 30, "center");
  ctx.fillStyle = "#000";
  for (const b of layout.blocks) {
    ctx.save();
    ctx.beginPath(); ctx.rect(b.textRect.x, b.textRect.y, b.textRect.w, b.textRect.h); ctx.clip();
    ctx.font = fontFor(b.px, 400);
    b.lines.forEach((line, i) => drawLine(ctx, line, b.textRect.x, b.textRect.y + b.px * .9 + i * b.lineH,
      b.textRect.w, "center", state.typo.justify, i === b.lines.length - 1 || b.lines[i + 1] === ""));
    ctx.restore();
  }
  if (state.safeArea) {
    ctx.strokeStyle = "#1773d1"; ctx.lineWidth = 2; ctx.setLineDash([12, 8]);
    ctx.strokeRect(80, 80, layout.w - 160, layout.h - 160);
  }
  ctx.restore();
}
