/**
 * Pure layout engine. Given the studio state, an export preset and a
 * measuring context, it computes the position/size of every element on
 * the canvas — headers, date pill, meta chips, frosted text panels with
 * auto-fitted justified body text, and the branding footer.
 *
 * No drawing happens here, so the same result feeds both the on-screen
 * preview and the full-resolution exports (and the UI fit-status chips).
 */

import {
  HEADER_LINE_1,
  HEADER_LINE_2,
  PANEL_HEADING_ORIGINAL,
  PANEL_HEADING_TRANSLATION,
  SAFE_MARGIN,
  FIT_MAX_PX,
  FIT_MIN_PX,
  LOGO_ASPECT,
  fontFor,
  setActiveFontStack,
  type HeaderAlign,
  type PresetDef,
  type StudioState,
} from "./types";
import { fitOneLine, measureAt, wrapText } from "./text";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HeaderLayout {
  align: HeaderAlign;
  x: number;
  w: number;
  anchorX: number;
  l1Px: number;
  l1Y: number;
  l2Px: number;
  l2Y: number;
}

export interface DateLayout {
  rect: Rect;
  px: number;
  baseline: number;
}

export interface ChipLayout {
  rect: Rect;
  label: string;
  value: string;
  labelPx: number;
  valuePx: number;
  labelBaseline: number;
  valueBaseline: number;
}

export interface BlockLayout {
  heading: string;
  rect: Rect;
  textRect: Rect;
  headingPx: number;
  headingBaseline: number;
  dividerY: number;
  px: number;
  lines: string[];
  lineH: number;
  contentH: number;
  fits: boolean;
  overflowPx: number;
  vOffset: number;
}

export interface FooterLayout {
  main: string;
  mainPx: number;
  mainY: number;
  sub: string;
  subPx: number;
  subY: number;
  /** Where the logo image draws when logo.position === "footer"; null otherwise. */
  logoRect: Rect | null;
}

export interface LayoutResult {
  w: number;
  h: number;
  unit: number;
  pad: number;
  safeInset: number;
  landscape: boolean;
  header: HeaderLayout;
  date: DateLayout | null;
  chips: ChipLayout[];
  blocks: BlockLayout[];
  footer: FooterLayout | null;
  /** Corner watermark placement when logo.position is "corner-left"/"corner-right". */
  cornerLogo: Rect | null;
  warnings: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Builds the footer band (branding line + tagline), swapping in the logo image slot when enabled. */
function buildFooter(
  state: StudioState,
  w: number,
  availBottom: number,
  mainPx: number,
  mainYOff: number,
  subPx: number,
  subYOff: number
): FooterLayout | null {
  if (!state.footer) return null;
  const useLogo = state.logo.enabled && state.logo.position === "footer";
  const logoH = mainPx * 1.7 * clamp(state.logo.scale, 0.7, 1.6);
  const logoW = logoH * LOGO_ASPECT;
  const logoRect: Rect | null = useLogo
    ? { x: w / 2 - logoW / 2, y: availBottom + mainYOff - logoH * 0.82, w: logoW, h: logoH }
    : null;
  return {
    main: "🪯  SIKHIZM.COM  🪯",
    mainPx,
    mainY: availBottom + mainYOff,
    sub: "ਰੋਜ਼ਾਨਾ ਹੁਕਮਨਾਮਾ — ਸਾਝਾ ਕਰੋ",
    subPx,
    subY: availBottom + subYOff,
    logoRect,
  };
}

/** Corner watermark placement, independent of the footer band. */
function buildCornerLogo(state: StudioState, unit: number, w: number, h: number, pad: number): Rect | null {
  if (!state.logo.enabled || state.logo.position === "footer") return null;
  const logoH = 46 * unit * clamp(state.logo.scale, 0.7, 1.6);
  const logoW = logoH * LOGO_ASPECT;
  const x = state.logo.position === "corner-left" ? pad : w - pad - logoW;
  return { x, y: pad, w: logoW, h: logoH };
}

export function computeLayout(
  state: StudioState,
  preset: PresetDef,
  ctx: CanvasRenderingContext2D
): LayoutResult {
  setActiveFontStack(state.fontId);
  const { w, h } = preset;
  const landscape = w > h * 1.15;
  const unit = landscape ? h / 1080 : w / 1080;
  const pad = clamp(state.header.padding, 24, 200) * unit;
  const safeInset = SAFE_MARGIN * unit;
  const x0 = pad;
  const cw = w - pad * 2;
  const align = state.header.align;
  const anchorX = align === "center" ? x0 + cw / 2 : x0;

  const warnings: string[] = [];
  let cursor = pad + 6 * unit;

  /* ------------------------------------------------------------ header */
  const si = clamp(state.header.scale, 0.7, 1.35);
  const l1Px = fitOneLine(ctx, HEADER_LINE_1, 52 * unit * si, 16 * unit, cw, 800);
  const l1Y = cursor + l1Px * 1.02;
  cursor = l1Y + l1Px * 0.52;
  const l2Px = fitOneLine(ctx, HEADER_LINE_2, l1Px * 0.72, 13 * unit, cw, 600);
  const l2Y = cursor + l2Px * 0.96;
  cursor = l2Y + l2Px * 0.42 + 24 * unit;

  /* -------------------------------------------------------- date pill */
  const datePadX = 30 * unit;
  const dateMaxW = (landscape ? cw * 0.52 : cw) - datePadX * 2;
  const dpx = fitOneLine(ctx, state.dateText, 30 * unit, 11 * unit, dateMaxW, 700);
  ctx.font = fontFor(dpx, 700);
  const pillW = ctx.measureText(state.dateText).width + datePadX * 2;
  const pillH = dpx + 26 * unit;
  const pillX = align === "center" ? x0 + (cw - pillW) / 2 : x0;
  const dateLayout: DateLayout = {
    rect: { x: pillX, y: cursor, w: pillW, h: pillH },
    px: dpx,
    baseline: cursor + pillH / 2 + dpx * 0.36,
  };

  /* ----------------------------------------------------------- chips */
  const chipDefs = [
    { label: "ਬਾਣੀਕਾਰ", value: state.banikar },
    { label: "ਅੰਗ", value: state.ang },
  ];
  const chipGap = 14 * unit;
  const chipH = 66 * unit;
  const chipPadX = 22 * unit;
  const chipMaxTotal = landscape ? cw * 0.42 : cw;
  const chipMaxW = (chipMaxTotal - chipGap) / 2;

  const chipsRaw = chipDefs.map((c) => {
    const labelPx = 15 * unit;
    const valueMax = 25 * unit;
    const valuePx = fitOneLine(ctx, c.value, valueMax, 10 * unit, chipMaxW - chipPadX * 2, 700);
    ctx.font = fontFor(labelPx, 700);
    const wl = ctx.measureText(c.label).width;
    ctx.font = fontFor(valuePx, 700);
    const wv = ctx.measureText(c.value).width;
    const cwChip = clamp(Math.max(wl, wv) + chipPadX * 2, 0, chipMaxW);
    return { ...c, labelPx, valuePx, w: cwChip };
  });

  const buildChips = (rowY: number, rightAligned: boolean): ChipLayout[] => {
    const total = chipsRaw.reduce((s, c) => s + c.w, 0) + chipGap;
    let cx = rightAligned
      ? x0 + cw - total
      : align === "center"
        ? x0 + (cw - total) / 2
        : x0;
    return chipsRaw.map((c) => {
      const rect = { x: cx, y: rowY, w: c.w, h: chipH };
      cx += c.w + chipGap;
      const blockH = c.labelPx + 4 * unit + c.valuePx;
      const labelBaseline = rect.y + (rect.h - blockH) / 2 + c.labelPx * 0.92;
      return {
        rect,
        label: c.label,
        value: c.value,
        labelPx: c.labelPx,
        valuePx: c.valuePx,
        labelBaseline,
        valueBaseline: labelBaseline + 4 * unit + c.valuePx * 0.95,
      };
    });
  };

  /* ------------------------------------------------- footer reserve */
  const footH = state.footer ? 66 * unit : 0;
  const availBottom = h - pad - footH;

  /* ---------------------------------------------------- panel chrome */
  const panelGap = 18 * unit;
  const pPadX = landscape ? 22 * unit : 26 * unit;
  const pPadTop = 20 * unit;
  const headingPx = (landscape ? 24 : 26) * unit;
  const headingLineH = headingPx * 1.12;
  const dividerGap = 8 * unit;
  const textGap = 14 * unit;
  const pPadBottom = 20 * unit;
  const chromeH = pPadTop + headingLineH + dividerGap + textGap + pPadBottom;

  /* -------------------------------------------- shared panel sizing */
  const typo = state.typo;
  const lh = clamp(typo.lineHeight, 1.3, 1.95);
  const maxPx = FIT_MAX_PX * unit;
  const minPx = FIT_MIN_PX * unit;

  const blocks: BlockLayout[] = [];
  let availTop: number;

  if (!landscape) {
    /* ---------------- stacked date row, chip row, stacked panels ----- */
    let yy = cursor + dateLayout.rect.h + 16 * unit;
    const chips = buildChips(yy, false);
    yy += chipH + 20 * unit;
    availTop = yy;
    const availH = Math.max(80 * unit, availBottom - availTop);
    const textW = cw - pPadX * 2;

    let pxO: number; // original size
    let pxT: number; // translation size
    let r: { mO: any; mT: any; stackH: number };

    if (typo.autoFit) {
      // Auto-fit with ratio: start at maxPx for translation, apply ratio for original
      let basePx = maxPx;
      const ratio = clamp(typo.originalSizeRatio, 1.0, 2.0);
      
      const pass = (basePx: number) => {
        const pxT = basePx;
        const pxO = basePx * ratio;
        const mO = measureAt(ctx, state.original, pxO, textW, lh);
        const mT = measureAt(ctx, state.translation, pxT, textW, lh);
        return { pxO, pxT, mO, mT, stackH: chromeH * 2 + panelGap + mO.contentH + mT.contentH };
      };

      let result = pass(basePx);
      while (basePx > minPx && result.stackH > availH) {
        basePx -= 1;
        result = pass(basePx);
      }
      pxO = result.pxO;
      pxT = result.pxT;
      r = result;
    } else {
      // Manual sizing with separate original and translation sizes
      pxO = typo.originalSize * unit;
      pxT = typo.translationSize * unit;
      const mO = measureAt(ctx, state.original, pxO, textW, lh);
      const mT = measureAt(ctx, state.translation, pxT, textW, lh);
      r = { mO, mT, stackH: chromeH * 2 + panelGap + mO.contentH + mT.contentH };
    }

    let textHO = r.mO.contentH;
    let textHT = r.mT.contentH;
    let fitsO = true;
    let fitsT = true;
    let shift = 0;

    if (r.stackH <= availH) {
      shift = (availH - r.stackH) / 2;
    } else {
      const textAvail = Math.max(40 * unit, availH - chromeH * 2 - panelGap);
      const sum = Math.max(1, r.mO.contentH + r.mT.contentH);
      textHO = textAvail * (r.mO.contentH / sum);
      textHT = textAvail - textHO;
      fitsO = r.mO.contentH <= textHO + 0.5;
      fitsT = r.mT.contentH <= textHT + 0.5;
      if (!fitsO) warnings.push(`Original text overflows its panel by ${Math.round((r.mO.contentH - textHO) / unit)}px`);
      if (!fitsT) warnings.push(`Translation overflows its panel by ${Math.round((r.mT.contentH - textHT) / unit)}px`);
    }

    const mk = (
      heading: string,
      y: number,
      textH: number,
      content: { lines: string[]; lineH: number; contentH: number },
      fits: boolean,
      fontSize: number
    ): BlockLayout => {
      const rect: Rect = { x: x0, y, w: cw, h: chromeH + textH };
      const dividerY = rect.y + pPadTop + headingLineH + dividerGap;
      const textRect: Rect = {
        x: rect.x + pPadX,
        y: dividerY + textGap,
        w: textW,
        h: textH,
      };
      return {
        heading,
        rect,
        textRect,
        headingPx,
        headingBaseline: rect.y + pPadTop + headingPx * 0.92,
        dividerY,
        px: fontSize,
        lines: content.lines,
        lineH: content.lineH,
        contentH: content.contentH,
        fits,
        overflowPx: Math.max(0, content.contentH - textH),
        vOffset: fits ? Math.max(0, (textH - content.contentH) / 2) : 0,
      };
    };

    const y1 = availTop + shift;
    blocks.push(mk(PANEL_HEADING_ORIGINAL, y1, textHO, r.mO, fitsO, pxO));
    const y2 = y1 + chromeH + textHO + panelGap;
    blocks.push(mk(PANEL_HEADING_TRANSLATION, y2, textHT, r.mT, fitsT, pxT));

    return {
      w, h, unit, pad, safeInset, landscape,
      header: { align, x: x0, w: cw, anchorX, l1Px, l1Y, l2Px, l2Y },
      date: dateLayout,
      chips,
      blocks,
      footer: buildFooter(state, w, availBottom, 22 * unit, 36 * unit, 14 * unit, 58 * unit),
      cornerLogo: buildCornerLogo(state, unit, w, h, pad),
      warnings,
    };
  }

  /* ============================ LANDSCAPE =========================== */
  const rowH = Math.max(dateLayout.rect.h, chipH);
  const dateY = cursor + (rowH - dateLayout.rect.h) / 2;
  dateLayout.rect.y = dateY;
  dateLayout.rect.x = x0;
  dateLayout.baseline = dateY + dateLayout.rect.h / 2 + dpx * 0.36;
  const chips = buildChips(cursor + (rowH - chipH) / 2, true);
  cursor += rowH + 18 * unit;
  availTop = cursor;
  const availH = Math.max(60 * unit, availBottom - availTop);
  const panelW = (cw - panelGap) / 2;
  const textW = panelW - pPadX * 2;
  const textH = availH - chromeH;

  let px: number;
  let mO = { lines: [] as string[], lineH: 0, contentH: 0 };
  let mT = { lines: [] as string[], lineH: 0, contentH: 0 };

  if (typo.autoFit) {
    px = Math.floor(maxPx);
    while (true) {
      mO = measureAt(ctx, state.original, px, textW, lh);
      mT = measureAt(ctx, state.translation, px, textW, lh);
      if ((mO.contentH <= textH && mT.contentH <= textH) || px <= minPx) break;
      px -= 1;
    }
  } else {
    px = Math.max(8, typo.manualSize * unit);
    mO = measureAt(ctx, state.original, px, textW, lh);
    mT = measureAt(ctx, state.translation, px, textW, lh);
  }

  const fitsO = mO.contentH <= textH + 0.5;
  const fitsT = mT.contentH <= textH + 0.5;
  if (!fitsO) warnings.push(`Original text overflows its panel by ${Math.round((mO.contentH - textH) / unit)}px`);
  if (!fitsT) warnings.push(`Translation overflows its panel by ${Math.round((mT.contentH - textH) / unit)}px`);

  const mkLand = (
    heading: string,
    x: number,
    content: typeof mO,
    fits: boolean
  ): BlockLayout => {
    const rect: Rect = { x, y: availTop, w: panelW, h: availH };
    const dividerY = rect.y + pPadTop + headingLineH + dividerGap;
    return {
      heading,
      rect,
      textRect: { x: rect.x + pPadX, y: dividerY + textGap, w: textW, h: textH },
      headingPx,
      headingBaseline: rect.y + pPadTop + headingPx * 0.92,
      dividerY,
      px,
      lines: content.lines,
      lineH: content.lineH,
      contentH: content.contentH,
      fits,
      overflowPx: Math.max(0, content.contentH - textH),
      vOffset: fits ? Math.max(0, (textH - content.contentH) / 2) : 0,
    };
  };

  blocks.push(mkLand(PANEL_HEADING_ORIGINAL, x0, mO, fitsO));
  blocks.push(mkLand(PANEL_HEADING_TRANSLATION, x0 + panelW + panelGap, mT, fitsT));

  return {
    w, h, unit, pad, safeInset, landscape,
    header: { align, x: x0, w: cw, anchorX, l1Px, l1Y, l2Px, l2Y },
    date: dateLayout,
    chips,
    blocks,
    footer: buildFooter(state, w, availBottom, 20 * unit, 34 * unit, 13 * unit, 56 * unit),
    cornerLogo: buildCornerLogo(state, unit, w, h, pad),
    warnings,
  };
}
