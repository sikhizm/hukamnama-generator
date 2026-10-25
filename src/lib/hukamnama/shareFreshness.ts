import type { LiveHukamnama } from "./liveSource";
import { indiaClock } from "../morningPlan";

/** Source availability indicator only; manual editor changes do not affect it. */
export function hasTodaysSourceContent(live: LiveHukamnama | null, day: string | null): boolean {
  return !!day && !!live && live.isToday && live.sourceDateISO === day;
}

export function millisecondsToIndiaMidnight(now = new Date()): number {
  const midnight = Date.parse(`${indiaClock(now).day}T00:00:00Z`) + 86_400_000 - 19_800_000;
  return Math.max(1, midnight - now.getTime());
}
