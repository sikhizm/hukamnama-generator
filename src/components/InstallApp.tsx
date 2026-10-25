"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallApp() {
  const dialog = useRef<HTMLDialogElement>(null);
  const prompt = useRef<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const sync = () => setInstalled(display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const ready = (event: Event) => { event.preventDefault(); prompt.current = event as InstallEvent; };
    const complete = () => { prompt.current = null; setInstalled(true); setHelp(false); };
    queueMicrotask(sync);
    display.addEventListener("change", sync);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", complete);
    return () => {
      display.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  useEffect(() => {
    if (help && !installed) dialog.current?.showModal();
    else dialog.current?.close();
  }, [help, installed]);

  async function install() {
    if (!prompt.current) { setHelp(true); return; }
    const event = prompt.current;
    prompt.current = null;
    setBusy(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch { setHelp(true); }
    finally { setBusy(false); }
  }

  if (installed) return null;
  return <>
    <button type="button" disabled={busy} onClick={() => void install()} className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/10 px-2.5 py-2 text-xs font-semibold text-amber-200 disabled:opacity-50"><Download size={14} />{busy ? "Installing…" : "Install app"}</button>
    <dialog ref={dialog} onCancel={() => setHelp(false)} onClose={() => setHelp(false)} aria-labelledby="install-title" className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-amber-300/30 bg-zinc-950 p-5 text-sm text-zinc-200 shadow-2xl backdrop:bg-black/70">
        <div className="mb-4 flex items-center justify-between"><h2 id="install-title" className="text-lg font-semibold text-amber-200">Install Hukamnama Studio</h2><button autoFocus type="button" aria-label="Close install instructions" onClick={() => setHelp(false)} className="rounded-lg border border-white/20 p-2"><X size={18} /></button></div>
        <p className="mb-3">Chrome / Edge: open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. On desktop, also look for the install icon beside the address bar.</p>
        <p className="mb-3">iPhone / iPad: open this site in Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</p>
        <p className="text-xs leading-5 text-zinc-400">If installation is not offered, try your main browser instead of an in-app browser. Publishing requires an internet connection and the app open and awake.</p>
    </dialog>
  </>;
}
