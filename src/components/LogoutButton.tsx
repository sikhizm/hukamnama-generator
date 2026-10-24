"use client";
import { useState } from "react";
export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return <button disabled={busy} onClick={async () => { setBusy(true); try { const result = await fetch("/api/auth/logout", { method: "POST" }); if (result.ok) window.location.assign("/login"); } finally { setBusy(false); } }} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400">{busy ? "Signing out…" : "Sign out"}</button>;
}
