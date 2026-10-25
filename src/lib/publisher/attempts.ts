import type { Draft, Outcome, Platform, PostKind } from "./model";
const LEDGER_KEY = "sikhizm-social-publisher-attempts-v2";
export function readLedger(): Record<string, { time: number; outcome: Outcome }> { return JSON.parse(localStorage.getItem(LEDGER_KEY) ?? "{}"); }
export function writeLedger(key: string, outcome: Outcome) {
  const ledger = readLedger(); ledger[key] = { time: Date.now(), outcome };
  // Keep a bounded history, retaining recent attempts across reloads and browser tabs.
  const entries = Object.entries(ledger).sort((a, b) => b[1].time - a[1].time).slice(0, 200);
  localStorage.setItem(LEDGER_KEY, JSON.stringify(Object.fromEntries(entries)));
}
export async function attemptKey(platform: Platform, kind: PostKind, draft: Draft, file: Blob | null, accountId: string) {
  const mediaHash = file ? [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))].map(b => b.toString(16).padStart(2, "0")).join("") : "";
  const bytes = new TextEncoder().encode(JSON.stringify({ platform, kind, draft, mediaHash, accountId }));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function clearAttempt(key: string) {
  const ledger = readLedger(); delete ledger[key]; localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
}
