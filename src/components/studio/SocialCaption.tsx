"use client";

import { copyPngImage } from "@/lib/browserClipboard";
import { captionContent } from "@/lib/hukamnama/loadedContent";

import { useEffect, useRef, useState } from "react";
import { Clipboard, Link2, LoaderCircle, MessageCircle, Download, Image as ImageIcon } from "lucide-react";
import type { StudioState } from "@/lib/hukamnama/types";
import { buildSocialCaption } from "@/lib/hukamnama/socialCaption";
import MorningPublisher from "./MorningPublisher";
import type { LiveHukamnama } from "@/lib/hukamnama/liveSource";
import { indiaClock } from "@/lib/morningPlan";
import { hasTodaysSourceContent, millisecondsToIndiaMidnight } from "@/lib/hukamnama/shareFreshness";

import { linkContext, requestEvergreenLinks } from "@/lib/hukamnama/sikhizmLinks";
const LINKS_KEY = "hukamnama-social-links-v2";
interface LinkDraft { articleUrl: string; pdfUrl: string; context: string; manual: boolean }

interface SocialCaptionProps {
  autoTarget: HTMLElement | null;
  reelTarget: HTMLElement | null;
  state: StudioState;
  notify: (message: string) => void;
  sgpcDateISO: string | null;
  createImage: () => Promise<File | null>;
  disabled: boolean;
  pendingText: boolean;
  live: LiveHukamnama | null;
  onLoadLive: (record: LiveHukamnama) => void;
  createFormatImage: (format: "feed" | "vertical") => Promise<Blob | null>;
}

export default function SocialCaption({ autoTarget, reelTarget, state, notify, createImage, disabled, pendingText, live, onLoadLive, createFormatImage }: SocialCaptionProps) {
  const fullContent = captionContent(state);
  const context = linkContext(fullContent);
  const [links, setLinks] = useState<LinkDraft>({ articleUrl: "", pdfUrl: "", context: "", manual: false });
  const articleUrl = links.context === context ? links.articleUrl : "";
  const pdfUrl = links.context === context ? links.pdfUrl : "";
  const requestId = useRef(0);
  const [linkNotice, setLinkNotice] = useState("");
  const [linksLoaded, setLinksLoaded] = useState(false);
  const [findingLinks, setFindingLinks] = useState(false);
  const [clipboardActivity, setClipboardActivity] = useState<"image" | "text" | "download" | null>(null);
  const clipboardBusy = useRef(false);
  const [clipboardNotice, setClipboardNotice] = useState("");
  const [whatsappStep, setWhatsappStep] = useState<"image" | "text">("image");
  const [indiaDay, setIndiaDay] = useState<string | null>(null);
  const currentSourceAvailable = hasTodaysSourceContent(live, indiaDay);

  useEffect(() => {
    let timer: number;
    const refreshDay = () => {
      window.clearTimeout(timer);
      const now = new Date();
      setIndiaDay(indiaClock(now).day);
      timer = window.setTimeout(refreshDay, millisecondsToIndiaMidnight(now));
    };
    timer = window.setTimeout(refreshDay, 0);
    window.addEventListener("focus", refreshDay);
    window.addEventListener("pageshow", refreshDay);
    document.addEventListener("visibilitychange", refreshDay);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshDay);
      window.removeEventListener("pageshow", refreshDay);
      document.removeEventListener("visibilitychange", refreshDay);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(LINKS_KEY) ?? "null");
        if (!cancelled && saved && typeof saved.articleUrl === "string" && typeof saved.pdfUrl === "string" && typeof saved.context === "string") setLinks({ ...saved, manual: saved.manual === true });
      } catch { /* Start without links when saved data cannot be read. */ }
      finally { if (!cancelled) setLinksLoaded(true); }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (linksLoaded) try { localStorage.setItem(LINKS_KEY, JSON.stringify(links)); } catch { /* Session edits remain usable. */ }
  }, [links, linksLoaded]);

  useEffect(() => {
    if (!linksLoaded || links.context === context || !fullContent.original || !state.ang || !state.dateText) return;
    const controller = new AbortController(), id = ++requestId.current;
    Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setFindingLinks(true);
      setLinkNotice("Searching Sikhizm by Ang and Gurbani…");
      try {
        const result = await requestEvergreenLinks({ date: state.dateISO, ang: state.ang, original: fullContent.original }, controller.signal);
        if (id !== requestId.current || controller.signal.aborted) return;
        setLinks({ articleUrl: result.articleUrl || "", pdfUrl: result.pdfUrl || "", context, manual: false });
        setLinkNotice(result.message);
      } catch {
        if (id === requestId.current && !controller.signal.aborted) setLinkNotice("Sikhizm lookup was unavailable. No links will be included; retry or add them manually.");
      } finally { if (id === requestId.current && !controller.signal.aborted) setFindingLinks(false); }
    });
    return () => { controller.abort(); };
  }, [context, links.context, linksLoaded, state.dateISO, state.ang, fullContent.original, state.dateText]);

  function editLink(field: "articleUrl" | "pdfUrl", value: string) {
    requestId.current++;
    setFindingLinks(false);
    setLinkNotice("Manual links selected for this Hukamnama.");
    setLinks(previous => ({ ...(previous.context === context ? previous : { articleUrl: "", pdfUrl: "" }), [field]: value, context, manual: true }));
  }

  const caption = buildSocialCaption(state, articleUrl, pdfUrl);

  const findTodayLinks = async () => {
    const id = ++requestId.current;
    setFindingLinks(true);
    try {
      const result = await requestEvergreenLinks({ date: state.dateISO, ang: state.ang, original: fullContent.original });
      if (id !== requestId.current) return;
      setLinks({ articleUrl: result.articleUrl || "", pdfUrl: result.pdfUrl || "", context, manual: false });
      setLinkNotice(result.message);
      notify(result.message);
    } catch (caught) {
      if (id === requestId.current) { setLinks({ articleUrl: "", pdfUrl: "", context, manual: false }); setLinkNotice("Lookup failed. Links omitted; retry or enter them manually."); notify(caught instanceof Error ? caught.message : "Could not search Sikhizm articles."); }
    } finally { if (id === requestId.current) setFindingLinks(false); }
  };

  const clipboardAction = async (action: "image" | "text" | "download") => {
    if (disabled || clipboardBusy.current) return;
    clipboardBusy.current = true; setClipboardActivity(action);
    let message = "";
    try {
      if (action === "image") {
        await copyPngImage(createImage);
        setWhatsappStep("text");
        message = "Image copied. Paste it into your WhatsApp Channel or Group and send it before copying the text.";
      } else if (action === "text") {
        await navigator.clipboard.writeText(caption);
        setWhatsappStep("image");
        message = "Text template copied. Paste it into the same WhatsApp Channel or Group and send.";
      } else {
        const file = await createImage();
        if (!file) throw new Error("Could not render the current image. Please try again.");
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url; anchor.download = file.name; anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
        message = "Image downloaded. Attach it in your WhatsApp Channel or Group, then copy the text template.";
      }
    } catch (error) {
      message = action === "image"
        ? error instanceof Error && error.message.includes("Download Image") ? error.message : "Image could not be copied. Use Download Image, then attach it in WhatsApp."
        : action === "text" ? "Text could not be copied. Select and copy it from Caption preview below."
        : error instanceof Error ? error.message : "Image download failed. Please try again.";
    } finally {
      setClipboardNotice(message); notify(message);
      clipboardBusy.current = false; setClipboardActivity(null);
    }
  };

  return (
    <section className="border-b border-white/[0.07]">
      <a href="#hukamnama-publish" className="m-4 flex min-h-12 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-400/15 px-3 py-3 text-sm font-bold text-amber-200">Facebook · Reels · YouTube · Stories ↓</a>
      <div className="space-y-3 border-b border-emerald-400/20 bg-emerald-950/20 p-4">
        <h3 className="flex items-center gap-2 text-lg font-bold text-emerald-200"><MessageCircle size={24} /> Copy for WhatsApp</h3>
        <p className="text-xs leading-5 text-zinc-300">Copy the image, paste and send it in your Channel or Group, then copy and send the text.</p>
        <button type="button" aria-describedby="whatsapp-freshness" disabled={disabled || clipboardActivity !== null} onClick={() => clipboardAction("image")} className={`flex min-h-16 w-full items-center justify-center gap-3 rounded-xl px-4 py-4 text-base font-bold text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${currentSourceAvailable ? "bg-emerald-400 hover:bg-emerald-300 focus-visible:outline-emerald-200" : "bg-red-400 hover:bg-red-300 focus-visible:outline-red-200"}`}>
          {clipboardActivity === "image" ? <LoaderCircle size={24} className="animate-spin" /> : <ImageIcon size={24} />}
          {clipboardActivity === "image" ? "Copying image…" : "1 · Copy Image"}
        </button>
        <button type="button" aria-describedby="whatsapp-freshness" disabled={disabled || clipboardActivity !== null} onClick={() => clipboardAction("text")} className={`flex min-h-16 w-full items-center justify-center gap-3 rounded-xl border px-4 py-4 text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${currentSourceAvailable ? `border-emerald-300/50 focus-visible:outline-emerald-200 ${whatsappStep === "text" ? "bg-emerald-400 text-zinc-950" : "bg-emerald-950 text-emerald-100"}` : "border-red-300/60 bg-red-950 text-red-100 hover:bg-red-900 focus-visible:outline-red-200"}`}>
          <Clipboard size={24} /> {clipboardActivity === "text" ? "Copying text…" : "2 · Copy Text Template"}
        </button>
        <button type="button" disabled={disabled || clipboardActivity !== null} onClick={() => clipboardAction("download")} className="flex min-h-10 items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-zinc-200 disabled:opacity-40"><Download size={16} />{clipboardActivity === "download" ? "Preparing download…" : "Download Image"}</button>
        {clipboardNotice && <p role="status" aria-live="polite" className="text-xs leading-5 text-zinc-200">{clipboardNotice}</p>}
        <p id="whatsapp-freshness" role="status" className={`text-xs ${currentSourceAvailable ? "text-emerald-100" : "text-red-200"}`}>{!currentSourceAvailable ? "Waiting for today’s Hukamnama from the source check. Resets at midnight IST." : disabled ? "Today’s Hukamnama is available. Apply your edits and complete the image to unlock copying." : whatsappStep === "text" ? "Paste and send the copied image first, then copy the text template." : "Today’s Hukamnama is available. Ready: start with Copy Image."}</p>
        <p className="text-[11px] leading-5 text-zinc-400">Copying text replaces the clipboard image. Paste the image first. If image pasting is unavailable on your device, download and attach it instead.</p>
      </div>
      <div className="p-4">
        <MorningPublisher pendingText={pendingText} autoTarget={autoTarget} manualLinks={links.context === context && links.manual} reelTarget={reelTarget} state={state} caption={caption} articleUrl={articleUrl} pdfUrl={pdfUrl} live={live} onLoadLive={onLoadLive} createImage={createFormatImage} disabled={disabled} />
      </div>
      <details open>
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-200 marker:hidden">
        Social caption &amp; sharing
        <span className="ml-2 text-[10px] font-normal text-zinc-500">caption, article link, PDF link</span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <label className="block text-[10px] font-medium text-zinc-400">
          Matching Hukamnama article URL
          <input value={articleUrl} onChange={(event) => editLink("articleUrl", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-zinc-200 outline-none focus:border-amber-300/50" />
        </label>
        <button type="button" disabled={findingLinks || !state.original || !state.ang} onClick={() => void findTodayLinks()} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[10px] font-semibold text-zinc-300 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40">
          {findingLinks ? <LoaderCircle size={12} className="animate-spin" /> : <Link2 size={12} />}
          {findingLinks ? "Finding today’s links…" : "Find matching Sikhizm article & PDF"}
        </button>
        {linkNotice && <p role="status" className="text-[11px] leading-5 text-zinc-400">{linkNotice}</p>}
        <label className="block text-[10px] font-medium text-zinc-400">
          PDF download URL
          <input value={pdfUrl} onChange={(event) => editLink("pdfUrl", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-zinc-200 outline-none focus:border-amber-300/50" />
        </label>
        <label className="block text-[10px] font-medium text-zinc-400">
          Caption preview · {caption.length.toLocaleString()} characters
          <textarea readOnly value={caption} rows={10} className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 font-pa text-xs leading-relaxed text-zinc-300 outline-none" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={disabled || clipboardActivity !== null} onClick={() => clipboardAction("text")} className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-2 py-2.5 text-[11px] font-bold text-zinc-950 hover:bg-amber-300">
            <Clipboard size={13} /> Copy text template
          </button>
        </div>
        <p className="text-[10px] leading-relaxed text-zinc-500">
          Download the image separately, then use Copy text template and paste it as the next message or post. The image and text stay separate, as in your current workflow.
        </p>
      </div>
      </details>

    </section>
  );
}
