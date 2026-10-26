import type { Destination } from "../morningPlan";
import type { StudioState } from "./types";
import { buildSocialCaption, DEFAULT_HASHTAGS } from "./socialCaption";

type CaptionState = Pick<StudioState, "dateText" | "original" | "translation">;

/** Use the applied excerpt shown in the editors, including its introduction. */
export function buildMorningCaption(target: Destination, state: CaptionState, articleUrl: string, pdfUrl: string): string {
  const applied = { dateText: state.dateText, original: state.original, translation: state.translation };
  if (target.endsWith("story")) return "";
  if (target === "facebook-reel") {
    const heading = buildSocialCaption(applied, "", "").split("\n----\n")[0];
    return `${heading}\n----\n${DEFAULT_HASHTAGS}`;
  }
  return buildSocialCaption(applied, target === "instagram-reel" ? "" : articleUrl, target === "instagram-reel" ? "" : pdfUrl);
}

export function youtubeHukamnamaTitle(dateISO: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new Error("Choose a valid Hukamnama date for the YouTube title.");
  const date = new Date(`${dateISO}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateISO) throw new Error("Choose a valid Hukamnama date for the YouTube title.");
  const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(date).toUpperCase();
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(date).toUpperCase();
  return `TODAY's HUKAMNAMA SRI DARBAR SAHIB AMRITSAR ${dateISO.slice(8)}-${month}-${dateISO.slice(0, 4)} ${weekday}`;
}
