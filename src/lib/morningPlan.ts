import { normalizeAuthor } from "./hukamnama/authors";
import type { StudioState } from "./hukamnama/types";
import type { LiveHukamnama } from "./hukamnama/liveSource";

export const DESTINATIONS = [
  { id: "facebook-image", label: "Facebook image · 1080 × 1350", selected: true },
  { id: "instagram-image", label: "Instagram image · 1080 × 1350", selected: false },
  { id: "facebook-reel", label: "Facebook reel · 1080 × 1920", selected: false },
  { id: "instagram-reel", label: "Instagram reel · 1080 × 1920", selected: true },
  { id: "youtube-reel", label: "YouTube Short · 1080 × 1920", selected: true },
  { id: "facebook-story", label: "Facebook story · 1080 × 1920", selected: true },
  { id: "instagram-story", label: "Instagram story · 1080 × 1920", selected: true },
] as const;
export type Destination = typeof DESTINATIONS[number]["id"];
export type MorningTargets = Record<Destination, boolean>;
export const defaultTargets = Object.fromEntries(DESTINATIONS.map(item => [item.id, item.selected])) as MorningTargets;
export const SHORT_TEMPLATE = "🪯 ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਹਿ 🪯\n🌸 ਅੱਜ ਦਾ ਹੁਕਮਨਾਮਾ, ਸ਼੍ਰੀ ਦਰਬਾਰ ਸਾਹਿਬ 🌸\n🗓️ {date}\n\nRead the complete Hukamnama and translations:\n{articleUrl}\n\nPDF: {pdfUrl}\n\n#Hukamnama #Gurbani #Waheguru #Sikhizm";
export function indiaClock(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map(part => [part.type, part.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}
export function inMorningWindow(time: string, now = new Date()) {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  const [hour, minute] = time.split(":").map(Number);
  const start = hour * 60 + minute;
  return hour >= 4 && hour <= 10 && minute < 60 && start <= 630 && indiaClock(now).minutes >= start && indiaClock(now).minutes <= 630;
}
export function expandTemplate(template: string, fields: Record<string, string>) {
  const lines: string[] = [];
  for (const line of template.split("\n")) {
    const missing = ["articleUrl", "pdfUrl"].filter(key => !fields[key]?.trim() && line.includes(`{${key}}`));
    if (missing.length && !/\{(?:date|original|translation)\}/.test(line)) {
      if (line.trim() === "{articleUrl}" && /(?:read|article|translation|hukamnama).*:\s*$/i.test(lines.at(-1) ?? "")) lines.pop();
      continue;
    }
    lines.push(line);
  }
  return lines.join("\n").replace(/\{(date|original|translation|articleUrl|pdfUrl)\}/g, (_, key: string) => fields[key] ?? "").replace(/\n{3,}/g, "\n\n").trim();
}
export function needsReel(targets: MorningTargets) { return targets["facebook-reel"] || targets["instagram-reel"] || targets["youtube-reel"]; }
export function verifyMorningState(state: StudioState, live: LiveHukamnama | null, day: string) {
  const validLive = live?.sourceDateISO === day && live.isToday && live.metadataMatched && !!live.original && !!live.translation && !!live.dateText && !!live.matchedAuthor;
  return { validLive, matchesLive: validLive && state.dateISO === day && state.original === live.original && state.translation === live.translation && state.ang === live.ang && normalizeAuthor(state.banikar) === normalizeAuthor(live.matchedAuthor) && state.dateText === live.dateText };
}
