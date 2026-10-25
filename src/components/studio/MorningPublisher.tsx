"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { StudioState } from "@/lib/hukamnama/types";
import type { LiveHukamnama } from "@/lib/hukamnama/liveSource";
import { loadChant, saveChant } from "@/lib/browserAudio";
import { DESTINATIONS, defaultTargets, expandTemplate, indiaClock, inMorningWindow, needsReel, verifyMorningState, SHORT_TEMPLATE, type Destination, type MorningTargets } from "@/lib/morningPlan";
import { requestEvergreenLinks } from "@/lib/hukamnama/sikhizmLinks";
import { buildSocialCaption } from "@/lib/hukamnama/socialCaption";

interface Props {
  manualLinks?: boolean;
  reelTarget: HTMLElement | null;
  state: StudioState; caption: string; articleUrl: string; pdfUrl: string;
  live: LiveHukamnama | null; onLoadLive: (live: LiveHukamnama) => void;
  createImage: (format: "feed" | "vertical") => Promise<Blob | null>; disabled: boolean;
}
interface Outcome { status: "sending" | "sent" | "failed" | "unknown"; message: string; url?: string }
type Ledger = Record<string, Partial<Record<Destination, Outcome>>>;
const SETTINGS_KEY = "sikhizm-morning-settings-v1", LEDGER_KEY = "sikhizm-morning-results-v1";
const field = "mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-zinc-200 disabled:opacity-40";
async function bundledChant() {
  const response = await fetch("/audio/waheguru-waheguru.mp3");
  if (!response.ok) throw new Error("The bundled chant could not load. Reload the app or upload a replacement.");
  return { name: "Waheguru Waheguru.mp3", blob: await response.blob() };
}

export default function MorningPublisher(props: Props) {
  const [targets, setTargets] = useState<MorningTargets>({ ...defaultTargets });
  const [duration, setDuration] = useState<"full" | 10 | 15>("full");
  const [time, setTime] = useState("05:45");
  const [template, setTemplate] = useState(SHORT_TEMPLATE);
  const [useFull, setUseFull] = useState(false);
  const [audio, setAudio] = useState<{ name: string; blob: Blob; url: string } | null>(null);
  const [video, setVideo] = useState<{ blob: Blob; url: string; fingerprint: string } | null>(null);
  const [ledger, setLedger] = useState<Ledger>({});
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Automatic publishing is off.");
  const [youtube, setYoutube] = useState("");
  const [wake, setWake] = useState(false);
  const active = useRef(false), armed = useRef(false), latest = useRef<() => void>(() => {});
  const day = indiaClock().day;
  const finalCaption = useFull ? props.caption : expandTemplate(template, { date: props.state.dateText, original: props.state.original, translation: props.state.translation, articleUrl: props.articleUrl, pdfUrl: props.pdfUrl });
  const fingerprint = JSON.stringify([props.state, duration, audio?.name, audio?.blob.size]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
        if (saved) {
          setTargets(Object.fromEntries(DESTINATIONS.map(item => [item.id, typeof saved.targets?.[item.id] === "boolean" ? saved.targets[item.id] : item.selected])) as MorningTargets);
          // Migrate the former 10/15-second default to full recording once.
          if (saved.audioDurationVersion === 2 && (saved.duration === "full" || saved.duration === 10 || saved.duration === 15)) setDuration(saved.duration);
          if (typeof saved.time === "string") setTime(saved.time);
          if (typeof saved.template === "string") setTemplate(saved.template);
          setUseFull(saved.useFull === true);
        }
        setLedger(JSON.parse(localStorage.getItem(LEDGER_KEY) ?? "{}"));
      } catch { if (!cancelled) setMessage("Saved settings could not be loaded. Check browser storage before arming."); }
      try {
        // A saved custom chant takes precedence; the bundled recording works
        // on new browsers and when IndexedDB is unavailable or cleared.
        const savedAudio = await loadChant().catch(() => null) ?? await bundledChant();
        if (savedAudio && !cancelled) setAudio({ ...savedAudio, url: URL.createObjectURL(savedAudio.blob) });
      } catch (error) { if (!cancelled) setMessage((error as Error).message); }
      finally { if (!cancelled) setLoaded(true); }
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ targets, duration, audioDurationVersion: 2, time, template, useFull })); }
    catch { /* Arming checks storage before sending. */ }
  }, [targets, duration, time, template, useFull, loaded]);
  useEffect(() => () => { if (audio) URL.revokeObjectURL(audio.url); }, [audio]);
  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | undefined;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || cancelled) return;
      try { const lock = await navigator.wakeLock.request("screen"); if (cancelled) { await lock.release(); return; } sentinel = lock; setWake(true); lock.addEventListener("release", () => setWake(false)); } catch { setWake(false); }
    };
    void acquire(); document.addEventListener("visibilitychange", acquire);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", acquire); void sentinel?.release(); };
  }, [enabled]);

  async function api(url: string, body?: FormData) {
    const response = await fetch(url, { method: "POST", body });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error ?? "Request failed."), { uncertain: result.uncertain ?? response.status >= 500 });
    return result;
  }
  async function uploadAudio(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1800000 || file.size < 32 || !file.type.startsWith("audio/")) throw new Error("Upload an audio clip under 1.8 MB (MP3, M4A or WAV).");
      await saveChant({ name: file.name, blob: file });
      setAudio({ name: file.name, blob: file, url: URL.createObjectURL(file) }); setVideo(null);
      setMessage("Chant saved on this browser. It will be reused for every reel.");
    } catch (error) { setMessage((error as Error).message); }
  }
  async function makeReel() {
    if (!audio) throw new Error("Upload your Waheguru chant first.");
    if (props.disabled) throw new Error("Complete the image and load the font before creating a reel.");
    const image = await props.createImage("vertical"); if (!image) throw new Error("Could not render the vertical image.");
    const body = new FormData(); body.set("image", image, "hukamnama.jpg"); body.set("audio", audio.blob, audio.name); body.set("duration", String(duration));
    const response = await fetch("/api/social/reel", { method: "POST", body });
    if (!response.ok) { const result = await response.json(); throw new Error(result.error ?? "Reel creation failed."); }
    const blob = await response.blob(); const result = { blob, url: URL.createObjectURL(blob), fingerprint };
    setVideo(result); return result;
  }
  function record(today: string, target: Destination, outcome: Outcome) {
    const saved = JSON.parse(localStorage.getItem(LEDGER_KEY) ?? "{}") as Ledger;
    const next = Object.fromEntries(Object.entries(saved).filter(([date]) => date >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))) as Ledger;
    next[today] = { ...next[today], [target]: outcome };
    localStorage.setItem(LEDGER_KEY, JSON.stringify(next)); // Persist BEFORE dispatch; fail closed if storage is unavailable.
    setLedger(next);
  }
  async function run(automatic: boolean) {
    if (active.current || !loaded || (automatic && !armed.current)) return;
    const { validLive, matchesLive } = verifyMorningState(props.state, props.live, indiaClock().day);
    if (automatic && !inMorningWindow(time)) { setMessage(`Armed · waiting until ${time} IST, then checking until 10:30 a.m.`); return; }
    if (!validLive) { setMessage("Waiting for today’s complete, source-matched Gurbani, translation, date and author. Nothing sent."); return; }
    if (!matchesLive) { props.onLoadLive(props.live!); setMessage("Loading today’s verified content. Publishing will wait for rendering."); return; }
    if (props.disabled) { setMessage("Waiting for complete artwork, the required font and text that fits. Nothing sent."); return; }
    if (!consent) { setMessage("Approve the selected destinations first."); return; }
    if (needsReel(targets) && !audio) { setMessage("Upload the chant before starting the selected reel destinations."); return; }
    active.current = true; setBusy(true);
    try {
      if (!navigator.locks) throw new Error("Use a browser supporting Web Locks (such as Chrome) to prevent two tabs posting together.");
      await navigator.locks.request("sikhizm-morning-publisher", { ifAvailable: true }, async lock => {
        if (!lock) { setMessage("Another app tab is handling morning publishing."); return; }
        const today = indiaClock().day;
        const completed = JSON.parse(localStorage.getItem(LEDGER_KEY) ?? "{}") as Ledger;
        const pending = DESTINATIONS.filter(item => targets[item.id] && !completed[today]?.[item.id]);
        if (!pending.length) { setMessage("Today’s selected destinations have already been attempted. Review results below; automatic retries are disabled."); return; }
        let articleUrl = "", pdfUrl = "";
        if (props.manualLinks) {
          articleUrl = props.articleUrl;
          pdfUrl = props.pdfUrl;
        } else try {
          const links = await requestEvergreenLinks({ date: today, ang: props.state.ang, original: props.state.original });
          if (links.found) { articleUrl = links.articleUrl; pdfUrl = links.pdfUrl || ""; }
        } catch { /* Omit unavailable links instead of carrying another day's links forward. */ }
        const batchCaption = useFull ? buildSocialCaption(props.state, articleUrl, pdfUrl) : expandTemplate(template, { date: props.state.dateText, original: props.state.original, translation: props.state.translation, articleUrl, pdfUrl });
        // Build all required artwork before the first external post.
        const feed = pending.some(item => item.id.endsWith("image")) ? await props.createImage("feed") : null;
        const vertical = pending.some(item => item.id.endsWith("story")) ? await props.createImage("vertical") : null;
        const reel = pending.some(item => item.id.endsWith("reel")) ? video?.fingerprint === fingerprint ? video : await makeReel() : null;
        if (automatic && !armed.current) return;
        for (const item of pending) {
          if (automatic && !armed.current) break;
          if (indiaClock().day !== today) break;
          record(today, item.id, { status: "sending", message: "Request started. Check the platform if the app closes before confirmation." });
          setMessage(`Publishing ${item.label}…`);
          try {
            const body = new FormData(); body.set("caption", batchCaption);
            let url = "/api/social/media";
            if (item.id.endsWith("image")) {
              if (!feed) throw Object.assign(new Error("Feed image unavailable."), { uncertain: false });
              url = "/api/social/publish"; body.set("platform", item.id.split("-")[0]); body.set("image", feed, "hukamnama.jpg"); body.set("hashtags", "");
            } else {
              const file = item.id.endsWith("reel") ? reel?.blob : vertical;
              if (!file) throw Object.assign(new Error("Prepared media unavailable."), { uncertain: false });
              body.set("file", file, item.id.endsWith("reel") ? "hukamnama.mp4" : "hukamnama.jpg"); body.set("target", item.id);
              if (item.id === "youtube-reel") { url = "/api/social/youtube"; body.set("title", `Daily Hukamnama · ${today} · Sikhizm #Shorts`); }
            }
            const result = await api(url, body);
            record(today, item.id, { status: "sent", message: result.processing ? "Upload accepted; platform processing may take a moment." : "Published", url: result.url });
          } catch (error) {
            const e = error as Error & { uncertain?: boolean };
            record(today, item.id, { status: e.uncertain === false ? "failed" : "unknown", message: e.message });
          }
        }
        setMessage("Morning batch finished. Review each destination below. WhatsApp remains manual.");
      });
    } catch (error) { setMessage((error as Error).message); }
    finally { active.current = false; setBusy(false); }
  }
  useEffect(() => { latest.current = () => { if (armed.current) void run(true); }; });
  useEffect(() => { const timer = setInterval(() => latest.current(), 15000); return () => clearInterval(timer); }, []);

  const reelPreview = <section aria-label="Reel preview" className="space-y-3 text-xs text-zinc-300">
    <h3 className="text-sm font-semibold text-amber-200">Reel preview · 1080 × 1920</h3>
    <p className="text-xs text-zinc-400">Create a preview with your saved Waheguru audio before publishing.</p>
      <button disabled={busy || props.disabled || !audio} onClick={async () => { setBusy(true); try { await makeReel(); setMessage("Reel ready. Preview and download it below; nothing was posted."); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } }} className="w-full rounded-lg border border-amber-300/30 px-3 py-2 text-amber-200">{busy ? "Working…" : "Create reel preview · no posting"}</button>
      {video && <div><video controls playsInline src={video.url} className="mx-auto max-h-72 w-full rounded-lg bg-black" /><a href={video.url} download={`hukamnama-${props.state.dateISO}-${duration === "full" ? "full-audio" : `${duration}s`}.mp4`} className="mt-2 block text-amber-300 underline">Download MP4</a>{video.fingerprint !== fingerprint && <p className="text-amber-200">Artwork or audio changed. The preview will be regenerated before publishing.</p>}</div>}
  </section>;

  return <>{props.reelTarget ? createPortal(reelPreview, props.reelTarget) : reelPreview}<details className="rounded-xl border border-amber-400/20 bg-amber-950/10" open>
    <summary className="cursor-pointer px-3 py-3 text-xs font-semibold text-amber-200">Morning posts, reels &amp; stories</summary>
    <div className="space-y-3 px-3 pb-4 text-xs text-zinc-400">
      <p>Select destinations independently. Image posts use the 1080×1350 template; reels and stories use 1080×1920.</p>
      <fieldset disabled={enabled || busy} className="space-y-2">{DESTINATIONS.map(item => <label key={item.id} className="flex items-start gap-2"><input type="checkbox" checked={targets[item.id]} onChange={event => { setConsent(false); setTargets(previous => ({ ...previous, [item.id]: event.target.checked })); }} className="mt-0.5 accent-amber-400" />{item.label}</label>)}</fieldset>
      <label className="block">Replace reel background audio (optional)<input type="file" accept="audio/*" disabled={enabled || busy || !loaded} onChange={event => void uploadAudio(event.target.files?.[0])} className={field} /></label>
      {audio && <div><p className="break-all text-emerald-300">Ready: {audio.name}</p><audio controls src={audio.url} className="mt-2 w-full" /></div>}
      <button disabled={enabled || busy || !loaded} onClick={async () => { try { const data = await bundledChant(); await saveChant(data).catch(() => null); setAudio({ ...data, url: URL.createObjectURL(data.blob) }); setVideo(null); setMessage("Bundled Waheguru chant selected for future reels."); } catch (error) { setMessage((error as Error).message); } }} className="text-amber-300 underline">Use bundled Waheguru chant</button>
      <p className="text-[10px]">Your full Waheguru recording is the default reel background. Optional replacements, up to 1.8 MB and 60 seconds, are saved on this browser. Audio is never looped.</p>
      <label className="block">Reel duration<select value={duration} disabled={enabled || busy} onChange={event => { setDuration(event.target.value === "full" ? "full" : Number(event.target.value) as 10 | 15); setVideo(null); }} className={field}><option value="full">Full audio clip (recommended)</option><option value={10}>First 10 seconds</option><option value={15}>First 15 seconds</option></select></label>
      <label className="flex items-start gap-2"><input type="checkbox" checked={useFull} disabled={enabled || busy} onChange={event => { setConsent(false); setUseFull(event.target.checked); }} className="mt-0.5 accent-amber-400" />Use the full text template above for feed posts and reels</label>
      {!useFull && <label className="block">Shared publishing template<textarea value={template} disabled={enabled || busy} onChange={event => { setTemplate(event.target.value); setConsent(false); }} rows={6} className={field} /><span className="text-[10px]">Fields: {"{date}, {articleUrl}, {pdfUrl}, {original}, {translation}"}</span></label>}
      <label className="block">Caption preview · {[...finalCaption].length} characters<textarea readOnly rows={5} value={finalCaption} className={field} /></label>
      <p className="text-[10px]">Links are matched against evergreen Sikhizm articles using Ang and Gurbani. Current manual edits take priority. If no match is verified, link sections are omitted.</p>
      {[...finalCaption].length > 2200 && <p className="text-amber-200">Instagram and image-post captions are limited to 2,200 characters. Choose a shorter template; Gurbani is never automatically cut.</p>}
      <p className="text-[10px]">Your signed-in session authorizes publishing. Reloading turns automatic posting off; your login stays active.</p>
      <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={async () => { try { const result = await api("/api/social/youtube/connect"); window.location.assign(result.url); } catch (error) { setMessage((error as Error).message); } }} className="rounded-lg border border-white/10 px-2 py-2">Connect YouTube</button><button disabled={busy} onClick={async () => { try { const result = await api("/api/social/youtube?status=1"); setYoutube(`${result.title} · ${result.channelId}`); } catch (error) { setYoutube((error as Error).message); } }} className="rounded-lg border border-white/10 px-2 py-2">Check channel</button></div>
      {youtube && <p className="break-all">YouTube: {youtube}</p>}
      <label className="block">Morning start time · IST<input type="time" min="04:00" max="10:30" value={time} disabled={enabled || busy} onChange={event => setTime(event.target.value)} className={field} /></label>
      <label className="flex items-start gap-2"><input type="checkbox" checked={consent} disabled={enabled || busy} onChange={event => setConsent(event.target.checked)} className="mt-0.5 accent-amber-400" />I approve public posting of today’s and future verified Hukamnamas to the selected accounts while this app session is armed.</label>
      <button role="switch" aria-checked={enabled} disabled={!enabled && (busy || !loaded || !consent || !Object.values(targets).some(Boolean) || (needsReel(targets) && !audio))} onClick={() => {
        if (enabled) { armed.current = false; setEnabled(false); setMessage("Automatic publishing is off."); return; }
        if (!/^\d{2}:\d{2}$/.test(time) || time < "04:00" || time > "10:30") { setMessage("Choose a start time between 04:00 and 10:30 IST."); return; }
        try { localStorage.setItem(LEDGER_KEY, localStorage.getItem(LEDGER_KEY) ?? "{}"); } catch { setMessage("Browser storage is required for posting records."); return; }
        armed.current = true; setEnabled(true); setMessage("Automatic publishing armed. Keep this app visible, awake and online.");
      }} className={`w-full rounded-lg px-3 py-3 font-bold text-zinc-950 disabled:opacity-40 ${enabled ? "bg-emerald-400" : "bg-amber-400"}`}>{enabled ? "AUTO ON · turn off" : "AUTO OFF · turn on"}</button>
      <button disabled={busy || enabled || !consent || props.disabled} onClick={() => void run(false)} className="w-full rounded-lg border border-white/10 px-3 py-2">Publish today’s pending destinations now</button>
      <p role="status" aria-live="polite" className="rounded-lg border border-white/10 p-2 leading-5 text-zinc-200">{message}</p>
      <p className="text-[10px]">App-open mode · laptop awake, online and app visible. {enabled ? wake ? "Screen wake lock active." : "Wake lock unavailable; prevent sleep manually." : ""} Stops at 10:30 IST. Stories contain the artwork; caption text is used on feed posts and reels. WhatsApp requires manual sharing.</p>
      {Object.entries(ledger[day] ?? {}).map(([id, result]) => <div key={id} className="rounded-lg border border-white/10 p-2"><p className="font-semibold text-zinc-200">{DESTINATIONS.find(item => item.id === id)?.label} · {result.status}</p><p className="mt-1 break-words">{result.message}</p>{result.url && <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-amber-300 underline">Open account/post</a>}{result.status !== "sent" && !enabled && <button disabled={busy} onClick={() => { const saved = JSON.parse(localStorage.getItem(LEDGER_KEY) ?? "{}") as Ledger; delete saved[day]?.[id as Destination]; localStorage.setItem(LEDGER_KEY, JSON.stringify(saved)); setLedger(saved); }} className="ml-2 underline">{result.status === "failed" ? "Allow retry for this failed destination" : "I checked: no post exists · allow retry"}</button>}{(result.status === "sending" || result.status === "unknown") && <p className="mt-1 text-amber-200">Not retried automatically. Check the account for an existing post.</p>}</div>)}
    </div>
  </details></>;
}
