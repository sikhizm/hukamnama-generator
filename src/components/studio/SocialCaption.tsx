"use client";

import { useEffect, useState } from "react";
import { Clipboard, Link2, LoaderCircle, MessageCircle, Send } from "lucide-react";
import type { StudioState } from "@/lib/hukamnama/types";
import { buildSocialCaption, DEFAULT_ARTICLE_URL, DEFAULT_PDF_URL } from "@/lib/hukamnama/socialCaption";

const LINKS_KEY = "hukamnama-social-links-v1";

interface SocialCaptionProps {
  state: StudioState;
  notify: (message: string) => void;
  sgpcDateISO: string | null;
  createImage: () => Promise<File | null>;
  disabled: boolean;
}

export default function SocialCaption({ state, notify, sgpcDateISO, createImage, disabled }: SocialCaptionProps) {
  const [articleUrl, setArticleUrl] = useState(DEFAULT_ARTICLE_URL);
  const [pdfUrl, setPdfUrl] = useState(DEFAULT_PDF_URL);
  const [linksLoaded, setLinksLoaded] = useState(false);
  const [findingLinks, setFindingLinks] = useState(false);
  const [sharingImage, setSharingImage] = useState(false);
  const [whatsappStep, setWhatsappStep] = useState<"image" | "text">("image");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LINKS_KEY);
      if (!saved) return;
      const links = JSON.parse(saved) as { articleUrl?: string; pdfUrl?: string };
      if (typeof links.articleUrl === "string") setArticleUrl(links.articleUrl);
      if (typeof links.pdfUrl === "string") setPdfUrl(links.pdfUrl);
    } catch {
      // Keep the editable defaults if storage is unavailable or malformed.
    } finally {
      setLinksLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!linksLoaded) return;
    try {
      localStorage.setItem(LINKS_KEY, JSON.stringify({ articleUrl, pdfUrl }));
    } catch {
      // Link edits remain usable for this session if storage is unavailable.
    }
  }, [articleUrl, pdfUrl, linksLoaded]);

  const caption = buildSocialCaption(state, articleUrl, pdfUrl);

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      notify("Full caption copied. Paste it into the platform’s caption or description field.");
    } catch {
      notify("Clipboard access is unavailable. Select and copy the caption text below.");
    }
  };

  const findTodayLinks = async () => {
    if (!sgpcDateISO) {
      notify("First wait for SGPC to confirm today’s Hukamnama at the top of the app.");
      return;
    }
    setFindingLinks(true);
    try {
      const response = await fetch(`/api/hukamnama/sikhizm-links?date=${encodeURIComponent(sgpcDateISO)}`, { cache: "no-store" });
      const result = await response.json() as { found?: boolean; articleUrl?: string; pdfUrl?: string | null; message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not look up today’s Sikhizm links.");
      if (!result.found || !result.articleUrl) {
        notify(result.message ?? "No matching Sikhizm post found. Your saved links were left unchanged.");
        return;
      }
      setArticleUrl(result.articleUrl);
      if (result.pdfUrl) setPdfUrl(result.pdfUrl);
      notify(result.message ?? "Updated today’s Sikhizm article and PDF links.");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Could not look up today’s Sikhizm links.");
    } finally {
      setFindingLinks(false);
    }
  };

  const shareImageFirst = async () => {
    setSharingImage(true);
    try {
      const file = await createImage();
      if (!file) throw new Error("Could not render the current image. Please try again.");
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Daily Hukamnama" });
      } else {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
        notify("Image downloaded. Send that image in your WhatsApp channel or group first, then return here for the text.");
      }
      setWhatsappStep("text");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        notify("Image sharing was cancelled. You can try again when ready.");
      } else {
        notify(caught instanceof Error ? caught.message : "Could not prepare the image for WhatsApp.");
      }
    } finally {
      setSharingImage(false);
    }
  };

  const shareTextNext = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: caption });
      } else {
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(caption)}`;
        const anchor = document.createElement("a");
        anchor.href = whatsappUrl;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.click();
      }
      setWhatsappStep("image");
      notify("WhatsApp text share opened. Choose the same channel or group and tap Send.");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        notify("Text sharing was cancelled. The text step is ready to try again.");
      } else {
        notify("Could not open the share sheet. Use Copy text template instead.");
      }
    }
  };

  return (
    <details className="border-b border-white/[0.07]">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-200 marker:hidden">
        Social caption &amp; sharing
        <span className="ml-2 text-[10px] font-normal text-zinc-500">caption, article link, PDF link</span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <label className="block text-[10px] font-medium text-zinc-400">
          Daily Hukamnama article URL
          <input value={articleUrl} onChange={(event) => setArticleUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-zinc-200 outline-none focus:border-amber-300/50" />
        </label>
        <button type="button" disabled={findingLinks || !sgpcDateISO} onClick={() => void findTodayLinks()} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[10px] font-semibold text-zinc-300 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40">
          {findingLinks ? <LoaderCircle size={12} className="animate-spin" /> : <Link2 size={12} />}
          {findingLinks ? "Finding today’s links…" : "Find today’s Sikhizm links"}
        </button>
        <label className="block text-[10px] font-medium text-zinc-400">
          PDF download URL
          <input value={pdfUrl} onChange={(event) => setPdfUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-zinc-200 outline-none focus:border-amber-300/50" />
        </label>
        <div className="space-y-2 rounded-xl border border-emerald-400/15 bg-emerald-950/10 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200">WhatsApp · image, then text</p>
          {whatsappStep === "image" ? (
            <button type="button" disabled={disabled || sharingImage} onClick={() => void shareImageFirst()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 py-2.5 text-[11px] font-bold text-zinc-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
              {sharingImage ? <LoaderCircle size={13} className="animate-spin" /> : <MessageCircle size={13} />}
              {sharingImage ? "Preparing image…" : "1 · Share image on WhatsApp"}
            </button>
          ) : (
            <button type="button" onClick={() => void shareTextNext()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 py-2.5 text-[11px] font-bold text-zinc-950 hover:bg-emerald-300">
              <Send size={13} /> 2 · Share text template next
            </button>
          )}
          <p className="text-[10px] leading-relaxed text-zinc-500">
            Send the image first, then return and share the text as a second message. Choose your channel or group and tap Send in WhatsApp; the app cannot send either post for you. If file sharing is unavailable, the image downloads so you can attach it manually.
          </p>
        </div>
        <label className="block text-[10px] font-medium text-zinc-400">
          Caption preview · {caption.length.toLocaleString()} characters
          <textarea readOnly value={caption} rows={10} className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 font-pa text-xs leading-relaxed text-zinc-300 outline-none" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void copyCaption()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-2 py-2.5 text-[11px] font-bold text-zinc-950 hover:bg-amber-300">
            <Clipboard size={13} /> Copy text template
          </button>
        </div>
        <p className="text-[10px] leading-relaxed text-zinc-500">
          Download the image separately, then use Copy text template and paste it as the next message or post. The image and text stay separate, as in your current workflow.
        </p>
      </div>
    </details>
  );
}
