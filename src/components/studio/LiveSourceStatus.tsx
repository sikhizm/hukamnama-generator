"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck, CloudDownload, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import type { LiveHukamnama } from "@/lib/hukamnama/liveSource";
import { indiaClock } from "@/lib/morningPlan";

interface Props {
  onUse: (record: LiveHukamnama) => void;
  onStatus: (record: LiveHukamnama | null) => void;
}

function indiaTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(date);
}

function inReleaseWindow(): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const minutes = Number(value.hour) * 60 + Number(value.minute);
  return minutes >= 4 * 60 + 15 && minutes <= 10 * 60 + 30;
}

export default function LiveSourceStatus({ onUse, onStatus }: Props) {
  const [record, setRecord] = useState<LiveHukamnama | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const recordRef = useRef<LiveHukamnama | null>(null);

  const check = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/hukamnama/live${force ? "?refresh=1" : ""}`, { cache: "no-store" });
      const result = await response.json() as LiveHukamnama & { error?: string; checkedAt?: string };
      if (!response.ok) throw new Error(result.error ?? "The SGPC feed could not be checked.");
      recordRef.current = result;
      setRecord(result);
      onStatus(result);
      setCheckedAt(result.checkedAt);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The SGPC feed could not be checked.");
      setCheckedAt(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, [onStatus]);

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => {
      const current = recordRef.current;
      if (inReleaseWindow() && (current?.sourceDateISO !== indiaClock().day || !current?.translation || !current?.matchedAuthor)) void check();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [check]);

  const useToday = () => {
    if (!record?.isToday) return;
    onUse(record);
    const usedSikhizmPost = record.sourceName.startsWith("Sikhizm");
    const authorNotice = record.matchedAuthor
      ? `Matched author ${record.matchedAuthor}`
      : "No verified author match was available; the current author was kept";
    const translationNotice = record.translation
      ? ""
      : ` The ${usedSikhizmPost ? "Sikhizm post" : "fallback page"} has no verified Punjabi explanation, so add it manually before export.`;
    setNotice(`Loaded today’s Gurbani and Ang ${record.ang} from ${record.sourceName}. ${authorNotice}.${translationNotice}`);
    window.setTimeout(() => setNotice(null), 5000);
  };

  return (
    <section aria-live="polite" className="flex flex-wrap items-center gap-2.5 border-b border-white/[0.07] bg-[#111218] px-4 py-2.5">
      {record?.isToday ? <CircleCheck size={15} className="shrink-0 text-emerald-300" /> : error ? <TriangleAlert size={15} className="shrink-0 text-amber-300" /> : <LoaderCircle size={15} className={`shrink-0 text-amber-300 ${loading ? "animate-spin" : ""}`} />}
      <div className="min-w-[220px] flex-1 text-[11px] leading-relaxed">
        {record?.isToday ? (
          <>
            <span className="font-semibold text-emerald-200">{record.sourceName.startsWith("Sikhizm") ? "Today’s Hukamnama found on Sikhizm" : "SGPC live feed updated for today"}</span>
            <span className="text-zinc-400"> · {record.sourceDateISO} · {record.sourceName}{record.sourceTime ? ` at ${record.sourceTime} IST` : " (release time not shown)"}</span>
          </>
        ) : error ? (
          <><span className="font-semibold text-amber-200">Couldn’t check SGPC live feed</span><span className="text-zinc-400"> · {error}</span></>
        ) : record ? (
          <><span className="font-semibold text-amber-200">Waiting for today’s Hukamnama</span><span className="text-zinc-400"> · live page still shows {record.sourceDateISO} at {record.sourceTime} IST</span></>
        ) : (
          <><span className="font-semibold text-zinc-200">Checking SGPC live Hukamnama…</span><span className="text-zinc-500"> · release usually falls between 4:30 and 5:30 a.m. IST</span></>
        )}
        {checkedAt && <span className="ml-1.5 text-zinc-600">checked {indiaTime(checkedAt)} IST</span>}
        {notice && <span className="ml-2 text-emerald-300">{notice}</span>}
        {record?.isToday && <p className="mt-0.5 text-zinc-500">The app checks every 5 minutes from 4:15 to 10:30 a.m. IST while open. Load text manually here, or let the armed morning publisher load complete verified content.{record.sourceName.startsWith("Sikhizm") && " SGPC blocked the server request, so this same-day post is the fallback; verify the Nanakshahi date before publishing."}{!record.translation && " The source does not include a verified Punjabi explanation."}</p>}
      </div>
      <button type="button" disabled={loading} onClick={() => void check(true)} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold text-zinc-300 hover:bg-white/[0.08] disabled:opacity-50">
        <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Check SGPC
      </button>
      {record?.isToday && (
        <button type="button" onClick={useToday} className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-2.5 py-1.5 text-[10px] font-bold text-zinc-950 hover:bg-amber-300">
          <CloudDownload size={12} /> Load today’s text
        </button>
      )}
    </section>
  );
}
