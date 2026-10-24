/**
 * Canvas renderer for the Hukamnama artwork. Pure drawing — all geometry
 * comes from computeLayout(), so preview and every export preset share
 * identical output.
 */

import {
  HEADER_LINE_1,
  HEADER_LINE_2,
  fontFor,
  type StudioState,
} from "./types";
import { isReference, referenceComposite, drawReference } from "./reference";
import { drawLine } from "./text";
import type { LayoutResult, Rect } from "./layout";

const GOLD = "#f5c453";
const CREAM = "#fdf7ea";

/* ------------------------------------------------------------ helpers */

function rr(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  const rad = Math.min(radius, r.w / 2, r.h / 2);
  ctx.beginPath();
  ctx.moveTo(r.x + rad, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
  ctx.closePath();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = w / h;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (ir > cr) sw = sh * cr;
  else sh = sw / cr;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

/** Cheap high-quality frosted blur: extreme downscale + smooth upscale. */
function frostedRegion(
  composite: HTMLCanvasElement,
  rect: Rect,
  blurPx: number,
  out: CanvasRenderingContext2D
) {
  if (blurPx < 0.75) {
    out.drawImage(composite, rect.x, rect.y, rect.w, rect.h, rect.x, rect.y, rect.w, rect.h);
    return;
  }
  const pad = blurPx * 2;
  const sx = Math.max(0, rect.x - pad);
  const sy = Math.max(0, rect.y - pad);
  const sw = Math.min(composite.width - sx, rect.w + pad * 2);
  const sh = Math.min(composite.height - sy, rect.h + pad * 2);
  const scale = Math.max(1 / Math.max(6, blurPx * 1.4), 0.04);
  const tw = Math.max(2, Math.round(sw * scale));
  const th = Math.max(2, Math.round(sh * scale));
  const tmp = document.createElement("canvas");
  tmp.width = tw;
  tmp.height = th;
  const tctx = tmp.getContext("2d")!;
  tctx.imageSmoothingEnabled = true;
  tctx.imageSmoothingQuality = "high";
  // two-pass downscale => smoother gaussian-ish result
  tctx.drawImage(composite, sx, sy, sw, sh, 0, 0, tw * 1.6, th * 1.6);
  tctx.drawImage(tmp, 0, 0, tw * 1.6, th * 1.6, 0, 0, tw, th);
  out.imageSmoothingEnabled = true;
  out.imageSmoothingQuality = "high";
  out.drawImage(tmp, 0, 0, tw, th, sx, sy, sw, sh);
}

/* ----------------------------------------------------- bg composite */

/**
 * Builds the flattened background layer (photo cover-crop + dark overlay
 * + top/bottom gradients). Cached by the caller.
 */
/** Endpoints of a CSS-angle linear gradient line covering a w×h box. */
function angledGradientLine(w: number, h: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const len = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
  const cx = w / 2;
  const cy = h / 2;
  const dx = (Math.sin(rad) * len) / 2;
  const dy = (Math.cos(rad) * len) / 2;
  return { x1: cx - dx, y1: cy + dy, x2: cx + dx, y2: cy - dy };
}

export function buildComposite(
  w: number,
  h: number,
  state: StudioState,
  img: HTMLImageElement | null,
  layout: LayoutResult
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  if (isReference(state)) {
    referenceComposite(ctx, img, state.presetId, layout);
    return c;
  }

  if (state.bg.mode === "color") {
    ctx.fillStyle = state.bg.solidColor;
    ctx.fillRect(0, 0, w, h);
  } else if (state.bg.mode === "gradient") {
    const { x1, y1, x2, y2 } = angledGradientLine(w, h, state.bg.gradAngle);
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, state.bg.gradFrom);
    g.addColorStop(1, state.bg.gradTo);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (img && img.complete && img.naturalWidth > 0) {
    drawCover(ctx, img, w, h);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#101c3f");
    g.addColorStop(0.55, "#1b2a55");
    g.addColorStop(1, "#0a0f22");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rg = ctx.createRadialGradient(w / 2, h * 0.62, 0, w / 2, h * 0.62, w * 0.75);
    rg.addColorStop(0, "rgba(255,180,60,0.35)");
    rg.addColorStop(1, "rgba(255,180,60,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }

  if (state.bg.overlay > 0.001) {
    ctx.fillStyle = `rgba(4,7,15,${state.bg.overlay})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (state.bg.gradTop > 0.001) {
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.34);
    g.addColorStop(0, `rgba(2,4,10,${state.bg.gradTop})`);
    g.addColorStop(1, "rgba(2,4,10,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h * 0.34);
  }
  if (state.bg.gradBottom > 0.001) {
    const g = ctx.createLinearGradient(0, h * 0.6, 0, h);
    g.addColorStop(0, "rgba(2,4,10,0)");
    g.addColorStop(1, `rgba(2,4,10,${state.bg.gradBottom})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
  }
  return c;
}

/* --------------------------------------------------------- main draw */

export interface LogoImages {
  mark: HTMLImageElement | null;
  card: HTMLImageElement | null;
}

function drawLogoImg(
  ctx: CanvasRenderingContext2D,
  logos: LogoImages,
  variant: "mark" | "card",
  rect: Rect
) {
  const img = logos[variant];
  if (!img || !img.complete || img.naturalWidth === 0) return;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 10;
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

export function drawHukamnama(
  ctx: CanvasRenderingContext2D,
  layout: LayoutResult,
  state: StudioState,
  composite: HTMLCanvasElement,
  logos: LogoImages = { mark: null, card: null }
): void {
  const { w, h, unit } = layout;
  ctx.textBaseline = "alphabetic";
  ctx.drawImage(composite, 0, 0);
  if (isReference(state)) {
    drawReference(ctx, layout, state);
    return;
  }

  /* ------------------------------------------------------ header */
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = 14 * unit;
  ctx.shadowOffsetY = 2 * unit;
  ctx.textAlign = layout.header.align;
  ctx.font = fontFor(layout.header.l1Px, 800);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(HEADER_LINE_1, layout.header.anchorX, layout.header.l1Y);
  ctx.font = fontFor(layout.header.l2Px, 600);
  ctx.fillStyle = "#ffe2a6";
  ctx.fillText(HEADER_LINE_2, layout.header.anchorX, layout.header.l2Y);
  ctx.restore();

  /* ------------------------------------------------------ date pill */
  if (layout.date) {
    const d = layout.date;
    ctx.save();
    rr(ctx, d.rect, d.rect.h / 2);
    ctx.fillStyle = "rgba(48,34,10,0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(245,196,83,0.6)";
    ctx.lineWidth = 1.5 * unit;
    ctx.stroke();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 8 * unit;
    ctx.font = fontFor(d.px, 700);
    ctx.fillStyle = "#ffe6ad";
    ctx.textAlign = "center";
    ctx.fillText(state.dateText, d.rect.x + d.rect.w / 2, d.baseline);
    ctx.restore();
  }

  /* ------------------------------------------------------ meta chips */
  for (const chip of layout.chips) {
    ctx.save();
    rr(ctx, chip.rect, 16 * unit);
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1 * unit;
    ctx.stroke();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 5 * unit;
    ctx.textAlign = "center";
    const cxc = chip.rect.x + chip.rect.w / 2;
    ctx.font = fontFor(chip.labelPx, 700);
    ctx.fillStyle = GOLD;
    ctx.fillText(chip.label, cxc, chip.labelBaseline);
    ctx.font = fontFor(chip.valuePx, 700);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(chip.value, cxc, chip.valueBaseline);
    ctx.restore();
  }

  /* ------------------------------------------------------ text panels */
  for (const block of layout.blocks) {
    const radius = 26 * unit;
    ctx.save();
    rr(ctx, block.rect, radius);
    ctx.clip();
    frostedRegion(composite, block.rect, state.bg.panelBlur * unit, ctx);
    ctx.fillStyle = `rgba(8,12,24,${state.bg.panelOpacity})`;
    ctx.fillRect(block.rect.x, block.rect.y, block.rect.w, block.rect.h);
    // soft inner top highlight
    const sheen = ctx.createLinearGradient(0, block.rect.y, 0, block.rect.y + 90 * unit);
    sheen.addColorStop(0, "rgba(255,255,255,0.07)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(block.rect.x, block.rect.y, block.rect.w, 90 * unit);
    ctx.restore();

    // border + gold accent
    ctx.save();
    rr(ctx, block.rect, radius);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.25 * unit;
    ctx.stroke();
    const accW = block.rect.w * 0.42;
    const accX = block.rect.x + (block.rect.w - accW) / 2;
    const accY = block.rect.y + 1.5 * unit;
    const ag = ctx.createLinearGradient(accX, 0, accX + accW, 0);
    ag.addColorStop(0, "rgba(245,196,83,0)");
    ag.addColorStop(0.5, "rgba(245,196,83,0.85)");
    ag.addColorStop(1, "rgba(245,196,83,0)");
    rr(ctx, { x: accX, y: accY, w: accW, h: 3 * unit }, 2 * unit);
    ctx.fillStyle = ag;
    ctx.fill();
    ctx.restore();

    // heading + divider
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 6 * unit;
    ctx.font = fontFor(block.headingPx, 700);
    ctx.fillStyle = GOLD;
    ctx.textAlign = "center";
    ctx.fillText(block.heading, block.rect.x + block.rect.w / 2, block.headingBaseline);
    ctx.restore();

    ctx.save();
    const dg = ctx.createLinearGradient(block.textRect.x, 0, block.textRect.x + block.textRect.w, 0);
    dg.addColorStop(0, "rgba(245,196,83,0)");
    dg.addColorStop(0.25, "rgba(245,196,83,0.4)");
    dg.addColorStop(0.75, "rgba(245,196,83,0.4)");
    dg.addColorStop(1, "rgba(245,196,83,0)");
    ctx.strokeStyle = dg;
    ctx.lineWidth = 1 * unit;
    ctx.beginPath();
    ctx.moveTo(block.textRect.x, block.dividerY);
    ctx.lineTo(block.textRect.x + block.textRect.w, block.dividerY);
    ctx.stroke();
    ctx.restore();

    // body (justified, vertically centred, clipped to its box)
    ctx.save();
    rr(ctx, block.textRect, 4 * unit);
    ctx.clip();
    ctx.font = fontFor(block.px, 600);
    ctx.fillStyle = CREAM;
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 5 * unit;
    const justify = state.typo.justify;
    const align = state.header.align;
    
    // Calculate max lines that can fit
    const maxVisibleLines = Math.floor(block.textRect.h / block.lineH);
    
    block.lines.forEach((line, i) => {
      // Only render lines that fit within the box height
      if (i < maxVisibleLines) {
        const baseline = block.textRect.y + block.vOffset + i * block.lineH + block.px * 0.92;
        const paragraphEnd = i === block.lines.length - 1 || line.trim() === "";
        drawLine(
          ctx,
          line,
          block.textRect.x,
          baseline,
          block.textRect.w,
          align,
          justify,
          paragraphEnd
        );
      }
    });
    ctx.restore();
  }

  /* ------------------------------------------------------ footer */
  if (layout.footer) {
    const f = layout.footer;
    if (f.logoRect) {
      drawLogoImg(ctx, logos, state.logo.variant, f.logoRect);
    } else {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 8 * unit;
      ctx.textAlign = "center";
      ctx.font = fontFor(f.mainPx, 800);
      ctx.fillStyle = GOLD;
      const spaced = f.main;
      ctx.fillText(spaced, w / 2, f.mainY);
      ctx.restore();
    }
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 8 * unit;
    ctx.textAlign = "center";
    ctx.font = fontFor(f.subPx, 500);
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.fillText(f.sub, w / 2, f.subY);
    ctx.restore();
  }

  /* ------------------------------------------------------ corner logo */
  if (layout.cornerLogo) {
    drawLogoImg(ctx, logos, state.logo.variant, layout.cornerLogo);
  }

  /* -------------------------------------------------- safe-area guide */
  if (state.safeArea) {
    const s = layout.safeInset;
    ctx.save();
    ctx.strokeStyle = "rgba(255,196,60,0.9)";
    ctx.lineWidth = 2 * unit;
    ctx.setLineDash([14 * unit, 10 * unit]);
    ctx.strokeRect(s, s, w - 2 * s, h - 2 * s);
    ctx.setLineDash([]);
    const label = `SAFE AREA · ${Math.round(s / unit)}px`;
    const lpx = 16 * unit;
    ctx.font = fontFor(lpx, 700);
    const tw = ctx.measureText(label).width;
    const chipR: Rect = { x: s + 10 * unit, y: s + 10 * unit, w: tw + 24 * unit, h: lpx + 18 * unit };
    rr(ctx, chipR, chipR.h / 2);
    ctx.fillStyle = "rgba(255,196,60,0.95)";
    ctx.fill();
    ctx.fillStyle = "#161003";
    ctx.textAlign = "left";
    ctx.fillText(label, chipR.x + 12 * unit, chipR.y + chipR.h / 2 + lpx * 0.36);
    ctx.restore();
  }
}

