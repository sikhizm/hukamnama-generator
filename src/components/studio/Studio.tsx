"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  ImageDown,
  Layers,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Frame,
  RotateCcw,
  CircleCheck,
} from "lucide-react";
import {
  PRESETS,
  getPreset,
  getFontDef,
  FONT_OPTIONS,
  LOGO_SRC,
  type BgSettings,
  type FontId,
  type HeaderSettings,
  type LogoSettings,
  type PresetDef,
  type StudioState,
  type TypoSettings,
} from "@/lib/hukamnama/types";
import { isReference, referenceConfig } from "@/lib/hukamnama/reference";
import referenceSample from "@/lib/hukamnama/reference-sample.json";
import { defaultState } from "@/lib/hukamnama/defaults";
import { computeLayout, type LayoutResult } from "@/lib/hukamnama/layout";
import { buildComposite, drawHukamnama, type LogoImages } from "@/lib/hukamnama/renderer";
import { formatHukamDate, isoToDate } from "@/lib/hukamnama/punjabiDate";
import {
  FontSection,
  PresetSection,
  BackgroundSection,
  HeaderSection,
  DateSection,
  MetaSection,
  ContentSection,
  TypographySection,
  BrandingSection,
  type FontStatus,
} from "./panels";

const STORAGE_KEY = "hukamnama-studio-v1";
const STRICT_KEY = "hukamnama-studio-strict";
const DEFAULT_BG = "/images/golden-temple.jpg";

function revive(saved: StudioState): StudioState {
  const def = defaultState();
  return {
    ...def,
    ...saved,
    design: saved.design ?? "studio",
    bg: { ...def.bg, ...(saved.bg ?? {}) },
    header: { ...def.header, ...(saved.header ?? {}) },
    typo: { ...def.typo, ...(saved.typo ?? {}) },
    logo: { ...def.logo, ...(saved.logo ?? {}) },
  };
}

export default function Studio() {
  const [state, setState] = useState<StudioState>(() => defaultState());
  const [loaded, setLoaded] = useState(false);
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [fontStatus, setFontStatus] = useState<FontStatus>("checking");
  const [customFontIds, setCustomFontIds] = useState<Set<FontId>>(new Set());
  const [fontVersion, setFontVersion] = useState(0);
  const [bgVersion, setBgVersion] = useState(0);
  const [logoVersion, setLogoVersion] = useState(0);
  const [strictFont, setStrictFontState] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [backgroundReady, setBackgroundReady] = useState(false);
  const [scale, setScale] = useState(0.25);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<CanvasRenderingContext2D | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const logoMarkRef = useRef<HTMLImageElement | null>(null);
  const logoCardRef = useRef<HTMLImageElement | null>(null);
  const compositeCache = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);
  const fontCustom = customFontIds.has(state.fontId);

  const preset = getPreset(state.presetId);
  const referenceMode = isReference(state);
  const exportPresets = state.design === "reference" ? PRESETS.filter(p => p.id === "vertical" || p.id === "feed") : PRESETS;

  /* ---------------------------------------------------------- toast */
  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3000);
  }, []);

  /* -------------------------------------------------- state patching */
  const patch = useCallback((p: Partial<StudioState>) => {
    setState((prev) => {
      const next = { ...prev, ...p };
      if (p.dateISO && !next.dateManual) {
        next.dateText = formatHukamDate(isoToDate(p.dateISO));
      }
      return next;
    });
  }, []);
  const patchBg = useCallback((p: Partial<BgSettings>) => {
    setState((prev) => ({ ...prev, bg: { ...prev.bg, ...p } }));
  }, []);
  const patchHeader = useCallback((p: Partial<HeaderSettings>) => {
    setState((prev) => ({ ...prev, header: { ...prev.header, ...p } }));
  }, []);
  const patchTypo = useCallback((p: Partial<TypoSettings>) => {
    setState((prev) => ({ ...prev, typo: { ...prev.typo, ...p } }));
  }, []);
  const patchLogo = useCallback((p: Partial<LogoSettings>) => {
    setState((prev) => ({ ...prev, logo: { ...prev.logo, ...p } }));
  }, []);
  const setStrictFont = useCallback((v: boolean) => {
    setStrictFontState(v);
    try {
      localStorage.setItem(STRICT_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  /* ------------------------------------------------------ persistence */
  useEffect(() => {
    measureRef.current = document.createElement("canvas").getContext("2d");
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(revive(JSON.parse(raw) as StudioState));
      const sv = localStorage.getItem(STRICT_KEY);
      if (sv === "0") setStrictFontState(false);
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = window.setTimeout(() => {
      try {
        const copy: StudioState = { ...state, bg: { ...state.bg } };
        if (copy.bg.dataUrl && copy.bg.dataUrl.length > 2_400_000) copy.bg.dataUrl = null;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
      } catch {
        /* quota exceeded — skip */
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [state, loaded]);

  /* ---------------------------------------------------- background img */
  useEffect(() => {
    let alive = true;
    setBackgroundReady(false);
    bgImgRef.current = null;
    const src = referenceMode ? referenceConfig(state.presetId).src : state.bg.dataUrl || DEFAULT_BG;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      setBackgroundReady(true);
      bgImgRef.current = img;
      setBgVersion((v) => v + 1);
    };
    img.onerror = () => {
      if (!alive) return;
      setBackgroundReady(false);
      bgImgRef.current = null;
      setBgVersion((v) => v + 1);
    };
    img.src = src;
    return () => { alive = false; };
  }, [state.bg.dataUrl, state.presetId, referenceMode]);

  /* --------------------------------------------------------- logo imgs */
  useEffect(() => {
    let alive = 2;
    const done = () => {
      alive -= 1;
      if (alive <= 0) setLogoVersion((v) => v + 1);
    };
    const mark = new Image();
    mark.onload = () => {
      logoMarkRef.current = mark;
      done();
    };
    mark.onerror = done;
    mark.src = LOGO_SRC.mark;
    const card = new Image();
    card.onload = () => {
      logoCardRef.current = card;
      done();
    };
    card.onerror = done;
    card.src = LOGO_SRC.card;
  }, []);

  /* ------------------------------------------------------ font detect */
  useEffect(() => {
    let alive = true;
    (async () => {
      setFontStatus("checking");
      try {
        await Promise.allSettled([
          document.fonts.load("16px 'Noto Sans Gurmukhi'", "ਵਾਹਿਗੁਰੂ"),
          document.fonts.load("16px 'Space Grotesk'", "Studio"),
          document.fonts.load("16px 'LEMON MILK'", "SGGS"),
          document.fonts.load("16px 'Noto Color Emoji'", "🪯🗓️📜🗒️🌸"),
        ]);
        const def = getFontDef(state.fontId);
        const faces = await document.fonts.load(
          `16px '${def.family}'`,
          "ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ੧੨੩੪੫"
        );
        if (!alive) return;
        setFontStatus(faces.length > 0 ? "ready" : "missing");
        setFontVersion((v) => v + 1);
      } catch {
        if (alive) setFontStatus("missing");
      }
    })();
    const onDone = () => setFontVersion((v) => v + 1);
    document.fonts.addEventListener("loadingdone", onDone);
    return () => {
      alive = false;
      document.fonts.removeEventListener("loadingdone", onDone);
    };
  }, [state.fontId]);

  /* ------------------------------------------------------- stage zoom */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setScale(Math.max(0.05, Math.min((r.width - 56) / preset.w, (r.height - 56) / preset.h)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [preset.w, preset.h]);

  /* ------------------------------------------------- layout + render */
  useEffect(() => {
    const canvas = canvasRef.current;
    const mctx = measureRef.current;
    if (!canvas || !mctx) return;
    const L = computeLayout(state, preset, mctx);
    setLayout(L);

    const key = [
      preset.w,
      preset.h,
      state.design,
      state.bg.mode,
      state.bg.solidColor,
      state.bg.gradFrom,
      state.bg.gradTo,
      state.bg.gradAngle,
      state.bg.overlay,
      state.bg.gradTop,
      state.bg.gradBottom,
      (state.bg.dataUrl || "").length,
      bgVersion,
    ].join("|");
    if (compositeCache.current?.key !== key) {
      compositeCache.current = {
        key,
        canvas: buildComposite(preset.w, preset.h, state, bgImgRef.current),
      };
    }
    if (canvas.width !== preset.w) canvas.width = preset.w;
    if (canvas.height !== preset.h) canvas.height = preset.h;
    const ctx = canvas.getContext("2d");
    const logos: LogoImages = { mark: logoMarkRef.current, card: logoCardRef.current };
    if (ctx) drawHukamnama(ctx, L, state, compositeCache.current.canvas, logos);
  }, [state, preset, fontVersion, bgVersion, logoVersion]);

  /* ---------------------------------------------------------- uploads */
  const onBgFile = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      patchBg({ dataUrl: String(reader.result) });
      notify("Background photo updated");
    };
    reader.readAsDataURL(f);
  };

  const onFontFile = async (f: File | undefined) => {
    if (!f) return;
    const def = getFontDef(state.fontId);
    try {
      const buf = await f.arrayBuffer();
      const face = new FontFace(def.family, buf, { weight: "100 900" });
      await face.load();
      document.fonts.add(face);
      setCustomFontIds((prev) => new Set(prev).add(state.fontId));
      setFontStatus("ready");
      setFontVersion((v) => v + 1);
      notify(`${def.label} loaded — brand typography active`);
    } catch {
      notify("Could not load that font file — please use a valid .ttf / .otf");
    }
  };

  /* ----------------------------------------------------------- export */
  const fontReady = fontStatus === "ready" || !strictFont;
  const contentReady = !!(state.original.trim() && state.translation.trim() && state.dateText.trim() && state.banikar.trim() && state.ang.trim());
  const canExport = contentReady && fontReady && (!referenceMode || backgroundReady) && !!layout && layout.blocks.every(b => b.fits);

  const renderToBlob = async (p: PresetDef, format: "png" | "jpeg"): Promise<Blob | null> => {
    const mctx = measureRef.current;
    if (!mctx) return Promise.resolve(null);
    if (!contentReady) throw new Error("Enter complete content and a verified date before exporting.");
    const exportState = { ...state, presetId: p.id, safeArea: false };
    const L = computeLayout(exportState, p, mctx);
    if (L.blocks.some(b => !b.fits)) throw new Error(`${p.label}: text does not fit. Export blocked to prevent incomplete Gurbani.`);
    let bg = bgImgRef.current;
    if (isReference(exportState)) {
      bg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image(); img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Template artwork could not load. Please retry."));
        img.src = referenceConfig(p.id).src;
      });
    }
    const comp = buildComposite(p.w, p.h, exportState, bg);
    const c = document.createElement("canvas");
    c.width = p.w;
    c.height = p.h;
    const ctx = c.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    const logos: LogoImages = { mark: logoMarkRef.current, card: logoCardRef.current };
    drawHukamnama(ctx, L, exportState, comp, logos);
    return new Promise((res) =>
      c.toBlob((b) => res(b), format === "png" ? "image/png" : "image/jpeg", 0.92)
    );
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const doExport = async (format: "png" | "jpeg") => {
    if (!canExport) {
      notify(`Export locked — load ${getFontDef(state.fontId).label} or allow fallback in the Font section`);
      return;
    }
    setExporting(format);
    try {
      const ext = format === "png" ? "png" : "jpg";
      const blob = await renderToBlob(preset, format);
      if (!blob) throw new Error("render failed");
      downloadBlob(blob, `hukamnama-${preset.id}-${preset.w}x${preset.h}-${state.dateISO}.${ext}`);
      notify(`Exported ${preset.w}×${preset.h} ${ext.toUpperCase()}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Export failed — please try again");
    } finally {
      setExporting(null);
    }
  };

  const doExportAll = async () => {
    if (!canExport) {
      notify(`Export locked — load ${getFontDef(state.fontId).label} or allow fallback in the Font section`);
      return;
    }
    setExporting("all");
    try {
      const mctx = measureRef.current;
      if (!mctx) throw new Error("Canvas is not ready.");
      for (const p of exportPresets) {
        if (computeLayout({ ...state, presetId: p.id }, p, mctx).blocks.some(b => !b.fits)) {
          throw new Error(`${p.label}: text does not fit. No files exported.`);
        }
      }
      for (const p of exportPresets) {
        const blob = await renderToBlob(p, "png");
        if (blob) {
          downloadBlob(blob, `hukamnama-${p.id}-${p.w}x${p.h}-${state.dateISO}.png`);
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      notify(`Exported all ${exportPresets.length} preset sizes`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const resetAll = () => {
    setState(defaultState());
    notify("Studio reset to defaults");
  };

  /* -------------------------------------------------------------- UI */
  const fontChip = (() => {
    if (fontStatus === "checking")
      return {
        cls: "border-white/10 bg-white/[0.04] text-zinc-400",
        icon: <LoaderCircle size={12} className="animate-spin" />,
        text: "Detecting font…",
      };
    if (fontStatus === "ready")
      return {
        cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        icon: <ShieldCheck size={12} />,
        text: `${getFontDef(state.fontId).label} active`,
      };
    if (!strictFont)
      return {
        cls: "border-orange-400/30 bg-orange-400/10 text-orange-300",
        icon: <TriangleAlert size={12} />,
        text: "Fallback font — export allowed",
      };
    return {
      cls: "border-amber-400/30 bg-amber-400/10 text-amber-300",
      icon: <ShieldAlert size={12} />,
      text: `${getFontDef(state.fontId).label} missing — click to load`,
    };
  })();

  const blockChip = (label: string, index: 0 | 1) => {
    const b = layout?.blocks[index];
    if (!b || !layout) return null;
    const refPx = Math.round(b.px / layout.unit);
    return (
      <span
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium backdrop-blur ${
          b.fits
            ? "border-emerald-400/25 bg-emerald-950/60 text-emerald-300"
            : "border-red-400/30 bg-red-950/60 text-red-300"
        }`}
      >
        {b.fits ? <CircleCheck size={11} /> : <TriangleAlert size={11} />}
        {label} · {refPx}px{b.fits ? "" : ` · over ${Math.round(b.overflowPx / layout.unit)}px`}
      </span>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col md:h-screen md:overflow-hidden bg-[#0a0b10] text-zinc-200">
      {/* ------------------------------------------------------- topbar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0c0d13] px-4">
        <div className="font-pa grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 text-[13px] font-bold text-zinc-950 shadow-lg shadow-amber-500/25">
          ਸਿ
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold tracking-wide text-white">
            Hukamnama Studio
          </div>
          <div className="truncate text-[10px] text-zinc-500">
            sikhizm.com · Daily Hukamnama image generator
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => fontInputRef.current?.click()}
            className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10.5px] font-medium transition hover:brightness-125 sm:flex ${fontChip.cls}`}
          >
            {fontChip.icon}
            {fontChip.text}
          </button>
          <button
            type="button"
            onClick={resetAll}
            title="Reset everything to defaults"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-200"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        {/* ----------------------------------------------------- sidebar */}
        <aside className="studio-scroll w-full md:w-[360px] shrink-0 md:overflow-y-auto border-r border-white/[0.06] bg-[#0d0e14]">
          <section className="space-y-3 border-b border-white/10 p-4">
            <label className="block text-sm font-semibold" htmlFor="design">Design</label>
            <select id="design" className="w-full rounded bg-zinc-800 p-2" value={state.design}
              onChange={e => patch({ design: e.target.value as StudioState["design"], presetId: "vertical" })}>
              <option value="reference">Original Sikhizm template</option><option value="studio">Previous studio design</option>
            </select>
            {state.design === "reference" && <>
              <p className="text-xs text-zinc-400">Original artwork, header, QR and footer. ChatrikUni is required to match the body; Latin labels use LEMON MILK when installed.</p>
              {!canExport && fontReady && <p role="alert" className="mb-2 text-xs text-red-300">Export blocked: complete the text, author, Ang and verified date; check artwork and text-fit warnings.</p>}
              <div className="flex gap-2">{exportPresets.map(p => <button key={p.id} type="button"
                aria-pressed={state.presetId === p.id} onClick={() => patch({ presetId: p.id })}
                className={`rounded border p-2 text-xs ${state.presetId === p.id ? "border-amber-300 text-amber-200" : "border-zinc-700"}`}>{p.w} × {p.h}</button>)}</div>
              <button type="button" className="text-xs text-amber-300 underline" onClick={() => {
                patch({ ...referenceSample, banikar: "Bani Bhagat Namdev Ji", ang: "718", fontId: "chatrikuni",
                  dateISO: "2026-10-24", dateManual: true,
                  dateText: "24-October-2026 | ਕੱਤਕ (Katak) 08 | ਸ਼ਨੀਵਾਰ (Saturday)",
                  typo: { ...state.typo, autoFit: true } });
                notify("Loaded reference example dated 24 October 2026 — not a live daily fetch.");
              }}>Load supplied reference example (24 Oct 2026)</button>
              {!backgroundReady && <p role="status" className="text-xs text-amber-300">Waiting for template artwork. Export remains locked.</p>}
            </>}
            <p className="text-xs text-amber-200">Verify the Punjabi date against SGPC and enter the full date manually. The existing automatic calendar is approximate.</p>
          </section>
          <FontSection
            state={state}
            layout={layout}
            patch={patch}
            patchBg={patchBg}
            patchHeader={patchHeader}
            patchTypo={patchTypo}
            patchLogo={patchLogo}
            fontStatus={fontStatus}
            fontCustom={fontCustom}
            strictFont={strictFont}
            setStrictFont={setStrictFont}
            onPickFont={() => fontInputRef.current?.click()}
            onUploadBg={() => bgInputRef.current?.click()}
            onResetBg={() => patchBg({ dataUrl: null })}
          />
          {state.design === "studio" && <><PresetSection {...panelProps()} /><BackgroundSection {...panelProps()} /><HeaderSection {...panelProps()} /></>}
          <DateSection {...panelProps()} />
          <MetaSection {...panelProps()} />
          <ContentSection {...panelProps()} />
          <TypographySection {...panelProps()} />
          {state.design === "studio" && <BrandingSection {...panelProps()} />}

          {/* ------------------------------------------------ export dock */}
          <div className="sticky bottom-0 z-10 border-t border-white/[0.07] bg-[#0c0d13]/95 px-4 py-3 backdrop-blur">
            {!fontReady && (
              <button
                type="button"
                onClick={() => fontInputRef.current?.click()}
                className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/[0.08] px-2 py-1.5 text-[10px] font-medium text-amber-300 transition hover:bg-amber-400/15"
              >
                <ShieldAlert size={11} />
                Export locked — load {getFontDef(state.fontId).label} to unlock
              </button>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canExport || exporting !== null}
                onClick={() => doExport("png")}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-3 py-2.5 text-[12.5px] font-bold text-zinc-950 shadow-lg shadow-amber-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:saturate-0"
              >
                {exporting === "png" ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                PNG
              </button>
              <button
                type="button"
                disabled={!canExport || exporting !== null}
                onClick={() => doExport("jpeg")}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 text-[12.5px] font-semibold text-zinc-200 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {exporting === "jpeg" ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <ImageDown size={14} />
                )}
                JPG
              </button>
            </div>
            <button
              type="button"
              disabled={!canExport || exporting !== null}
              onClick={doExportAll}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-medium text-zinc-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {exporting === "all" ? (
                <LoaderCircle size={12} className="animate-spin" />
              ) : (
                <Layers size={12} />
              )}
              Export all {exportPresets.length} presets (PNG)
            </button>
            <p className="mt-2 text-center text-[9px] leading-snug text-zinc-600">
              Full-resolution export · {preset.w} × {preset.h} · rendered locally, nothing is uploaded
            </p>
          </div>
        </aside>

        {/* ------------------------------------------------------- stage */}
        <main ref={stageRef} className="stage-bg relative min-h-[65vh] min-w-0 flex-1 overflow-hidden md:min-h-0">
          <div className="absolute left-4 top-4 z-10 flex max-w-[70%] flex-wrap items-center gap-2">
            {blockChip("Original", 0)}
            {blockChip("Translation", 1)}
            {layout?.warnings.map((w) => (
              <span
                key={w}
                className="flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-950/60 px-2.5 py-1 text-[10px] font-medium text-red-300 backdrop-blur"
              >
                <TriangleAlert size={11} /> {w}
              </span>
            ))}
          </div>
          <div className="absolute right-4 top-4 z-10 flex gap-2">
            <button
              type="button"
              onClick={() => patch({ safeArea: !state.safeArea })}
              title="Toggle safe-area guide (80px)"
              className={`grid h-8 w-8 place-items-center rounded-lg border backdrop-blur transition ${
                state.safeArea
                  ? "border-amber-300/60 bg-amber-400/20 text-amber-300"
                  : "border-white/10 bg-black/40 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Frame size={14} />
            </button>
          </div>

          <div className="absolute inset-0 flex items-center justify-center p-7">
            <div
              style={{ width: Math.round(preset.w * scale), height: Math.round(preset.h * scale) }}
              className="overflow-hidden rounded-lg shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
            >
              <canvas ref={canvasRef} width={preset.w} height={preset.h} className="block h-full w-full" />
            </div>
          </div>

          <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/[0.07] bg-black/50 px-3 py-1 font-mono text-[9.5px] text-zinc-400 backdrop-blur">
            {preset.w} × {preset.h} · {Math.round(scale * 100)}% preview · exports at 100%
          </div>
        </main>
      </div>

      {/* ------------------------------------------------------- hidden */}
      <input
        ref={bgInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onBgFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={fontInputRef}
        type="file"
        accept=".ttf,.otf"
        className="hidden"
        onChange={(e) => {
          void onFontFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {toastMsg && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-amber-300/25 bg-zinc-900/95 px-4 py-2 text-[11.5px] font-medium text-amber-100 shadow-2xl backdrop-blur">
          {toastMsg}
        </div>
      )}
    </div>
  );

  /* shared props bundle for the simple panels */
  function panelProps() {
    return {
      state,
      layout,
      patch,
      patchBg,
      patchHeader,
      patchTypo,
      patchLogo,
      fontStatus,
      fontCustom,
      strictFont,
      setStrictFont,
      onPickFont: () => fontInputRef.current?.click(),
      onUploadBg: () => bgInputRef.current?.click(),
      onResetBg: () => patchBg({ dataUrl: null }),
    };
  }
}

