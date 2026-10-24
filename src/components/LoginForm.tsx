"use client";
import { useState } from "react";

export default function LoginForm() {
  const [username, setUsername] = useState(""), [password, setPassword] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <form className="mt-6 space-y-4" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Sign-in failed.");
      window.location.assign("/");
    } catch (caught) { setError((caught as Error).message); setPassword(""); }
    finally { setBusy(false); }
  }}>
    <label className="block text-sm">Username<input required autoComplete="username" maxLength={200} value={username} disabled={busy} onChange={event => setUsername(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2" /></label>
    <label className="block text-sm">Password<input required type="password" autoComplete="current-password" maxLength={512} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2" /></label>
    {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
    <button disabled={busy} className="w-full rounded-lg bg-amber-400 px-3 py-3 font-semibold text-zinc-950 disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
  </form>;
}
