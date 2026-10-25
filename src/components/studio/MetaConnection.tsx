"use client";

import { useState } from "react";

interface Result {
  facebook?: { name: string; id: string; connected: boolean };
  instagram?: { username: string | null; connected: boolean };
  message?: string;
  error?: string;
}

export default function MetaConnection() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function check() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/social/connection", {
        method: "POST",
        cache: "no-store",
      });
      const data = await response.json() as Result;
      setResult(response.ok ? data : { error: data.error ?? "Connection check failed." });
    } catch {
      setResult({ error: "Could not reach the connection check. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="border-b border-white/[0.07]">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-200">Facebook &amp; Instagram · Step 1</summary>
      <div className="space-y-3 px-4 pb-4 text-xs text-zinc-400">
        <p>Connect your Sikhizm accounts first. This step checks the account connection only and does not publish anything.</p>
        <p>Facebook: <a href="https://facebook.com/sikhizmcom" target="_blank" rel="noopener noreferrer" className="text-amber-300">sikhizmcom</a><br />Instagram: <a href="https://instagram.com/sikhizmcom" target="_blank" rel="noopener noreferrer" className="text-amber-300">@sikhizmcom</a></p>
        <form onSubmit={(event) => { event.preventDefault(); void check(); }} className="space-y-2">
          <p className="text-[10px]">Your signed-in session authorizes this check.</p>
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-amber-400 px-3 py-2 font-bold text-zinc-950 disabled:opacity-40">{busy ? "Checking accounts…" : "Check account connection"}</button>
        </form>
        {result && <div role="status" aria-live="polite" className="space-y-2 rounded-lg border border-white/10 p-3">
          {result.error ? <p className="text-amber-200">{result.error}</p> : <>
            <p>Facebook: {result.facebook?.name} · Page ID {result.facebook?.id} · Verified</p>
            <p>Instagram: {result.instagram?.connected ? "@sikhizmcom · Verified" : "Not connected to the expected account"}</p>
            <p>{result.message}</p>
          </>}
        </div>}
        <p className="text-[10px]">Create a separate image and caption in <a href="/posts" className="text-amber-300 underline">Social Publisher</a>. Automatic posting is not enabled.</p>
      </div>
    </details>
  );
}
