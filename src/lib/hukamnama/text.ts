/**
 * Canvas text primitives: wrapping, measurement, auto-fit sizing and
 * justified drawing. All functions work on a measure/render 2D context
 * with the ChatrikUni font stack.
 */

import { fontFor } from "./types";

export type HAlign = "left" | "center";

/** Word-wrap `text` at `px` so no line exceeds `maxW`. Hard-breaks long tokens. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  px: number,
  maxW: number,
  weight: 400 | 500 | 600 | 700 | 800 = 600
): string[] {
  ctx.font = fontFor(px, weight);
  const out: string[] = [];
  const paras = text.replace(/\r/g, "").split("\n");
  for (const para of paras) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      if (ctx.measureText(word).width > maxW) {
        if (line) {
          out.push(line);
          line = "";
        }
        // Keep vowel signs and combining marks attached to their Gurmukhi grapheme.
        let chunk = "";
        for (const { segment: ch } of new Intl.Segmenter("pa", { granularity: "grapheme" }).segment(word)) {
          if (chunk && ctx.measureText(chunk + ch).width > maxW) {
            out.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
        continue;
      }
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxW) {
        out.push(line);
        line = word;
      } else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

export interface MeasuredBlock {
  lines: string[];
  lineH: number;
  contentH: number;
}

export function measureAt(
  ctx: CanvasRenderingContext2D,
  text: string,
  px: number,
  maxW: number,
  lineHeight: number,
  weight: 400 | 500 | 600 | 700 | 800 = 600
): MeasuredBlock {
  const lines = wrapText(ctx, text, px, maxW, weight);
  const lineH = px * lineHeight;
  return { lines, lineH, contentH: lines.length * lineH };
}

/** Binary search: largest px ≤ capPx that keeps `text` on one line within maxW. */
export function fitOneLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  capPx: number,
  minPx: number,
  maxW: number,
  weight: 400 | 500 | 600 | 700 | 800 = 700
): number {
  const fits = (px: number) => {
    ctx.font = fontFor(px, weight);
    return ctx.measureText(text).width <= maxW;
  };
  if (fits(capPx)) return capPx;
  let lo = minPx;
  let hi = capPx;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Auto-fit a block: start at maxPx and reduce 1px at a time until the
 * wrapped text height fits in maxH. Never goes below minPx.
 */
export function fitBlockPx(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxH: number,
  maxPx: number,
  minPx: number,
  lineHeight: number,
  weight: 400 | 500 | 600 | 700 | 800 = 600
): { px: number; lines: string[]; lineH: number; contentH: number; fits: boolean } {
  for (let px = Math.floor(maxPx); px >= Math.ceil(minPx); px--) {
    const m = measureAt(ctx, text, px, maxW, lineHeight, weight);
    if (m.contentH <= maxH + 0.5) return { px, ...m, fits: true };
  }
  const m = measureAt(ctx, text, Math.ceil(minPx), maxW, lineHeight, weight);
  return { px: Math.ceil(minPx), ...m, fits: false };
}

/**
 * Draw one wrapped line. When `justify` is on (and the line has 2+ words
 * and is not the paragraph-final line), extra space is distributed
 * between words so both edges align flush.
 */
export function drawLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  baseline: number,
  maxW: number,
  align: HAlign,
  justify: boolean,
  isLast: boolean
): void {
  if (!line.trim()) return;
  const words = line.split(/\s+/).filter(Boolean);
  const anchor = align === "center" ? x + maxW / 2 : x;

  if (!justify || isLast || words.length < 2) {
    ctx.textAlign = align;
    ctx.fillText(line, anchor, baseline);
    return;
  }

  const wordsW = words.reduce((s, w) => s + ctx.measureText(w).width, 0);
  const gap = Math.max(0, (maxW - wordsW) / (words.length - 1));
  if (gap > maxW * 0.12) {
    // pathological sparse line — fall back to natural alignment
    ctx.textAlign = align;
    ctx.fillText(line, anchor, baseline);
    return;
  }
  ctx.textAlign = "left";
  let cx = x;
  for (const w of words) {
    ctx.fillText(w, cx, baseline);
    cx += ctx.measureText(w).width + gap;
  }
}


/** Balance the last two lines of each paragraph without changing any words or markers. */
export function measureBalancedAt(ctx: CanvasRenderingContext2D, text: string, px: number, maxW: number) {
  ctx.font = fontFor(px, 400);
  const lines = text.replace(/\r/g, "").split("\n").flatMap(paragraph => {
    const wrapped = wrapText(ctx, paragraph, px, maxW, 400);
    if (wrapped.length < 2) return wrapped;
    const last = wrapped.at(-1)!;
    if (ctx.measureText(last).width >= maxW * 0.78) return wrapped;
    const words = `${wrapped.at(-2)} ${last}`.split(/\s+/).filter(Boolean);
    let best: [string, string] | null = null, score = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
      const aw = ctx.measureText(a).width, bw = ctx.measureText(b).width;
      if (aw > maxW || bw > maxW || /^[॥।੦-੯0-9\s]+$/u.test(b)) continue;
      const candidate = Math.pow(1 - aw / maxW, 2) + Math.pow(1 - bw / maxW, 2) * 1.5;
      if (candidate < score) { best = [a, b]; score = candidate; }
    }
    if (best) wrapped.splice(-2, 2, ...best);
    return wrapped;
  });
  const metrics = lines.map(line => ctx.measureText(line));
  const ascent = Math.max(px * 0.8, ...metrics.map(m => m.actualBoundingBoxAscent ?? px * 0.9));
  const descent = Math.max(px * 0.15, ...metrics.map(m => m.actualBoundingBoxDescent ?? px * 0.2));
  const lineH = Math.max(px * 1.2, ascent + descent + 2);
  const contentH = lines.length ? ascent + descent + (lines.length - 1) * lineH : 0;
  const lastWidth = ctx.measureText(lines.at(-1) ?? "").width;
  return { lines, lineH, contentH, ascent, tailRatio: lastWidth / maxW };
}
