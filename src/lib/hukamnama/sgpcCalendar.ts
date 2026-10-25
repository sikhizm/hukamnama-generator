import { formatSgpcCalendarDate } from "./sgpcDate";

/** Month starts transcribed from SGPC's published Samvat 558 calendar, pages 1–3.
 * https://sgpc.net/wp-content/uploads/2026/03/Calender_2026.pdf
 * Valid only for this published year; never extrapolate into another year.
 */
export const SGPC_558_MONTHS = [
  ["2026-03-14", "Chet"], ["2026-04-14", "Vaisakh"], ["2026-05-15", "Jeth"],
  ["2026-06-15", "Harh"], ["2026-07-16", "Sawan"], ["2026-08-17", "Bhadon"],
  ["2026-09-17", "Assu"], ["2026-10-17", "Katak"], ["2026-11-16", "Maghar"],
  ["2026-12-16", "Poh"], ["2027-01-14", "Magh"], ["2027-02-13", "Phagun"],
] as const;

/** Exact lookup within the published year, independent of daily-page availability. */
export function publishedSgpcDate(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < "2026-03-14" || iso >= "2027-03-15") return null;
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  const start = SGPC_558_MONTHS.filter(([day]) => day <= iso).at(-1);
  if (!start) return null;
  const day = Math.round((date.getTime() - Date.parse(`${start[0]}T00:00:00Z`)) / 86400000) + 1;
  const weekday = date.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" });
  return formatSgpcCalendarDate(`${weekday}, ${day} ${start[1]} (Samvat 558 Nanakshahi)`, iso);
}

/** Upgrade only the former Gregorian-only fallback, preserving custom date text. */
export function upgradeGregorianDate(text: string, iso: string): string {
  const published = publishedSgpcDate(iso);
  if (!published) return text;
  const [gregorian, , weekday] = published.split(" | ");
  const englishDay = weekday.match(/\(([^)]+)\)/)?.[1];
  return text.trim() === `${gregorian} | ${englishDay}` || text.trim() === iso ? published : text;
}
