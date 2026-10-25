import type { BlockLayout, LayoutResult, Rect } from "./layout";
import { drawLine, measureBalancedAt } from "./text";
import { fontFor, setActiveFontStack, type PresetDef, type StudioState } from "./types";

/** Coordinates measured from the supplied 1080×1350 and 1080×1920 artwork. */
export const REFERENCE = {
  feed: {
    src: "/images/templates/1080.png", stripe: [0, 343, 1080, 36],
    original: [39, 394, 1002, 326], translation: [41, 725, 998, 506],
    date: [379, 1256, 659, 60], originalPx: 53, translationPx: 38,
    bodyTop: 379, bodyBottom: 1231, separatorY: 0,
    gapBeforeSeparator: 22, gapAfterSeparator: 16,
    authorX: 41, metaY: 369, metaPx: 24, rightX: 1029,
  },
  vertical: {
    src: "/images/templates/1920.png", stripe: [0, 429, 1080, 54],
    original: [88, 508, 904, 420], translation: [88, 1037, 904, 546],
    date: [90, 1644, 902, 57], originalPx: 56, translationPx: 37,
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
  const minOriginalPx = 32;
  const minTranslationPx = 24;
  const ratio = Math.max(1.2, state.typo.originalSizeRatio);
  const availableH = c.bodyBottom - originalTop;
  const originalMeasures = new Map<number, ReturnType<typeof measureBalancedAt>>();
  const translationMeasures = new Map<number, ReturnType<typeof measureBalancedAt>>();
  const measurePair = (originalPx: number, translationPx: number, separator = true) => {
    const original = originalMeasures.get(originalPx) ?? measureBalancedAt(ctx, state.original, originalPx, originalW);
    const translation = translationMeasures.get(translationPx) ?? measureBalancedAt(ctx, state.translation, translationPx, translationW);
    originalMeasures.set(originalPx, original);
    translationMeasures.set(translationPx, translation);
    const gapBefore = separator ? 24 : 12;
    const gapAfter = separator ? 32 : 12;
    const dividerY = separator ? originalTop + original.contentH + gapBefore : 0;
    const translationTop = originalTop + original.contentH + gapBefore + gapAfter;
    const originalBoxH = Math.max(0, Math.min(original.contentH, availableH));
    const translationBoxH = Math.max(0, c.bodyBottom - translationTop);
    return { original, translation, dividerY, translationTop, originalBoxH, translationBoxH };
  };

  let originalPx = state.typo.originalSize;
  let translationPx = Math.min(state.typo.translationSize, originalPx - 4);
  let pair = measurePair(originalPx, translationPx);
  if (state.typo.autoFit) {
    let bestScore = -Infinity;
    // Fill the body with the largest readable pair, then penalize sparse final lines.
    // Try a separator-free layout as a fallback when its extra space improves fit.
    for (let px = 96; px >= minOriginalPx; px--) {
      const target = Math.round(px / ratio);
      for (let tp = Math.max(minTranslationPx, target - 4); tp <= Math.min(px - 4, target + 2); tp++) {
        for (const separator of [true, false]) {
          const candidate = measurePair(px, tp, separator);
          if (candidate.original.contentH > candidate.originalBoxH || candidate.translation.contentH > candidate.translationBoxH) continue;
          const fill = (candidate.translationTop + candidate.translation.contentH - originalTop) / availableH;
          const tails = Math.min(1, candidate.original.tailRatio / 0.8) + Math.min(1, candidate.translation.tailRatio / 0.8);
          const score = fill * 3 + px / 96 + tails * 1.4 + (separator ? 0.12 : 0);
          if (score > bestScore) { bestScore = score; originalPx = px; translationPx = tp; pair = candidate; }
        }
      }
    }
    if (bestScore === -Infinity) {
      originalPx = minOriginalPx;
      translationPx = minTranslationPx;
      pair = measurePair(originalPx, translationPx, false);
    }
  }

  const originalFits = pair.original.contentH <= pair.originalBoxH;
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
  if (id === "vertical" && img && layout.blocks[0].dividerY > 0) {
    const dividerY = layout.blocks[0].dividerY;
    const crop = { x: 400, y: 956, w: 280, h: 36 };
    ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h,
      crop.x, dividerY - crop.h / 2, crop.w, crop.h);
  }
  ctx.fillStyle = "#ba0000";
  ctx.fillRect(c.stripe[0], c.stripe[1], c.stripe[2], c.stripe[3]);
  ctx.fillStyle = "#9d0000";
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath(); ctx.roundRect(c.date[0], c.date[1], c.date[2], c.date[3], id === "feed" ? 14 : [0, 0, 14, 14]); ctx.fill();
  } else ctx.fillRect(c.date[0], c.date[1], c.date[2], c.date[3]);
}

export function drawReference(ctx: CanvasRenderingContext2D, layout: LayoutResult, state: StudioState) {
  const c = referenceConfig(state.presetId);
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.shadowBlur = 0;
  const label = (text: string, x: number, box: Rect, maxW: number, cap: number, align: CanvasTextAlign) => {
    let px = cap;
    const segments: { text: string; gurmukhi: boolean }[] = [];
    for (const char of text) {
      const gurmukhi = /[\u0A00-\u0A7F]/u.test(char);
      const previous = segments.at(-1);
      if (previous?.gurmukhi === gurmukhi) previous.text += char;
      else segments.push({ text: char, gurmukhi });
    }
    const setSegmentFont = (gurmukhi: boolean) => {
      ctx.font = gurmukhi ? fontFor(px * 1.28, 400) : `400 ${px}px 'LEMON MILK', Arial, sans-serif`;
    };
    const measure = () => {
      let width = 0, ascent = 0, descent = 0;
      for (const segment of segments) {
        setSegmentFont(segment.gurmukhi);
        const m = ctx.measureText(segment.text);
        width += m.width;
        ascent = Math.max(ascent, m.actualBoundingBoxAscent ?? px * 0.8);
        descent = Math.max(descent, m.actualBoundingBoxDescent ?? px * 0.2);
      }
      return { width, ascent, descent };
    };
    let metrics = measure();
    while ((metrics.width > maxW || metrics.ascent + metrics.descent > box.h - 12) && px > 10) { px--; metrics = measure(); }
    let cursor = align === "center" ? x - metrics.width / 2 : align === "right" ? x - metrics.width : x;
    const baseline = box.y + (box.h + metrics.ascent - metrics.descent) / 2;
    ctx.textAlign = "left";
    for (const segment of segments) {
      setSegmentFont(segment.gurmukhi);
      ctx.fillText(segment.text, cursor, baseline);
      cursor += ctx.measureText(segment.text).width;
    }
  };
  ctx.fillStyle = "#fff";
  const stripe = rect(c.stripe);
  label(state.banikar.toUpperCase(), c.authorX, stripe, 690, c.metaPx, "left");
  label(`SGGS * ${state.ang}`, c.rightX, stripe, 230, c.metaPx, "right");
  const d = rect(c.date);
  label(state.dateText.replace(/^🗓️\s*/, "").toUpperCase(), d.x + d.w / 2, d, d.w - 32, state.presetId === "feed" ? 24 : 30, "center");
  ctx.fillStyle = "#000";
  for (const b of layout.blocks) {
    ctx.save();
    ctx.beginPath(); ctx.rect(b.textRect.x, b.textRect.y, b.textRect.w, b.textRect.h); ctx.clip();
    ctx.font = fontFor(b.px, 400);
    b.lines.forEach((line, i) => drawLine(ctx, line, b.textRect.x, b.textRect.y + (b.ascent ?? b.px * .9) + i * b.lineH,
      b.textRect.w, "center", state.typo.justify, (i === b.lines.length - 1 && (ctx.measureText(line).width < b.textRect.w * 0.78 || line.split(/\s+/).length < 4)) || b.lines[i + 1] === ""));
    ctx.restore();
  }
  if (state.safeArea) {
    ctx.strokeStyle = "#1773d1"; ctx.lineWidth = 2; ctx.setLineDash([12, 8]);
    ctx.strokeRect(80, 80, layout.w - 160, layout.h - 160);
  }
  ctx.restore();
}
