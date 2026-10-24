/**
 * Shared types + constants for the Hukamnama Studio.
 */

export interface PresetDef {
  id: string;
  label: string;
  ratio: string;
  w: number;
  h: number;
  platforms: string[];
}

export const PRESETS: PresetDef[] = [
  {
    id: "vertical",
    label: "Vertical",
    ratio: "9:16",
    w: 1080,
    h: 1920,
    platforms: ["Instagram Reels", "YouTube Shorts", "WhatsApp Channel", "WhatsApp Group"],
  },
  {
    id: "square",
    label: "Square",
    ratio: "1:1",
    w: 1080,
    h: 1080,
    platforms: ["Facebook Post", "WhatsApp Group"],
  },
  {
    id: "feed",
    label: "Feed Portrait",
    ratio: "4:5",
    w: 1080,
    h: 1350,
    platforms: ["Instagram Post", "Facebook Post", "LinkedIn"],
  },
  {
    id: "link",
    label: "Landscape",
    ratio: "1.91:1",
    w: 1200,
    h: 630,
    platforms: ["Facebook Link Post", "Facebook Share"],
  },
  {
    id: "wide",
    label: "Widescreen",
    ratio: "16:9",
    w: 1920,
    h: 1080,
    platforms: ["YouTube", "Facebook Cover"],
  },
];

export function getPreset(id: string): PresetDef {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/** Safe-area guide inset, in device pixels at 1080-reference (scaled by unit per preset). */
export const SAFE_MARGIN = 80;

/** Auto-fit bounds (px at 1080-reference — multiplied by the layout unit). */
export const FIT_MAX_PX = 44;
export const FIT_MIN_PX = 18;

export type HeaderAlign = "center" | "left";

/** Which kind of backdrop fills the canvas before overlays/panels are drawn. */
export type BgMode = "image" | "color" | "gradient";

export interface BgSettings {
  /** Backdrop type: photo cover-crop, flat color, or a two-stop gradient. */
  mode: BgMode;
  /** Custom uploaded image (object/data URL). null → default Golden Temple photo. */
  dataUrl: string | null;
  /** Flat background color, used when mode === "color". */
  solidColor: string;
  /** Gradient start color, used when mode === "gradient". */
  gradFrom: string;
  /** Gradient end color, used when mode === "gradient". */
  gradTo: string;
  /** Gradient angle in degrees (CSS convention: 0 = bottom→top, 180 = top→bottom). */
  gradAngle: number;
  /** Dark overlay opacity 0–0.85. */
  overlay: number;
  /** Top gradient strength 0–0.9. */
  gradTop: number;
  /** Bottom gradient strength 0–0.9. */
  gradBottom: number;
  /** Panel fill opacity 0.15–0.92. */
  panelOpacity: number;
  /** Frosted-glass blur radius behind panels 0–24. */
  panelBlur: number;
}

/* ------------------------------------------------------------------ */
/* Logo / branding mark                                                */
/* ------------------------------------------------------------------ */

/** "mark" = transparent Khanda + wordmark. "card" = same mark on a white pill/plate. */
export type LogoVariant = "mark" | "card";
export type LogoPosition = "footer" | "corner-left" | "corner-right";

export interface LogoSettings {
  enabled: boolean;
  variant: LogoVariant;
  position: LogoPosition;
  /** Size multiplier 0.7–1.6. */
  scale: number;
}

/** Native aspect ratio (w/h) of the sikhizm.com logo artwork. */
export const LOGO_ASPECT = 600 / 161;

export const LOGO_SRC: Record<LogoVariant, string> = {
  mark: "/images/logo-mark.png",
  card: "/images/logo-card.png",
};

export interface HeaderSettings {
  align: HeaderAlign;
  /** Header font scale 0.7–1.35. */
  scale: number;
  /** Layout inset / side padding, px at 1080-ref, 40–160. */
  padding: number;
}

export interface TypoSettings {
  justify: boolean;
  autoFit: boolean;
  /** Manual font size (px at 1080-ref) used when autoFit is off. */
  manualSize: number;
  /** Manual font size for original/Mool Hukamnama (px at 1080-ref). */
  originalSize: number;
  /** Manual font size for translation (px at 1080-ref). */
  translationSize: number;
  /** Ratio multiplier for original vs translation when autoFit is on (1.0–2.0). */
  originalSizeRatio: number;
  /** Line-height multiplier 1.3–1.9. */
  lineHeight: number;
}

export interface StudioState {
  design: "reference";
  presetId: string;
  safeArea: boolean;
  bg: BgSettings;
  header: HeaderSettings;
  dateISO: string;
  dateManual: boolean;
  dateText: string;
  banikar: string;
  ang: string;
  original: string;
  translation: string;
  typo: TypoSettings;
  /** Show sikhizm.com branding footer band (reserves vertical space). */
  footer: boolean;
  /** Which Gurmukhi typeface renders all on-canvas text. */
  fontId: FontId;
  /** sikhizm.com logo mark placement. */
  logo: LogoSettings;
}

/* ------------------------------------------------------------------ */
/* Fixed (non-editable) header strings — always rendered on the image. */
/* ------------------------------------------------------------------ */

export const HEADER_LINE_1 = "🪯 ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਹਿ 🪯";
export const HEADER_LINE_2 =
  "🌸 ਅੱਜ ਦਾ ਹੁਕਮਨਾਮਾ, ਸ਼੍ਰੀ ਦਰਬਾਰ ਸਾਹਿਬ, ਹਰਿਮੰਦਿਰ ਸਾਹਿਬ, ਅੰਮ੍ਰਿਤਸਰ 🌸";

export const PANEL_HEADING_ORIGINAL = "📜 ਮੂਲ ਹੁਕਮਨਾਮਾ";
export const PANEL_HEADING_TRANSLATION = "🗒️ ਪੰਜਾਬੀ ਅਨੁਵਾਦ";

/* ------------------------------------------------------------------ */
/* Fonts — pick one Gurmukhi typeface; graceful Gurmukhi + emoji       */
/* fallbacks always follow it.                                        */
/* ------------------------------------------------------------------ */

export type FontId = "chatrikuni" | "tiro" | "notoserif" | "ucsb";

export interface FontDef {
  id: FontId;
  label: string;
  /** CSS font-family name used both in @font-face / Google Fonts import and in canvas. */
  family: string;
  /** Short style tag shown in the picker. */
  tag: string;
  /** True when the app must load this from a local file (public/fonts/ or user upload). */
  requiresFile: boolean;
  /** Expected filename(s) under public/fonts/ when requiresFile is true. */
  fileHint?: string;
}

export const FONT_OPTIONS: FontDef[] = [
  {
    id: "chatrikuni",
    label: "ChatrikUni",
    family: "ChatrikUni",
    tag: "Brand",
    requiresFile: true,
    fileHint: "ChatrikUni.ttf / .otf",
  },
  {
    id: "tiro",
    label: "Tiro Gurmukhi",
    family: "Tiro Gurmukhi",
    tag: "Google Fonts",
    requiresFile: false,
  },
  {
    id: "notoserif",
    label: "Noto Serif Gurmukhi",
    family: "Noto Serif Gurmukhi",
    tag: "Google Fonts",
    requiresFile: false,
  },
  {
    id: "ucsb",
    label: "Gurmukhi-UCSB-Uni",
    family: "Gurmukhi-UCSB-Uni",
    tag: "Classic",
    requiresFile: true,
    fileHint: "Gurmukhi-UCSB-Uni.ttf",
  },
];

export function getFontDef(id: FontId): FontDef {
  return FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[0];
}

export function fontStackFor(id: FontId): string {
  const def = getFontDef(id);
  return [
    `'${def.family}'`,
    "'Noto Sans Gurmukhi'",
    "'Raavi'",
    "'Mukta Mahee'",
    "'Nirmala UI'",
    "'Noto Color Emoji'",
    "'Apple Color Emoji'",
    "'Segoe UI Emoji'",
    "sans-serif",
  ].join(", ");
}

/** Default fallback stack (ChatrikUni), used until the first computeLayout() call sets it. */
let ACTIVE_FONT_STACK = fontStackFor("chatrikuni");

/** Called once per layout/render pass — every subsequent fontFor() in this pass uses it. */
export function setActiveFontStack(id: FontId): void {
  ACTIVE_FONT_STACK = fontStackFor(id);
}

export function fontFor(px: number, weight: 400 | 500 | 600 | 700 | 800 = 700): string {
  return `${weight} ${Math.max(1, Math.round(px))}px ${ACTIVE_FONT_STACK}`;
}

