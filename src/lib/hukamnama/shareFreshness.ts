import type { LiveHukamnama } from "./liveSource";
import type { StudioState } from "./types";
import { indiaClock, verifyMorningState } from "../morningPlan";

/** A fetched date alone is insufficient: the editor must contain that SGPC text. */
export function hasTodaysSgpcContent(state: StudioState, live: LiveHukamnama | null, day: string | null): boolean {
  return !!day && !!live && live.sourceName.startsWith("SGPC ")
    && verifyMorningState(state, live, day).matchesLive === true;
}

export function millisecondsToIndiaMidnight(now = new Date()): number {
  const midnight = Date.parse(`${indiaClock(now).day}T00:00:00Z`) + 86_400_000 - 19_800_000;
  return Math.max(1, midnight - now.getTime());
}
