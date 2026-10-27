"use client";

import { useRef, useState } from "react";
import type { LiveHukamnama } from "@/lib/hukamnama/liveSource";
import { DAILY_SOURCES, manualSourceUrl, type DailySource } from "@/lib/hukamnama/sourceSelection";
import { indiaClock } from "@/lib/morningPlan";

export default function SourceSettings({ onUse }: { onUse: (record: LiveHukamnama) => void }) {
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [sources, setSources] = useState<DailySource[]>(DAILY_SOURCES.map(source => source.id));
  const [translation, setTranslation] = useState(true);
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);

  const fetchSelected = async () => {
    if (mode !== "manual" || !sources.length || active.current) return;
    active.current = true; setBusy(true); setFeedback(null);
    try {
      const response = await fetch(manualSourceUrl({ sources, translation }), { cache: "no-store" });
      const result = await response.json() as LiveHukamnama & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The selected sources could not be loaded.");
      if (!result.isToday || result.sourceDateISO !== indiaClock().day) throw new Error("The selected sources have no verified current-day Hukamnama. Your editor was kept.");
      onUse(result);
      setFeedback({ error: false, text: `Loaded ${result.sourceDateISO} · Ang ${result.ang} · ${result.sourceName}.${!result.translation ? " No matching Punjabi translation; enter it manually." : ""}${!result.matchedAuthor ? " Choose an author before publishing." : ""}` });
    } catch (error) {
      setFeedback({ error: true, text: `${error instanceof Error ? error.message : "Could not load the selected sources."} No new text was applied.` });
    } finally { active.current = false; setBusy(false); }
  };

  return <details className="w-full rounded-lg border border-white/10 bg-white/[0.02] text-xs">
    <summary className="cursor-pointer px-3 py-2 font-semibold text-zinc-300">Source settings · manual override</summary>
    <div className="space-y-3 border-t border-white/10 p-3">
      <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
        <legend className="sr-only">Fetching mode</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2"><input type="radio" name="source-mode" checked={mode === "automatic"} onChange={() => { setMode("automatic"); setFeedback(null); }} /> Automatic (default)</label>
          <label className="flex items-center gap-2"><input type="radio" name="source-mode" checked={mode === "manual"} onChange={() => { setMode("manual"); setFeedback(null); }} /> Choose sources</label>
        </div>
        {mode === "automatic" ? <p className="text-zinc-400">Use “Load today’s text” above. Automatic checks and unattended posting use the existing source order.</p> : <>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-zinc-400">Daily sources · tried in this priority order</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-3">{DAILY_SOURCES.map(source => <label key={source.id} className="flex items-center gap-2">
              <input type="checkbox" checked={sources.includes(source.id)} onChange={event => { setSources(current => event.target.checked ? [...current, source.id] : current.filter(id => id !== source.id)); setFeedback(null); }} />{source.label}
            </label>)}</div>
          </fieldset>
          <label className="flex items-start gap-2"><input className="mt-0.5" type="checkbox" checked={translation} onChange={event => { setTranslation(event.target.checked); setFeedback(null); }} /><span>BaniDB: fill missing Punjabi translation using an exact Gurbani match</span></label>
          <p className="text-zinc-500">BaniDB does not confirm today’s Hukamnama. Only selected daily sources are queried; native translations are kept. This override loads the editor only. Automatic posting keeps its default rules.</p>
          {!sources.length && <p role="alert" className="text-amber-300">Choose at least one daily source.</p>}
          <button type="button" disabled={busy || !sources.length} onClick={() => void fetchSelected()} className="rounded-lg bg-amber-400 px-3 py-2 font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-50">{busy ? "Fetching selected sources…" : "Fetch from selected sources"}</button>
        </>}
      </fieldset>
      {feedback && <p role={feedback.error ? "alert" : "status"} className={feedback.error ? "text-amber-300" : "text-emerald-300"}>{feedback.text}</p>}
    </div>
  </details>;
}
