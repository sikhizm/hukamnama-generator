"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { composeCaption, type Platform } from "@/lib/socialPost";

type Prepared = { blob: Blob; preview: string; padded: boolean; width: number; height: number };
type Outcome = { id?: string; url?: string; error?: string; uncertain?: boolean };
const inputClass = "mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-amber-300/60 disabled:opacity-50";

async function prepareImage(file: File): Promise<Prepared> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20000000) throw new Error("Choose a JPG, PNG or WebP image up to 20 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 50000000) throw new Error("Use an image smaller than 50 megapixels.");
    const ratio = bitmap.width / bitmap.height;
    const padded = ratio < 0.8 || ratio > 1.91;
    const targetRatio = Math.max(0.8, Math.min(1.91, ratio));
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = Math.round(1080 / targetRatio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image preparation is unavailable in this browser.");
    ctx.fillStyle = "#10121b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
    ctx.drawImage(bitmap, (canvas.width - bitmap.width * scale) / 2, (canvas.height - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Could not prepare the image.")), "image/jpeg", 0.93));
    if (blob.size > 3000000) throw new Error("Prepared image exceeds 3 MB. Please use a simpler or smaller image.");
    const preview = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not load the preview."));
      reader.readAsDataURL(blob);
    });
    return { blob, preview, padded, width: canvas.width, height: canvas.height };
  } finally { bitmap.close(); }
}

export default function ImagePostComposer() {
  const [image, setImage] = useState<Prepared | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("#Gurbani #Sikhism #Sikhizm");
  const [targets, setTargets] = useState<Record<Platform, boolean>>({ facebook: true, instagram: true });
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Partial<Record<Platform, Outcome>>>({});
  const inFlight = useRef(false);
  const selection = useRef(0);
  const locked = busy || Object.values(results).some(result => result?.id || result?.uncertain);
  let finalCaption = "";
  let captionError = "";
  try { finalCaption = composeCaption(caption, hashtags); } catch (err) { captionError = (err as Error).message; }

  async function choose(file?: File) {
    const sequence = ++selection.current;
    setReview(false); setError(""); setImage(null); setResults({});
    if (!file) return;
    setPreparing(true);
    try { const next = await prepareImage(file); if (selection.current === sequence) setImage(next); }
    catch (err) { if (selection.current === sequence) setError((err as Error).message); }
    finally { if (selection.current === sequence) setPreparing(false); }
  }

  async function publish() {
    if (inFlight.current || !image || captionError || !review) return;
    const pending = (["facebook", "instagram"] as Platform[]).filter(platform => targets[platform] && !results[platform]?.id && !results[platform]?.uncertain);
    if (!pending.length) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      for (const platform of pending) {
        const body = new FormData();
        body.set("platform", platform); body.set("image", image.blob, "gurbani-post.jpg"); body.set("caption", caption); body.set("hashtags", hashtags);
        let outcome: Outcome;
        try {
          const response = await fetch("/api/social/publish", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body });
          const data = await response.json() as Outcome;
          outcome = response.ok && data.id ? data : { error: data.error ?? "Publishing failed. Check your account before retrying.", uncertain: data.uncertain ?? (response.status >= 500) };
        } catch { outcome = { error: "Connection interrupted. Check your account before retrying to avoid a duplicate.", uncertain: true }; }
        setResults(previous => ({ ...previous, [platform]: outcome }));
      }
    } finally { setKey(""); setBusy(false); inFlight.current = false; }
  }

  return <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
    <section className="space-y-6 rounded-2xl border border-white/10 bg-[#10121b] p-5 sm:p-7" aria-label="Post composer">
      <label className="block text-sm font-medium">1. Your Gurbani image
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={locked || preparing} onChange={event => void choose(event.target.files?.[0])} className={inputClass} />
      </label>
      <p className="-mt-3 text-xs leading-5 text-zinc-500">JPG, PNG or WebP · up to 20 MB. Prepared as a JPEG for publishing. Your full artwork stays visible.</p>
      <label className="block text-sm font-medium">2. Caption
        <textarea rows={6} value={caption} disabled={locked} onChange={event => { setCaption(event.target.value); setReview(false); }} placeholder="Write your message or Gurbani explanation…" className={inputClass} />
      </label>
      <label className="block text-sm font-medium">Hashtags
        <textarea rows={2} value={hashtags} disabled={locked} onChange={event => { setHashtags(event.target.value); setReview(false); }} className={inputClass} />
      </label>
      <p className="-mt-3 text-xs text-zinc-500">Separate hashtags with spaces or commas. {Array.from(finalCaption || caption).length.toLocaleString()} / 2,200 characters including hashtags.</p>
      <fieldset disabled={locked} className="space-y-3"><legend className="mb-3 text-sm font-medium">3. Publish to</legend>
        {(["facebook", "instagram"] as Platform[]).map(platform => <label key={platform} className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm">
          <input type="checkbox" checked={targets[platform]} onChange={event => { setTargets(previous => ({ ...previous, [platform]: event.target.checked })); setReview(false); }} className="accent-amber-400" />
          {platform === "facebook" ? "Facebook · Connected Sikhizm Page" : "Instagram · @sikhizmcom"}
        </label>)}
      </fieldset>
      <label className="block text-sm font-medium">Social setup key
        <input type="password" autoComplete="off" maxLength={512} value={key} disabled={busy} onChange={event => setKey(event.target.value)} className={inputClass} />
      </label>
      <p className="-mt-3 text-xs text-zinc-500">Use the same setup key as the connection checker. It is cleared after publishing.</p>
      <label className="flex items-start gap-3 text-sm leading-5"><input type="checkbox" className="mt-1 accent-amber-400" checked={review} disabled={busy} onChange={event => setReview(event.target.checked)} />I have reviewed the image, caption and selected accounts. Publish this post publicly.</label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {captionError && <p className="text-xs text-amber-200">{captionError}</p>}
      <button onClick={() => void publish()} disabled={busy || preparing || !image || !review || !key || !!captionError || !Object.entries(targets).some(([platform, enabled]) => enabled && !results[platform as Platform]?.id && !results[platform as Platform]?.uncertain)} className="w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-zinc-950 disabled:opacity-40">{busy ? "Publishing… Please keep this page open" : Object.keys(results).length ? "Publish remaining accounts" : "Publish image post"}</button>
      <div aria-live="polite" className="space-y-3">{(["facebook", "instagram"] as Platform[]).map(platform => results[platform] && <div key={platform} className="rounded-xl border border-white/10 p-4 text-sm"><p className="mb-1 font-semibold capitalize">{platform}</p>{results[platform]?.id ? <a className="text-emerald-300 underline" href={results[platform]?.url} target="_blank" rel="noopener noreferrer">Published · View post ↗</a> : <p className="text-amber-200">{results[platform]?.error}</p>}{results[platform]?.uncertain && <p className="mt-2 text-xs text-zinc-400">Retry is paused because this post may already exist. Check the account before starting a new post.</p>}</div>)}</div>
      {Object.keys(results).length > 0 && <button disabled={busy} onClick={() => { setResults({}); setReview(false); setKey(""); setError(""); }} className="text-sm text-amber-300 underline">Start a new post (check any unconfirmed results first)</button>}
      <p className="text-xs leading-5 text-zinc-500">Posts are sent only when you press Publish. For Instagram, the image is first uploaded to Facebook as unpublished media. Automatic posting and reels will be added separately.</p>
    </section>
    <section className="lg:sticky lg:top-8 lg:self-start" aria-label="Post preview">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#10121b]">
        <div className="flex items-center gap-3 border-b border-white/10 p-4"><span className="grid h-9 w-9 place-items-center rounded-full bg-amber-400 text-sm font-bold text-zinc-950">ਸਿ</span><div><p className="text-sm font-semibold text-white">Sikhizm</p><p className="text-xs text-zinc-500">Image post preview</p></div></div>
        {image ? <Image src={image.preview} unoptimized width={image.width} height={image.height} alt="Your complete prepared Gurbani artwork" className="max-h-[650px] w-full object-contain" /> : <div className="grid min-h-80 place-items-center p-10 text-center text-sm text-zinc-500">{preparing ? "Preparing your image…" : "Choose an image to see your post here"}</div>}
        <p className="whitespace-pre-wrap break-words p-5 text-sm leading-6">{finalCaption || "Your caption and hashtags will appear here."}</p>
      </div>
      {image && <p className="mt-3 text-xs leading-5 text-zinc-500">{image.width} × {image.height} · {Math.round(image.blob.size / 1024)} KB{image.padded ? " · Padding added to fit the feed without cropping." : " · Original proportions preserved."}</p>}
    </section>
  </div>;
}
