"use client";

import { splitIntroduction, joinIntroduction } from "@/lib/hukamnama/introduction";

import {
  Proportions,
  Image as ImageIcon,
  Palette,
  Blend,
  CaseSensitive,
  CalendarDays,
  BookOpen,
  ScrollText,
  SlidersHorizontal,
  BadgeCheck,
  Type,
  AlignCenter,
  AlignLeft,
  Upload,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  CircleCheck,
  LoaderCircle,
  Delete,
  Lock,
  PanelBottom,
  CornerUpLeft,
  CornerUpRight,
} from "lucide-react";
import { useState } from "react";
import { publishedSgpcDate } from "@/lib/hukamnama/sgpcCalendar";
import { formatSgpcCalendarDate } from "@/lib/hukamnama/sgpcDate";
import { AUTHOR_OPTIONS, normalizeAuthor } from "@/lib/hukamnama/authors";
import { Section, SliderRow, ToggleRow, SegRow, FieldLabel, TextInput, TextArea } from "./controls";
import {
  PRESETS,
  FIT_MAX_PX,
  FIT_MIN_PX,
  FONT_OPTIONS,
  LOGO_SRC,
  HEADER_LINE_2,
  PANEL_HEADING_ORIGINAL,
  PANEL_HEADING_TRANSLATION,
  getFontDef,
  type BgSettings,
  type HeaderSettings,
  type LogoSettings,
  type StudioState,
  type TypoSettings,
} from "@/lib/hukamnama/types";
import type { LayoutResult } from "@/lib/hukamnama/layout";
import { formatHukamDate, isoToDate } from "@/lib/hukamnama/punjabiDate";

export type FontStatus = "checking" | "ready" | "missing";

export interface PanelProps {
  state: StudioState;
  layout: LayoutResult | null;
  patch: (p: Partial<StudioState>) => void;
  patchBg: (p: Partial<BgSettings>) => void;
  patchHeader: (p: Partial<HeaderSettings>) => void;
  patchTypo: (p: Partial<TypoSettings>) => void;
  patchLogo: (p: Partial<LogoSettings>) => void;
  fontStatus: FontStatus;
  fontCustom: boolean;
  strictFont: boolean;
  setStrictFont: (v: boolean) => void;
  onPickFont: () => void;
  onUploadBg: () => void;
  onResetBg: () => void;
}

/* ----------------------------------------------------- font section */

export function FontSection(p: PanelProps) {
  const { state, patch, fontStatus, fontCustom } = p;
  const def = getFontDef(state.fontId);
  return (
    <Section
      icon={Type}
      title="Font"
      subtitle={fontStatus === "ready" ? `${def.label} active` : `${def.label} — export requires this font`}
    >
      <div className="grid grid-cols-2 gap-2">
        {FONT_OPTIONS.map((f) => {
          const active = f.id === state.fontId;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => patch({ fontId: f.id })}
              className={`rounded-xl border p-2.5 text-left transition ${
                active
                  ? "border-amber-300/60 bg-amber-400/[0.09]"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.045]"
              }`}
            >
              <div
                className={`font-pa truncate text-[13px] font-semibold ${
                  active ? "text-amber-200" : "text-zinc-300"
                }`}
                style={{ fontFamily: `'${f.family}', 'Noto Sans Gurmukhi', sans-serif` }}
              >
                ਸਤਿ ਨਾਮੁ
              </div>
              <div className="mt-1 truncate text-[10.5px] font-medium text-zinc-300">{f.label}</div>
              <div className="mt-0.5 text-[9px] text-zinc-600">{f.tag}</div>
            </button>
          );
        })}
      </div>

      {fontStatus === "ready" ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2.5">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-300" />
          <div className="text-[11px] leading-snug text-emerald-200/90">
            <span className="font-semibold text-emerald-200">{def.label} active</span>
            {def.requiresFile
              ? fontCustom
                ? " — loaded from your uploaded file."
                : ` — loaded from /fonts/${def.family}.`
              : " — loaded from Google Fonts."}
            <span className="mt-0.5 block text-emerald-200/60">All Gurmukhi text renders in this typeface.</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-400/25 bg-amber-400/[0.08] px-3 py-2.5">
            {fontStatus === "checking" ? (
              <LoaderCircle size={15} className="mt-0.5 shrink-0 animate-spin text-amber-300" />
            ) : (
              <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber-300" />
            )}
            <div className="text-[11px] leading-snug text-amber-100/90">
              {fontStatus === "checking" ? (
                `Detecting ${def.label}…`
              ) : def.requiresFile ? (
                <>
                  <span className="font-semibold text-amber-200">{def.label} not found.</span>
                  <span className="block">
                    Place <span className="font-mono">{def.fileHint}</span> in{" "}
                    <span className="font-mono">public/fonts/</span>, or load it now:
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-amber-200">{def.label} not found.</span>
                  <span className="block">Couldn&apos;t load it from Google Fonts — check your connection.</span>
                </>
              )}
            </div>
          </div>
          {fontStatus === "missing" && def.requiresFile && (
            <button
              type="button"
              onClick={p.onPickFont}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300/40 bg-amber-400/15 px-3 py-2 text-[11.5px] font-semibold text-amber-200 transition hover:bg-amber-400/25"
            >
              <Upload size={13} /> Load {def.label} .ttf / .otf
            </button>
          )}
        </div>
      )}
      <ToggleRow
        label="Require this font for export"
        desc="Keeps PNG/JPG export locked until the selected font is available. Turn off to allow a clearly-marked fallback (Noto Sans Gurmukhi)."
        checked={p.strictFont}
        onChange={p.setStrictFont}
      />
    </Section>
  );
}

/* --------------------------------------------------- preset section */

export function PresetSection(p: PanelProps) {
  const { state, patch } = p;
  return (
    <Section icon={Proportions} title="Export preset" subtitle="Platform size for PNG / JPG output">
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((pr) => {
          const active = pr.id === state.presetId;
          const ar = pr.w / pr.h;
          const boxW = 34 * Math.min(1, ar);
          const boxH = 34 * Math.min(1, 1 / ar);
          return (
            <button
              key={pr.id}
              type="button"
              onClick={() => patch({ presetId: pr.id })}
              className={`group rounded-xl border p-2.5 text-left transition ${
                active
                  ? "border-amber-300/60 bg-amber-400/[0.09]"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.045]"
              }`}
            >
              <div className="mb-2 flex h-9 items-center justify-center">
                <span
                  style={{ width: boxW, height: boxH }}
                  className={`rounded-[3px] border transition ${
                    active
                      ? "border-amber-300/80 bg-amber-300/25"
                      : "border-zinc-600 bg-zinc-700/30 group-hover:border-zinc-500"
                  }`}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-semibold ${active ? "text-amber-200" : "text-zinc-300"}`}>
                  {pr.label}
                </span>
                <span className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[9px] text-zinc-400">
                  {pr.ratio}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[9.5px] text-zinc-500">
                {pr.w} × {pr.h}
              </div>
              <div className="mt-1 line-clamp-1 text-[9px] leading-tight text-zinc-600">
                {pr.platforms.join(" · ")}
              </div>
            </button>
          );
        })}
      </div>
      <ToggleRow
        label="Safe-area guide (80px)"
        desc="Dashed overlay so text is never cropped by platform UI chrome."
        checked={state.safeArea}
        onChange={(v) => patch({ safeArea: v })}
      />
    </Section>
  );
}

/* ----------------------------------------------- background section */

export function BackgroundSection(p: PanelProps) {
  const { state, patchBg } = p;
  const custom = !!state.bg.dataUrl;
  const mode = state.bg.mode;
  return (
    <Section icon={ImageIcon} title="Background" subtitle="Photo, flat color, or gradient backdrop">
      <SegRow
        options={[
          { value: "image", label: "Photo", icon: ImageIcon },
          { value: "color", label: "Color", icon: Palette },
          { value: "gradient", label: "Gradient", icon: Blend },
        ]}
        value={mode}
        onChange={(v) => patchBg({ mode: v })}
      />

      {mode === "image" && (
        <>
          <div className="relative h-16 overflow-hidden rounded-lg border border-white/[0.08]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.bg.dataUrl ?? "/images/golden-temple.jpg"}
              alt="Background preview"
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-amber-200">
              {custom ? "Custom photo" : "Default — Golden Temple"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={p.onUploadBg}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] px-2 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/[0.08]"
            >
              <Upload size={12} /> Upload photo
            </button>
            {custom && (
              <button
                type="button"
                onClick={p.onResetBg}
                title="Reset to default photo"
                className="grid place-items-center rounded-lg border border-white/[0.09] bg-white/[0.04] px-2.5 text-zinc-300 transition hover:bg-white/[0.08]"
              >
                <RotateCcw size={12} />
              </button>
            )}
          </div>
        </>
      )}

      {mode === "color" && (
        <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
          <input
            type="color"
            value={state.bg.solidColor}
            onChange={(e) => patchBg({ solidColor: e.target.value })}
            className="h-9 w-12 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent"
          />
          <div className="min-w-0 flex-1">
            <FieldLabel>Background color</FieldLabel>
            <TextInput mono value={state.bg.solidColor} onChange={(v) => patchBg({ solidColor: v })} />
          </div>
        </div>
      )}

      {mode === "gradient" && (
        <div className="space-y-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={state.bg.gradFrom}
              onChange={(e) => patchBg({ gradFrom: e.target.value })}
              className="h-9 w-12 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent"
            />
            <div className="min-w-0 flex-1">
              <FieldLabel>Gradient start</FieldLabel>
              <TextInput mono value={state.bg.gradFrom} onChange={(v) => patchBg({ gradFrom: v })} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={state.bg.gradTo}
              onChange={(e) => patchBg({ gradTo: e.target.value })}
              className="h-9 w-12 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent"
            />
            <div className="min-w-0 flex-1">
              <FieldLabel>Gradient end</FieldLabel>
              <TextInput mono value={state.bg.gradTo} onChange={(v) => patchBg({ gradTo: v })} />
            </div>
          </div>
          <SliderRow label="Gradient angle" value={state.bg.gradAngle} min={0} max={360} step={1}
            format={(v) => `${Math.round(v)}°`} onChange={(v) => patchBg({ gradAngle: v })} />
        </div>
      )}

      <SliderRow label="Dark overlay" value={state.bg.overlay} min={0} max={0.85} step={0.01}
        format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchBg({ overlay: v })} />
      <SliderRow label="Top gradient" value={state.bg.gradTop} min={0} max={0.9} step={0.01}
        format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchBg({ gradTop: v })} />
      <SliderRow label="Bottom gradient" value={state.bg.gradBottom} min={0} max={0.9} step={0.01}
        format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchBg({ gradBottom: v })} />
      <SliderRow label="Panel opacity" value={state.bg.panelOpacity} min={0.15} max={0.92} step={0.01}
        format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchBg({ panelOpacity: v })} />
      <SliderRow label="Panel blur (frosted glass)" value={state.bg.panelBlur} min={0} max={24} step={0.5}
        format={(v) => `${v}px`} onChange={(v) => patchBg({ panelBlur: v })} />
    </Section>
  );
}

/* --------------------------------------------------- header section */

export function HeaderSection(p: PanelProps) {
  const { state, patchHeader } = p;
  return (
    <Section icon={CaseSensitive} title="Header" subtitle="Fixed Fateh + Hukamnama banner text">
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
        <div className="mb-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
          <Lock size={9} /> Fixed text — not editable
        </div>
        <p className="font-pa text-[11px] leading-snug text-amber-100/80">{HEADER_LINE_2}</p>
      </div>
      <SegRow
        options={[
          { value: "center", label: "Center", icon: AlignCenter },
          { value: "left", label: "Left", icon: AlignLeft },
        ]}
        value={state.header.align}
        onChange={(v) => patchHeader({ align: v })}
      />
      <SliderRow label="Header font size" value={state.header.scale} min={0.7} max={1.35} step={0.01}
        format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchHeader({ scale: v })} />
      <SliderRow label="Canvas padding" value={state.header.padding} min={40} max={160} step={1}
        format={(v) => `${Math.round(v)}px`} onChange={(v) => patchHeader({ padding: v })} />
    </Section>
  );
}

/* ----------------------------------------------------- date section */

export function DateSection(p: PanelProps) {
  const { state, patch } = p;
  const [sgpcDate, setSgpcDate] = useState("");
  const [dateMessage, setDateMessage] = useState("");
  return (
    <Section icon={CalendarDays} title="Date row" subtitle="Punjabi + Gregorian date line">
      <FieldLabel>Pick a date</FieldLabel>
      <input
        type="date"
        value={state.dateISO}
        onChange={(e) => e.target.value && patch({ dateISO: e.target.value })}
        className="u-date w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12.5px] text-zinc-100 outline-none transition focus:border-amber-300/50"
      />
      <div className="mt-2">
        <FieldLabel
          right={
            <button
              type="button"
              onClick={() =>
                patch({ dateManual: false, dateText: formatHukamDate(isoToDate(state.dateISO)) })
              }
              className="flex items-center gap-1 text-[10px] font-medium text-amber-300/90 transition hover:text-amber-200"
            >
              <RotateCcw size={10} /> {publishedSgpcDate(state.dateISO) ? "Use SGPC calendar" : "Use calendar estimate"}
            </button>
          }
        >
          Date line {state.dateManual ? "(source / manual)" : publishedSgpcDate(state.dateISO) ? "(published SGPC calendar)" : "(estimate · verify with SGPC)"}
        </FieldLabel>
        <TextArea
          rows={2}
          value={state.dateText}
          onChange={(v) => patch({ dateText: v, dateManual: true })}
          gurmukhi
        />
      </div>
      <details className="rounded-lg border border-white/10 p-3 text-xs text-zinc-300">
        <summary className="cursor-pointer font-semibold text-amber-200">Use a date copied from SGPC</summary>
        <p className="mt-2 text-[11px] leading-5 text-zinc-400">If SGPC fetch is blocked, copy its Punjabi or English Nanakshahi date line here. Check the Gregorian date selected above first.</p>
        <label className="mt-2 block">SGPC calendar line
          <textarea rows={3} value={sgpcDate} onChange={event => setSgpcDate(event.target.value)} placeholder="ਐਤਵਾਰ, ੯ ਕੱਤਕ (ਸੰਮਤ ੫੫੮ ਨਾਨਕਸ਼ਾਹੀ)" className="font-pa mt-1 w-full rounded-lg border border-white/10 bg-black/20 p-2" />
        </label>
        <button type="button" onClick={() => {
          const dateText = formatSgpcCalendarDate(sgpcDate, state.dateISO);
          if (!dateText) { setDateMessage("Could not match this SGPC calendar line to the selected weekday. Check the date, day, month and Samvat year."); return; }
          patch({ dateText, dateManual: true });
          setDateMessage("SGPC date formatted. Confirm it belongs to the selected Gregorian date before sharing.");
        }} className="mt-2 rounded-lg border border-amber-300/30 px-3 py-2 font-semibold text-amber-200">Apply SGPC date</button>
        {dateMessage && <p role="status" className="mt-2 text-[11px] leading-5">{dateMessage}</p>}
      </details>
    </Section>
  );
}

/* ----------------------------------------------------- meta section */

export function MetaSection(p: PanelProps) {
  const { state, patch } = p;
  const author = normalizeAuthor(state.banikar);
  const authorChoice = AUTHOR_OPTIONS.some(option => option === author) ? author : "custom";
  return (
    <Section icon={BookOpen} title="Baani metadata" subtitle="ਬਾਣੀਕਾਰ + ਅੰਗ chips">
      <div>
        <FieldLabel>ਬਾਣੀਕਾਰ (Author)</FieldLabel>
        <select
          value={authorChoice}
          onChange={(e) => patch({ banikar: e.target.value === "custom" ? "" : e.target.value })}
          className="mb-2 w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-[12.5px] text-zinc-100 outline-none focus:border-amber-300/50 font-pa"
        >
          {AUTHOR_OPTIONS.map((author) => <option key={author} value={author}>{author}</option>)}
          <option value="custom">Custom</option>
        </select>
        {authorChoice === "custom" && (
          <TextInput gurmukhi value={state.banikar} placeholder="Enter author name" onChange={(v) => patch({ banikar: v })} />
        )}
      </div>
      <div>
        <FieldLabel>ਅੰਗ (Ang)</FieldLabel>
        <TextInput gurmukhi value={state.ang} onChange={(v) => patch({ ang: v })} />
      </div>
    </Section>
  );
}

/* -------------------------------------------------- content section */

function BlockStatus(props: { p: PanelProps; index: 0 | 1 }) {
  const b = props.p.layout?.blocks[props.index];
  if (!b || !props.p.layout) return null;
  const refPx = Math.round(b.px / props.p.layout.unit);
  if (b.fits) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-300/90">
        <CircleCheck size={11} /> fits · {refPx}px
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-red-300">
      <TriangleAlert size={11} /> {refPx}px · overflows {Math.round(b.overflowPx / props.p.layout.unit)}px
    </span>
  );
}

export function ContentSection(p: PanelProps & { onPendingChange: (pending: boolean) => void }) {
  const { state, patch } = p;
  const source = splitIntroduction(state.original, state.introduction);
  const [introduction, setIntroduction] = useState(source.introduction);
  const [original, setOriginal] = useState(source.body);
  const [translation, setTranslation] = useState(state.translation);
  const dirty = introduction !== source.introduction || original !== source.body || translation !== state.translation;
  function edit(nextOriginal: string, nextTranslation: string, nextIntroduction = introduction) {
    setIntroduction(nextIntroduction);
    setOriginal(nextOriginal); setTranslation(nextTranslation);
    p.onPendingChange(nextIntroduction !== source.introduction || nextOriginal !== source.body || nextTranslation !== state.translation);
  }
  return (
    <Section icon={ScrollText} title="Hukamnama text" subtitle="Introduction + Gurbani + Punjabi translation">
      <div>
        <FieldLabel>Introductory text · smaller heading</FieldLabel>
        <TextArea ariaLabel="Introductory text" rows={2} gurmukhi value={introduction} onChange={v => edit(original, translation, v)} />
        <p className="mt-1 text-[10px] text-zinc-500">Raag, author heading and Mool Mantar. Long introductions wrap naturally.</p>
      </div>
      <div>
        <FieldLabel right={<BlockStatus p={p} index={0} />}>
          {PANEL_HEADING_ORIGINAL} <span className="text-zinc-600">· {original.length} chars</span>
        </FieldLabel>
        <TextArea ariaLabel="Main Gurbani" rows={6} gurmukhi value={original} onChange={(v) => edit(v, translation)} />
      </div>
      <div>
        <FieldLabel right={<BlockStatus p={p} index={1} />}>
          {PANEL_HEADING_TRANSLATION} <span className="text-zinc-600">· {translation.length} chars</span>
        </FieldLabel>
        <TextArea ariaLabel="Punjabi translation" rows={6} gurmukhi value={translation} onChange={(v) => edit(original, v)} />
        <button
          type="button"
          onClick={() => edit("", "", "")}
          className="mt-1.5 flex items-center gap-1 text-[10px] text-zinc-500 transition hover:text-zinc-300"
        >
          <Delete size={10} /> Clear all three fields
        </button>
      </div>
      <button type="button" disabled={!dirty} onClick={() => { patch({ introduction: introduction.trim(), original: joinIntroduction(introduction, original), translation }); p.onPendingChange(false); }} className="min-h-11 w-full rounded-lg bg-amber-400 px-3 py-3 text-sm font-bold text-zinc-950 disabled:opacity-40">Update text &amp; preview</button>
      {(state.fullOriginal || state.fullTranslation) && <details className="text-xs text-zinc-400"><summary className="cursor-pointer text-amber-200">View full fetched source · retained for captions</summary><p className="mt-2 font-pa leading-6">{state.fullOriginal}</p><p className="mt-2 font-pa leading-6">{state.fullTranslation}</p></details>}
      <p role="status" className="text-xs text-zinc-400">{dirty ? "Edits pending. Press Update to apply all three text fields before sharing or publishing." : "Text applied to the image, reel and caption."}</p>
    </Section>
  );
}

/* ----------------------------------------------- typography section */

export function TypographySection(p: PanelProps) {
  const { state, patchTypo } = p;
  const ratio = state.typo.originalSizeRatio.toFixed(2);
  return (
    <Section icon={SlidersHorizontal} title="Text layout" subtitle="Auto-fit + justified Gurmukhi">
      <ToggleRow
        label="Justified alignment"
        desc="Stretch spaces so both panel edges align flush. Last lines stay centered."
        checked={state.typo.justify}
        onChange={(v) => patchTypo({ justify: v })}
      />
      <ToggleRow
        label="Auto-fit text"
        desc={`Fill the body and balance short final lines. Gurbani stays larger; target ratio ${ratio}×.`}
        checked={state.typo.autoFit}
        onChange={(v) => patchTypo({ autoFit: v })}
      />
      
      {state.typo.autoFit && <SliderRow label="Target ratio (Original ÷ Translation)" value={state.typo.originalSizeRatio} min={1.2} max={2.0} step={0.05} format={v => `${v.toFixed(2)}×`} onChange={v => patchTypo({ originalSizeRatio: v })} />}
      <p className="text-[10px] text-zinc-500">Adjusting a pixel size switches to manual sizing. Main Gurbani stays larger than the introduction and translation.</p>
      <SliderRow label="Introduction size" value={state.typo.introductionSize} min={12} max={80} step={1} format={v => `${v}px`} onChange={v => patchTypo({ introductionSize: v, originalSize: Math.max(state.typo.originalSize, v + 4), autoFit: false })} />
      <label className="flex items-center justify-between text-xs text-zinc-300">Introduction colour<input aria-label="Introduction colour" type="color" value={state.typo.introductionColor} onChange={event => patchTypo({ introductionColor: event.target.value })} className="h-8 w-12 rounded border border-white/10" /></label>
      <SliderRow label="Main Gurbani size" value={state.typo.originalSize} min={22} max={128} step={1} format={v => `${v}px`} onChange={v => patchTypo({ originalSize: v, translationSize: Math.min(state.typo.translationSize, v - 4), introductionSize: Math.min(state.typo.introductionSize, v - 4), autoFit: false })} />
      <SliderRow label="Translation size" value={state.typo.translationSize} min={18} max={96} step={1} format={v => `${v}px`} onChange={v => patchTypo({ translationSize: v, originalSize: Math.max(state.typo.originalSize, v + 4), autoFit: false })} />
      {p.layout && <p className="text-[10px] text-amber-200">Rendered sizes: introduction {p.layout.introduction ? `${Math.round(p.layout.introduction.px)}px` : "not used"}, Gurbani {Math.round(p.layout.blocks[0].px)}px, translation {Math.round(p.layout.blocks[1].px)}px.</p>}

      <SliderRow
        label="Line height"
        value={state.typo.lineHeight}
        min={1.3}
        max={1.9}
        step={0.02}
        format={(v) => v.toFixed(2)}
        onChange={(v) => patchTypo({ lineHeight: v })}
      />
      <p className="text-[10px] text-zinc-500">Applies to all three text areas. Auto-fit may reduce font sizes when spacing increases; turn it off to keep your pixel sizes.</p>
    </Section>
  );
}

/* ------------------------------------------------- branding section */

export function BrandingSection(p: PanelProps) {
  const { state, patch, patchLogo } = p;
  const logo = state.logo;
  return (
    <Section icon={BadgeCheck} title="Branding" subtitle="sikhizm.com footer + logo">
      <ToggleRow
        label="Show footer branding band"
        desc="Reserves a strip at the bottom of the artwork for the logo/mark + tagline."
        checked={state.footer}
        onChange={(v) => patch({ footer: v })}
      />

      <ToggleRow
        label="Show sikhizm.com logo"
        desc="Places the real logo artwork instead of (or alongside) the text mark."
        checked={logo.enabled}
        onChange={(v) => patchLogo({ enabled: v })}
      />

      {logo.enabled && (
        <>
          <FieldLabel>Logo style</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {(["mark", "card"] as const).map((v) => {
              const active = logo.variant === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => patchLogo({ variant: v })}
                  className={`overflow-hidden rounded-xl border p-2 transition ${
                    active
                      ? "border-amber-300/60 bg-amber-400/[0.09]"
                      : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.045]"
                  } ${v === "mark" ? "bg-[repeating-conic-gradient(#2a2a2a_0%_25%,#1a1a1a_0%_50%)] bg-[length:12px_12px]" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={LOGO_SRC[v]} alt={v} className="h-8 w-full object-contain" />
                  <div className={`mt-1.5 text-center text-[10px] font-medium ${active ? "text-amber-200" : "text-zinc-400"}`}>
                    {v === "mark" ? "Transparent mark" : "White card"}
                  </div>
                </button>
              );
            })}
          </div>

          <FieldLabel>Placement</FieldLabel>
          <SegRow
            options={[
              { value: "footer", label: "Footer", icon: PanelBottom },
              { value: "corner-left", label: "Top-left", icon: CornerUpLeft },
              { value: "corner-right", label: "Top-right", icon: CornerUpRight },
            ]}
            value={logo.position}
            onChange={(v) => patchLogo({ position: v })}
          />

          <SliderRow label="Logo size" value={logo.scale} min={0.7} max={1.6} step={0.02}
            format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patchLogo({ scale: v })} />
        </>
      )}
    </Section>
  );
}



