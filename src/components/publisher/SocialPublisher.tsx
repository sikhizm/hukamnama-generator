"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { readLedger, writeLedger, attemptKey, clearAttempt } from "@/lib/publisher/attempts";
import { PLATFORMS, LABELS, FORMATS, EMPTY_DRAFT, postText, validateDraft, type Account, type Draft, type Outcome, type Platform, type PostKind } from "@/lib/publisher/model";

type Media = { file: Blob; preview: string; width: number; height: number; name: string; padded?: boolean };
type SavedDraft = { version: 2; draft: Draft; overrides: Partial<Record<Platform, Draft>>; kind: PostKind };
const DRAFT_KEY = "sikhizm-social-publisher-draft-v2";

const field = "mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-300/60 disabled:opacity-50";
const panel = "rounded-2xl border border-white/10 bg-[#10121b] p-5";
const button = "rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-amber-300/50 disabled:opacity-40";
const OAUTH = ["threads", "pinterest", "linkedin", "x", "mastodon"];

async function prepareImage(file: Blob, name = "social-post.jpg"): Promise<Media> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20000000) throw new Error("Choose a JPG, PNG or WebP image up to 20 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 50000000) throw new Error("Use an image smaller than 50 megapixels.");
    const ratio = bitmap.width / bitmap.height, target = Math.max(0.8, Math.min(1.91, ratio));
    const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = Math.round(1080 / target);
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Image preparation is unavailable in this browser.");
    ctx.fillStyle = "#10121b"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
    ctx.drawImage(bitmap, (canvas.width - bitmap.width * scale) / 2, (canvas.height - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
    let blob: Blob | null = null;
    for (const quality of [0.93, 0.85, 0.75, 0.65]) { blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality)); if (blob && blob.size <= 950000) break; }
    if (!blob || blob.size > 950000) throw new Error("Use a simpler image so it can fit the publishing limit without excessive compression.");
    return { file: blob, preview: URL.createObjectURL(blob), width: canvas.width, height: canvas.height, padded: ratio !== target, name };
  } finally { bitmap.close(); }
}
function DraftFields({ draft, onChange, disabled, compact = false }: { draft: Draft; onChange: (draft: Draft) => void; disabled: boolean; compact?: boolean }) {
  const update = (key: keyof Draft, value: string) => onChange({ ...draft, [key]: value });
  return <div className="space-y-4">
    <label className="block text-xs font-medium text-zinc-300">Title <span className="font-normal text-zinc-500">· for YouTube / Pinterest</span><input maxLength={100} disabled={disabled} value={draft.title} onChange={e => update("title", e.target.value)} className={field} placeholder="Optional post title" /></label>
    <label className="block text-xs font-medium text-zinc-300">Caption / Message<textarea disabled={disabled} rows={compact ? 4 : 6} value={draft.caption} onChange={e => update("caption", e.target.value)} className={field} placeholder="Write your message…" /></label>
    <label className="block text-xs font-medium text-zinc-300">Destination URL<input type="url" disabled={disabled} value={draft.url} onChange={e => update("url", e.target.value)} className={field} placeholder="https://sikhizm.com/your-article/" /></label>
    <label className="block text-xs font-medium text-zinc-300">Hashtags<input disabled={disabled} value={draft.hashtags} onChange={e => update("hashtags", e.target.value)} className={field} placeholder="#Sikhizm #Gurbani" /></label>
    <label className="block text-xs font-medium text-zinc-300">Image description <span className="font-normal text-zinc-500">· accessibility, where supported</span><input maxLength={1000} disabled={disabled} value={draft.alt} onChange={e => update("alt", e.target.value)} className={field} placeholder="Describe what is shown in the image" /></label>
  </div>;
}
async function fetchAccounts(signal?: AbortSignal): Promise<Account[]> {
  const response = await fetch("/api/social/publisher/accounts", { method: "POST", signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not check connections.");
  return data.accounts;
}

export default function SocialPublisher({ initialNotice = "" }: { initialNotice?: string }) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [overrides, setOverrides] = useState<Partial<Record<Platform, Draft>>>({});
  const [kind, setKind] = useState<PostKind>("image");
  const [media, setMedia] = useState<Media | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [targets, setTargets] = useState<Platform[]>([]);
  const [preview, setPreview] = useState<Platform>("facebook");
  const [customise, setCustomise] = useState<Platform | null>(null);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false), [preparing, setPreparing] = useState(false), [checking, setChecking] = useState(true);
  const [review, setReview] = useState(false), [notice, setNotice] = useState(initialNotice);
  const [results, setResults] = useState<Partial<Record<Platform, Outcome>>>({});
  const inFlight = useRef(false), mediaSequence = useRef(0), keys = useRef<Partial<Record<Platform, string>>>({});
  const locked = busy || Object.values(results).some(result => result?.id || result?.uncertain);
  const effective = (platform: Platform) => ({ ...(overrides[platform] ?? draft), board: overrides[platform]?.board || draft.board });
  const visible = effective(preview), visibleText = postText(visible);
  const invalid = targets.map(platform => validateDraft(platform, kind, effective(platform))).filter(Boolean);
  const invalidate = () => { setReview(false); setResults({}); keys.current = {}; };

  useEffect(() => { return () => { if (media?.preview) URL.revokeObjectURL(media.preview); }; }, [media]);
  async function checkAccounts(signal?: AbortSignal) {
    try { setAccounts(await fetchAccounts(signal)); }
    catch (error) { if (!signal?.aborted) setNotice((error as Error).message); }
    finally { if (!signal?.aborted) setChecking(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetchAccounts(controller.signal).then(next => { if (!controller.signal.aborted) { setAccounts(next); setChecking(false); } }).catch(error => { if (!controller.signal.aborted) { setNotice(error.message); setChecking(false); } });
    return () => controller.abort();
  }, []);
  function saveDraft() {
    const saved: SavedDraft = { version: 2, draft, overrides, kind };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(saved));
  }
  function restoreDraft() {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as SavedDraft | null;
      if (!saved || saved.version !== 2 || !["image", "text", "video"].includes(saved.kind)) throw new Error("No saved draft is available.");
      const clean = (value: Draft): Draft => Object.fromEntries(Object.keys(EMPTY_DRAFT).map(key => [key, typeof value?.[key as keyof Draft] === "string" ? value[key as keyof Draft].slice(0, 20000) : ""])) as Draft;
      setMedia(null); setDraft(clean(saved.draft)); setOverrides(Object.fromEntries(PLATFORMS.filter(p => saved.overrides?.[p]).map(p => [p, clean(saved.overrides[p]!)]))); setKind(saved.kind); setTargets([]); invalidate();
      setNotice("Draft text restored. Choose your media and publishing accounts again.");
    } catch (error) { setNotice((error as Error).message); }
  }
  async function connect(platform: Platform) {
    try {
      saveDraft();
      const response = await fetch(`/api/social/publisher/connect/${platform}`, { method: "POST" });
      const data = await response.json(); if (!response.ok || !data.url) throw new Error(data.error ?? "Could not start authorization.");
      window.location.assign(data.url);
    } catch (error) { setNotice((error as Error).message); }
  }
  async function choose(file?: File) {
    const sequence = ++mediaSequence.current; invalidate(); setMedia(null); if (!file) return;
    setPreparing(true); setNotice("");
    try {
      let next: Media;
      if (kind === "video") {
        if (file.type !== "video/mp4" || file.size > 4000000 || new TextDecoder().decode(await file.slice(4, 8).arrayBuffer()) !== "ftyp") throw new Error("Choose an MP4 video up to 4 MB. Facebook and Instagram publish it as a reel.");
        next = { file, name: file.name, preview: URL.createObjectURL(file), width: 1080, height: 1920 };
      } else next = await prepareImage(file, file.name);
      if (sequence === mediaSequence.current) setMedia(next); else URL.revokeObjectURL(next.preview);
    } catch (error) { if (sequence === mediaSequence.current) setNotice((error as Error).message); }
    finally { if (sequence === mediaSequence.current) setPreparing(false); }
  }
  async function importArticle() {
    const sequence = ++mediaSequence.current; setPreparing(true); setNotice(""); invalidate();
    try {
      const response = await fetch("/api/social/publisher/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: source }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Article import failed.");
      if (sequence !== mediaSequence.current) return;
      setDraft({ ...EMPTY_DRAFT, title: data.title, caption: data.caption, url: data.url }); setOverrides({}); setKind("image"); setPreview("facebook"); setMedia(null); setTargets([]);
      if (data.imageUrl) {
        try {
          const image = await fetch("/api/social/publisher/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: data.imageUrl, image: true }) });
          if (!image.ok) throw new Error();
          const next = await prepareImage(await image.blob());
          if (sequence === mediaSequence.current) { setMedia(next); setNotice("Article imported as a draft. Review the text and image before publishing."); } else URL.revokeObjectURL(next.preview);
        } catch { setNotice("Article text imported. The featured image could not be loaded; upload it manually."); }
      } else setNotice("Article text imported. Upload an image or choose a text / link post.");
    } catch (error) { setNotice((error as Error).message); }
    finally { if (sequence === mediaSequence.current) setPreparing(false); }
  }
  async function publish() {
    if (inFlight.current || !review || !targets.length || invalid.length || (kind !== "text" && !media)) return;
    if (!navigator.locks) { setNotice("Use a current Chrome, Edge, Firefox or Safari browser for publishing safely across tabs."); return; }
    inFlight.current = true; setBusy(true); setNotice("");
    try {
      await navigator.locks.request("sikhizm-social-publisher", { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Another Social Publisher tab is publishing. Wait for it to finish.");
        for (const platform of targets) {
          if (!accounts.find(account => account.platform === platform)?.connected) throw new Error(`Refresh connections and connect ${LABELS[platform]} first.`);
          const specific = effective(platform), key = await attemptKey(platform, kind, specific, kind !== "text" ? media?.file ?? null : null, accounts.find(account => account.platform === platform)?.id ?? "");
          keys.current[platform] = key;
          const prior = readLedger()[key];
          if (prior) { setResults(previous => ({ ...previous, [platform]: prior.outcome })); continue; }
          const sending = { error: "The request was started but its result is not confirmed. Check this account before retrying.", uncertain: true };
          // Store before dispatch. A reload or interrupted response cannot silently resend this content.
          writeLedger(key, sending); setResults(previous => ({ ...previous, [platform]: sending }));
          const body = new FormData(); body.set("platform", platform); body.set("kind", kind);
          for (const [name, value] of Object.entries(specific)) body.set(name, value);
          if (kind !== "text" && media) body.set("file", media.file, kind === "video" ? "social-post.mp4" : "social-post.jpg");
          let outcome: Outcome;
          try {
            const response = await fetch("/api/social/publisher/publish", { method: "POST", body, signal: AbortSignal.timeout(185000) });
            const result = await response.json() as Outcome;
            outcome = response.ok && result.id ? result : { error: result.error ?? "The platform did not confirm this post.", uncertain: result.uncertain ?? response.status >= 500 };
          } catch { outcome = sending; }
          // If storage fails, retain the pre-dispatch marker and stop further destinations.
          writeLedger(key, outcome); setResults(previous => ({ ...previous, [platform]: outcome }));
        }
      });
    } catch (error) { setNotice((error as Error).message); }
    finally { inFlight.current = false; setBusy(false); setReview(false); }
  }
  function allowRetry(platform: Platform) {
    try { const key = keys.current[platform]; if (key) { clearAttempt(key); } setResults(previous => { const next = { ...previous }; delete next[platform]; return next; }); setReview(false); }
    catch { setNotice("Browser storage is unavailable. Retry remains paused."); }
  }

  return <div className="mt-7">
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <span className="mr-auto text-xs text-zinc-500">One draft · individual platform previews · publish when ready</span>
      <button className={button} disabled={busy || preparing} onClick={() => { try { saveDraft(); setNotice("Draft text saved in this browser. Media must be selected again after reloading."); } catch { setNotice("This browser could not save the draft."); } }}>Save draft</button>
      <button className={button} disabled={locked || preparing} onClick={restoreDraft}>Restore draft</button>
      <button className={button} disabled={busy || preparing} onClick={() => { ++mediaSequence.current; setDraft(EMPTY_DRAFT); setOverrides({}); setMedia(null); setTargets([]); setSource(""); invalidate(); setNotice("New draft started. Publishing history is retained to prevent accidental duplicate posts."); }}>New post</button>
    </div>
    {notice && <p role="status" className="mb-5 rounded-xl border border-amber-300/20 bg-amber-400/5 p-4 text-sm text-amber-100">{notice}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(300px,1fr)_minmax(300px,1fr)_310px]">
      <section className={`${panel} space-y-5`} aria-label="Create post">
        <div><h2 className="text-sm font-semibold text-white">1 · Create your post</h2><p className="mt-1 text-xs text-zinc-500">Upload media or import a public Sikhizm article.</p></div>
        <div className="rounded-xl border border-white/10 p-3"><label className="text-xs font-medium">Import from Sikhizm<input type="url" value={source} onChange={e => setSource(e.target.value)} disabled={locked || preparing} className={field} placeholder="https://sikhizm.com/article/" /></label><button className={`${button} mt-3 w-full`} disabled={!source || locked || preparing} onClick={() => void importArticle()}>{preparing ? "Preparing…" : "Import article as draft"}</button><p className="mt-2 text-[11px] text-zinc-500">Reads public content. Your WordPress site stays unchanged. Import replaces this draft.</p></div>
        <fieldset disabled={locked || preparing}><legend className="mb-2 text-xs font-medium">Post format</legend><div className="grid grid-cols-3 gap-2">{(["image", "text", "video"] as PostKind[]).map(value => <button key={value} aria-pressed={kind === value} onClick={() => { setKind(value); setPreview("facebook"); setMedia(null); setTargets([]); invalidate(); }} className={`${button} ${kind === value ? "border-amber-300/50 bg-amber-400/10 text-amber-200" : ""}`}>{value === "image" ? "Image" : value === "text" ? "Text / Link" : "Video / Reel"}</button>)}</div></fieldset>
        {kind !== "text" && <label className="block text-xs font-medium">{kind === "image" ? "Your image" : "Your MP4 video"}<input key={kind} type="file" accept={kind === "image" ? "image/jpeg,image/png,image/webp" : "video/mp4"} disabled={locked || preparing} className={`${field} file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-zinc-200`} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; void choose(file); }} /><span className="mt-2 block text-[11px] leading-5 text-zinc-500">{kind === "image" ? "JPG, PNG, WebP up to 20 MB. Prepared as JPEG; artwork stays fully visible." : "MP4 up to 4 MB. Facebook / Instagram use reels; YouTube uses video uploads. Use a vertical video for reels."}</span></label>}
        {media && <p className="break-words text-xs text-zinc-400">Selected: {media.name}</p>}
        <DraftFields draft={draft} disabled={locked || preparing} onChange={next => { setDraft(next); invalidate(); }} />
        {overrides && Object.keys(overrides).length > 0 && <p className="text-xs text-amber-200">Custom versions: {Object.keys(overrides).map(p => LABELS[p as Platform]).join(", ")}. Shared edits do not replace these versions.</p>}
      </section>
      <section className="space-y-4 xl:sticky xl:top-5" aria-label="Platform preview">
        <div className="flex flex-wrap gap-1.5">{PLATFORMS.filter(p => FORMATS[p].includes(kind)).map(platform => <button key={platform} onClick={() => setPreview(platform)} aria-pressed={preview === platform} className={`${button} ${preview === platform ? "border-amber-300/50 bg-amber-400/10 text-amber-200" : ""}`}>{LABELS[platform]}</button>)}</div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#10121b]">
          <div className="flex items-center gap-3 border-b border-white/10 p-4"><span className="grid size-9 place-items-center rounded-full bg-amber-400 text-lg text-zinc-950" style={{ fontFamily: "ChatrikUni, sans-serif" }}>ੴ</span><div><p className="text-sm font-semibold text-white">{accounts.find(a => a.platform === preview)?.name ?? LABELS[preview]}</p><p className="text-xs text-zinc-500">{LABELS[preview]} · {kind === "video" ? "Video" : kind === "text" ? "Text / link" : "Image"} preview</p></div></div>
          {kind === "image" && (media ? <Image src={media.preview} unoptimized width={media.width} height={media.height} alt={visible.alt || "Prepared post image"} className="max-h-[560px] w-full object-contain" /> : <div className="grid min-h-64 place-items-center p-8 text-center text-sm text-zinc-500">{preparing ? "Preparing your media…" : "Upload an image or import an article"}</div>)}
          {kind === "video" && (media ? <video controls preload="metadata" src={media.preview} className="max-h-[560px] w-full" aria-label="Selected video preview" /> : <div className="grid min-h-64 place-items-center text-sm text-zinc-500">Select an MP4 video</div>)}
          <div className="space-y-3 p-5">{["youtube", "pinterest"].includes(preview) && <p className="font-semibold text-white">{visible.title || "Your title"}</p>}<p className="whitespace-pre-wrap break-words text-sm leading-6">{visibleText || "Your caption, URL and hashtags will appear here."}</p></div>
        </div>
        <p className="text-xs leading-5 text-zinc-500">{[...visibleText].length.toLocaleString()} characters · Approximate preview. Platforms control final appearance and link behaviour.{media && kind === "image" ? ` ${media.width} × ${media.height} · ${Math.round(media.file.size / 1024)} KB${media.padded ? " · Padding added without cropping." : "."}` : ""}</p>
        {validateDraft(preview, kind, visible) && <p className="text-xs text-amber-200">{validateDraft(preview, kind, visible)}</p>}
        <button className={button} disabled={locked || preparing} onClick={() => setCustomise(customise === preview ? null : preview)}>Customise for {LABELS[preview]}</button>
        {customise && <div className={`${panel} space-y-4`}><div className="flex items-center justify-between"><h3 className="text-sm font-medium">{LABELS[customise]} version</h3><button className="text-xs text-amber-200 underline" disabled={locked} onClick={() => { setOverrides(previous => { const next = { ...previous }; delete next[customise]; return next; }); invalidate(); }}>Use shared draft</button></div><DraftFields compact draft={effective(customise)} disabled={locked || preparing} onChange={next => { setOverrides(previous => ({ ...previous, [customise]: next })); invalidate(); }} /></div>}
      </section>
      <aside className={`${panel} space-y-5`} aria-label="Accounts and publishing">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white">2 · Choose destinations</h2><button className="text-xs text-amber-200 underline disabled:opacity-40" disabled={checking || busy} onClick={() => { setChecking(true); void checkAccounts(); }}>{checking ? "Checking…" : "Refresh"}</button></div>
        <div className="space-y-2">{PLATFORMS.map(platform => { const account = accounts.find(a => a.platform === platform), supported = FORMATS[platform].includes(kind); return <div key={platform} className={`rounded-xl border p-3 ${targets.includes(platform) ? "border-amber-300/40 bg-amber-400/5" : "border-white/10"}`}><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={targets.includes(platform)} disabled={locked || preparing || !account?.connected || !supported} className="accent-amber-400" onChange={e => { setTargets(previous => e.target.checked ? [...previous, platform] : previous.filter(p => p !== platform)); setPreview(platform); invalidate(); }} /><span className="font-medium">{LABELS[platform]}</span><span className={`ml-auto size-1.5 rounded-full ${account?.connected ? "bg-emerald-400" : "bg-zinc-600"}`} /></label><p className="mt-1.5 truncate pl-6 text-[11px] text-zinc-500">{account?.name ?? (checking ? "Checking connection…" : account?.configured ? (["facebook", "instagram"].includes(platform) ? "Verification failed" : "Credentials saved · not connected") : "Setup needed")}{!supported ? " · Choose another format" : ""}</p>{!account?.connected && !checking && <details className="mt-2 pl-6 text-xs"><summary className="cursor-pointer text-zinc-400">Connection settings</summary><p className="mt-2 leading-5 text-zinc-400">{account?.message ?? "Refresh connections to check setup."}</p>{account?.connection !== "server-token" && (OAUTH.includes(platform) || platform === "youtube") && <button className={`${button} mt-2`} disabled={busy || preparing || !account?.configured} onClick={() => void connect(platform)}>Connect {LABELS[platform]}</button>}</details>}{account?.connected && account.connection !== "server-token" && OAUTH.includes(platform) && <button className="mt-2 pl-6 text-[11px] text-zinc-400 underline" disabled={busy || preparing} onClick={() => void connect(platform)}>Reconnect / change account</button>}{account?.connected && account.connection === "server-token" && <p className="mt-2 pl-6 text-[11px] leading-5 text-zinc-400">{account.message}</p>}</div>; })}</div>
        {targets.includes("pinterest") && <label className="block text-xs font-medium">Pinterest board<select value={effective("pinterest").board} disabled={locked} className={field} onChange={e => { setOverrides(previous => ({ ...previous, pinterest: { ...effective("pinterest"), board: e.target.value } })); invalidate(); }}><option value="">Choose a board</option>{accounts.find(a => a.platform === "pinterest")?.boards?.map(board => <option key={board.id} value={board.id}>{board.name}</option>)}</select></label>}
        <div className="space-y-3 border-t border-white/10 pt-4"><h2 className="text-sm font-semibold text-white">3 · Review & publish</h2>{invalid.map((message, i) => <p key={i} className="text-xs text-amber-200">{message}</p>)}<label className="flex items-start gap-2.5 text-xs leading-5 text-zinc-300"><input type="checkbox" checked={review} disabled={busy || preparing} onChange={e => setReview(e.target.checked)} className="mt-1 accent-amber-400" />I reviewed each selected platform’s content and account. Publish publicly when I press the button.</label><button disabled={busy || preparing || checking || !targets.length || !review || !!invalid.length || (kind !== "text" && !media)} onClick={() => void publish()} className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-zinc-950 disabled:opacity-40">{busy ? "Publishing… keep this page open" : `Publish to ${targets.length || "selected"} ${targets.length === 1 ? "account" : "accounts"}`}</button><p className="text-[11px] leading-5 text-zinc-500">Posts are sent only when you press Publish. This tab does not change your morning autopost settings.</p></div>
        <div aria-live="polite" className="space-y-3">{PLATFORMS.filter(p => results[p]).map(platform => { const result = results[platform]!; return <div key={platform} className="rounded-xl border border-white/10 p-3 text-xs"><p className="mb-2 font-semibold">{LABELS[platform]}</p>{result.id ? <><p className="text-emerald-300">{result.processing ? "Uploaded · processing" : "Published"}</p>{result.url && <a href={result.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-emerald-300 underline">View on platform ↗</a>}</> : <><p className="leading-5 text-amber-200">{result.error}</p><button disabled={busy} className="mt-2 text-zinc-300 underline" onClick={() => allowRetry(platform)}>I checked the account: allow another attempt</button></>}</div>; })}</div>
        <details className="text-xs text-zinc-500"><summary className="cursor-pointer">Additional platforms</summary><p className="mt-2 leading-5">TikTok needs its own approved publishing flow and creator controls. WhatsApp sharing remains available in Hukamnama Studio. Neither is automatically posted from this tab.</p></details>
      </aside>
    </div>
  </div>;
}
