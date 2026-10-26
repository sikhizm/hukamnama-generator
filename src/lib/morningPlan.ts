import { captionContent } from "./hukamnama/loadedContent";
import { hukamnamaExcerpt } from "./hukamnama/excerpt";
import { publishedSgpcDate } from "./hukamnama/sgpcCalendar";
import { normalizeAuthor } from "./hukamnama/authors";
import type { StudioState } from "./hukamnama/types";
import type { LiveHukamnama } from "./hukamnama/liveSource";

export const DESTINATIONS = [
  { id: "facebook-image", label: "Facebook image · 1080 × 1350", selected: true },
  { id: "facebook-reel", label: "Facebook reel · 1080 × 1920", selected: true },
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
  const full = captionContent(state);
  const expected = state.fullOriginal && live ? hukamnamaExcerpt(live.original, live.translation) : null;
  const validExcerpt = !expected || (!expected.error && state.original === expected.original && state.translation === expected.translation);
  return { validLive, matchesLive: validLive && validExcerpt && state.dateISO === day && full.original === live.original && full.translation === live.translation && state.ang === live.ang && normalizeAuthor(state.banikar) === normalizeAuthor(live.matchedAuthor) && state.dateText === live.dateText };
}

/** Fail closed for unattended runs: today's complete source must have just been fetched. */
export function verifyFreshMorningState(state: StudioState, live: LiveHukamnama | null, now = new Date()) {
  const day = indiaClock(now).day;
  const base = verifyMorningState(state, live, day);
  const age = now.getTime() - Date.parse(live?.checkedAt ?? "");
  const fresh = Number.isFinite(age) && age >= -30_000 && age <= 120_000;
  const ang = live?.ang ?? "";
  const complete = !!live && /^\d{1,4}$/.test(ang) && Number(ang) >= 1 && Number(ang) <= 1430
    && !!normalizeAuthor(live.matchedAuthor) && !!live.translation.trim()
    && /[॥।]\s*[੦-੯0-9]+(?:\s*[॥।]\s*[੦-੯0-9]+)*\s*[॥।]\s*$/u.test(live.original);
  const calendar = publishedSgpcDate(day);
  const validCalendar = !!live && (calendar ? live.dateText === calendar : live.dateText.includes(" | ") && /[\u0A00-\u0A7F]/u.test(live.dateText));
  const validLive = Boolean(base.validLive && fresh && complete && validCalendar);
  return { validLive, matchesLive: Boolean(validLive && base.matchesLive) };
}

/** Retry requests never include confirmed successes; uncertain outcomes need an explicit per-item request. */
export function pendingDestinations(targets: MorningTargets, outcomes: Partial<Record<Destination, { status: string }>>, retry: Destination[] = []) {
  return DESTINATIONS.filter(item => retry.length
    ? retry.includes(item.id) && !!outcomes[item.id] && outcomes[item.id]?.status !== "sent"
    : targets[item.id] && !outcomes[item.id]);
}
