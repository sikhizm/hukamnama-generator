import type { BlockLayout, LayoutResult, Rect } from "./layout";
import { drawLine, measureAt } from "./text";
import { fontFor, setActiveFontStack, type PresetDef, type StudioState } from "./types";

/** Coordinates measured from the supplied 1080×1350 and 1080×1920 artwork. */
export const REFERENCE = {
  feed: {
    src: "/images/templates/1080.png", stripe: [0, 343, 1080, 36],
    original: [39, 394, 1002, 326], translation: [41, 725, 998, 506],
    date: [390, 1268, 640, 38], originalPx: 53, translationPx: 38,
    authorX: 41, metaY: 369, metaPx: 24, rightX: 1029,
  },
  vertical: {
    src: "/images/templates/1920.png", stripe: [0, 429, 1080, 54],
    original: [88, 508, 904, 420], translation: [88, 1037, 904, 546],
    date: [140, 1645, 802, 45], originalPx: 56, translationPx: 37,
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
  const blocks = [state.original, state.translation].map((text, i): BlockLayout => {
    const box = rect(i === 0 ? c.original : c.translation);
    const cap = i === 0 ? c.originalPx : c.translationPx;
    let px = state.typo.autoFit ? cap : (i === 0 ? state.typo.originalSize : state.typo.translationSize);
    // Match the PSD's regular weight and compact leading; never reduce below readable bounds.
    const leading = 1.2;
    const minimum = i === 0 ? 32 : 28;
    let m = measureAt(ctx, text, px, box.w, leading, 400);
    while (state.typo.autoFit && m.contentH > box.h && px > minimum) {
      px -= 1;
      m = measureAt(ctx, text, px, box.w, leading, 400);
    }
    const fits = m.contentH <= box.h && m.lines.every(line => {
      ctx.font = fontFor(px, 400);
      return ctx.measureText(line).width <= box.w + 0.5;
    });
    if (!fits) warnings.push(`${i === 0 ? "Gurbani" : "Translation"} does not fit. Export is blocked; use additional slides or edit the layout.`);
    return { heading: "", rect: box, textRect: box, headingPx: 0, headingBaseline: 0,
      dividerY: 0, px, ...m, fits, overflowPx: Math.max(0, m.contentH - box.h), vOffset: 0 };
  });
  return { w: preset.w, h: preset.h, unit: 1, pad: c.original[0], safeInset: 80, landscape: false,
    header: { align: "center", x: 0, w: 1080, anchorX: 540, l1Px: 0, l1Y: 0, l2Px: 0, l2Y: 0 },
    date: { rect: rect(c.date), px: 28, baseline: c.date[1] + c.date[3] * .75 },
    chips: [], blocks, footer: null, cornerLogo: null, warnings };
}

/** Reference PNGs preserve all fixed artwork. Clear every variable region before drawing new text. */
export function referenceComposite(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, id: string) {
  const c = referenceConfig(id);
  ctx.fillStyle = "#fbd58c";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (img) ctx.drawImage(img, 0, 0);
  // Clear full body areas, including glyphs outside the PSD text bounding boxes.
  ctx.fillStyle = "#fbd58c";
  if (id === "feed") ctx.fillRect(0, 379, 1080, 865);
  else {
    ctx.fillRect(0, 483, 1080, 467);
    ctx.fillRect(0, 1005, 1080, 610);
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
