"use client";

import { useEffect, useState } from "react";
import { Clipboard, Share2 } from "lucide-react";
import type { StudioState } from "@/lib/hukamnama/types";
import { buildSocialCaption, DEFAULT_ARTICLE_URL, DEFAULT_PDF_URL } from "@/lib/hukamnama/socialCaption";

const LINKS_KEY = "hukamnama-social-links-v1";

interface SocialCaptionProps {
  state: StudioState;
  onShare: (caption: string) => void;
  notify: (message: string) => void;
  disabled: boolean;
}

export default function SocialCaption({ state, onShare, notify, disabled }: SocialCaptionProps) {
  const [articleUrl, setArticleUrl] = useState(DEFAULT_ARTICLE_URL);
  const [pdfUrl, setPdfUrl] = useState(DEFAULT_PDF_URL);
  const [linksLoaded, setLinksLoaded] = useState(false);

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
        <label className="block text-[10px] font-medium text-zinc-400">
          PDF download URL
          <input value={pdfUrl} onChange={(event) => setPdfUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-zinc-200 outline-none focus:border-amber-300/50" />
        </label>
        <label className="block text-[10px] font-medium text-zinc-400">
          Caption preview · {caption.length.toLocaleString()} characters
          <textarea readOnly value={caption} rows={10} className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 font-pa text-xs leading-relaxed text-zinc-300 outline-none" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void copyCaption()} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2.5 text-[11px] font-semibold text-zinc-200 hover:bg-white/[0.08]">
            <Clipboard size={13} /> Copy caption
          </button>
          <button type="button" disabled={disabled} onClick={() => onShare(caption)} className="flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-2 py-2.5 text-[11px] font-bold text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40">
            <Share2 size={13} /> Share image + text
          </button>
        </div>
        <p className="text-[10px] leading-relaxed text-zinc-500">
          The phone’s share sheet may pass both items together. If the selected app drops the text, use Copy caption and paste it into that post’s caption or description. WhatsApp channel/group and social app final-send controls remain in their own apps.
        </p>
      </div>
    </details>
  );
}
